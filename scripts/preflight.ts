import { access, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { TUNING } from '../tuning';
import { assertPortsFree, checkHttp, control, failureMessage, isMain, ownerIsAlive, projectRoot, readSession } from './operations';
import { validateTunnel } from './tunnel-installation';

type Check = { ok: boolean; name: string; detail: string };
export async function preflight(root = projectRoot, localOnly = false): Promise<Check[]> {
  const checks: Check[] = [];
  const check = async (name: string, action: () => Promise<string>) => {
    try { checks.push({ ok: true, name, detail: await action() }); }
    catch (error) { checks.push({ ok: false, name, detail: failureMessage(error) }); }
  };
  await check('Runtime', async () => {
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major < 22 || (major === 22 && minor < 13)) throw new Error('Use Node >=22.13.0, then run npm ci in this checkout.');
    if (process.platform === 'win32') throw new Error('Session process groups currently require macOS or Linux; the pinned tunnel installer requires macOS.');
    for (const path of ['tsx/dist/loader.mjs', 'vinext/dist/cli.js', '@colyseus/core/package.json']) {
      try { await access(join(root, 'node_modules', path)); } catch { throw new Error('Dependencies are missing in this checkout. Run npm ci (no dependency upgrades required).'); }
    }
    return `Node ${process.versions.node}; local dependencies present.`;
  });
  await check('Private session storage', async () => {
    const work = join(root, 'work'); await mkdir(work, { recursive: true, mode: 0o700 });
    const probe = join(work, `.preflight-${randomBytes(TUNING.server.tokenBytes).toString('hex')}`);
    try { await writeFile(probe, '', { flag: 'wx', mode: 0o600 }); }
    catch { throw new Error('Cannot write private session files in this checkout’s work directory.'); }
    finally { await rm(probe, { force: true }); }
    return 'Private files can be created. Invitations and keys are never printed by preflight.';
  });
  await check('Local session', async () => {
    const local = await readSession(root, 'dev');
    if (!local) {
      await assertPortsFree([TUNING.server.port, TUNING.server.webPort, TUNING.server.gatewayPort]);
      throw new Error('Local ports are available. Start npm run dev in another terminal and wait for “local preview ready”, then rerun preflight.');
    }
    if (!await ownerIsAlive(local)) throw new Error('Stale local session record. Run npm run dev -- --stop to remove it safely, then npm run dev.');
    if ((await control(local)).state !== 'ready') throw new Error('Local session is still starting or stopping. Wait for its terminal, then rerun preflight.');
    const base = `http://${TUNING.server.host}:${TUNING.server.gatewayPort}`;
    if (!await checkHttp(`${base}/game/health`, body => { try { const health = JSON.parse(body); return health.ok === true && health.phase === TUNING.phase; } catch { return false; } })) {
      throw new Error('The owned gateway cannot reach a ready Phase 1 room. Restart this checkout’s dev session.');
    }
    if (!await checkHttp(`${base}/game/belay/config`, body => {
      try { const config = JSON.parse(body); return Boolean(config.roomId) && config.operator === true && typeof config.token === 'string'; } catch { return false; }
    }) || !await checkHttp(base, body => body.includes('BELAY') && body.includes('Join test rope'))) {
      throw new Error('The owned gateway’s room configuration or frontend is not ready. Check the dev terminal before inviting anyone.');
    }
    return `Owned session ready at ${base}; room, operator access and frontend respond.`;
  });
  if (!localOnly) {
    await check('Tunnel installation', async () => { await validateTunnel(root); return `Pinned cloudflared ${TUNING.tools.cloudflaredVersion} and installed binary checksum verified; no tunnel opened.`; });
    await check('Remote session slot', async () => {
      const remote = await readSession(root, 'playtest');
      if (remote) {
        if (!await ownerIsAlive(remote)) throw new Error('Stale remote session record. Run npm run playtest:stop, then rerun preflight.');
        const state = (await control(remote)).state;
        throw new Error(`This checkout already has a ${state} remote session. Use its private invitation file if ready; otherwise wait, or run npm run playtest:stop before opening another.`);
      }
      await assertPortsFree([TUNING.server.protectedPort]);
      return `Protected port ${TUNING.server.protectedPort} is available.`;
    });
  }
  return checks;
}

if (isMain(import.meta.url)) {
  try {
    const localOnly = process.argv.includes('--local');
    const checks = await preflight(projectRoot, localOnly);
    for (const result of checks) console.log(`${result.ok ? 'PASS' : 'BLOCKED'} ${result.name}: ${result.detail}`);
    const ready = checks.every(result => result.ok);
    console.log(ready ? localOnly ? 'LOCAL SETUP READY. Open two browser contexts at the local preview; this does not count as a remote human session.'
      : 'READY TO OPEN: npm run playtest:open. No internet tunnel was opened or tested by preflight.'
      : 'NOT READY. Follow the BLOCKED actions above, then rerun this command.');
    console.log('Gate 1 remains unevaluated. Another-city access, two human participants and their feel verdict require the actual invited session.');
    process.exitCode = ready ? 0 : 1;
  } catch (error) { console.error(failureMessage(error)); process.exitCode = 1; }
}
