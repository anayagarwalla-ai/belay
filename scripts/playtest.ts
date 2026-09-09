import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createGateway } from '../server/gateway';
import { issueAccess } from '../server/auth';
import { TUNING } from '../tuning';
import { LIMITS, OwnedProcess, Session, assertPortsFree, checkHttp, childEnvironment, control, failureMessage,
  isMain, ownerIsAlive, projectRoot, readSession, waitFor, writePrivate } from './operations';
import { validateTunnel } from './tunnel-installation';

/** Chunk boundaries are arbitrary; keep a bounded tail and require actual connection registration. */
export class TunnelOutput {
  private tail: Buffer = Buffer.alloc(0);
  url?: string;
  registered = false;
  add(chunk: Buffer) {
    this.tail = Buffer.from(Buffer.concat([this.tail, chunk]).subarray(-LIMITS.maximumTunnelLogBytes));
    const text = this.tail.toString();
    this.url ??= text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com(?=[\s|"/]|$)/)?.[0];
    this.registered ||= text.includes('Registered tunnel connection') || /"message"\s*:\s*"Registered tunnel connection/.test(text);
  }
}

type Gateway = ReturnType<typeof createGateway>;
export type PlaytestOptions = {
  root?: string; protectedPort?: number; tunnelCommand?: string[]; gatewayFactory?: (key: string) => Gateway;
  verifyPublic?: (url: string) => Promise<boolean>; startupTimeoutMs?: number; lifetimeMs?: number;
};
export async function runPlaytest(options: PlaytestOptions = {}) {
  const root = options.root ?? projectRoot;
  const local = await readSession(root, 'dev');
  if (!local || !await ownerIsAlive(local) || (await control(local)).state !== 'ready') throw new Error('This checkout has no ready local session. Start npm run dev, wait for “local preview ready”, then run npm run playtest:preflight.');
  const session = await Session.create(root, 'playtest', { devSessionId: local.id,
    expiresAt: new Date(Date.now() + (options.lifetimeMs ?? TUNING.server.sessionLifetimeSeconds * 1000)).toISOString() });
  let gateway: Gateway | undefined, tunnel: OwnedProcess | undefined;
  let watching: Promise<void> | undefined;
  const invitationKey = randomBytes(TUNING.server.tokenBytes).toString('hex');
  const expiry = setTimeout(() => { console.log('Session lifetime reached; closing remote access.'); session.stop(); },
    Math.max(0, Date.parse(session.record.expiresAt!) - Date.now()));
  const watch = setInterval(() => {
    if (watching || session.abort.signal.aborted) return;
    watching = (async () => {
      const current = await readSession(root, 'dev');
      if (current?.id !== local.id || !await ownerIsAlive(local) || (await control(local)).state !== 'ready') {
        session.fail('The local dev owner stopped or changed; closing remote access.');
      }
    })().catch(() => session.fail('Lost the local dev owner; closing remote access.')).finally(() => { watching = undefined; });
  }, LIMITS.pollMs);
  try {
    await rm(join(root, 'work', 'playtest-links.json'), { force: true });
    const protectedPort = options.protectedPort ?? TUNING.server.protectedPort;
    await assertPortsFree([protectedPort]);
    const binary = options.tunnelCommand ? undefined : await validateTunnel(root);
    session.abort.signal.throwIfAborted();
    process.env.BELAY_SESSION_SECRET = local.secret;
    gateway = options.gatewayFactory ? options.gatewayFactory(invitationKey) : createGateway(true, invitationKey);
    gateway.server.on('error', () => session.fail('Protected gateway could not listen; no invitation was published.'));
    await new Promise<void>((resolveListen, reject) => {
      gateway!.server.once('error', reject);
      gateway!.server.listen(protectedPort, TUNING.server.host, resolveListen);
    });
    session.abort.signal.throwIfAborted();
    const output = new TunnelOutput();
    tunnel = new OwnedProcess(options.tunnelCommand ?? [binary!, 'tunnel', '--config', '/dev/null', '--no-autoupdate', '--url',
      `http://${TUNING.server.host}:${protectedPort}`], root, childEnvironment(),
    () => session.fail('Tunnel process exited. Check connectivity and rerun preflight; no raw tunnel logs or credentials were printed.'), chunk => output.add(chunk));
    await waitFor(async () => {
      if (!output.url || !output.registered) return false;
      if (options.verifyPublic) return options.verifyPublic(output.url);
      const response = await fetch(`${output.url}/game/belay/config`, { redirect: 'error', signal: AbortSignal.any([session.abort.signal, AbortSignal.timeout(LIMITS.probeTimeoutMs)]) }).catch(() => undefined);
      const protectedApi = response?.status === 401;
      await response?.body?.cancel();
      if (!protectedApi || !await checkHttp(output.url, body => body.includes('Session invitation'), {}, session.abort.signal)) return false;
      // Prove both upstreams are usable through authenticated local access before publishing links.
      const base = `http://${TUNING.server.host}:${protectedPort}`;
      const cookie = `belay_test=${issueAccess('tester', invitationKey)}`;
      if (!await checkHttp(`${base}/game/belay/config`, body => {
        try { const config = JSON.parse(body); return Boolean(config.roomId) && config.operator === false; } catch { return false; }
      }, { cookie }, session.abort.signal)) return false;
      return checkHttp(base, body => body.includes('data-belay-entry'), { cookie }, session.abort.signal);
    }, options.startupTimeoutMs ?? LIMITS.tunnelStartupTimeoutMs, session.abort.signal,
    'Tunnel startup timed out before registration, access protection and upstream readiness were confirmed. Check internet access and retry; no invitation was published.');
    session.abort.signal.throwIfAborted();
    const links = { openedAt: session.record.openedAt, expiresAt: session.record.expiresAt,
      expiresInSeconds: Math.max(0, Math.floor((Date.parse(session.record.expiresAt!) - Date.now()) / 1000)),
      operator: `${output.url}/#${issueAccess('operator', invitationKey)}`, tester: `${output.url}/#${issueAccess('tester', invitationKey)}` };
    await writePrivate(join(root, 'work', 'playtest-links.json'), links);
    await session.ready();
    console.log(`Protected remote endpoint ready: ${output.url}`);
    console.log('Private invitations saved in work/playtest-links.json. Share only the tester link with your invited partner.');
    console.log(`Expires at ${session.record.expiresAt}. Ctrl+C or npm run playtest:stop confirms teardown.`);
    await session.done;
  } catch (error) {
    if (!session.abort.signal.aborted) session.fail(failureMessage(error));
  } finally {
    session.stop(session.code); clearTimeout(expiry); clearInterval(watch);
    await watching;
    const cleanup = await Promise.allSettled([
      rm(join(root, 'work', 'playtest-links.json'), { force: true }), tunnel?.stop(), gateway?.close(),
    ]);
    let confirmed = cleanup.every(result => result.status === 'fulfilled');
    if (!confirmed) session.code = 1;
    delete process.env.BELAY_SESSION_SECRET;
    try {
      await writePrivate(join(root, 'work', 'last-playtest-teardown.json'), {
        openedAt: session.record.openedAt, closedAt: new Date().toISOString(), invitationKeyDiscarded: true,
        tunnelStopped: Boolean(tunnel) && cleanup[1].status === 'fulfilled', gatewayClosed: Boolean(gateway) && cleanup[2].status === 'fulfilled',
        cleanupConfirmed: confirmed, exitCode: session.code, cost: 0,
      });
    } catch { confirmed = false; session.code = 1; console.error('Could not save the teardown record; resource cleanup still ran.'); }
    await session.dispose(confirmed);
    console.log(confirmed ? 'Remote test closed. Owned tunnel stopped, gateway closed, invitations invalidated. Cost: $0.'
      : 'Remote cleanup was not fully confirmed. Session metadata was retained for preflight; inspect the teardown record.');
  }
  return session.code;
}

if (isMain(import.meta.url)) {
  try { process.exitCode = await runPlaytest(); }
  catch (error) { console.error(failureMessage(error)); process.exitCode = 1; }
}
