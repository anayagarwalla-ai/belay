import { afterEach, describe, expect, it, vi } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, chmod, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Session, assertPortsFree, childEnvironment, control, isAlive, readSession, sessionPath, stopSession, waitFor, writePrivate } from '../scripts/operations';
import { TunnelOutput } from '../scripts/playtest';
import { installTunnel } from '../scripts/setup-tunnel';

const roots: string[] = [], sessions: Session[] = [], processes: ChildProcess[] = [];
const fixtures = fileURLToPath(new URL('./fixtures/operations-runner.ts', import.meta.url));
const secret = 'ab'.repeat(32);
const tempRoot = async () => { const root = await mkdtemp(join(tmpdir(), 'belay-operations-')); roots.push(root); return root; };
const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const exists = async (path: string) => { try { await stat(path); return true; } catch { return false; } };
const until = (check: () => Promise<boolean>, timeout = 10000) => waitFor(check, timeout);
async function port() {
  const server = createServer();
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const value = (server.address() as { port: number }).port;
  await new Promise<void>(done => server.close(() => done()));
  return value;
}
async function launch(root: string, options: Record<string, unknown>) {
  const config = join(root, `config-${processes.length}.json`); await writeFile(config, JSON.stringify({ root, ...options }));
  const child = spawn(process.execPath, ['--import', import.meta.resolve('tsx'), fixtures, config], { stdio: ['ignore', 'pipe', 'pipe'], env: childEnvironment() });
  processes.push(child);
  let output = '';
  child.stdout!.on('data', data => { output += data.toString(); }); child.stderr!.on('data', data => { output += data.toString(); });
  const exited = new Promise<number | null>(done => child.once('exit', done));
  return { child, exited, output: () => output };
}
async function localSession(root: string) {
  const session = await Session.create(root, 'dev', { secret }); sessions.push(session); await session.ready(); return session;
}
afterEach(async () => {
  vi.restoreAllMocks();
  for (const child of processes) if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  await Promise.all(processes.map(async child => {
    await until(async () => child.exitCode !== null || child.signalCode !== null).catch(() => child.kill('SIGKILL'));
  }));
  for (const session of sessions) await session.dispose();
  sessions.length = 0; processes.length = 0;
  for (const root of roots) await rm(root, { recursive: true, force: true }); roots.length = 0;
});

describe('session ownership and local readiness', () => {
  it('atomically rejects simultaneous duplicate startup without replacing the winning secret', async () => {
    const root = await tempRoot();
    const attempts = await Promise.allSettled([Session.create(root, 'dev', { secret }), Session.create(root, 'dev', { secret: 'cd'.repeat(32) })]);
    const winner = attempts.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<Session>;
    sessions.push(winner.value);
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await readSession(root, 'dev'))?.secret).toBe(winner.value.record.secret);
    expect((await stat(sessionPath(root, 'dev'))).mode & 0o777).toBe(0o600);
    expect((await control(winner.value.record)).state).toBe('starting');
  });
  it('replaces loose file permissions and never passes the backend secret to frontend/tunnel children', async () => {
    const root = await tempRoot(), path = join(root, 'private.json');
    await writeFile(path, '{}'); await chmod(path, 0o666); await writePrivate(path, { private: true });
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    const old = process.env.BELAY_SESSION_SECRET;
    process.env.BELAY_SESSION_SECRET = secret;
    expect(childEnvironment().BELAY_SESSION_SECRET).toBeUndefined();
    expect(childEnvironment(secret).BELAY_SESSION_SECRET).toBe(secret);
    if (old === undefined) delete process.env.BELAY_SESSION_SECRET; else process.env.BELAY_SESSION_SECRET = old;
  });
  it('authenticates stop without signaling the PID and safely cleans a reused-PID record', async () => {
    const root = await tempRoot(), session = await localSession(root);
    await expect(control({ ...session.record, id: 'ef'.repeat(32) }, true)).rejects.toThrow('authenticate');
    expect(session.abort.signal.aborted).toBe(false);
    const stale = { ...session.record, processStart: 'a different process generation' };
    await writePrivate(sessionPath(root, 'dev'), stale);
    expect(await stopSession(root, 'dev')).toEqual({ stopped: false, stale: true });
    expect(session.abort.signal.aborted).toBe(false);
    expect(await stopSession(root, 'dev')).toEqual({ stopped: false, stale: false });
  });
  it('refuses another checkout’s record and malformed/legacy PID files', async () => {
    const root = await tempRoot(), session = await localSession(root);
    await writePrivate(sessionPath(root, 'dev'), { ...session.record, root: '/another-checkout' });
    await expect(stopSession(root, 'dev')).rejects.toThrow('another checkout');
    await writePrivate(sessionPath(root, 'dev'), { pid: process.pid, secret });
    await expect(stopSession(root, 'dev')).rejects.toThrow('old version');
    await writePrivate(sessionPath(root, 'dev'), session.record);
  });
  it('detects occupied ports without sending requests or terminating their owner', async () => {
    const root = await tempRoot(); let requests = 0;
    const server = createServer((_req, res) => { requests++; res.end('unrelated'); });
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
    const occupied = (server.address() as { port: number }).port;
    try {
      await expect(assertPortsFree([occupied])).rejects.toThrow('occupied');
      const runner = await launch(root, { mode: 'dev', ports: { authority: occupied, web: await port(), gateway: await port() } });
      expect(await runner.exited).toBe(1);
      expect(requests).toBe(0); expect(server.listening).toBe(true);
      expect(await exists(join(root, 'authority.json'))).toBe(false);
      expect(await readSession(root, 'dev')).toBeNull();
    } finally { await new Promise<void>(done => server.close(() => done())); }
  });
  it('waits for the actual room and frontend before ready; stop waits for all owned children', async () => {
    const root = await tempRoot(), ports = { authority: await port(), web: await port(), gateway: await port() };
    const runner = await launch(root, { mode: 'dev', ports, delay: 900 });
    await until(async () => Boolean(await readSession(root, 'dev')));
    expect((await readSession(root, 'dev'))?.state).toBe('starting');
    expect(runner.output()).not.toContain('local preview ready');
    await until(async () => (await readSession(root, 'dev'))?.state === 'ready');
    expect(runner.output()).toContain('local preview ready');
    const authority = await json(join(root, 'authority.json')), web = await json(join(root, 'web.json'));
    expect(authority.hasSecret).toBe(true); expect(web.hasSecret).toBe(false);
    const record = (await readSession(root, 'dev'))!;
    expect(runner.output()).not.toContain(record.secret);
    expect(await stopSession(root, 'dev')).toEqual({ stopped: true, stale: false });
    expect(await runner.exited).toBe(0);
    await until(async () => !isAlive(authority.pid) && !isAlive(web.pid));
    await assertPortsFree(Object.values(ports));
  });
  it('tears down the authority and gateway when the frontend exits during startup', async () => {
    const root = await tempRoot(), ports = { authority: await port(), web: await port(), gateway: await port() };
    const runner = await launch(root, { mode: 'dev', ports, webFailure: true });
    expect(await runner.exited).toBe(1);
    expect(runner.output()).not.toContain('local preview ready');
    expect(await readSession(root, 'dev')).toBeNull();
    await assertPortsFree(Object.values(ports));
    if (await exists(join(root, 'authority.json'))) await until(async () => !isAlive((await json(join(root, 'authority.json'))).pid));
  });
  it('fails a bounded local startup without leaving processes, ports or a ready record', async () => {
    const root = await tempRoot(), ports = { authority: await port(), web: await port(), gateway: await port() };
    const runner = await launch(root, { mode: 'dev', ports, delay: 3000, timeout: 300 });
    expect(await runner.exited).toBe(1);
    expect(runner.output()).toContain('startup timed out');
    expect(runner.output()).not.toContain('local preview ready');
    expect(await readSession(root, 'dev')).toBeNull();
    await assertPortsFree(Object.values(ports));
  });
  it('cleans both local children after dev SIGKILL and removes only its stale record', async () => {
    const root = await tempRoot(), ports = { authority: await port(), web: await port(), gateway: await port() };
    const runner = await launch(root, { mode: 'dev', ports });
    await until(async () => (await readSession(root, 'dev'))?.state === 'ready');
    const authority = await json(join(root, 'authority.json')), web = await json(join(root, 'web.json'));
    runner.child.kill('SIGKILL'); await runner.exited;
    await until(async () => !isAlive(authority.pid) && !isAlive(web.pid));
    expect(await stopSession(root, 'dev')).toEqual({ stopped: false, stale: true });
    await assertPortsFree(Object.values(ports));
  });
});

describe('owned process groups', () => {
  it('does not orphan a child if the supervisor dies while the guardian is still loading', async () => {
    const root = await tempRoot(), runner = await launch(root, { mode: 'guardian' });
    await until(async () => exists(join(root, 'parent.json')));
    const { guardianPid } = await json(join(root, 'parent.json'));
    runner.child.kill('SIGKILL'); await runner.exited;
    await until(async () => !isAlive(guardianPid));
    if (await exists(join(root, 'tree.json'))) {
      const tree = await json(join(root, 'tree.json'));
      await until(async () => !isAlive(tree.pid) && (!tree.descendant || !isAlive(tree.descendant)));
    }
  });
  it.each(['SIGTERM', 'SIGKILL'] as const)('cleans children and grandchildren when the supervisor receives %s', async signal => {
    const root = await tempRoot(), runner = await launch(root, { mode: 'guardian' });
    await until(async () => { try { return Boolean((await json(join(root, 'tree.json'))).descendant); } catch { return false; } });
    const tree = await json(join(root, 'tree.json'));
    runner.child.kill(signal);
    await runner.exited;
    await until(async () => !isAlive(tree.pid) && !isAlive(tree.descendant));
  });
});

describe.skipIf(process.platform !== 'darwin' || !['arm64', 'x64'].includes(process.arch))('installer failures without network access', () => {
  it.each(['http', 'checksum'])('preserves the previous binary and clears staging on %s failure', async failure => {
    const root = await tempRoot(); await mkdir(join(root, '.tools'));
    const binary = join(root, '.tools', 'cloudflared'); await writeFile(binary, 'previous binary');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(failure === 'http' ? new Response('', { status: 503 }) : new Response('wrong archive'));
    await expect(installTunnel(root)).rejects.toThrow(failure === 'http' ? 'download failed' : 'Checksum mismatch');
    expect(await readFile(binary, 'utf8')).toBe('previous binary');
    expect(await readdir(join(root, '.tools'))).toEqual(['cloudflared']);
  });
});

describe('remote session lifecycle with a fake tunnel (no public network)', () => {
  it('parses a split URL and registration with bounded retained output', () => {
    const output = new TunnelOutput();
    output.add(Buffer.from('x'.repeat(20000) + 'https://fixture.trycloud'));
    expect(output.url).toBeUndefined();
    output.add(Buffer.from('flare.com\nRegis')); expect(output.url).toBe('https://fixture.trycloudflare.com');
    expect(output.registered).toBe(false);
    output.add(Buffer.from('tered tunnel connection\n')); expect(output.registered).toBe(true);
  });
  it.each(['silent', 'unregistered', 'fail'])('fails closed for a %s tunnel and leaves no invitation or listener', async behavior => {
    const root = await tempRoot(); await localSession(root); const protectedPort = await port();
    const runner = await launch(root, { mode: 'playtest', port: protectedPort, behavior, timeout: 600 });
    expect(await runner.exited).toBe(1);
    expect(await exists(join(root, 'work', 'playtest-links.json'))).toBe(false);
    expect(await readSession(root, 'playtest')).toBeNull();
    expect(runner.output()).not.toContain('endpoint ready');
    expect((await json(join(root, 'work', 'last-playtest-teardown.json'))).exitCode).toBe(1);
    await assertPortsFree([protectedPort]);
  });
  it('publishes private links once ready, rejects duplicates, and confirms idempotent teardown', async () => {
    const root = await tempRoot(); await localSession(root); const protectedPort = await port();
    const runner = await launch(root, { mode: 'playtest', port: protectedPort });
    await until(async () => (await readSession(root, 'playtest'))?.state === 'ready');
    const before = await json(join(root, 'work', 'playtest-links.json'));
    const duplicate = await launch(root, { mode: 'playtest', port: protectedPort });
    expect(await duplicate.exited).toBe(1);
    expect(await json(join(root, 'work', 'playtest-links.json'))).toEqual(before);
    expect(runner.output()).not.toContain(new URL(before.tester).hash.slice(1));
    expect((await stat(join(root, 'work', 'playtest-links.json'))).mode & 0o777).toBe(0o600);
    const tunnel = await json(join(root, 'tunnel.json')); expect(tunnel.hasSecret).toBe(false);
    expect(await stopSession(root, 'playtest')).toEqual({ stopped: true, stale: false });
    expect(await runner.exited).toBe(0);
    expect(await stopSession(root, 'playtest')).toEqual({ stopped: false, stale: false });
    expect(await exists(join(root, 'work', 'playtest-links.json'))).toBe(false);
    expect((await json(join(root, 'work', 'last-playtest-teardown.json'))).tunnelStopped).toBe(true);
    await until(async () => !isAlive(tunnel.pid));
    await assertPortsFree([protectedPort]);
  });
  it('does not publish links when stopped during the readiness check', async () => {
    const root = await tempRoot(); await localSession(root);
    const runner = await launch(root, { mode: 'playtest', port: await port(), verifyDelay: 1000 });
    await until(async () => exists(join(root, 'tunnel.json')));
    expect(await stopSession(root, 'playtest')).toEqual({ stopped: true, stale: false });
    expect(await runner.exited).toBe(0);
    expect(await exists(join(root, 'work', 'playtest-links.json'))).toBe(false);
    expect(runner.output()).not.toContain('endpoint ready');
  });
  it('still closes resources and exits if the teardown report cannot be saved', async () => {
    const root = await tempRoot(); await localSession(root); const protectedPort = await port();
    const runner = await launch(root, { mode: 'playtest', port: protectedPort });
    await until(async () => (await readSession(root, 'playtest'))?.state === 'ready');
    await mkdir(join(root, 'work', 'last-playtest-teardown.json'));
    await control((await readSession(root, 'playtest'))!, true);
    expect(await runner.exited).toBe(1);
    expect(runner.output()).toContain('Could not save the teardown record');
    expect(await exists(join(root, 'work', 'playtest-links.json'))).toBe(false);
    await assertPortsFree([protectedPort]);
    expect(await stopSession(root, 'playtest')).toEqual({ stopped: false, stale: true });
  });
  it.each(['expiry', 'dev-stop'])('automatically closes after %s', async reason => {
    const root = await tempRoot(), local = await localSession(root);
    const protectedPort = await port();
    const runner = await launch(root, { mode: 'playtest', port: protectedPort, lifetime: reason === 'expiry' ? 1500 : 10000 });
    await until(async () => (await readSession(root, 'playtest'))?.state === 'ready');
    if (reason === 'dev-stop') await local.dispose();
    expect(await runner.exited).toBe(reason === 'expiry' ? 0 : 1);
    expect(await exists(join(root, 'work', 'playtest-links.json'))).toBe(false);
    await assertPortsFree([protectedPort]);
  });
});
