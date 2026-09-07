import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { LocalLoadTuning } from './local-load-model';

type Reply = { id?: number; result?: unknown; error?: string };
/** Owns only directly forked children; never reads pidfiles, signals a group, or adopts a PID. */
export class LocalChild {
  readonly child: ChildProcess;
  readonly exit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  readonly logs: string[] = [];
  private logBytes = 0;
  private nextId = 0;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  private exited = false;
  constructor(readonly role: 'authority' | 'generator', readonly settings: LocalLoadTuning) {
    const env: NodeJS.ProcessEnv = { ...process.env, BELAY_LOCAL_LOAD_WALL_MS: String(settings.maximumWallMs) };
    delete env.BELAY_SESSION_SECRET;
    this.child = fork(fileURLToPath(new URL('./local-load-worker.ts', import.meta.url)), [role], {
      execArgv: ['--import', 'tsx', `--max-old-space-size=${role === 'authority' ? settings.authorityHeapMiB : settings.generatorHeapMiB}`],
      env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], serialization: 'advanced',
    });
    const log = (chunk: Buffer) => {
      const available = Math.max(0, settings.maximumChildLogBytes - this.logBytes);
      if (available) { this.logs.push(chunk.subarray(0, available).toString()); this.logBytes += Math.min(chunk.length, available); }
    };
    this.child.stdout?.on('data', log); this.child.stderr?.on('data', log);
    this.child.on('message', (reply: Reply) => {
      if (reply.id === undefined) return;
      const entry = this.pending.get(reply.id); if (!entry) return;
      clearTimeout(entry.timer); this.pending.delete(reply.id);
      if (reply.error) entry.reject(new Error(reply.error)); else entry.resolve(reply.result);
    });
    this.exit = new Promise(resolve => {
      this.child.once('error', error => this.rejectPending(error));
      this.child.once('exit', (code, signal) => {
        this.exited = true; this.rejectPending(new Error(`Owned ${role} exited (${code ?? signal})`)); resolve({ code, signal });
      });
    });
  }
  private rejectPending(error: Error) {
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(error); }
    this.pending.clear();
  }
  request<T>(command: string, value?: unknown, timeout = this.settings.startupTimeoutMs): Promise<T> {
    if (this.exited || !this.child.connected) return Promise.reject(new Error(`Owned ${this.role} is unavailable`));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${this.role}:${command} timeout`)); }, timeout);
      this.pending.set(id, { resolve: value => resolve(value as T), reject, timer });
      this.child.send({ id, command, value }, error => {
        if (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
      });
    });
  }
  async stop() {
    if (!this.exited) {
      try { await this.request('shutdown', undefined, this.settings.shutdownGraceMs); } catch { /* Escalate only this child. */ }
      if (!this.exited) this.child.kill('SIGTERM');
    }
    const timer = setTimeout(() => { if (!this.exited) this.child.kill('SIGKILL'); }, this.settings.shutdownGraceMs);
    try { return { pid: this.child.pid, role: this.role, ...await this.exit }; }
    finally { clearTimeout(timer); }
  }
}
