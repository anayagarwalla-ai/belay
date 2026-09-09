import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { createGateway } from '../server/gateway';
import { TUNING } from '../tuning';
import { LIMITS, OwnedProcess, Session, assertPortsFree, checkHttp, childEnvironment, control, failureMessage,
  isMain, ownerIsAlive, projectRoot, readSession, stopSession, waitFor } from './operations';

type Gateway = ReturnType<typeof createGateway>;
// Dependencies are injectable for isolated process/ephemeral-port tests; production values stay in tuning.ts.
export type DevOptions = {
  root?: string; ports?: { authority: number; web: number; gateway: number };
  commands?: { authority: string[]; web: string[] }; gatewayFactory?: () => Gateway; startupTimeoutMs?: number;
};
export async function runDev(options: DevOptions = {}) {
  const root = options.root ?? projectRoot;
  const ports = options.ports ?? { authority: TUNING.server.port, web: TUNING.server.webPort, gateway: TUNING.server.gatewayPort };
  const secret = randomBytes(TUNING.server.tokenBytes).toString('hex');
  const session = await Session.create(root, 'dev', { secret });
  const children: OwnedProcess[] = [];
  let gateway: Gateway | undefined;
  try {
    await assertPortsFree(Object.values(ports));
    session.abort.signal.throwIfAborted();
    process.env.BELAY_SESSION_SECRET = secret;
    gateway = (options.gatewayFactory ?? createGateway)();
    gateway.server.on('error', () => session.fail('Local gateway could not listen; its port may have been taken during startup.'));
    await new Promise<void>((resolveListen, reject) => {
      gateway!.server.once('error', reject);
      gateway!.server.listen(ports.gateway, TUNING.server.host, resolveListen);
    });
    session.abort.signal.throwIfAborted();
    const commands = options.commands ?? {
      authority: [process.execPath, '--import', import.meta.resolve('tsx'), join(root, 'server/main.ts')],
      web: [process.execPath, join(root, 'node_modules/vinext/dist/cli.js'), 'dev', '--hostname', TUNING.server.host, '--port', String(ports.web)],
    };
    children.push(new OwnedProcess(commands.authority, root, childEnvironment(secret), () => session.fail('Authority process exited; closing the local session.')));
    children.push(new OwnedProcess(commands.web, root, childEnvironment(), () => session.fail('Frontend process exited; closing the local session.')));
    const base = `http://${TUNING.server.host}:${ports.gateway}`;
    await waitFor(async () => {
      if (!await checkHttp(`http://${TUNING.server.host}:${ports.authority}/health`, body => {
        try { const health = JSON.parse(body); return health.ok === true && health.phase === TUNING.phase; } catch { return false; }
      }, {}, session.abort.signal)) return false;
      if (!await checkHttp(`${base}/game/belay/config`, body => {
        try { const config = JSON.parse(body); return Boolean(config.roomId) && config.operator === true && typeof config.token === 'string'; } catch { return false; }
      }, {}, session.abort.signal)) return false;
      return checkHttp(base, body => body.includes('BELAY') && body.includes('data-belay-entry'), {}, session.abort.signal);
    }, options.startupTimeoutMs ?? LIMITS.startupTimeoutMs, session.abort.signal,
    'Local startup timed out waiting for the room, authenticated gateway and frontend. Check the child output above; no ready session was published.');
    await session.ready();
    console.log(`BELAY local preview ready: ${base}`);
    console.log('Room, gateway and frontend checked. Loopback only. Run npm run playtest:preflight before inviting a partner. Ctrl+C closes the session.');
    await session.done;
  } catch (error) {
    if (!session.abort.signal.aborted) session.fail(failureMessage(error));
  } finally {
    session.stop(session.code);
    try {
      // Close only the remote session tied to this dev owner, before revoking its backend key.
      const remote = await readSession(root, 'playtest');
      if (remote?.devSessionId === session.record.id && await ownerIsAlive(remote)) {
        await control(remote, true);
        await stopSession(root, 'playtest');
      }
    } catch { console.error('Remote session did not confirm teardown; its owner watchdog will close it.'); session.code = 1; }
    const cleanup = await Promise.allSettled([...children.map(child => child.stop()), gateway?.close()]);
    const confirmed = cleanup.every(result => result.status === 'fulfilled');
    if (!confirmed) { console.error('Local child cleanup was not confirmed. Session metadata was retained for preflight; no unrelated process was signaled.'); session.code = 1; }
    delete process.env.BELAY_SESSION_SECRET;
    await session.dispose(confirmed);
  }
  return session.code;
}

if (isMain(import.meta.url)) {
  try {
    if (process.argv.includes('--stop')) {
      const result = await stopSession(projectRoot, 'dev');
      console.log(result.stale ? 'Removed a stale local session record. No process was signaled.' : result.stopped ? 'Local session teardown confirmed.' : 'No local session is recorded in this checkout.');
    } else process.exitCode = await runDev();
  } catch (error) { console.error(failureMessage(error)); process.exitCode = 1; }
}
