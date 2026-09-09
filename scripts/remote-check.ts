import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import WebSocket from 'ws';
import type { ClientConfig, Snapshot } from '../shared/protocol';
import { TUNING } from '../tuning';

// Node's browser-compatible global WebSocket cannot forward an invitation cookie.
// The official SDK uses this Node ws implementation for this CLI check only.
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
const { Client } = await import('@colyseus/sdk');
const links = JSON.parse(await readFile('work/playtest-links.json', 'utf8')) as { tester: string; operator: string };
const base = new URL(links.tester).origin;
const checks: string[] = [];
const boundedFetch = (path: string, init?: RequestInit) => fetch(base + path, { ...init, signal: AbortSignal.timeout(TUNING.server.httpTimeoutMs) });
let room: Awaited<ReturnType<InstanceType<typeof Client>['create']>> | undefined;
try {
  assert.equal((await boundedFetch('/game/belay/config')).status, 401);
  assert((await (await boundedFetch('/')).text()).includes('Session invitation'));
  checks.push('External URL exposes invitation form only; API requires authentication.');
  const login = async (link: string) => {
    const response = await boundedFetch('/access', { method: 'POST', body: new URL(link).hash.slice(1) });
    assert.equal(response.status, 204);
    const header = response.headers.get('set-cookie')!;
    assert(header.includes('HttpOnly') && header.includes('Secure') && header.includes('SameSite=Strict'));
    return header.split(';')[0];
  };
  const testerCookie = await login(links.tester);
  const tester = await (await boundedFetch('/game/belay/config', { headers: { cookie: testerCookie } })).json() as ClientConfig;
  assert.equal(tester.operator, false);
  assert.equal((await boundedFetch('/test-network', { method: 'POST', headers: { cookie: testerCookie }, body: JSON.stringify({ addedRttMs: 0, jitterMs: 0 }) })).status, 403);
  checks.push('Tester can fetch its room token, cannot change the network profile; cookie is secure and HttpOnly.');
  const operatorCookie = await login(links.operator);
  const config = await (await boundedFetch('/game/belay/config', { headers: { cookie: operatorCookie } })).json() as ClientConfig;
  assert(config.operator);
  const html = await (await boundedFetch('/', { headers: { cookie: testerCookie } })).text();
  assert(html.includes('BELAY') && html.includes('data-belay-entry'));
  checks.push('Authenticated page contains the actual Phase 1 UI.');
  const client = new Client(base.replace('https', 'wss') + '/game', { headers: { cookie: operatorCookie } });
  room = await client.create('belay', { token: config.token });
  const snapshot = await new Promise<Snapshot>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Remote snapshot timed out')), TUNING.network.debugTimeoutMs);
    room!.onMessage('seat', () => {});
    room!.onMessage('snapshot', state => { clearTimeout(timeout); resolve(state); });
  });
  assert.equal(snapshot.players.filter(p => p.connected).length, 1);
  checks.push('A real TLS WebSocket receives authoritative snapshots through the protected tunnel.');
  await writeFile('reports/phase1-remote.json', JSON.stringify({ generatedAt: new Date().toISOString(), checks,
    scope: 'One local machine reaching itself through the external tunnel; NOT a distinct-city human feel test.',
    cost: 0, paidResources: 0, humanGate: 'NOT EVALUATED' }, null, 2) + '\n');
  console.log(checks.join('\n'));
} finally {
  if (room?.connection.isOpen) await room.leave();
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/stop-playtest.ts'], { stdio: 'inherit' });
}
