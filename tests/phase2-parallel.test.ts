import { fork } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TUNING } from '../tuning';
import { BelaySimulation, initializePhysics } from '../shared/simulation';
import { FullWindowSamples, summarizeTrajectories } from '../scripts/phase2-analysis';
import { runTrajectory, runTrajectoryAsync } from '../scripts/phase2-harness';
import { trajectorySchedule } from '../scripts/phase2-policies';
import { auditRecord, digest, freezeSource, makeParallelPlan, memoryRefusal, mergeTimingFile, partitionSchedule, RawTimingJournal, readRecords, workerDirectory, writeMetadata, type Source } from '../scripts/phase2-parallel-core';
import { EvidenceChild } from '../scripts/phase2-parallel-supervisor';
import { collectParallelEvidence, finalizeParallelEvidence, runParallelEvidence } from '../scripts/phase2-parallel';
import { hashFile, packageRuntimeAssets, provenance, type BotReport } from '../scripts/phase2-report';
import * as reportIO from '../scripts/phase2-report';
import * as coreIO from '../scripts/phase2-parallel-core';
const directories: string[] = [], children: EvidenceChild[] = [];
const plan = makeParallelPlan();
const root = process.cwd(), fixture = path.join(root, 'tests/fixtures/phase2-child.mjs');
let source: Source;
function finalizationReport(): BotReport & { failure: string | null } {
  return { ...source, schema: 'phase2-parallel-result-1', generatedAt: new Date().toISOString(), mode: 'full',
    evidenceStatus: 'COMPLETE', failure: null, scope: 'Synthetic finalization fixture; no trajectories executed',
    humanFun: 'NOT EVALUATED', humanRescueStop: 'NOT EVALUATED', productionQualification: 'NOT TESTED',
    wallSeconds: 0, processMemoryBefore: process.memoryUsage(), processMemoryAfter: process.memoryUsage(),
    timingMethod: 'No measured workload', isolatedStepMs: new FullWindowSamples(1, 16).summary(),
    summary: summarizeTrajectories([]), records: [], strata: [] };
}
async function directory() { const result = await mkdtemp(path.join(os.tmpdir(), 'belay-parallel-')); directories.push(result); return result; }
async function childFixture(mode: string, index = 0, extra: object = {}, onFailure: (reason: string) => void = () => {}) {
  const folder = await directory(), configPath = path.join(folder, 'config.json');
  const guard = { maximumWallMs: plan.limits.maximumWallMs, maximumRssBytes: plan.limits.maximumWorkerRssBytes,
    minimumAvailableBytes: 0, sampleMs: plan.limits.sampleMs, shutdownGraceMs: plan.limits.shutdownGraceMs,
    heapMiB: plan.limits.watchdogHeapMiB, sentinelPath: path.join(folder, 'watchdog.json'),
    runtime: { node: process.versions.node, uv: process.versions.uv, platform: process.platform } };
  await writeFile(configPath, JSON.stringify({ mode, index, sampleMs: plan.limits.sampleMs, guard,
    lifeMs: plan.limits.sampleMs, watchdogModule: pathToFileURL(path.join(root, 'scripts/phase2-parallel-watchdog.ts')).href, ...extra }));
  const child = new EvidenceChild(index, fixture, configPath, root, plan, onFailure); children.push(child);
  return { child, folder, configPath };
}
afterEach(async () => {
  await Promise.all(children.splice(0).map(child => child.stop()));
  await Promise.all(directories.splice(0).map(folder => rm(folder, { recursive: true, force: true })));
  vi.restoreAllMocks();
});
beforeAll(async () => { await initializePhysics(); source = await provenance(); });

describe('fixed four-worker plan and accounting', () => {
  it('partitions all original ordinals once with identical seeds, horizons and balanced sample reservations', () => {
    const original = trajectorySchedule(TUNING.phase2Evidence.trajectoryRuns);
    expect(plan.assignments.flat()).toEqual(original);
    expect(new Set(plan.assignments.flat().map(row => row.ordinal)).size).toBe(original.length);
    expect(plan.assignments.map(rows => rows.length)).toEqual(Array(plan.limits.workers).fill(original.length / plan.limits.workers));
    expect(plan.maximumLiveTimingBytes).toBeLessThanOrEqual(TUNING.phase2Evidence.maximumTimingBytes);
    expect(plan.reservedOutputBytes).toBeLessThanOrEqual(plan.limits.maximumOutputBytes);
    expect(() => partitionSchedule(original, 0)).toThrow();
  });
  it('uses the explicitly supported available-memory policy and refuses unavailable or unsupported runtimes', () => {
    const accepted = { ...plan.limits.availableMemoryRuntime, rawFreeBytes: 0, availableBytes: plan.limits.minimumInitialAvailableBytes };
    expect(memoryRefusal(accepted, 'initial', 0, plan)).toBeNull();
    expect(memoryRefusal({ ...accepted, availableBytes: plan.limits.minimumOngoingAvailableBytes }, 'ongoing', 0, plan)).toBeNull();
    expect(memoryRefusal({ ...accepted, availableBytes: plan.limits.minimumInitialAvailableBytes - 1 }, 'initial', 0, plan)).toMatch(/floor/);
    expect(memoryRefusal({ ...accepted, availableBytes: null }, 'initial', 0, plan)).toMatch(/Unsupported/);
    expect(memoryRefusal({ ...accepted, node: 'unsupported' }, 'initial', 0, plan)).toMatch(/Unsupported/);
    expect(memoryRefusal(accepted, 'ongoing', plan.limits.maximumTotalRssBytes + 1, plan)).toMatch(/RSS/);
  });
  it('merges raw doubles into exact global tails instead of averaging worker percentiles', async () => {
    const folder = await directory();
    const first = await RawTimingJournal.create(path.join(folder, 'a.raw'), 10, 1600, 3);
    const second = await RawTimingJournal.create(path.join(folder, 'b.raw'), 90, 1600, 3);
    [1000, 1000, ...Array(8).fill(1)].forEach(value => first.add(value));
    Array(90).fill(1).forEach(value => second.add(value));
    await first.close(); await second.close();
    const merged = new FullWindowSamples(100, 1600);
    await mergeTimingFile(first.filename, merged, 10, 3);
    await mergeTimingFile(second.filename, merged, 90, 3);
    expect(merged.summary()).toMatchObject({ count: 100, p50: 1, p95: 1, p99: 1000, max: 1000 });
    expect(merged.summary().p99).not.toBe((first.samples.summary().p99! + second.samples.summary().p99!) / 2);
  });
  it('rejects incomplete, nonfinite and oversized timing files without mutating the existing aggregate', async () => {
    const folder = await directory(), filename = path.join(folder, 'bad.raw'), target = new FullWindowSamples(10, 160);
    target.add(42);
    await writeFile(filename, Buffer.alloc(3));
    await expect(mergeTimingFile(filename, target, 10, 2)).rejects.toThrow(/Truncated/);
    const bad = Buffer.alloc(16); bad.writeDoubleLE(1); bad.writeDoubleLE(Number.NaN, 8); await writeFile(filename, bad);
    await expect(mergeTimingFile(filename, target, 10, 2)).rejects.toThrow(/finite/);
    await expect(mergeTimingFile(filename, target, 1, 2)).rejects.toThrow(/oversized/);
    expect(target.count).toBe(1);
  });
  it('keeps only complete validated record lines and refuses changed ordinals/horizons', async () => {
    const spec = { ...trajectorySchedule(1)[0], scene: 'rescue' as const, horizonSeconds: TUNING.phase2Evidence.lifecycleSeconds };
    const { record } = runTrajectory(spec), folder = await directory(), filename = path.join(folder, 'records.jsonl');
    expect(() => auditRecord({ ...record, ordinal: record.ordinal + 1 }, spec)).toThrow(/ordinal/);
    expect(() => auditRecord({ ...record, horizonSeconds: spec.horizonSeconds + 1 }, spec)).toThrow(/horizon/);
    await writeFile(filename, JSON.stringify(record) + '\n{"unfinished":');
    const result = await readRecords(filename, [spec], TUNING.phase2Evidence.maximumReportBytes);
    expect(result.rows).toEqual([record]); expect(result.incompleteReason).toMatch(/Trailing/);
    await writeFile(filename, JSON.stringify({ ...record, ticks: 0, observedSeconds: 0, ending: 'censored' }) + '\n');
    expect((await readRecords(filename, [spec], TUNING.phase2Evidence.maximumReportBytes)).incompleteReason).toMatch(/Shortened/);
  });
  it('collects four complete real-record journals exactly and rejects changed receipt hashes or source identity', async () => {
    const folder = await directory();
    const schedule = trajectorySchedule(plan.limits.workers).map(spec => ({ ...spec, scene: 'rescue' as const,
      horizonSeconds: TUNING.phase2Evidence.lifecycleSeconds }));
    const assignments = schedule.map(spec => [spec]);
    const small = { ...plan, schedule, assignments, assignmentHashes: assignments.map(digest), scheduleSha256: digest(schedule),
      maximumSamples: schedule.reduce((sum, spec) => sum + Math.ceil(spec.horizonSeconds * spec.tickHz), 0) };
    const expected = new FullWindowSamples(small.maximumSamples, TUNING.phase2Evidence.maximumTimingBytes);
    for (const spec of schedule) {
      const output = workerDirectory(folder, spec.ordinal); await mkdir(output);
      const raw = await RawTimingJournal.create(path.join(output, 'timings.f64le'), small.maximumSamples,
        TUNING.phase2Evidence.maximumTimingBytes, small.limits.timingChunkSamples);
      const { record } = runTrajectory(spec, { add: value => { raw.add(value); expected.add(value); } });
      await raw.close(); await writeFile(path.join(output, 'records.jsonl'), JSON.stringify(record) + '\n');
      await writeMetadata(path.join(output, 'source.json'), { ...source, assignmentSha256: small.assignmentHashes[spec.ordinal], scheduleSha256: small.scheduleSha256 });
      await writeMetadata(path.join(output, 'source-final.json'), source);
      await writeMetadata(path.join(output, 'status.json'), { status: 'COMPLETE', persistedSamples: raw.count,
        artifacts: { timingsSha256: await hashFile(raw.filename), recordsSha256: await hashFile(path.join(output, 'records.jsonl')) } });
    }
    const complete = await collectParallelEvidence(folder, small, source);
    expect(complete.problems).toEqual([]); expect(complete.missingOrdinals).toEqual([]);
    expect(complete.timing).toEqual(expected.summary()); expect(complete.summary.stepAttempts).toBe(expected.count);
    const first = workerDirectory(folder, 0);
    await writeMetadata(path.join(first, 'status.json'), { status: 'COMPLETE', persistedSamples: 0, artifacts: {} });
    expect((await collectParallelEvidence(folder, small, source)).problems.join()).toMatch(/artifact hashes/);
    await writeMetadata(path.join(first, 'source.json'), { ...source, sourceManifestSha256: 'changed' });
    expect((await collectParallelEvidence(folder, small, source)).missingOrdinals).toEqual([0]);
  });
  it('freezes read-only source files and refuses a mismatched source hash', async () => {
    const folder = await directory(), output = path.join(folder, 'source');
    await freezeSource(source, output, plan.limits.maximumSourceBytes);
    for (const file of source.files) {
      expect(await hashFile(path.join(output, file.path))).toBe(file.sha256);
      expect((await stat(path.join(output, file.path))).mode & 0o222).toBe(0);
    }
    await expect(freezeSource({ ...source, files: [{ ...source.files[0], sha256: 'changed' }] },
      path.join(folder, 'mismatch'), plan.limits.maximumSourceBytes)).rejects.toThrow(/changed/);
  });
  it('hashes transitive compiler files and the actual native binary, detecting persistent dependency edits', async () => {
    expect(source.runtime.assets.some(asset => asset.role.includes('esm/index.mjs'))).toBe(true);
    expect(source.runtime.assets.some(asset => asset.role.includes('dependency:esbuild/lib/main.js'))).toBe(true);
    expect(source.runtime.assets.some(asset => asset.role.includes('dependency:@esbuild/darwin-arm64/bin/esbuild'))).toBe(true);
    const folder = await directory(); await mkdir(path.join(folder, 'dist'));
    const manifest = path.join(folder, 'package.json'), nested = path.join(folder, 'dist/implementation.mjs');
    await writeFile(manifest, JSON.stringify({ name: 'fixture' })); await writeFile(nested, 'export const value = 1;');
    const first = await packageRuntimeAssets(manifest, 'fixture');
    await writeFile(nested, 'export const value = 2;');
    expect(digest(await packageRuntimeAssets(manifest, 'fixture'))).not.toBe(digest(first));
  });
  it('fails available-memory preflight without starting any worker and retains explicit incomplete output', async () => {
    const output = path.join(await directory(), 'refused'), originalRawFloor = TUNING.localLoad.minimumFreeMemoryBytes;
    vi.spyOn(process, 'availableMemory').mockReturnValue(0);
    const { report } = await runParallelEvidence(output);
    expect(report.evidenceStatus).toBe('INCOMPLETE'); expect(report.records).toEqual([]);
    expect(report.failure).toMatch(/available-memory floor/);
    expect((await readdir(output)).some(name => name.startsWith('worker-') || name === 'source')).toBe(false);
    expect(JSON.parse(await readFile(path.join(output, 'status.json'), 'utf8')).status).toBe('INCOMPLETE');
    expect(TUNING.localLoad.minimumFreeMemoryBytes).toBe(originalRawFloor);
  });
});

describe('interruptions during final output — no simulation', () => {
  it.each(['report', 'status'] as const)('downgrades every success artifact after an abort during the awaited %s write', async stage => {
    const folder = await directory(), report = finalizationReport(); let failure: string | null = null;
    let entered!: () => void, release!: () => void;
    const blocked = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
    if (stage === 'report') {
      const original = reportIO.writeBoundedJSON;
      vi.spyOn(reportIO, 'writeBoundedJSON').mockImplementationOnce(async (...args) => { entered(); await gate; return original(...args); });
    } else {
      const original = coreIO.writeMetadata;
      vi.spyOn(coreIO, 'writeMetadata').mockImplementationOnce(async (...args) => { entered(); await gate; return original(...args); });
    }
    const released = vi.fn();
    const operation = finalizeParallelEvidence(folder, report, plan, {}, { failure: () => failure,
      abort: reason => { failure ??= reason; }, releaseGuard: () => true, releaseSignals: released });
    await blocked; failure = 'Injected interruption during final output'; expect(released).not.toHaveBeenCalled(); release(); await operation;
    expect(report.evidenceStatus).toBe('INCOMPLETE'); expect(report.failure).toBe(failure);
    for (const name of ['result.json', 'status.json']) expect(JSON.parse(await readFile(path.join(folder, name), 'utf8')))
      .toMatchObject({ [name === 'result.json' ? 'evidenceStatus' : 'status']: 'INCOMPLETE', failure });
    expect(await readFile(path.join(folder, 'result.md'), 'utf8')).toContain('**INCOMPLETE**');
    expect(released).toHaveBeenCalledOnce();
  });
  it('returns exit 1 and consistent incomplete receipts after actual SIGTERM during a blocked report write', async () => {
    const { child, folder } = await childFixture('finalization', 0, { report: finalizationReport(), plan,
      lifeMs: TUNING.network.debugTimeoutMs + plan.limits.shutdownGraceMs,
      nativeHooksModule: pathToFileURL(path.join(root, 'scripts/phase2-native-hooks.mjs')).href,
      finalizerModule: pathToFileURL(path.join(root, 'scripts/phase2-parallel.ts')).href });
    await child.ready; child.child.kill('SIGTERM'); const exit = await child.exit;
    expect(exit.code).toBe(1);
    expect(JSON.parse(await readFile(path.join(folder, 'result.json'), 'utf8')).evidenceStatus).toBe('INCOMPLETE');
    expect(JSON.parse(await readFile(path.join(folder, 'status.json'), 'utf8')).status).toBe('INCOMPLETE');
  });
  it('keeps the independent deadline armed while the final status write stays blocked', async () => {
    const { child, folder } = await childFixture('blocked-finalization', 0, { report: finalizationReport(), plan,
      nativeHooksModule: pathToFileURL(path.join(root, 'scripts/phase2-native-hooks.mjs')).href,
      finalizerModule: pathToFileURL(path.join(root, 'scripts/phase2-parallel.ts')).href });
    await child.ready; const exit = await child.exit;
    expect(exit.signal).toBe('SIGKILL');
    expect(JSON.parse(await readFile(path.join(folder, 'watchdog.json'), 'utf8')).reason).toBe('Independent wall-time limit reached');
    expect(JSON.parse(await readFile(path.join(folder, 'status.json'), 'utf8')).status).toBe('INCOMPLETE');
  });
});

describe('same physics with asynchronous worker yields', () => {
  it('native Node execution matches complete original state/tapes at 2–6 bodies without compiler descendants', async () => {
    const specs = TUNING.phase2Evidence.teamSizes.flatMap(playerCount => (['crossing', 'rescue'] as const).map(scene => ({
      ...trajectorySchedule(1)[0], playerCount, scene, horizonSeconds: TUNING.phase2Evidence.lifecycleSeconds })));
    const { child, folder } = await childFixture('native-physics', 0, { specs, maximumBytes: plan.limits.maximumMetadataBytes,
      nativeHooksModule: pathToFileURL(path.join(root, 'scripts/phase2-native-hooks.mjs')).href,
      simulationModule: pathToFileURL(path.join(root, 'shared/simulation.ts')).href,
      harnessModule: pathToFileURL(path.join(root, 'scripts/phase2-harness.ts')).href });
    await child.ready;
    const native = JSON.parse(await readFile(path.join(folder, 'native.json'), 'utf8'));
    expect(native.compilerChildren).toEqual([]);
    for (const [index, spec] of specs.entries()) {
      const expected = runTrajectory(spec, undefined, true);
      expect(native.results[index]).toEqual({ finalState: expected.finalState, tape: expected.tape,
        policyInputsSha256: expected.record.policyInputsSha256 });
    }
  });
  it.each(TUNING.phase2Evidence.teamSizes)('preserves full state/input tape at %i bodies', async playerCount => {
    const spec = { ...trajectorySchedule(1)[0], playerCount, scene: 'rescue' as const, horizonSeconds: TUNING.phase2Evidence.lifecycleSeconds };
    const sync = runTrajectory(spec, undefined, true), asyncResult = await runTrajectoryAsync(spec, undefined, true);
    expect(asyncResult.finalState).toEqual(sync.finalState);
    expect(asyncResult.record.policyInputsSha256).toBe(sync.record.policyInputsSha256);
    expect(asyncResult.tape).toEqual(sync.tape);
  });
  it('marks interrupted execution incomplete and disposes on cancellation or failed IO callbacks', async () => {
    const spec = { ...trajectorySchedule(1)[0], scene: 'rescue' as const, horizonSeconds: TUNING.phase2Evidence.lifecycleSeconds };
    const dispose = vi.spyOn(BelaySimulation.prototype, 'dispose'); let cancelled = false;
    const result = await runTrajectoryAsync(spec, undefined, false, { stopReason: () => cancelled ? 'test interruption' : null,
      onYield: async () => { cancelled = true; } });
    expect(result.record.ending).toBe('error'); expect(result.record.evidenceComplete).toBe(false);
    expect(result.record.ticks).toBe(1); expect(dispose).toHaveBeenCalledTimes(1);
    await expect(runTrajectoryAsync(spec, undefined, false, { onYield: async () => { throw new Error('test IO failure'); } })).rejects.toThrow(/IO/);
    expect(dispose).toHaveBeenCalledTimes(2);
  });
});

describe('bounded owned subprocesses — fixtures, not the benchmark', () => {
  it('starts four distinct fixture PIDs and observes every owned exit', async () => {
    const fixtures = await Promise.all(Array.from({ length: plan.limits.workers }, (_, index) => childFixture('idle', index)));
    await Promise.all(fixtures.map(({ child }) => child.ready));
    expect(new Set(fixtures.map(({ child }) => child.child.pid)).size).toBe(plan.limits.workers);
    const exits = await Promise.all(fixtures.map(({ child }) => child.stop()));
    expect(exits).toHaveLength(plan.limits.workers); expect(fixtures.every(({ child }) => child.exited)).toBe(true);
  });
  it('bounds logs and forcibly stops a CPU-blocked child that cannot process SIGTERM', async () => {
    const { child } = await childFixture('block', 0, { logs: plan.limits.maximumChildLogBytes * 2 });
    await child.ready;
    const result = await child.stop();
    expect(result.signal).toBe('SIGKILL'); expect(child.logBytes).toBeLessThanOrEqual(plan.limits.maximumChildLogBytes);
    expect(child.omittedLogBytes).toBeGreaterThan(0);
  });
  it('independent watchdog kills its own CPU-blocked process at the deadline', async () => {
    const { child, folder } = await childFixture('watchdog'); await child.ready;
    const result = await child.exit;
    expect(result.signal).toBe('SIGKILL');
    expect(JSON.parse(await readFile(path.join(folder, 'watchdog.json'), 'utf8'))).toMatchObject({ status: 'INCOMPLETE', reason: 'Independent wall-time limit reached' });
  });
  it('hard-stops blocked main JS even when the sentinel filesystem callback never completes', async () => {
    const { child, folder } = await childFixture('stalled-sentinel'); await child.ready;
    expect((await child.exit).signal).toBe('SIGKILL');
    await expect(stat(path.join(folder, 'watchdog.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('rejects malformed worker control messages', async () => {
    let resolve!: (reason: string) => void;
    const failed = new Promise<string>(done => { resolve = done; });
    const { child } = await childFixture('malformed', 0, {}, resolve);
    expect(await failed).toMatch(/IPC/); await child.stop();
  });
  it('detects actual parent death while main JS is blocked and leaves an incomplete sentinel', async () => {
    const folder = await directory(), configPath = path.join(folder, 'orphan.json'), sentinel = path.join(folder, 'watchdog.json');
    await writeFile(configPath, JSON.stringify({ mode: 'orphan', index: 0, sampleMs: plan.limits.sampleMs,
      lifeMs: plan.limits.sampleMs * 2, watchdogModule: pathToFileURL(path.join(root, 'scripts/phase2-parallel-watchdog.ts')).href,
      guard: { maximumWallMs: plan.limits.maximumWallMs, maximumRssBytes: plan.limits.maximumWorkerRssBytes,
        minimumAvailableBytes: 0, sampleMs: plan.limits.sampleMs, shutdownGraceMs: plan.limits.shutdownGraceMs,
        heapMiB: plan.limits.watchdogHeapMiB, sentinelPath: sentinel,
        runtime: { node: process.versions.node, uv: process.versions.uv, platform: process.platform } } }));
    const launcher = fork(path.join(root, 'tests/fixtures/phase2-orphan-parent.mjs'), [fixture, configPath], { execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    const orphanPid = await new Promise<number>((resolve, reject) => { launcher.once('message', value => resolve((value as { childPid: number }).childPid)); launcher.once('error', reject); });
    await new Promise<void>(resolve => launcher.once('exit', () => resolve()));
    const deadline = performance.now() + TUNING.network.debugTimeoutMs + plan.limits.shutdownGraceMs;
    let gone = false;
    while (performance.now() < deadline) {
      try { process.kill(orphanPid, 0); } catch { gone = true; break; }
      await delay(TUNING.localLoad.probePollMs);
    }
    expect(gone).toBe(true);
    expect(JSON.parse(await readFile(sentinel, 'utf8'))).toMatchObject({ status: 'INCOMPLETE', reason: 'Owned process lost its original parent' });
  });
});
