import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { TUNING } from '../tuning';
import { FullWindowSamples, summarizeTrajectories } from './phase2-analysis';
import type { EvidenceRecord } from './phase2-harness';
import { PHASE2_POLICIES, PHASE2_SCENES } from './phase2-policies';
import { provenance, renderBotReport, writeBoundedJSON, type BotReport } from './phase2-report';
import { freezeSource, makeParallelPlan, memoryReading, memoryRefusal, mergeTimingFile, readMetadata, readRecords,
  runtimeSignature, workerDirectory, writeMetadata, type ParallelPlan, type Source, type WorkerJob } from './phase2-parallel-core';
import { EvidenceChild, ownedRss } from './phase2-parallel-supervisor';
import { startWatchdog } from './phase2-parallel-watchdog';

type ParallelReport = BotReport & Record<string, unknown>;
/** Signal handlers remain installed until every awaited success write and guard
 * teardown has finished. Any failure is monotonic and invalidates success files. */
export async function finalizeParallelEvidence(directory: string, report: ParallelReport, plan: ParallelPlan,
  receipt: Record<string, unknown>, control: { failure: () => string | null; abort: (reason: string) => void;
    releaseGuard: (force?: boolean) => boolean; releaseSignals: () => void }) {
  const settings = plan.limits;
  const writeStatus = () => writeMetadata(path.join(directory, 'status.json'), { ...receipt,
    status: report.evidenceStatus, phase: 'finished', failure: report.failure, at: new Date().toISOString() });
  const writeReport = async () => {
    await writeBoundedJSON(path.join(directory, 'result.json'), report, settings.maximumFinalReportBytes);
    const markdown = renderBotReport(report, 'result.json');
    if (Buffer.byteLength(markdown) > settings.maximumMetadataBytes) throw new Error('Readable report exceeds root bound');
    await writeFile(path.join(directory, 'result.md'), markdown);
  };
  try {
    try { await writeReport(); }
    catch (error) { control.abort(`Final output failed: ${String(error)}`); }
    if (!control.failure()) {
      try { await writeStatus(); }
      catch (error) { control.abort(`Final status failed: ${String(error)}`); }
    }
    if (!control.failure() && !control.releaseGuard()) control.abort('Independent finalization guard tripped');
    // This check is after all awaited success operations, including the final
    // status rename. No await separates a successful check and signal release.
    const finalFailure = control.failure();
    if (finalFailure) {
      report.evidenceStatus = 'INCOMPLETE'; report.failure = finalFailure;
      report.scope = `Incomplete invocation: ${report.records.length}/${plan.schedule.length} validated trajectory records; ${finalFailure}.`;
      try {
        await writeStatus(); // Invalidate any earlier success receipt first.
        await writeReport();
      } catch (error) {
        control.abort(`Incomplete-output replacement failed: ${String(error)}`);
        // Raw worker journals remain. A failed replacement must not leave
        // success-labelled report files at the canonical result paths.
        await Promise.allSettled(['result.json', 'result.md'].map(name => rm(path.join(directory, name), { force: true })));
        try { await writeStatus(); }
        catch { await rm(path.join(directory, 'status.json'), { force: true }).catch(() => {}); }
      }
    }
  } finally {
    // Synchronous release comes after every awaited write/replacement/removal.
    // The independent deadline stays armed even if one of those operations hangs.
    control.releaseGuard(true); control.releaseSignals();
  }
}

export async function collectParallelEvidence(directory: string, plan: ParallelPlan, source: Source) {
  const all = new FullWindowSamples(plan.maximumSamples, TUNING.phase2Evidence.maximumTimingBytes);
  const records: EvidenceRecord[] = [], workers: unknown[] = [], problems: string[] = [];
  for (let index = 0; index < plan.limits.workers; index++) {
    const folder = workerDirectory(directory, index), assigned = plan.assignments[index];
    try {
      const first = await readMetadata(path.join(folder, 'source.json')) as Source & { assignmentSha256: string; scheduleSha256: string };
      if (first.sourceManifestSha256 !== source.sourceManifestSha256 || runtimeSignature(first) !== runtimeSignature(source)
        || first.assignmentSha256 !== plan.assignmentHashes[index] || first.scheduleSha256 !== plan.scheduleSha256) throw new Error('Worker source/runtime/assignment identity differs');
      const journal = await readRecords(path.join(folder, 'records.jsonl'), assigned, plan.limits.recordBytesPerWorker);
      const maximumSamples = assigned.reduce((sum, spec) => sum + Math.ceil(spec.horizonSeconds * spec.tickHz), 0);
      const timing = await mergeTimingFile(path.join(folder, 'timings.f64le'), all, maximumSamples, plan.limits.timingChunkSamples, journal.rows);
      records.push(...journal.rows);
      if (journal.incompleteReason) problems.push(`Worker ${index}: ${journal.incompleteReason}`);
      if (journal.rows.length !== assigned.length || timing.unattributedSamples) problems.push(`Worker ${index}: incomplete shard or unattributed timing tail`);
      let state: unknown = null, finalSource: Source | null = null;
      try { state = await readMetadata(path.join(folder, 'status.json')); finalSource = await readMetadata(path.join(folder, 'source-final.json')) as Source; }
      catch { problems.push(`Worker ${index}: missing final receipt/source check`); }
      if ((state as { status?: string } | null)?.status !== 'COMPLETE') problems.push(`Worker ${index}: no complete exit receipt`);
      const receipt = state as { persistedSamples?: number; artifacts?: { timingsSha256?: string; recordsSha256?: string } } | null;
      if (receipt?.persistedSamples !== timing.samples || receipt.artifacts?.timingsSha256 !== timing.sha256
        || receipt.artifacts?.recordsSha256 !== journal.sha256) problems.push(`Worker ${index}: exit artifact hashes/counts not verified`);
      if (!finalSource || finalSource.sourceManifestSha256 !== source.sourceManifestSha256 || runtimeSignature(finalSource) !== runtimeSignature(source)) problems.push(`Worker ${index}: final source/runtime not verified`);
      workers.push({ index, source: `worker-${index}/source.json`, finalSource: `worker-${index}/source-final.json`, state,
        records: { path: `worker-${index}/records.jsonl`, bytes: journal.bytes, sha256: journal.sha256, count: journal.rows.length },
        timings: { path: `worker-${index}/timings.f64le`, encoding: 'IEEE-754 Float64 little-endian milliseconds', ...timing } });
    } catch (error) { problems.push(`Worker ${index}: ${String(error).slice(0, plan.limits.maximumChildLogBytes)}`); }
  }
  records.sort((a, b) => a.ordinal - b.ordinal);
  const ordinals = new Set(records.map(record => record.ordinal));
  if (ordinals.size !== records.length) problems.push('Duplicate trajectory ordinals');
  const missingOrdinals = plan.schedule.filter(spec => !ordinals.has(spec.ordinal)).map(spec => spec.ordinal);
  const summary = summarizeTrajectories(records);
  if (missingOrdinals.length) problems.push(`${missingOrdinals.length} planned trajectories have no validated record`);
  if (summary.errors || summary.incompleteEvidence) problems.push('Trajectory errors or incomplete physical evidence');
  if (all.count !== summary.stepAttempts) problems.push('Persisted timing count differs from validated record step attempts');
  return { records, workers, problems, missingOrdinals, summary, timing: all.summary() };
}

export async function runParallelEvidence(directory: string) {
  const plan = makeParallelPlan(), source = await provenance(), settings = plan.limits;
  const started = performance.now(), before = process.memoryUsage(), initialMemory = memoryReading();
  await mkdir(directory, { recursive: false });
  let failure: string | null = null, phase = 'preflight';
  const children: EvidenceChild[] = [];
  let abortResolve!: () => void;
  const aborted = new Promise<void>(resolve => { abortResolve = resolve; });
  const abort = (reason: string) => { if (!failure) { failure = reason; abortResolve(); } };
  const checked = async <T>(work: Promise<T>) => Promise.race([work, aborted.then(() => { throw new Error(failure ?? 'Interrupted'); })]);
  const onSignal = () => abort('Operator interrupted the offline benchmark');
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  let statusTask: Promise<unknown> = Promise.resolve();
  const status = () => {
    // Phase transitions and resource sampling share this one atomic-output path.
    // Serialize them so their temporary files cannot collide.
    statusTask = statusTask.catch(() => {}).then(() => writeMetadata(path.join(directory, 'status.json'), { status: 'INCOMPLETE', phase, failure,
      planned: plan.schedule.length, observedRecordReceipts: children.reduce((sum, child) => sum + (child.latest?.records ?? 0), 0),
      sourceManifestSha256: source.sourceManifestSha256, scheduleSha256: plan.scheduleSha256, at: new Date().toISOString() }));
    return statusTask;
  };
  const deadline = Date.now() + settings.maximumWallMs;
  let watchdog: ReturnType<typeof startWatchdog> | undefined, timer: NodeJS.Timeout | undefined, sampleTask: Promise<void> | undefined;
  let sampleCount = 0, retainedSamples = 0, resourceBytes = 0, lastRetained = -Infinity;
  let peakOwnedRssBytes = before.rss, minimumAvailableBytes = initialMemory.availableBytes, minimumRawFreeBytes = initialMemory.rawFreeBytes;
  let teardown: Awaited<ReturnType<EvidenceChild['stop']>>[] = [];
  let lastProgressCount = -1;
  const progress = () => {
    const count = children.reduce((sum, child) => sum + (child.latest?.records ?? 0), 0);
    if (count !== lastProgressCount) {
      lastProgressCount = count;
      console.log(JSON.stringify({ status: 'INCOMPLETE', phase, observedRecords: count, planned: plan.schedule.length,
        workers: children.map(child => ({ index: child.index, records: child.latest?.records ?? 0, ordinal: child.latest?.currentOrdinal ?? null })), wallSeconds: (performance.now() - started) / 1000 }));
    }
  };
  const takeSample = async (force = false) => {
    const rss = await ownedRss(children), memory = memoryReading();
    sampleCount++; peakOwnedRssBytes = Math.max(peakOwnedRssBytes, rss.totalBytes);
    minimumRawFreeBytes = Math.min(minimumRawFreeBytes, memory.rawFreeBytes);
    if (memory.availableBytes !== null) minimumAvailableBytes = Math.min(minimumAvailableBytes ?? Infinity, memory.availableBytes);
    const refusal = memoryRefusal(memory, 'ongoing', rss.totalBytes, plan); if (refusal) abort(refusal);
    if (force || performance.now() - lastRetained >= settings.resourceRetainMs) {
      const row = { sampleCount, phase, monotonicMs: performance.now(), at: new Date().toISOString(), memory, rss,
        controllerMemory: process.memoryUsage(), workerProgress: children.map(child => child.latest) };
      const text = JSON.stringify(row) + '\n', bytes = Buffer.byteLength(text);
      if (resourceBytes + bytes > settings.maximumResourceBytes) throw new Error('Resource journal byte cap reached');
      await appendFile(path.join(directory, 'resources.jsonl'), text); resourceBytes += bytes; retainedSamples++;
      lastRetained = performance.now(); await status();
    }
  };
  const sample = (force = false): Promise<void> => {
    if (sampleTask) return force ? sampleTask.then(() => sample(true)) : Promise.resolve();
    sampleTask = takeSample(force).catch(error => abort(`Resource sampling failed: ${String(error)}`)).finally(() => { sampleTask = undefined; });
    return sampleTask;
  };
  try {
    await writeMetadata(path.join(directory, 'manifest.json'), { status: 'INCOMPLETE', source, plan, initialMemory,
      scope: 'Four independent local workers on one shared host; fixed 1,000-trajectory schedule. No human, production-capacity or network verdict.',
      memoryPolicy: 'Offline-only version-pinned availableMemory heuristic. Raw free is recorded separately. Socket-load eligibility is unchanged.' });
    await status();
    const refusal = memoryRefusal(initialMemory, 'initial', before.rss, plan); if (refusal) throw new Error(refusal);
    if (path.resolve(process.argv[1] ?? '') !== fileURLToPath(new URL('./phase2-parallel-entry.mjs', import.meta.url))) {
      throw new Error('Guarded runs require the native phase2-parallel-entry.mjs entrypoint; external compiler helpers are excluded.');
    }
    const controllerRssLimit = settings.maximumTotalRssBytes - settings.workers * settings.maximumWorkerRssBytes;
    if (controllerRssLimit <= 0) throw new Error('No controller RSS reserve in the root envelope');
    watchdog = startWatchdog({ parentPid: process.ppid, deadline, maximumWallMs: settings.maximumWallMs,
      maximumRssBytes: controllerRssLimit, minimumAvailableBytes: settings.minimumOngoingAvailableBytes,
      sampleMs: settings.sampleMs, shutdownGraceMs: settings.shutdownGraceMs, heapMiB: settings.watchdogHeapMiB,
      sentinelPath: path.join(directory, 'watchdog.json'), runtime: settings.availableMemoryRuntime }, abort);
    await watchdog.ready;
    phase = 'freezing-source'; await status();
    const sourceRoot = path.join(directory, 'source'); await freezeSource(source, sourceRoot, settings.maximumSourceBytes);
    if (failure) throw new Error(failure);
    phase = 'starting-workers'; await status();
    for (let index = 0; index < settings.workers; index++) {
      if (failure) throw new Error(failure);
      const outputDirectory = workerDirectory(directory, index); await mkdir(outputDirectory, { recursive: false });
      const job: WorkerJob = { schema: 'phase2-parallel-job-1', index, parentPid: process.pid, deadline, outputDirectory,
        expectedSource: source.sourceManifestSha256, expectedRuntime: runtimeSignature(source), scheduleSha256: plan.scheduleSha256,
        assignmentSha256: plan.assignmentHashes[index] };
      const jobPath = path.join(outputDirectory, 'job.json'); await writeMetadata(jobPath, job);
      await writeMetadata(path.join(outputDirectory, 'status.json'), { status: 'INCOMPLETE', phase: 'not-ready', index });
      children.push(new EvidenceChild(index, path.join(sourceRoot, 'scripts/phase2-parallel-worker-entry.mjs'), jobPath, sourceRoot, plan, abort, progress));
    }
    timer = setInterval(() => { void sample(); }, settings.sampleMs);
    await checked(Promise.all(children.map(child => child.ready)));
    for (const child of children) if (child.latest?.sourceSha256 !== source.sourceManifestSha256 || child.latest.runtimeSha256 !== runtimeSignature(source)) throw new Error('Ready worker identity mismatch');
    phase = 'fixed-matrix'; await status(); await sample(true);
    await checked(Promise.all(children.map(child => child.exit)));
  } catch (error) { abort(error instanceof Error ? error.message : String(error)); }
  finally {
    phase = 'stopping-owned-workers'; if (timer) clearInterval(timer);
    if (sampleTask) await sampleTask;
    teardown = await Promise.all(children.map(child => child.stop()));
    for (const child of children) {
      try { await writeFile(path.join(workerDirectory(directory, child.index), 'worker.log'), Buffer.concat(child.logs)); }
      catch (error) { abort(`Worker log output failed: ${String(error)}`); }
    }
    try { await status(); } catch (error) { abort(`Stop receipt failed: ${String(error)}`); }
  }
  phase = 'collecting';
  let collected: Awaited<ReturnType<typeof collectParallelEvidence>>;
  try { collected = await collectParallelEvidence(directory, plan, source); }
  catch (error) {
    abort(`Collection failed: ${String(error)}`);
    collected = { records: [], workers: [], problems: [failure!], missingOrdinals: plan.schedule.map(spec => spec.ordinal),
      summary: summarizeTrajectories([]), timing: new FullWindowSamples(1, TUNING.phase2Evidence.maximumTimingBytes).summary() };
  }
  if (teardown.length !== settings.workers || teardown.some(row => row.code !== 0)) abort('Not all four owned workers exited successfully');
  if (collected.problems.length) abort(collected.problems[0]);
  const complete = !failure && collected.records.length === plan.schedule.length;
  const report: ParallelReport = { ...source, schema: 'phase2-parallel-result-1', generatedAt: new Date().toISOString(), mode: 'full',
    evidenceStatus: complete ? 'COMPLETE' : 'INCOMPLETE', failure,
    scope: `${complete ? 'Complete fixed matrix' : 'Incomplete partial evidence'}: ${collected.records.length}/${plan.schedule.length} validated trajectory records. Four local workers; no aggregate claim from missing ordinals.`,
    humanFun: 'NOT EVALUATED', humanRescueStop: 'NOT EVALUATED', productionQualification: 'NOT TESTED',
    wallSeconds: (performance.now() - started) / 1000, processMemoryBefore: before, processMemoryAfter: process.memoryUsage(),
    timingMethod: complete ? 'Exact nearest-rank quantiles over every raw Float64LE simulation.step timing from all four workers.'
      : 'Exact nearest-rank quantiles over validated persisted raw timing prefixes only; interrupted/unflushed attempts may be absent.',
    timingReconciliation: `${collected.timing.count} persisted samples versus ${collected.summary.stepAttempts} validated record step attempts. ${complete ? 'Counts reconcile for the complete invocation.' : 'No full-window completeness claim; missing, corrupt or unflushed tails remain unknown.'}`,
    executionModel: 'Four independent child processes execute fixed disjoint ordinal shards. Step timing excludes policy, snapshot, async yields, IO, transport and scheduling. Shared-host contention is uncontrolled. Controller and separate worker RSS are sampled; no per-room attribution or production topology is claimed.',
    isolatedStepMs: collected.timing, summary: collected.summary, records: collected.records,
    strata: PHASE2_SCENES.flatMap(scene => TUNING.phase2Evidence.teamSizes.flatMap(playerCount => PHASE2_POLICIES.flatMap(policy => {
      const rows = collected.records.filter(row => row.scene === scene && row.playerCount === playerCount && row.policy === policy);
      return rows.length ? [{ scene, playerCount, policy, metrics: summarizeTrajectories(rows) }] : [];
    }))),
    parallel: { workers: collected.workers, missingOrdinals: collected.missingOrdinals, problems: collected.problems,
      scheduleSha256: plan.scheduleSha256, limits: settings, teardown, allOwnedExitsObserved: teardown.length === children.length,
      resource: { sampleCount, retainedSamples, resourceBytes, peakOwnedRssBytes, minimumAvailableBytes, minimumRawFreeBytes,
        policy: 'Version-identified process.availableMemory heuristic; raw free recorded separately. RSS/available guards are sampled and can overshoot between observations.' } },
  };
  await finalizeParallelEvidence(directory, report, plan, { validatedRecords: collected.records.length,
    planned: plan.schedule.length, missingOrdinals: collected.missingOrdinals, samples: collected.timing.count, teardown },
  { failure: () => failure, abort, releaseGuard: force => watchdog?.release(force) ?? true,
    releaseSignals: () => { process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal); } });
  return { directory, report };
}

export async function parallelMain() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => !['--plan', '--run'].includes(arg))) throw new Error('Usage: phase2-parallel.ts [--plan|--run]; all numerical limits and the unchanged schedule come from root tuning.');
  await mkdir('reports', { recursive: true });
  if (!args.includes('--run')) {
    const plan = makeParallelPlan(), source = await provenance(), memory = memoryReading();
    const result = await writeMetadata('reports/phase2-parallel-plan.json', { status: 'PREPARED_NOT_STARTED', plan, source, memory,
      preflightRefusal: memoryRefusal(memory, 'initial', process.memoryUsage().rss, plan),
      scope: 'No workers or trajectories launched. --run explicitly starts the fixed 1,000 job on a new frozen source snapshot.' });
    console.log(JSON.stringify({ ...result, workers: plan.limits.workers, trajectories: plan.schedule.length, maximumSamples: plan.maximumSamples,
      maximumTimingFileBytes: plan.maximumTimingFileBytes, reservedOutputBytes: plan.reservedOutputBytes }));
  } else {
    const directory = path.resolve('reports', `phase2-parallel-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`);
    const result = await runParallelEvidence(directory);
    console.log(JSON.stringify({ directory, status: result.report.evidenceStatus, failure: result.report.failure,
      trajectories: result.report.records.length, planned: TUNING.phase2Evidence.trajectoryRuns, samples: result.report.isolatedStepMs.count }));
    if (result.report.evidenceStatus !== 'COMPLETE') process.exitCode = 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await parallelMain();
