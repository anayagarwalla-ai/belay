import { open } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { TUNING } from '../tuning';
import { initializePhysics } from '../shared/simulation';
import { runTrajectoryAsync } from './phase2-harness';
import { hashFile, provenance } from './phase2-report';
import { appendRecord, makeParallelPlan, RawTimingJournal, readMetadata, runtimeSignature, validWorkerJob, writeMetadata,
  type WorkerJob, type WorkerProgress } from './phase2-parallel-core';
import { startWatchdog } from './phase2-parallel-watchdog';

if (!process.send || !process.connected || process.argv.length !== 3) process.exit(1);
const job = await readMetadata(process.argv[2]) as WorkerJob;
const plan = makeParallelPlan(); validWorkerJob(job, plan);
if (process.ppid !== job.parentPid) process.exit(1);
const settings = plan.limits, assigned = plan.assignments[job.index];
let failure: string | null = null, completed = 0, recordBytes = 0, currentOrdinal: number | null = null, currentTick: number | null = null;
const stop = (reason: string) => { failure ??= reason; };
process.on('SIGINT', () => stop('Worker interrupted')); process.on('SIGTERM', () => stop('Worker terminated'));
process.on('disconnect', () => stop('Worker lost IPC parent'));
process.on('message', message => {
  if (JSON.stringify(message).length > TUNING.network.maximumFrameBytes) stop('Oversized controller message');
  else if ((message as { type?: string })?.type === 'stop') stop('Controller requested termination');
  else stop('Unknown controller message');
});
const watchdog = startWatchdog({ parentPid: job.parentPid, deadline: job.deadline, maximumWallMs: settings.maximumWallMs,
  maximumRssBytes: settings.maximumWorkerRssBytes, minimumAvailableBytes: settings.minimumOngoingAvailableBytes,
  sampleMs: settings.sampleMs, shutdownGraceMs: settings.shutdownGraceMs, heapMiB: settings.watchdogHeapMiB,
  sentinelPath: path.join(job.outputDirectory, 'watchdog.json'), runtime: settings.availableMemoryRuntime }, stop);
let raw: RawTimingJournal | undefined, recordsFile: Awaited<ReturnType<typeof open>> | undefined;
let sourceSha256 = '', runtimeSha256 = '';
const checkpoint = async (type: WorkerProgress['type'], force = false) => {
  if (!force && performance.now() - lastCheckpoint < settings.sampleMs) return;
  lastCheckpoint = performance.now();
  await raw?.flush();
  const progress: WorkerProgress = { type, index: job.index, records: completed, samples: raw?.count ?? 0,
    persistedSamples: raw?.persistedCount ?? 0, recordBytes, currentOrdinal, currentTick, sourceSha256, runtimeSha256, failure };
  await writeMetadata(path.join(job.outputDirectory, 'status.json'), { status: 'INCOMPLETE',
    phase: type, progress, memory: process.memoryUsage(), at: new Date().toISOString() });
  if (!process.connected) throw new Error('IPC parent disappeared');
  await new Promise<void>((resolve, reject) => process.send!(progress, error => error ? reject(error) : resolve()));
};
let lastCheckpoint = -Infinity;
try {
  const guard = await watchdog.ready;
  if (failure) throw new Error(failure);
  const source = await provenance(); sourceSha256 = source.sourceManifestSha256; runtimeSha256 = runtimeSignature(source);
  if (sourceSha256 !== job.expectedSource || runtimeSha256 !== job.expectedRuntime) throw new Error('Worker source/runtime differs from the frozen controller manifest.');
  const ownPath = source.files.find(file => file.path === 'scripts/phase2-parallel-worker-entry.mjs');
  if (source.runtime.entrypointSha256 !== ownPath?.sha256) throw new Error('Worker entrypoint hash differs from the source snapshot.');
  await writeMetadata(path.join(job.outputDirectory, 'source.json'), { ...source, guard, assignmentSha256: job.assignmentSha256,
    scheduleSha256: job.scheduleSha256, parentPid: job.parentPid, pid: process.pid });
  const capacity = assigned.reduce((sum, spec) => sum + Math.ceil(spec.horizonSeconds * spec.tickHz), 0);
  raw = await RawTimingJournal.create(path.join(job.outputDirectory, 'timings.f64le'), capacity,
    TUNING.phase2Evidence.maximumTimingBytes, settings.timingChunkSamples);
  recordsFile = await open(path.join(job.outputDirectory, 'records.jsonl'), 'wx');
  await initializePhysics();
  await checkpoint('ready', true);
  for (const spec of assigned) {
    if (failure) break;
    currentOrdinal = spec.ordinal; currentTick = 0;
    const before = raw.count;
    const { record } = await runTrajectoryAsync(spec, raw, false, { stopReason: () => failure,
      onYield: async () => { currentTick = raw!.count - before; await checkpoint('progress'); } });
    currentTick = record.ticks;
    await raw.flush();
    recordBytes = await appendRecord(recordsFile, record, recordBytes, settings.recordBytesPerWorker);
    completed++;
    // Retain simulation errors and continue the fixed schedule, as the sequential
    // benchmark does. Only operational cancellation/IO/source/resource failure stops a shard.
    await checkpoint('progress', true);
  }
  const finalSource = await provenance();
  await writeMetadata(path.join(job.outputDirectory, 'source-final.json'), finalSource);
  if (finalSource.sourceManifestSha256 !== sourceSha256 || runtimeSignature(finalSource) !== runtimeSha256) stop('Frozen source/runtime changed during worker execution');
  if (completed !== assigned.length) stop('Worker stopped before its complete assigned shard');
  currentOrdinal = null; currentTick = null;
  await checkpoint('done', true);
} catch (error) { stop(error instanceof Error ? error.message : String(error)); }
finally {
  const closed = await Promise.allSettled([raw?.close(), recordsFile?.close()]);
  for (const result of closed) if (result.status === 'rejected') stop(`Final journal flush failed: ${String(result.reason)}`);
  let artifacts: { timingsSha256: string; recordsSha256: string } | null = null;
  try {
    if (raw && recordsFile) artifacts = { timingsSha256: await hashFile(path.join(job.outputDirectory, 'timings.f64le')),
      recordsSha256: await hashFile(path.join(job.outputDirectory, 'records.jsonl')) };
  } catch (error) { stop(`Artifact hashing failed: ${String(error)}`); }
  try { await writeMetadata(path.join(job.outputDirectory, 'status.json'), { status: failure ? 'INCOMPLETE' : 'COMPLETE',
    phase: 'exit', completed, assigned: assigned.length, persistedSamples: raw?.persistedCount ?? 0,
    observedSamples: raw?.count ?? 0, recordBytes, artifacts, failure, memory: process.memoryUsage(), at: new Date().toISOString() }); }
  catch (error) { stop(`Final exit receipt failed: ${String(error)}`); }
  await watchdog.disarm();
}
process.exit(failure ? 1 : 0);
