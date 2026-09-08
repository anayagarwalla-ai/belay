import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, open, opendir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUNING, FAMILIES } from '../tuning.ts';

// Independent implementation: only builtins and pure tuning, never the harness,
// physics, primary collector, schedule generator, or analysis implementation.
export const EXPECTED = Object.freeze({
  source: '3253adc6e3bd7823ef4d9c7b110ffd6903a68f7a63dc1f14603a210ac6050fcb',
  schedule: '598d0502785b45555c81f8cd54cebabc2fa9802b928d33a5715d7be39b2d2fba',
  runtime: '6a090feeb9b10a0da6515d99844c284468b271f2cc47ed5ecd7daf2310d19a24',
});
// Use the integrated central caps; the final manifest must match them exactly.
const parallel = TUNING.phase2Evidence.parallel;
export const CAPS = Object.freeze({
  metadata: parallel.maximumMetadataBytes,
  final: parallel.maximumFinalReportBytes,
  records: TUNING.phase2Evidence.maximumReportBytes,
  timing: TUNING.phase2Evidence.maximumTimingBytes,
  chunkSamples: parallel.timingChunkSamples,
  workers: parallel.workers,
});
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = value => sha(JSON.stringify(value));
const integer = (value, low, high, label) => assert(Number.isSafeInteger(value) && value >= low && value <= high, label);
const runtimeDigest = source => digest({
  assets: source.runtime.assets.map(({ role, sha256 }) => ({ role, sha256 })),
  nodeOptionsSha256: source.runtime.nodeOptionsSha256, node: source.machine.node,
});
const signature = info => [info.dev, info.ino, info.size, info.mtimeNs, info.ctimeNs].map(String).join(':');
const alive = pid => {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
};

function scheduleFor(config, families, count) {
  const sizes = config.phase2Evidence.teamSizes, policies = ['recovery', 'walk', 'bad', 'static-brace', 'frozen-tail'];
  const scenes = ['crossing', 'rescue'], matrix = sizes.length * scenes.length * policies.length;
  return Array.from({ length: count }, (_, ordinal) => {
    const repetition = Math.floor(ordinal / matrix), scene = scenes[Math.floor(ordinal / sizes.length) % scenes.length];
    return { ordinal, seed: (config.seed + repetition) >>> 0, playerCount: sizes[ordinal % sizes.length], scene,
      policy: policies[Math.floor(ordinal / (sizes.length * scenes.length)) % policies.length],
      family: families[repetition % families.length], tickHz: config.tickHz,
      horizonSeconds: scene === 'crossing' ? config.phase2Evidence.crossingSeconds : config.phase2Evidence.rescueSeconds };
  });
}
export function fixedSchedule() {
  return scheduleFor(TUNING, Object.keys(FAMILIES), TUNING.phase2Evidence.trajectoryRuns);
}

function counts(rows) {
  const count = ending => rows.filter(row => row.ending === ending).length;
  return { trajectories: rows.length, crossingTrajectories: rows.filter(row => row.scene === 'crossing').length,
    complete: count('complete'), failed: count('failed'), fixtureRecovered: count('fixture-recovered'),
    censored: count('censored'), errors: count('error'), incompleteEvidence: rows.filter(row => row.evidenceComplete !== true).length,
    executedTicks: rows.reduce((sum, row) => sum + row.ticks, 0), stepAttempts: rows.reduce((sum, row) => sum + row.stepAttempts, 0) };
}
function checkCounts(actual, expected, label) {
  for (const [key, value] of Object.entries(expected)) assert.equal(actual?.[key], value, `${label}.${key}`);
}
function orderedSummary(values, total) {
  const count = values.length;
  if (!count) return { count: 0, min: null, p50: null, p95: null, p99: null, max: null, mean: null };
  values.sort(); // Typed-array numeric sort, in place. No JS-number array or second full-window copy.
  const pick = p => values[Math.ceil(p * count) - 1];
  return { count, min: values[0], p50: pick(0.5), p95: pick(0.95), p99: pick(0.99), max: values[count - 1], mean: total / count };
}
function auditOutcome(row, spec) {
  for (const [key, value] of Object.entries(spec)) assert.equal(row[key], value, `ordered shard ${key}`);
  const cap = Math.ceil(spec.horizonSeconds * spec.tickHz);
  integer(row.stepAttempts, 1, cap, 'step-attempt cap');
  integer(row.ticks, 0, row.stepAttempts, 'tick count');
  assert.equal(row.observedSeconds, row.ticks / row.tickHz, 'observed seconds');
  assert.equal(row.evidenceComplete, true, 'incomplete physical evidence');
  assert.equal(row.error, null, 'trajectory error');
  assert.equal(row.ticks, row.stepAttempts, 'non-error trajectory tick/attempt mismatch');
  assert(Array.isArray(row.episodes), 'episodes array');
  if (row.ending === 'complete') assert(spec.scene === 'crossing' && row.runStatus === 'complete', 'crossing completion label');
  else if (row.ending === 'failed') assert.equal(row.runStatus, 'failed', 'terminal failure label');
  else if (row.ending === 'fixture-recovered') {
    assert(spec.scene === 'rescue' && row.episodes.length > 0 && row.episodes.every(e => e.status === 'recovered')
      && !['failed', 'complete'].includes(row.runStatus), 'focused recovery label');
  } else if (row.ending === 'censored') {
    assert.equal(row.ticks, cap, 'censor must cover exact full horizon');
    assert(['testing', 'active'].includes(row.runStatus), 'terminal outcome mislabeled as censor');
  } else assert.fail('error or unknown trajectory ending');
  assert(hex(row.finalStateSha256) && hex(row.policyInputsSha256), 'trajectory artifact identities');
}

/** Current-host final-artifact audit. Test mode can only return SYNTHETIC_VALIDATED.
 * Files are never modified; PID probes use signal 0 only and never adopt ownership. */
export async function validateFinalMatrix(directory, synthetic = null, trustedPins = EXPECTED) {
  const root = await realpath(directory), seen = new Map(), receipts = new Map();
  // A new real campaign supplies pins recorded before launch. This changes only
  // the trusted identities, never the fixed schedule, bounds or completion gate.
  // The historical default and synthetic-only fixture path remain separate.
  const expected = synthetic?.expected ?? trustedPins;
  assert(expected && ['source', 'schedule', 'runtime'].every(key => hex(expected[key])), 'invalid trusted pins');
  const config = synthetic?.config ?? TUNING, families = synthetic?.families ?? Object.keys(FAMILIES);
  const count = synthetic?.count ?? TUNING.phase2Evidence.trajectoryRuns;
  integer(count, 1, TUNING.phase2Evidence.trajectoryRuns, 'schedule count cap');
  const workers = CAPS.workers; // Four real exits are always required, including synthetic fixtures.
  assert.equal(workers, 4, 'validator is scoped to four workers');
  const child = relative => {
    assert(typeof relative === 'string' && relative.length > 0 && !path.isAbsolute(relative)
      && !relative.split(/[\\/]/).includes('..'), 'unsafe artifact path');
    return path.join(root, relative);
  };
  async function read(relative, cap, consume) {
    const name = child(relative);
    assert.equal(await realpath(name), name, `symlink artifact: ${relative}`);
    const before = await lstat(name, { bigint: true });
    assert(before.isFile() && before.size <= BigInt(cap), `file type/byte cap: ${relative}`);
    const file = await open(name, 'r');
    try {
      assert.equal(signature(await file.stat({ bigint: true })), signature(before), `file changed at open: ${relative}`);
      const result = await consume(file, Number(before.size));
      assert.equal(signature(await file.stat({ bigint: true })), signature(before), `file changed during read: ${relative}`);
      assert.equal(signature(await lstat(name, { bigint: true })), signature(before), `file replaced: ${relative}`);
      seen.set(relative, signature(before)); return result;
    } finally { await file.close(); }
  }
  async function exact(file, buffer, offset, length) {
    let done = 0;
    while (done < length) {
      const result = await file.read(buffer, done, length - done, offset + done);
      assert(result.bytesRead > 0, 'unexpected file EOF'); done += result.bytesRead;
    }
  }
  async function json(relative, cap = CAPS.metadata) {
    return read(relative, cap, async (file, size) => {
      const buffer = Buffer.alloc(size); await exact(file, buffer, 0, size);
      receipts.set(relative, { bytes: size, sha256: sha(buffer) });
      return JSON.parse(buffer.toString('utf8'));
    });
  }
  async function finalGate() {
    const status = await json('status.json');
    assert(status.status === 'COMPLETE' && status.phase === 'finished' && status.failure === null,
      'directory is live/incomplete, not finalized COMPLETE');
    for (const folder of ['', ...Array.from({ length: workers }, (_, i) => `worker-${i}`)]) {
      let nameBytes = 0;
      for await (const entry of await opendir(folder ? child(folder) : root)) {
        nameBytes += Buffer.byteLength(entry.name);
        assert(nameBytes <= CAPS.metadata, 'directory listing cap');
        assert(entry.name !== 'watchdog.json' && !entry.name.endsWith('.tmp'), `unfinished/tripped guard artifacts: ${folder}`);
      }
    }
    return status;
  }
  const status = await finalGate(), initialStatusHash = receipts.get('status.json').sha256;
  const manifest = await json('manifest.json'), plan = manifest.plan, source = manifest.source;
  assert.equal(plan.schema, 'phase2-parallel-1', 'plan schema');
  assert.equal(source.sourceManifestSha256, expected.source, 'trusted source pin');
  assert.equal(runtimeDigest(source), expected.runtime, 'trusted runtime pin');
  const schedule = synthetic ? scheduleFor(config, families, count) : fixedSchedule(), scheduleHash = digest(schedule);
  assert.equal(scheduleHash, expected.schedule, 'trusted schedule pin');
  assert.deepEqual(plan.schedule, schedule, 'independent schedule reconstruction');
  assert.equal(plan.scheduleSha256, scheduleHash, 'schedule digest');
  assert.equal(plan.limits.workers, workers, 'worker count');
  assert.equal(plan.limits.maximumMetadataBytes, CAPS.metadata, 'metadata cap');
  assert.equal(plan.limits.maximumFinalReportBytes, CAPS.final, 'final report cap');
  assert.equal(plan.limits.recordBytesPerWorker, Math.floor(CAPS.records / workers), 'journal cap');
  assert.equal(plan.limits.maximumSourceBytes, CAPS.records, 'source cap');
  assert.equal(plan.limits.timingChunkSamples, CAPS.chunkSamples, 'IO chunk cap');
  const maximumSamples = schedule.reduce((sum, spec) => sum + Math.ceil(spec.horizonSeconds * spec.tickHz), 0);
  assert.equal(plan.maximumSamples, maximumSamples, 'planned samples');
  assert.equal(plan.maximumTimingFileBytes, maximumSamples * 8, 'planned timing bytes');
  const width = Math.ceil(count / workers);
  const assignments = Array.from({ length: workers }, (_, i) => schedule.slice(i * width, (i + 1) * width));
  assert(assignments.every(rows => rows.length), 'empty worker assignment');
  assert.deepEqual(plan.assignments, assignments, 'contiguous assignments');
  assert.deepEqual(plan.assignmentHashes, assignments.map(digest), 'assignment digests');
  const maxShard = Math.max(...assignments.map(rows => rows.reduce((sum, spec) => sum + Math.ceil(spec.horizonSeconds * spec.tickHz), 0)));
  const maxTrajectory = Math.max(...schedule.map(spec => Math.ceil(spec.horizonSeconds * spec.tickHz)));
  assert.equal(plan.maximumLiveTimingBytes, (maximumSamples * 2 + maxShard * 2 + maxTrajectory * 3 + CAPS.chunkSamples * 2) * 8,
    'planned timing reserve');
  assert(plan.maximumLiveTimingBytes <= CAPS.timing, 'declared timing reserve');

  function checkSource(value, entry) {
    assert.equal(digest(value.files), expected.source, 'source file-list digest');
    assert.deepEqual(value.files, source.files, 'source file list changed');
    assert.equal(value.sourceManifestSha256, expected.source, 'source manifest changed');
    assert.equal(runtimeDigest(value), expected.runtime, 'runtime receipt changed');
    assert.deepEqual(value.tuning, source.tuning, 'reported tuning changed');
    assert.deepEqual(value.familyDefinitions, source.familyDefinitions, 'reported family definitions changed');
    const row = value.files.find(file => file.path === `scripts/${entry}`);
    assert(row && value.runtime.entrypointSha256 === row.sha256 && path.basename(value.runtime.entrypoint) === entry,
      'native entrypoint identity');
  }
  checkSource(source, 'phase2-parallel-entry.mjs');
  const sourcePaths = new Set(); let sourceBytes = 0;
  for (const entry of source.files) {
    assert(hex(entry.sha256) && !sourcePaths.has(entry.path), 'duplicate/invalid frozen source entry'); sourcePaths.add(entry.path);
    await read(`source/${entry.path}`, CAPS.records - sourceBytes, async (file, size) => {
      assert.equal(Number((await file.stat()).mode) & 0o222, 0, 'frozen source is writable');
      sourceBytes += size; const hash = createHash('sha256'), buffer = Buffer.alloc(CAPS.chunkSamples * 8);
      for (let pos = 0; pos < size; pos += buffer.length) {
        const n = Math.min(buffer.length, size - pos); await exact(file, buffer, pos, n); hash.update(buffer.subarray(0, n));
      }
      assert.equal(hash.digest('hex'), entry.sha256, `frozen source bytes: ${entry.path}`);
    });
  }
  const result = await json('result.json', CAPS.final);
  await read('result.md', CAPS.metadata, async (file, size) => {
    assert(size > 0, 'missing readable final artifact');
    const bytes = Buffer.alloc(size); await exact(file, bytes, 0, size);
    receipts.set('result.md', { bytes: size, sha256: sha(bytes) });
  });
  assert(result.schema === 'phase2-parallel-result-1' && result.evidenceStatus === 'COMPLETE' && result.failure === null,
    'final result is incomplete');
  checkSource(result, 'phase2-parallel-entry.mjs');
  assert.deepEqual(result.parallel.limits, plan.limits, 'final limits');
  assert.equal(result.parallel.scheduleSha256, scheduleHash, 'final schedule');
  assert.deepEqual(result.parallel.problems, [], 'collection problems');
  assert.deepEqual(result.parallel.missingOrdinals, [], 'missing final ordinals');
  assert.deepEqual(status.missingOrdinals, [], 'status missing ordinals');
  assert.equal(status.planned, count); assert.equal(status.validatedRecords, count);
  assert.equal(result.parallel.allOwnedExitsObserved, true, 'owned-exit flag');
  assert.equal(result.parallel.teardown.length, workers, 'four observed worker closes required');
  assert.deepEqual(status.teardown, result.parallel.teardown, 'controller close receipts');
  assert.equal(result.parallel.workers.length, workers, 'four collected shards required');
  assert.equal(result.records.length, count, 'final record count');

  const shards = [], pids = new Set(); let controllerPid;
  for (let index = 0; index < workers; index++) {
    const folder = `worker-${index}`, job = await json(`${folder}/job.json`);
    const first = await json(`${folder}/source.json`), last = await json(`${folder}/source-final.json`);
    const exit = await json(`${folder}/status.json`), teardown = result.parallel.teardown[index], published = result.parallel.workers[index];
    checkSource(first, 'phase2-parallel-worker-entry.mjs'); checkSource(last, 'phase2-parallel-worker-entry.mjs');
    assert.equal(job.schema, 'phase2-parallel-job-1'); assert.equal(job.index, index);
    assert.equal(await realpath(job.outputDirectory).catch(() => null), child(folder), 'worker job belongs to another artifact directory');
    assert.equal(job.expectedSource, expected.source); assert.equal(job.expectedRuntime, expected.runtime);
    assert.equal(job.scheduleSha256, scheduleHash); assert.equal(job.assignmentSha256, plan.assignmentHashes[index]);
    assert.equal(first.scheduleSha256, scheduleHash); assert.equal(first.assignmentSha256, job.assignmentSha256);
    assert.equal(first.parentPid, job.parentPid, 'worker parent identity');
    controllerPid ??= job.parentPid; assert.equal(job.parentPid, controllerPid, 'single controller identity');
    integer(first.pid, 1, 0x7fffffff, 'worker pid'); integer(controllerPid, 1, 0x7fffffff, 'controller pid');
    assert(!pids.has(first.pid) && first.pid !== controllerPid, 'unique worker ownership'); pids.add(first.pid);
    assert(teardown.index === index && teardown.pid === first.pid && teardown.code === 0 && teardown.signal === null,
      'missing or unsuccessful observed worker close');
    assert(exit.status === 'COMPLETE' && exit.phase === 'exit' && exit.failure === null, 'worker exit receipt incomplete');
    assert.equal(exit.completed, assignments[index].length, 'worker completed count');
    assert.equal(exit.assigned, assignments[index].length, 'worker assigned count');
    assert.equal(published.index, index, 'published worker index');
    assert.deepEqual(published.state, exit, 'published final worker state');
    assert.equal(published.source, `${folder}/source.json`); assert.equal(published.finalSource, `${folder}/source-final.json`);
    assert.equal(published.records.path, `${folder}/records.jsonl`); assert.equal(published.timings.path, `${folder}/timings.f64le`);
    shards.push({ index, folder, exit, published });
  }
  pids.add(controllerPid);
  const requireClosed = () => { for (const pid of pids) assert(!alive(pid), 'recorded controller/worker PID still exists; refuse live or reused PID'); };
  requireClosed(); // Before opening any timing stream, including a briefly COMPLETE live controller.

  const allRows = [], ordinalSeen = new Set(); let totalAttempts = 0, maxAttempts = 0;
  for (const shard of shards) {
    const name = `${shard.folder}/records.jsonl`;
    const rows = await read(name, Math.floor(CAPS.records / workers), async (file, size) => {
      const bytes = Buffer.alloc(size); await exact(file, bytes, 0, size);
      const hash = sha(bytes); receipts.set(name, { bytes: size, sha256: hash });
      assert.equal(hash, shard.exit.artifacts.recordsSha256, 'journal exit hash');
      assert.equal(hash, shard.published.records.sha256, 'journal result hash');
      assert.equal(size, shard.exit.recordBytes); assert.equal(size, shard.published.records.bytes);
      const text = bytes.toString('utf8'); assert(text.endsWith('\n'), 'incomplete JSONL tail');
      const lines = text.slice(0, -1).split('\n');
      assert.equal(lines.length, assignments[shard.index].length, 'missing/extra shard ordinal');
      return lines.map(line => JSON.parse(line));
    });
    assert.equal(rows.length, shard.published.records.count);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]; assert(!ordinalSeen.has(row.ordinal), 'duplicate ordinal'); ordinalSeen.add(row.ordinal);
      auditOutcome(row, assignments[shard.index][i]);
      assert.deepEqual(row, result.records[row.ordinal], 'raw journal differs from final record');
      maxAttempts = Math.max(maxAttempts, row.stepAttempts); totalAttempts += row.stepAttempts;
    }
    shard.rows = rows; allRows.push(...rows);
  }
  assert.equal(ordinalSeen.size, count, 'missing global ordinals');
  const summary = counts(allRows); checkCounts(result.summary, summary, 'summary');
  assert.equal(status.samples, totalAttempts, 'controller sample count');
  const strataSeen = new Set();
  for (const stratum of result.strata) {
    const key = JSON.stringify([stratum.scene, stratum.playerCount, stratum.policy]);
    assert(!strataSeen.has(key), 'duplicate stratum'); strataSeen.add(key);
    const rows = allRows.filter(r => r.scene === stratum.scene && r.playerCount === stratum.playerCount && r.policy === stratum.policy);
    assert(rows.length > 0, 'unexpected stratum'); checkCounts(stratum.metrics, counts(rows), 'stratum counts');
  }
  assert.equal(strataSeen.size, new Set(allRows.map(r => JSON.stringify([r.scene, r.playerCount, r.policy]))).size, 'missing stratum');
  integer(totalAttempts, 1, maximumSamples, 'full-window sample cap');
  const allocationBytes = (totalAttempts + maxAttempts + CAPS.chunkSamples) * 8;
  assert(allocationBytes <= CAPS.timing, 'typed timing allocation exceeds existing cap');
  const all = new Float64Array(totalAttempts), scratch = new Float64Array(maxAttempts), buffer = Buffer.alloc(CAPS.chunkSamples * 8);
  let position = 0, total = 0;
  for (const shard of shards) {
    const samples = shard.rows.reduce((sum, row) => sum + row.stepAttempts, 0), name = `${shard.folder}/timings.f64le`;
    const published = shard.published.timings;
    assert.equal(published.encoding, 'IEEE-754 Float64 little-endian milliseconds', 'timing encoding label');
    assert.equal(shard.exit.observedSamples, samples); assert.equal(shard.exit.persistedSamples, samples);
    assert.equal(published.samples, samples); assert.equal(published.unattributedSamples, 0, 'unattributed timing tail');
    await read(name, maximumSamples * 8, async (file, size) => {
      assert.equal(size, samples * 8, 'raw timing length must equal step-attempts * 8');
      assert.equal(size, published.bytes); const hash = createHash('sha256');
      let rowIndex = 0, used = 0, rowTotal = 0;
      for (let offset = 0; offset < size; offset += buffer.length) {
        const n = Math.min(buffer.length, size - offset); await exact(file, buffer, offset, n); hash.update(buffer.subarray(0, n));
        for (let i = 0; i < n; i += 8) {
          const value = buffer.readDoubleLE(i); assert(Number.isFinite(value) && value >= 0, 'nonfinite/negative timing');
          all[position++] = value; scratch[used++] = value; total += value; rowTotal += value;
          assert(Number.isFinite(total) && Number.isFinite(rowTotal), 'nonfinite accumulated timing');
          if (used === shard.rows[rowIndex].stepAttempts) {
            assert.deepEqual(orderedSummary(scratch.subarray(0, used), rowTotal), shard.rows[rowIndex].stepExecutionMs,
              `trajectory timing summary ordinal ${shard.rows[rowIndex].ordinal}`);
            rowIndex++; used = 0; rowTotal = 0;
          }
        }
      }
      assert(rowIndex === shard.rows.length && used === 0, 'timing segmentation');
      const hashValue = hash.digest('hex'); receipts.set(name, { bytes: size, sha256: hashValue });
      assert.equal(hashValue, shard.exit.artifacts.timingsSha256, 'timing exit hash');
      assert.equal(hashValue, published.sha256, 'timing result hash');
    });
  }
  assert.equal(position, totalAttempts, 'combined sample count');
  const timing = orderedSummary(all, total);
  assert.deepEqual(timing, result.isolatedStepMs, 'independent full-window quantiles/mean');
  // Check all inspected files still have the original identity before rereading
  // the canonical gate, so the gate cannot replace a changed-file seal.
  for (const [name, seal] of seen) assert.equal(signature(await lstat(child(name), { bigint: true })), seal, `artifact changed: ${name}`);
  await finalGate(); assert.equal(receipts.get('status.json').sha256, initialStatusHash, 'final status changed'); requireClosed();
  return { validationStatus: synthetic ? 'SYNTHETIC_VALIDATED' : 'VALIDATED_FINAL_MATRIX', complete: !synthetic,
    directory: root, expected, planned: count, validatedRecords: allRows.length, validatedWorkerCloseReceipts: workers,
    summary, isolatedStepMs: timing, typedTimingAllocationBytes: allocationBytes,
    artifactReceipts: Object.fromEntries(receipts),
    limits: 'Current-host artifact audit. Runtime assets are compared by recorded identity, not rehashed installed binaries. No physics replay, state-hash preimage verification, resource-history audit, non-count KPI/stratum statistics, human gate, or production/performance qualification.' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.equal(process.argv.length, 3, 'Usage: node --max-old-space-size=256 scripts/phase2-independent-final-validate.mjs FINAL_DIRECTORY');
    assert(process.execArgv.includes(`--max-old-space-size=${TUNING.localLoad.generatorHeapMiB}`), 'Use the existing 256 MiB old-space cap.');
    console.log(JSON.stringify(await validateFinalMatrix(process.argv[2]), null, 2));
  } catch (error) {
    console.log(JSON.stringify({ validationStatus: 'REFUSED', complete: false,
      reason: String(error.message).slice(0, TUNING.localLoad.maximumChildLogBytes) })); process.exitCode = 1;
  }
}
