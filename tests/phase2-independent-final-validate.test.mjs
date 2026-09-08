import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateFinalMatrix, fixedSchedule, CAPS, EXPECTED } from '../scripts/phase2-independent-final-validate.mjs';
import { TUNING } from '../tuning.ts';

// Tiny synthetic numbers only; these expected statistics do not use validator helpers.
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = value => sha(JSON.stringify(value));
const statistics = values => {
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
  return { count: n, min: sorted[0], p50: sorted[Math.ceil(n / 2) - 1], p95: sorted[Math.ceil(n * 95 / 100) - 1],
    p99: sorted[Math.ceil(n * 99 / 100) - 1], max: sorted.at(-1), mean: values.reduce((a, b) => a + b, 0) / n };
};
const counts = rows => ({ trajectories: rows.length, crossingTrajectories: rows.filter(r => r.scene === 'crossing').length,
  complete: rows.filter(r => r.ending === 'complete').length, failed: rows.filter(r => r.ending === 'failed').length,
  fixtureRecovered: rows.filter(r => r.ending === 'fixture-recovered').length, censored: rows.filter(r => r.ending === 'censored').length,
  errors: 0, incompleteEvidence: 0, executedTicks: rows.reduce((s, r) => s + r.ticks, 0), stepAttempts: rows.reduce((s, r) => s + r.stepAttempts, 0) });

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'belay-final-validator-synthetic-'));
  const put = (name, value) => writeFile(path.join(root, name), JSON.stringify(value) + '\n');
  const get = async name => JSON.parse(await readFile(path.join(root, name), 'utf8'));
  const config = structuredClone(TUNING);
  config.phase2Evidence.crossingSeconds = 0.1; config.phase2Evidence.rescueSeconds = 0.1;
  const schedule = Array.from({ length: 10 }, (_, ordinal) => ({ ordinal, seed: 1701, playerCount: ordinal % 5 + 2,
    scene: ordinal < 5 ? 'crossing' : 'rescue', policy: 'recovery', family: 'balanced', tickHz: 30, horizonSeconds: 0.1 }));
  const files = [];
  for (const name of ['scripts/phase2-parallel-entry.mjs', 'scripts/phase2-parallel-worker-entry.mjs', 'tuning.ts']) {
    const destination = path.join(root, 'source', name), content = `// synthetic source ${name}\n`;
    await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, content); await chmod(destination, 0o444);
    files.push({ path: name, sha256: sha(content) });
  }
  const runtime = { entrypoint: '/synthetic/phase2-parallel-entry.mjs', entrypointSha256: files[0].sha256,
    nodeOptionsSha256: sha(''), assets: [{ role: 'node', path: '/synthetic/node', sha256: sha('synthetic executable identity') }] };
  const source = { files, sourceManifestSha256: digest(files), runtime, tuning: config, familyDefinitions: { balanced: {} }, machine: { node: 'v26.5.0' } };
  const expected = { source: digest(files), schedule: digest(schedule), runtime: digest({ assets: runtime.assets.map(({ role, sha256 }) => ({ role, sha256 })),
    nodeOptionsSha256: runtime.nodeOptionsSha256, node: source.machine.node }) };
  const assignments = [schedule.slice(0, 3), schedule.slice(3, 6), schedule.slice(6, 9), schedule.slice(9)];
  const limits = { workers: 4, maximumMetadataBytes: CAPS.metadata, maximumFinalReportBytes: CAPS.final,
    recordBytesPerWorker: CAPS.records / 4, maximumSourceBytes: CAPS.records, timingChunkSamples: CAPS.chunkSamples };
  const plan = { schema: 'phase2-parallel-1', schedule, scheduleSha256: expected.schedule, assignments, assignmentHashes: assignments.map(digest),
    maximumSamples: 30, maximumTimingFileBytes: 240, maximumLiveTimingBytes: (60 + 18 + 9 + CAPS.chunkSamples * 2) * 8, limits };
  const samples = [], records = schedule.map(spec => {
    const ending = spec.ordinal === 0 ? 'complete' : spec.ordinal === 1 ? 'failed' : spec.ordinal === 5 ? 'fixture-recovered' : 'censored';
    const ticks = ending === 'censored' ? 3 : ending === 'failed' ? 2 : 1;
    const raw = Array.from({ length: ticks }, (_, j) => spec.ordinal * 10 + j + 1); samples.push(raw);
    return { ...spec, ticks, stepAttempts: ticks, observedSeconds: ticks / 30, ending,
      runStatus: ending === 'complete' ? 'complete' : ending === 'failed' ? 'failed' : 'active',
      evidenceComplete: true, error: null, episodes: ending === 'fixture-recovered' ? [{ status: 'recovered' }] : [],
      finalStateSha256: sha('synthetic state'), policyInputsSha256: sha('synthetic inputs'), stepExecutionMs: statistics(raw) };
  });
  const teardown = [], published = [], controllerPid = 0x7ffffffe;
  for (let index = 0; index < 4; index++) {
    const folder = `worker-${index}`; await mkdir(path.join(root, folder));
    const rows = assignments[index].map(s => records[s.ordinal]), raw = rows.flatMap(r => samples[r.ordinal]);
    const buffer = Buffer.alloc(raw.length * 8); raw.forEach((value, i) => buffer.writeDoubleLE(value, i * 8));
    const journal = rows.map(row => JSON.stringify(row) + '\n').join('');
    await writeFile(path.join(root, folder, 'records.jsonl'), journal); await writeFile(path.join(root, folder, 'timings.f64le'), buffer);
    const pid = controllerPid - index - 1;
    const workerSource = { ...structuredClone(source), pid, parentPid: controllerPid, assignmentSha256: plan.assignmentHashes[index], scheduleSha256: expected.schedule };
    workerSource.runtime.entrypoint = '/synthetic/phase2-parallel-worker-entry.mjs'; workerSource.runtime.entrypointSha256 = files[1].sha256;
    await put(`${folder}/source.json`, workerSource); await put(`${folder}/source-final.json`, workerSource);
    await put(`${folder}/job.json`, { schema: 'phase2-parallel-job-1', index, parentPid: controllerPid, outputDirectory: path.join(root, folder), expectedSource: expected.source,
      expectedRuntime: expected.runtime, assignmentSha256: plan.assignmentHashes[index], scheduleSha256: expected.schedule });
    const state = { status: 'COMPLETE', phase: 'exit', completed: rows.length, assigned: rows.length,
      persistedSamples: raw.length, observedSamples: raw.length, recordBytes: Buffer.byteLength(journal), failure: null,
      artifacts: { timingsSha256: sha(buffer), recordsSha256: sha(journal) } };
    await put(`${folder}/status.json`, state);
    teardown.push({ index, pid, code: 0, signal: null, omittedLogBytes: 0 });
    published.push({ index, source: `${folder}/source.json`, finalSource: `${folder}/source-final.json`, state,
      records: { path: `${folder}/records.jsonl`, bytes: Buffer.byteLength(journal), sha256: sha(journal), count: rows.length },
      timings: { path: `${folder}/timings.f64le`, encoding: 'IEEE-754 Float64 little-endian milliseconds', bytes: buffer.length, sha256: sha(buffer), samples: raw.length, unattributedSamples: 0 } });
  }
  const result = { ...source, schema: 'phase2-parallel-result-1', evidenceStatus: 'COMPLETE', failure: null,
    records, summary: counts(records), isolatedStepMs: statistics(samples.flat()),
    strata: records.map(row => ({ scene: row.scene, playerCount: row.playerCount, policy: row.policy, metrics: counts([row]) })),
    parallel: { limits, workers: published, teardown, allOwnedExitsObserved: true, problems: [], missingOrdinals: [], scheduleSha256: expected.schedule } };
  await put('manifest.json', { status: 'INCOMPLETE', source, plan }); // Manifest remains initially INCOMPLETE in real schema.
  await put('result.json', result); await writeFile(path.join(root, 'result.md'), '# Synthetic final artifact\n');
  await put('status.json', { status: 'COMPLETE', phase: 'finished', failure: null, planned: 10, validatedRecords: 10,
    missingOrdinals: [], samples: samples.flat().length, teardown });
  async function journalChange(edit) {
    const name = 'worker-0/records.jsonl', rows = (await readFile(path.join(root, name), 'utf8')).trimEnd().split('\n').map(JSON.parse);
    edit(rows); const text = rows.map(row => JSON.stringify(row) + '\n').join(''); await writeFile(path.join(root, name), text);
    const state = await get('worker-0/status.json'), final = await get('result.json');
    state.recordBytes = Buffer.byteLength(text); state.artifacts.recordsSha256 = sha(text);
    final.parallel.workers[0].state = state;
    Object.assign(final.parallel.workers[0].records, { bytes: Buffer.byteLength(text), sha256: sha(text), count: rows.length });
    for (const row of rows) final.records[row.ordinal] = row;
    await put('worker-0/status.json', state); await put('result.json', final);
  }
  return { root, get, put, journalChange, options: { expected, config, families: ['balanced'], count: 10 } };
}
async function withFixture(run) {
  const value = await fixture(); try { await run(value); } finally { await rm(value.root, { recursive: true, force: true }); }
}

test('valid synthetic final: exact pooled statistics, physical failures and censors retained', () => withFixture(async f => {
  const result = await validateFinalMatrix(f.root, f.options);
  assert.equal(result.validationStatus, 'SYNTHETIC_VALIDATED'); assert.equal(result.complete, false);
  assert.equal(result.validatedWorkerCloseReceipts, 4); assert.equal(result.summary.failed, 1); assert.equal(result.summary.censored, 7);
  assert.equal(result.isolatedStepMs.count, 25); assert.equal(result.isolatedStepMs.p50, 51);
  assert.equal(result.isolatedStepMs.p95, 92); assert.equal(result.isolatedStepMs.p99, 93);
  assert(result.typedTimingAllocationBytes < 100000);
}));
test('pure production plan matches prior schedule pin and maximum reservation without reading any run', () => {
  const schedule = fixedSchedule(); assert.equal(schedule.length, 1000); assert.equal(digest(schedule), EXPECTED.schedule);
  assert.equal(schedule.reduce((sum, row) => sum + Math.ceil(row.horizonSeconds * row.tickHz), 0), 9900000);
});

const corruptions = [
  ['duplicate ordinal with refreshed journal hashes', f => f.journalChange(rows => { rows[1] = structuredClone(rows[0]); }), /duplicate ordinal|ordered shard/],
  ['missing ordinal with refreshed journal hashes', f => f.journalChange(rows => { rows.pop(); }), /missing\/extra shard ordinal/],
  ['one-byte timing tail', f => writeFile(path.join(f.root, 'worker-0/timings.f64le'), Buffer.alloc(1), { flag: 'a' }), /raw timing length/],
  ['one full unattributed sample', f => writeFile(path.join(f.root, 'worker-0/timings.f64le'), Buffer.alloc(8), { flag: 'a' }), /raw timing length/],
  ['incorrect pooled percentile', async f => { const r = await f.get('result.json'); r.isolatedStepMs.p95++; await f.put('result.json', r); }, /full-window quantiles/],
  ['incorrect trajectory percentile with refreshed hashes', f => f.journalChange(rows => { rows[0].stepExecutionMs.p99++; }), /trajectory timing summary/],
  ['missing worker exit receipt', f => rm(path.join(f.root, 'worker-0/status.json')), /ENOENT/],
  ['missing final source receipt', f => rm(path.join(f.root, 'worker-0/source-final.json')), /ENOENT/],
  ['unclean observed close', async f => {
    const r = await f.get('result.json'), s = await f.get('status.json'); r.parallel.teardown[0].code = 1;
    s.teardown = r.parallel.teardown; await f.put('result.json', r); await f.put('status.json', s);
  }, /unsuccessful observed worker close/],
  ['job belongs to another directory', async f => {
    const r = await f.get('worker-0/job.json'); r.outputDirectory = '/different/invocation/worker-0'; await f.put('worker-0/job.json', r);
  }, /another artifact directory/],
  ['vacuous owned-exits flag', async f => { const r = await f.get('result.json'); r.parallel.teardown = []; await f.put('result.json', r); }, /four observed worker closes/],
  ['live controller cannot pass even with final flags', async f => {
    for (let i = 0; i < 4; i++) for (const name of ['job.json', 'source.json']) {
      const r = await f.get(`worker-${i}/${name}`); r.parentPid = process.pid; await f.put(`worker-${i}/${name}`, r);
    }
  }, /PID still exists/],
  ['live status refused before missing timing streams', async f => {
    const r = await f.get('status.json'); r.status = 'INCOMPLETE'; r.phase = 'fixed-matrix'; await f.put('status.json', r);
    await rm(path.join(f.root, 'worker-0/timings.f64le'));
  }, /live\/incomplete/],
  ['watchdog failure sentinel', f => f.put('worker-1/watchdog.json', { status: 'INCOMPLETE' }), /tripped guard/],
  ['error or incomplete physical evidence', f => f.journalChange(rows => { rows[0].evidenceComplete = false; rows[0].ending = 'error'; }), /incomplete physical evidence/],
  ['short censor', f => f.journalChange(rows => { rows[2].ticks--; rows[2].stepAttempts--; rows[2].observedSeconds = rows[2].ticks / 30; }), /exact full horizon/],
  ['nonfinite timing sample', async f => {
    const name = path.join(f.root, 'worker-0/timings.f64le'), b = await readFile(name); b.writeDoubleLE(Infinity); await writeFile(name, b);
  }, /nonfinite\/negative timing/],
  ['negative timing sample', async f => {
    const name = path.join(f.root, 'worker-0/timings.f64le'), b = await readFile(name); b.writeDoubleLE(-1); await writeFile(name, b);
  }, /nonfinite\/negative timing/],
  ['stale final runtime identity', async f => { const r = await f.get('worker-2/source-final.json'); r.runtime.assets[0].sha256 = sha('changed'); await f.put('worker-2/source-final.json', r); }, /runtime receipt changed/],
  ['frozen source bytes changed', async f => {
    const name = path.join(f.root, 'source/tuning.ts'); await chmod(name, 0o644); await writeFile(name, '// changed\n'); await chmod(name, 0o444);
  }, /frozen source bytes/],
  ['wrong assignment identity', async f => { const r = await f.get('worker-1/job.json'); r.assignmentSha256 = sha('wrong'); await f.put('worker-1/job.json', r); }, /AssertionError|Expected values/],
  ['incorrect outcome summary', async f => { const r = await f.get('result.json'); r.summary.failed = 0; await f.put('result.json', r); }, /summary.failed/],
  ['wrong raw artifact hash', async f => {
    const r = await f.get('result.json'); r.parallel.workers[0].timings.sha256 = sha('wrong'); await f.put('result.json', r);
  }, /timing result hash/],
];
for (const [name, corrupt, message] of corruptions) test(`refuses ${String(name)}`, () => withFixture(async f => {
  await corrupt(f); await assert.rejects(validateFinalMatrix(f.root, f.options), message);
}));
test('synthetic directory cannot use production pins', () => withFixture(async f => {
  await assert.rejects(validateFinalMatrix(f.root), /trusted source pin/);
}));
test('new trusted pins cannot turn a shortened synthetic schedule into a real completed matrix', () => withFixture(async f => {
  await assert.rejects(validateFinalMatrix(f.root, null, f.options.expected), /trusted schedule pin|independent schedule reconstruction/);
}));
test('malformed trusted pins fail closed', () => withFixture(async f => {
  await assert.rejects(validateFinalMatrix(f.root, null, { ...EXPECTED, source: 'untrusted' }), /invalid trusted pins/);
}));
