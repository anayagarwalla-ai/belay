import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, open, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { TUNING } from '../tuning';
import { FullWindowSamples } from './phase2-analysis';
import type { EvidenceRecord } from './phase2-harness';
import { trajectorySchedule, type TrajectorySpec } from './phase2-policies';
import { hashFile, provenance, readBoundedJSON, writeBoundedJSON } from './phase2-report';

export type Source = Awaited<ReturnType<typeof provenance>>;
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const runtimeSignature = (source: Source) => digest({ assets: source.runtime.assets.map(({ role, sha256 }) => ({ role, sha256 })),
  nodeOptionsSha256: source.runtime.nodeOptionsSha256, node: source.machine.node });
export function partitionSchedule(schedule: readonly TrajectorySpec[], workers: number) {
  if (!Number.isSafeInteger(workers) || workers < 1 || workers > schedule.length) throw new Error('Invalid worker count.');
  const width = Math.ceil(schedule.length / workers);
  return Array.from({ length: workers }, (_, index) => schedule.slice(index * width, (index + 1) * width));
}
export function makeParallelPlan() {
  const schedule = trajectorySchedule(TUNING.phase2Evidence.trajectoryRuns);
  const profile = TUNING.phase2Evidence.parallel, shared = TUNING.localLoad;
  for (const value of [profile.maximumWallMs, profile.maximumWorkerRssBytes, profile.watchdogHeapMiB, profile.timingChunkSamples,
    profile.maximumMetadataBytes, profile.maximumFinalReportBytes, profile.maximumResourceBytes, profile.resourceRetainMs, profile.maximumOutputBytes]) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Invalid root parallel bound.');
  }
  if (profile.maximumWallMs > 0x7fffffff) throw new Error('Root deadline exceeds the supported timer range.');
  const assignments = partitionSchedule(schedule, profile.workers);
  const maximumSamples = schedule.reduce((sum, spec) => sum + Math.ceil(spec.horizonSeconds * spec.tickHz), 0);
  const maximumTimingFileBytes = maximumSamples * Float64Array.BYTES_PER_ELEMENT;
  const maximumShardBytes = Math.max(...assignments.map(rows => rows.reduce((sum, spec) => sum + Math.ceil(spec.horizonSeconds * spec.tickHz) * Float64Array.BYTES_PER_ELEMENT, 0)));
  const maximumTrajectoryBytes = Math.max(...schedule.map(spec => Math.ceil(spec.horizonSeconds * spec.tickHz) * Float64Array.BYTES_PER_ELEMENT));
  // Reserve combined storage/sort, a validated shard and its copy, trajectory
  // validation/storage/sort, and both IO chunks before creating any worker.
  const maximumLiveTimingBytes = maximumTimingFileBytes * 2 + maximumShardBytes * 2 + maximumTrajectoryBytes * 3
    + profile.timingChunkSamples * Float64Array.BYTES_PER_ELEMENT * 2;
  if (maximumLiveTimingBytes > TUNING.phase2Evidence.maximumTimingBytes) throw new Error('Exact combined timing storage/sort exceeds the root memory bound.');
  const reservedOutputBytes = maximumTimingFileBytes + TUNING.phase2Evidence.maximumReportBytes * 2 + profile.maximumResourceBytes
    + profile.maximumFinalReportBytes * 2 + profile.maximumMetadataBytes * (profile.workers * 6 + 8) + shared.maximumChildLogBytes * profile.workers;
  if (reservedOutputBytes > profile.maximumOutputBytes) throw new Error('Worst-case artifact reservations exceed the root output bound.');
  return { schema: 'phase2-parallel-1', schedule, scheduleSha256: digest(schedule), assignments,
    assignmentHashes: assignments.map(digest), maximumSamples, maximumTimingFileBytes, maximumLiveTimingBytes, reservedOutputBytes,
    limits: { ...profile, childHeapMiB: shared.generatorHeapMiB, maximumTotalRssBytes: shared.maximumTotalRssBytes,
      sampleMs: shared.sampleMs,
      startupTimeoutMs: shared.startupTimeoutMs, shutdownGraceMs: shared.shutdownGraceMs,
      maximumChildLogBytes: shared.maximumChildLogBytes, recordBytesPerWorker: Math.floor(TUNING.phase2Evidence.maximumReportBytes / profile.workers),
      maximumSourceBytes: TUNING.phase2Evidence.maximumReportBytes } };
}
export type ParallelPlan = ReturnType<typeof makeParallelPlan>;
export type MemoryReading = { rawFreeBytes: number; availableBytes: number | null; node: string; uv: string; platform: string };
export function memoryReading(): MemoryReading {
  const available = typeof process.availableMemory === 'function' ? process.availableMemory() : null;
  return { rawFreeBytes: os.freemem(), availableBytes: available, node: process.versions.node, uv: process.versions.uv, platform: process.platform };
}
export function memoryRefusal(reading: MemoryReading, stage: 'initial' | 'ongoing', ownedRssBytes: number, plan: ParallelPlan) {
  const expected = plan.limits.availableMemoryRuntime;
  if (reading.node !== expected.node || reading.uv !== expected.uv || reading.platform !== expected.platform
    || reading.availableBytes === null || !Number.isFinite(reading.availableBytes) || reading.availableBytes < 0) return 'Unsupported or unavailable version-identified availableMemory API';
  if (!Number.isFinite(ownedRssBytes) || ownedRssBytes > plan.limits.maximumTotalRssBytes) return 'Owned-process aggregate RSS ceiling reached';
  const floor = stage === 'initial' ? plan.limits.minimumInitialAvailableBytes : plan.limits.minimumOngoingAvailableBytes;
  return reading.availableBytes < floor ? `Offline ${stage} available-memory floor reached` : null;
}
export type WorkerJob = { schema: 'phase2-parallel-job-1'; index: number; parentPid: number; deadline: number;
  outputDirectory: string; expectedSource: string; expectedRuntime: string; scheduleSha256: string; assignmentSha256: string };
export type WorkerProgress = { type: 'ready' | 'progress' | 'done'; index: number; records: number; samples: number;
  persistedSamples: number; recordBytes: number; currentOrdinal: number | null; currentTick: number | null;
  sourceSha256: string; runtimeSha256: string; failure: string | null };
export function workerDirectory(directory: string, index: number) { return path.join(directory, `worker-${index}`); }
export function validWorkerJob(job: WorkerJob, plan: ParallelPlan) {
  if (job.schema !== 'phase2-parallel-job-1' || !Number.isSafeInteger(job.index) || job.index < 0 || job.index >= plan.limits.workers
    || !Number.isSafeInteger(job.parentPid) || job.parentPid <= 0 || !Number.isFinite(job.deadline)
    || job.deadline <= Date.now() || job.deadline > Date.now() + plan.limits.maximumWallMs
    || job.scheduleSha256 !== plan.scheduleSha256 || job.assignmentSha256 !== plan.assignmentHashes[job.index]) throw new Error('Worker job does not match the frozen root schedule.');
}
export async function freezeSource(source: Source, destination: string, maximumBytes: number) {
  await mkdir(destination, { recursive: false });
  let bytes = 0;
  for (const entry of source.files) {
    bytes += (await stat(entry.path)).size;
    if (bytes > maximumBytes) throw new Error('Source snapshot exceeds root byte bound.');
    const output = path.join(destination, entry.path);
    await mkdir(path.dirname(output), { recursive: true });
    await copyFile(entry.path, output);
    if (await hashFile(output) !== entry.sha256) throw new Error(`Source changed while freezing: ${entry.path}`);
    await chmod(output, 0o444);
  }
  return { bytes, sourceManifestSha256: source.sourceManifestSha256 };
}

/** Raw files are Float64 little-endian, preserving each measured double without JSON rounding. */
export class RawTimingJournal {
  private written = 0;
  declare readonly filename: string;
  declare readonly samples: FullWindowSamples;
  declare private readonly file: Awaited<ReturnType<typeof open>>;
  declare private readonly chunkSamples: number;
  private constructor(filename: string, samples: FullWindowSamples,
    file: Awaited<ReturnType<typeof open>>, chunkSamples: number) {
    this.filename = filename; this.samples = samples; this.file = file; this.chunkSamples = chunkSamples;
  }
  static async create(filename: string, capacity: number, maximumMemoryBytes: number, chunkSamples: number) {
    if (!Number.isSafeInteger(chunkSamples) || chunkSamples < 1) throw new Error('Invalid timing IO chunk.');
    return new RawTimingJournal(filename, new FullWindowSamples(capacity, maximumMemoryBytes), await open(filename, 'wx'), chunkSamples);
  }
  add(value: number) { this.samples.add(value); }
  get count() { return this.samples.count; }
  get persistedCount() { return this.written; }
  async flush() {
    while (this.written < this.count) {
      const values = this.samples.copyRange(this.written, Math.min(this.count, this.written + this.chunkSamples));
      const bytes = Buffer.alloc(values.length * Float64Array.BYTES_PER_ELEMENT);
      values.forEach((value, index) => bytes.writeDoubleLE(value, index * Float64Array.BYTES_PER_ELEMENT));
      let offset = 0;
      while (offset < bytes.length) {
        const result = await this.file.write(bytes, offset, bytes.length - offset, this.written * Float64Array.BYTES_PER_ELEMENT + offset);
        if (!result.bytesWritten) throw new Error('Raw timing write did not advance.');
        offset += result.bytesWritten;
      }
      this.written += values.length;
    }
  }
  async close() { try { await this.flush(); } finally { await this.file.close(); } }
}

export async function appendRecord(file: Awaited<ReturnType<typeof open>>, record: EvidenceRecord, usedBytes: number, maximumBytes: number) {
  const text = JSON.stringify(record) + '\n', bytes = Buffer.byteLength(text);
  if (usedBytes + bytes > maximumBytes) throw new Error('Worker record journal exceeds the root byte bound.');
  await file.writeFile(text);
  return usedBytes + bytes;
}
export async function mergeTimingFile(filename: string, target: FullWindowSamples, maximumSamples: number, chunkSamples: number,
  records: readonly EvidenceRecord[] = []) {
  if (!Number.isSafeInteger(chunkSamples) || chunkSamples < 1) throw new Error('Invalid timing IO chunk.');
  const file = await open(filename, 'r');
  try {
    const bytes = (await file.stat()).size;
    if (bytes % Float64Array.BYTES_PER_ELEMENT || bytes > maximumSamples * Float64Array.BYTES_PER_ELEMENT) throw new Error('Truncated or oversized raw timing file.');
    const validated = new FullWindowSamples(Math.max(1, bytes / Float64Array.BYTES_PER_ELEMENT), TUNING.phase2Evidence.maximumTimingBytes);
    const buffer = Buffer.alloc(chunkSamples * Float64Array.BYTES_PER_ELEMENT);
    let offset = 0;
    while (offset < bytes) {
      const length = Math.min(buffer.length, bytes - offset);
      let read = 0;
      while (read < length) {
        const result = await file.read(buffer, read, length - read, offset + read);
        if (!result.bytesRead) throw new Error('Raw timing file shrank during collection.');
        read += result.bytesRead;
      }
      for (let index = 0; index < length; index += Float64Array.BYTES_PER_ELEMENT) validated.add(buffer.readDoubleLE(index));
      offset += length;
    }
    if ((await file.stat()).size !== bytes) throw new Error('Raw timing file changed during collection.');
    let attributed = 0;
    for (const record of records) {
      if (attributed + record.stepAttempts > validated.count) throw new Error('Records claim more timings than were persisted.');
      const measured = new FullWindowSamples(Math.max(1, record.stepAttempts), TUNING.phase2Evidence.maximumTimingBytes);
      for (const value of validated.copyRange(attributed, attributed + record.stepAttempts)) measured.add(value);
      const summary = measured.summary();
      for (const key of Object.keys(summary) as (keyof typeof summary)[]) if (summary[key] !== record.stepExecutionMs[key]) throw new Error('Raw timings differ from a trajectory timing summary.');
      attributed += record.stepAttempts;
    }
    if (target.count + validated.count > target.capacity) throw new Error('Merged raw timings exceed planned capacity.');
    for (let start = 0; start < validated.count; start += chunkSamples) {
      for (const value of validated.copyRange(start, Math.min(validated.count, start + chunkSamples))) target.add(value);
    }
    return { bytes, samples: validated.count, unattributedSamples: validated.count - attributed, sha256: await hashFile(filename) };
  } finally { await file.close(); }
}
export function auditRecord(record: EvidenceRecord, spec: TrajectorySpec) {
  for (const key of Object.keys(spec) as (keyof TrajectorySpec)[]) if (record[key] !== spec[key]) throw new Error(`Record differs from planned ${key}.`);
  const cap = Math.ceil(spec.horizonSeconds * spec.tickHz);
  if (!Number.isSafeInteger(record.stepAttempts) || record.stepAttempts < 0 || record.stepAttempts > cap
    || !Number.isSafeInteger(record.ticks) || record.ticks < 0 || record.ticks > record.stepAttempts
    || record.stepExecutionMs.count !== record.stepAttempts) throw new Error('Record tick/timing count is invalid.');
  if (record.observedSeconds !== record.ticks / record.tickHz) throw new Error('Record exposure differs from its authority ticks.');
  if (record.ending === 'censored' && record.ticks !== cap) throw new Error('Shortened horizon cannot be labelled as a full-horizon censor.');
  if (record.ending === 'complete' && (spec.scene !== 'crossing' || record.runStatus !== 'complete')) throw new Error('Invalid crossing completion.');
  if (record.ending === 'failed' && record.runStatus !== 'failed') throw new Error('Invalid terminal failure.');
  if (record.ending === 'fixture-recovered' && (spec.scene !== 'rescue' || !record.episodes.length || record.episodes.some(row => row.status !== 'recovered'))) throw new Error('Invalid focused recovery.');
  if (!['complete', 'failed', 'fixture-recovered', 'censored', 'error'].includes(record.ending)) throw new Error('Unknown trajectory outcome.');
}
export async function readRecords(filename: string, expected: readonly TrajectorySpec[], maximumBytes: number) {
  const info = await stat(filename);
  if (info.size > maximumBytes) throw new Error('Record journal exceeds root bound.');
  const text = await readFile(filename, 'utf8');
  if (Buffer.byteLength(text) !== info.size) throw new Error('Record journal changed while reading.');
  const lastNewline = text.lastIndexOf('\n');
  let incompleteReason: string | null = text && !text.endsWith('\n') ? 'Trailing incomplete record was not counted' : null;
  const rows: EvidenceRecord[] = [];
  for (const line of text.slice(0, lastNewline + 1).split('\n').filter(Boolean)) {
    try {
      if (rows.length >= expected.length) throw new Error('Too many records in worker shard.');
      const row = JSON.parse(line) as EvidenceRecord; auditRecord(row, expected[rows.length]); rows.push(row);
    } catch (error) { incompleteReason = `Record prefix stopped: ${String(error)}`; break; }
  }
  return { rows, incompleteReason, bytes: info.size, sha256: await hashFile(filename) };
}
export const writeMetadata = (filename: string, value: unknown) => writeBoundedJSON(filename, value, TUNING.phase2Evidence.parallel.maximumMetadataBytes);
export const readMetadata = (filename: string) => readBoundedJSON(filename, TUNING.phase2Evidence.parallel.maximumMetadataBytes);
