import { execFile, fork, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { TUNING } from '../tuning';
import type { ParallelPlan, WorkerProgress } from './phase2-parallel-core';
const execute = promisify(execFile);

/** Directly owns one forked child. No PID-file adoption or signalling of unrelated groups. */
export class EvidenceChild {
  declare readonly index: number;
  declare readonly plan: ParallelPlan;
  readonly child: ChildProcess;
  readonly exit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  readonly ready: Promise<void>;
  latest: WorkerProgress | null = null;
  logs: Buffer[] = [];
  logBytes = 0;
  omittedLogBytes = 0;
  exited = false;
  private readyTimer: NodeJS.Timeout;
  constructor(index: number, entrypoint: string, jobPath: string, cwd: string, plan: ParallelPlan,
    onFailure: (reason: string) => void, onProgress: () => void = () => {}) {
    this.index = index; this.plan = plan;
    const env = { ...process.env }; delete env.BELAY_SESSION_SECRET;
    this.child = fork(entrypoint, [jobPath], { cwd, execArgv: [`--max-old-space-size=${plan.limits.childHeapMiB}`],
      env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], serialization: 'json' });
    const log = (chunk: Buffer) => {
      const room = Math.max(0, plan.limits.maximumChildLogBytes - this.logBytes), keep = Math.min(room, chunk.length);
      if (keep) { this.logs.push(Buffer.from(chunk.subarray(0, keep))); this.logBytes += keep; }
      this.omittedLogBytes += chunk.length - keep;
    };
    this.child.stdout?.on('data', log); this.child.stderr?.on('data', log);
    let readyResolve!: () => void, readyReject!: (error: Error) => void;
    this.ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    void this.ready.catch(() => {});
    this.readyTimer = setTimeout(() => { const error = new Error(`Worker ${index} startup timed out`); readyReject(error); onFailure(error.message); }, plan.limits.startupTimeoutMs);
    this.child.on('message', value => {
      try {
        if (Buffer.byteLength(JSON.stringify(value)) > TUNING.network.maximumFrameBytes) throw new Error('Oversized worker control message');
        const message = value as WorkerProgress, previous = this.latest;
        const assigned = plan.assignments[index], cap = assigned.reduce((sum, spec) => sum + Math.ceil(spec.horizonSeconds * spec.tickHz), 0);
        if (!['ready', 'progress', 'done'].includes(message.type) || message.index !== index
          || !Number.isSafeInteger(message.records) || message.records < (previous?.records ?? 0) || message.records > assigned.length
          || !Number.isSafeInteger(message.samples) || message.samples < (previous?.samples ?? 0) || message.samples > cap
          || !Number.isSafeInteger(message.persistedSamples) || message.persistedSamples < (previous?.persistedSamples ?? 0) || message.persistedSamples > message.samples
          || !Number.isSafeInteger(message.recordBytes) || message.recordBytes < (previous?.recordBytes ?? 0) || message.recordBytes > plan.limits.recordBytesPerWorker
          || typeof message.sourceSha256 !== 'string' || typeof message.runtimeSha256 !== 'string') throw new Error('Invalid worker progress message');
        if (previous && (previous.sourceSha256 !== message.sourceSha256 || previous.runtimeSha256 !== message.runtimeSha256)) throw new Error('Worker changed source/runtime identity');
        this.latest = message;
        if (message.type === 'ready') { clearTimeout(this.readyTimer); readyResolve(); }
        if (message.failure) onFailure(`Worker ${index}: ${message.failure}`);
        onProgress();
      } catch (error) { onFailure(`Worker ${index} IPC: ${String(error)}`); }
    });
    this.exit = new Promise(resolve => {
      this.child.once('error', error => { readyReject(error); onFailure(`Worker ${index} spawn: ${error.message}`); });
      this.child.once('close', (code, signal) => {
        this.exited = true; clearTimeout(this.readyTimer);
        if (this.latest?.type !== 'done' || code !== 0) {
          readyReject(new Error(`Worker ${index} exited before ready/completion`));
          onFailure(`Worker ${index} exited incomplete (${code ?? signal})`);
        }
        resolve({ code, signal });
      });
    });
  }
  async stop() {
    if (!this.exited && this.child.exitCode === null && this.child.signalCode === null) {
      if (this.child.connected) this.child.send({ type: 'stop' }, () => {});
      this.child.kill('SIGTERM');
    }
    const forced = setTimeout(() => { if (!this.exited) this.child.kill('SIGKILL'); }, this.plan.limits.shutdownGraceMs);
    try { return { index: this.index, pid: this.child.pid, ...await this.exit, omittedLogBytes: this.omittedLogBytes }; }
    finally { clearTimeout(forced); clearTimeout(this.readyTimer); }
  }
}

export async function ownedRss(children: readonly EvidenceChild[]) {
  const alive = children.filter(child => !child.exited && child.child.pid && child.child.exitCode === null && child.child.signalCode === null);
  const pids = [process.pid, ...alive.map(child => child.child.pid!)];
  const { stdout } = await execute('/bin/ps', ['-o', 'pid=,rss=', '-p', pids.join(',')], {
    timeout: TUNING.network.debugTimeoutMs, maxBuffer: TUNING.localLoad.maximumChildLogBytes,
  });
  const rows = stdout.trim().split('\n').filter(Boolean).map(line => {
    const match = /^\s*(\d+)\s+(\d+)\s*$/.exec(line);
    if (!match || !pids.includes(Number(match[1]))) throw new Error('Unrecognized owned-RSS observation');
    return { pid: Number(match[1]), rssBytes: Number(match[2]) * 1024 };
  });
  if (!rows.some(row => row.pid === process.pid)) throw new Error('Controller RSS is unavailable');
  for (const child of alive) if (!rows.some(row => row.pid === child.child.pid) && child.child.exitCode === null && child.child.signalCode === null) {
    throw new Error('Live owned child RSS is unavailable');
  }
  return { rows, totalBytes: rows.reduce((sum, row) => sum + row.rssBytes, 0) };
}
