import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer as createHttpServer, request } from 'node:http';
import { createServer } from 'node:net';
import { chmod, link, lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { TUNING } from '../tuning';

export const LIMITS = TUNING.tools.operations;
const tokenPattern = new RegExp(`^[a-f0-9]{${TUNING.server.tokenBytes * 2}}$`);
export const projectRoot = fileURLToPath(new URL('..', import.meta.url));
export type Kind = 'dev' | 'playtest';
export type SessionRecord = {
  schema: 1; id: string; kind: Kind; root: string; pid: number; processStart: string;
  controlPort: number; openedAt: string; state: 'starting' | 'ready' | 'stopping';
  secret?: string; devSessionId?: string; expiresAt?: string;
};
export const sessionPath = (root: string, kind: Kind) => join(root, 'work', `${kind}-session.json`);
export const isMain = (url: string) => Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(url);
export const errorCode = (error: unknown) => (error as NodeJS.ErrnoException)?.code;
export const failureMessage = (error: unknown) => error instanceof Error ? error.message : 'Operation failed.';
export const isAlive = (pid: number) => {
  try { process.kill(pid, 0); return true; } catch (error) { return errorCode(error) !== 'ESRCH'; }
};
const exec = promisify(execFile);
async function processStart(pid: number): Promise<string | null> {
  if (!isAlive(pid)) return null;
  try { return (await exec('ps', ['-p', String(pid), '-o', 'lstart='])).stdout.trim() || null; }
  catch { if (!isAlive(pid)) return null; throw new Error('Cannot verify the session process with ps; no process was signaled.'); }
}

/** Private writes replace atomically, so an old world-readable file cannot keep its mode. */
export async function writePrivate(path: string, data: unknown, exclusive = false) {
  const temporary = `${path}.${randomBytes(TUNING.server.tokenBytes).toString('hex')}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    if (exclusive) await link(temporary, path);
    else {
      const { rename } = await import('node:fs/promises');
      await rename(temporary, path);
    }
  } finally { await rm(temporary, { force: true }); }
}

export async function readSession(root: string, kind: Kind): Promise<SessionRecord | null> {
  const path = sessionPath(root, kind);
  let value: unknown;
  try {
    const info = await lstat(path);
    if (!info.isFile() || (info.mode & 0o077) !== 0) throw new Error(`${kind} session file must be a private regular file (mode 600).`);
    value = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return null;
    if (error instanceof SyntaxError) throw new Error(`${kind} session file is invalid; do not trust or signal its PID.`);
    throw error;
  }
  const record = value as SessionRecord;
  if (!record || record.schema !== 1 || record.kind !== kind || record.root !== await realpath(root)
    || !Number.isSafeInteger(record.pid) || record.pid <= 0 || typeof record.processStart !== 'string'
    || !tokenPattern.test(record.id) || !Number.isInteger(record.controlPort) || record.controlPort <= 0 || record.controlPort > 65535
    || !['starting', 'ready', 'stopping'].includes(record.state)
    || (kind === 'dev' && (typeof record.secret !== 'string' || !tokenPattern.test(record.secret)))) {
    throw new Error(`${kind} session file is from an old version, another checkout, or is invalid. No process was signaled. See docs/playtest-operations.md.`);
  }
  return record;
}

export async function ownerIsAlive(record: SessionRecord) {
  return await processStart(record.pid) === record.processStart;
}

export function control(record: SessionRecord, stop = false): Promise<{ id: string; state: SessionRecord['state'] }> {
  return new Promise((resolveRequest, reject) => {
    const req = request({ host: TUNING.server.host, port: record.controlPort, path: stop ? '/stop' : '/status',
      method: stop ? 'POST' : 'GET', headers: { authorization: `Bearer ${record.id}` }, timeout: LIMITS.probeTimeoutMs }, response => {
      let body = '';
      response.on('data', chunk => {
        body += chunk.toString();
        if (Buffer.byteLength(body) > TUNING.server.maximumAuthBodyBytes) req.destroy(new Error('Invalid session control response.'));
      });
      response.on('error', reject);
      response.on('end', () => {
        try {
          const result = JSON.parse(body) as { id: string; state: SessionRecord['state'] };
          if (response.statusCode !== 200 || result.id !== record.id) throw new Error();
          resolveRequest(result);
        } catch { reject(new Error('Session owner did not authenticate; no process was signaled.')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Session control timed out; no process was signaled.')));
    req.on('error', () => reject(new Error('Session owner is unavailable; no process was signaled.')));
    req.end();
  });
}

export class Session {
  readonly abort = new AbortController();
  readonly done: Promise<void>;
  private finish!: () => void;
  private cleanupHandlers: (() => void)[] = [];
  private server = createHttpServer((req, res) => {
    if (req.headers.authorization !== `Bearer ${this.record.id}`) { res.writeHead(403).end(); return; }
    if (req.url === '/stop' && req.method === 'POST') this.stop();
    else if (req.url !== '/status' || req.method !== 'GET') { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id: this.record.id, state: this.record.state }));
  });
  code = 0;
  record!: SessionRecord;
  private constructor() { this.done = new Promise(resolveDone => { this.finish = resolveDone; }); }
  static async create(root: string, kind: Kind, extra: Pick<SessionRecord, 'secret' | 'devSessionId' | 'expiresAt'> = {}) {
    root = await realpath(root);
    const session = new Session();
    await mkdir(join(root, 'work'), { recursive: true, mode: 0o700 });
    await chmod(join(root, 'work'), 0o700);
    await new Promise<void>((resolveListen, reject) => {
      session.server.once('error', reject);
      session.server.listen(0, TUNING.server.host, resolveListen);
    });
    const started = await processStart(process.pid);
    if (!started) { await session.closeControl(); throw new Error('Cannot establish process ownership.'); }
    session.record = { schema: 1, id: randomBytes(TUNING.server.tokenBytes).toString('hex'), kind, root, pid: process.pid,
      processStart: started, controlPort: (session.server.address() as { port: number }).port,
      openedAt: new Date().toISOString(), state: 'starting', ...extra };
    try { await writePrivate(sessionPath(root, kind), session.record, true); }
    catch (error) {
      await session.closeControl();
      if (errorCode(error) === 'EEXIST') throw new Error(`${kind} session already exists. Run npm run playtest:preflight for ownership/stale-file guidance; this run changed no session files.`);
      throw error;
    }
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      const handler = () => session.stop();
      process.on(signal, handler); session.cleanupHandlers.push(() => process.off(signal, handler));
    }
    return session;
  }
  stop(code = 0) {
    if (this.abort.signal.aborted) return;
    this.code = code; this.record.state = 'stopping'; this.abort.abort(); this.finish();
  }
  fail(message: string) { if (!this.abort.signal.aborted) console.error(message); this.stop(1); }
  async ready() {
    this.abort.signal.throwIfAborted();
    this.record.state = 'ready';
    await writePrivate(sessionPath(this.record.root, this.record.kind), this.record);
    this.abort.signal.throwIfAborted();
  }
  private async closeControl() {
    this.server.closeAllConnections();
    await new Promise<void>(resolveClose => this.server.close(() => resolveClose()));
  }
  async dispose(removeRecord = true) {
    this.stop(this.code);
    for (const remove of this.cleanupHandlers) remove();
    await this.closeControl();
    if (removeRecord) await removeOwnedRecord(this.record);
  }
}

async function removeOwnedRecord(record: SessionRecord) {
  const current = await readSession(record.root, record.kind);
  if (current?.id === record.id) await rm(sessionPath(record.root, record.kind), { force: true });
}

export async function stopSession(root: string, kind: Kind) {
  const record = await readSession(root, kind);
  if (!record) return { stopped: false, stale: false };
  if (!await ownerIsAlive(record)) {
    // No PID is ever signaled. IPC guardians stop children if the owner dies.
    if (kind === 'playtest') await rm(join(root, 'work', 'playtest-links.json'), { force: true });
    await removeOwnedRecord(record);
    return { stopped: false, stale: true };
  }
  await control(record, true);
  await waitFor(async () => {
    const current = await readSession(root, kind);
    return !current || current.id !== record.id;
  }, LIMITS.stopTimeoutMs, undefined, `${kind} teardown did not complete; check its terminal. No unrelated process was signaled.`);
  return { stopped: true, stale: false };
}

export async function waitFor(check: () => Promise<boolean>, timeoutMs: number, signal?: AbortSignal, message = 'Startup timed out.') {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    signal?.throwIfAborted();
    if (await check()) { signal?.throwIfAborted(); return; }
    if (Date.now() >= deadline) throw new Error(message);
    await new Promise<void>(resolveWait => {
      const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', finish); resolveWait(); };
      const timer = setTimeout(finish, Math.min(LIMITS.pollMs, Math.max(0, deadline - Date.now())));
      signal?.addEventListener('abort', finish, { once: true });
    });
  }
}

export async function assertPortsFree(ports: readonly number[]) {
  // Reserve the whole set while checking it. Never fall back to a different port.
  const reservations: ReturnType<typeof createServer>[] = [];
  try {
    for (const port of ports) {
      const server = createServer(); reservations.push(server);
      await new Promise<void>((resolveListen, reject) => {
        server.once('error', () => reject(new Error(`Port ${port} on ${TUNING.server.host} is occupied or unavailable. Stop its owning checkout or app; BELAY did not signal it.`)));
        server.listen({ host: TUNING.server.host, port, exclusive: true }, resolveListen);
      });
    }
  } finally { await Promise.all(reservations.map(server => new Promise<void>(done => server.close(() => done())))); }
}

export async function checkHttp(url: string, validate: (body: string) => boolean, headers: Record<string, string> = {}, signal?: AbortSignal) {
  try {
    const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(LIMITS.probeTimeoutMs), ...(signal ? [signal] : [])]) });
    if (!response.ok) { await response.body?.cancel(); return false; }
    return validate(await response.text());
  } catch { return false; }
}

/** Detached guardian owns a process group. IPC disconnect also tears it down after SIGKILL of the parent. */
export class OwnedProcess {
  private child: ChildProcess;
  readonly exited: Promise<number>;
  private closing = false;
  get pid() { return this.child.pid; }
  constructor(command: string[], root: string, env: NodeJS.ProcessEnv, onExit: (code: number) => void,
    onOutput?: (chunk: Buffer) => void) {
    this.child = spawn(process.execPath, ['--import', import.meta.resolve('tsx'), fileURLToPath(new URL('./owned-process.ts', import.meta.url)), ...command], {
      cwd: root, env, detached: true, stdio: ['ignore', onOutput ? 'pipe' : 'inherit', onOutput ? 'pipe' : 'inherit', 'ipc'],
    });
    let result = 1;
    this.exited = new Promise(resolveExit => {
      this.child.on('message', message => { if (message && typeof message === 'object' && 'code' in message && typeof message.code === 'number') result = message.code; });
      this.child.once('error', () => { resolveExit(1); if (!this.closing) onExit(1); });
      this.child.once('exit', () => { if (!this.closing) onExit(result); });
      this.child.once('close', () => resolveExit(result));
    });
    if (onOutput) { this.child.stdout?.on('data', onOutput); this.child.stderr?.on('data', onOutput); }
  }
  async stop() {
    this.closing = true;
    if (this.child.connected) this.child.send({ stop: true }, () => {});
    const fallback = setTimeout(() => {
      if (this.child.pid && this.child.exitCode === null && this.child.signalCode === null) {
        try { process.kill(-this.child.pid, 'SIGKILL'); } catch { /* the owned group already exited */ }
      }
    }, LIMITS.shutdownGraceMs + LIMITS.probeTimeoutMs);
    try {
      await this.exited;
      if (this.child.pid) await waitFor(async () => {
        try { process.kill(-this.child.pid!, 0); return false; } catch (error) { return errorCode(error) === 'ESRCH'; }
      }, LIMITS.shutdownGraceMs + LIMITS.probeTimeoutMs, undefined, 'Owned process group did not finish teardown; no success was recorded.');
    } finally { clearTimeout(fallback); }
  }
}

export function childEnvironment(secret?: string) {
  const env = { ...process.env };
  delete env.BELAY_SESSION_SECRET;
  if (secret) env.BELAY_SESSION_SECRET = secret;
  return env;
}
