import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { localClient, observe, delay } from './client-utils';
import { issueAccess } from '../server/auth';
import { createGateway } from '../server/gateway';
import { TUNING } from '../tuning';
import { REST, type Snapshot } from '../shared/protocol';
import WebSocket from 'ws';

const { config, client } = await localClient();
const key = JSON.parse(await readFile('work/dev-session.json', 'utf8')).secret as string;
process.env.BELAY_SESSION_SECRET = key;
const room = await client.create('belay', { token: config.token });
const a = observe(room);
const second = await client.joinById(room.roomId, { token: config.token, bot: true });
const b = observe(second);
const checks: string[] = [];
const gateway = createGateway(true);
let other: Awaited<ReturnType<typeof client.create>> | undefined;
let tester: Awaited<ReturnType<typeof client.joinById>> | undefined;
try {
  await delay(250);
  assert.equal(a.latest?.players.filter(p => p.connected).length, 2);
  assert.notEqual(a.localId, b.localId); checks.push('Two real WebSocket clients get distinct bodies.');
  await assert.rejects(client.joinById(room.roomId, { token: config.token })); checks.push('Third player rejected by the Phase 1 room cap.');
  await a.command('pause');
  await a.command('loadScene', { seed: 44, family: 'balanced' });
  room.send('input', { x: -1, z: 0, brace: false, seq: 100 });
  await delay(50);
  const stepped = await a.command('stepTicks', 30) as Snapshot;
  assert.equal(stepped.tick, 30); assert(stepped.players[a.localId].position.x < -2);
  checks.push('Pause/reset/step operate on the authoritative world.');
  room.send('input', { ...REST, seq: 101, position: { x: 1000 } });
  room.send('input', { ...REST, seq: 99 });
  await delay(50);
  const before = await a.command('counters') as { rejectedInputs: number };
  assert(before.rejectedInputs >= 2); checks.push('Forged positions and out-of-order inputs rejected.');
  const tape = await a.command('tape') as { frames: unknown[] };
  assert.equal(tape.frames.length, 30); checks.push('Accepted input tape records exactly the stepped ticks.');
  other = await client.create('belay', { token: config.token }); const otherState = observe(other);
  await delay(100);
  other.send('input', { x: 1, z: 0, brace: false, seq: 1 });
  await delay(200);
  assert.equal(a.latest?.tick, 30); assert((otherState.latest?.tick ?? 0) > 0); checks.push('Rooms do not share simulation state.');
  await second.leave(); await delay(100);
  tester = await client.joinById(room.roomId, { token: issueAccess('tester', key) }); const viewer = observe(tester);
  await assert.rejects(viewer.command('loadScene', { seed: 99 }), /restricted/);
  checks.push('Tester invitation cannot invoke operator debug mutations.');
  await assert.rejects(client.create('belay', { token: issueAccess('tester', key) }));
  checks.push('Tester cannot allocate additional rooms.');
  const probes: number[] = [];
  room.onMessage('pong', (sent: number) => probes.push(performance.now() - sent));
  for (let i = 0; i < 10; i++) { room.send('ping', performance.now()); await delay(30); }
  assert.equal(probes.length, 10); checks.push('Echo telemetry works over the real socket.');
  await new Promise<void>(resolve => gateway.server.listen(0, TUNING.server.host, resolve));
  const port = (gateway.server.address() as { port: number }).port;
  const base = `http://${TUNING.server.host}:${port}`;
  assert.equal((await fetch(base + '/game/belay/config')).status, 401);
  assert.equal((await fetch(base + '/game/belay/config', { headers: { 'x-belay-role': 'operator', 'x-belay-gateway': key } })).status, 401);
  assert.equal((await fetch(base + '/access', { method: 'POST', body: 'invalid' })).status, 401);
  const login = await fetch(base + '/access', { method: 'POST', body: issueAccess('tester', key) });
  assert.equal(login.status, 204);
  const cookie = login.headers.get('set-cookie')!.split(';')[0];
  const admitted = await fetch(base + '/game/belay/config', { headers: { cookie, 'x-belay-role': 'operator' } });
  assert.equal(admitted.status, 200); assert.equal((await admitted.json() as { operator: boolean }).operator, false);
  checks.push('Gateway protects HTTP, validates invitations, and strips spoofed privilege headers.');
  const privatePaths = ['/work/dev-session.json', '/work/dev-session.json?raw', '/w%6frk/dev-session.json',
    '/w%256frk/dev-session.json', `/@fs${process.cwd()}/work/dev-session.json`, '/.git/config', '/.env',
    '/__debug', '/__open-in-editor?file=work/dev-session.json', '/__inspect'];
  for (const path of privatePaths) {
    const response = await fetch(base + path, { headers: { cookie } });
    assert.equal(response.status, 403, `Private gateway path was not blocked: ${path}`);
    assert(!(await response.text()).includes(key), 'Private credential appeared in a response.');
  }
  checks.push('Authenticated testers cannot read runtime credentials, Git internals or developer inspector routes, including encoded and /@fs paths.');
  for (const path of [privatePaths[0], privatePaths[1], privatePaths[2], privatePaths[4]]) {
    const response = await fetch(`http://${TUNING.server.host}:${TUNING.server.webPort}${path}`);
    assert([403, 404].includes(response.status), `Frontend private-file backstop failed: ${path}`);
    assert(!(await response.text()).includes(key), 'Private credential appeared in a frontend response.');
  }
  checks.push('Vite itself denies runtime credential files through direct, raw, encoded and /@fs requests.');
  const status = await new Promise<number>((resolve, reject) => {
    const socket = new WebSocket(`ws://${TUNING.server.host}:${port}/game/anything`);
    socket.on('unexpected-response', (_req, res) => { resolve(res.statusCode!); socket.terminate(); });
    socket.on('error', () => {}); socket.on('open', () => { socket.close(); reject(new Error('Unauthenticated upgrade admitted')); });
  });
  assert.equal(status, 401); checks.push('Gateway rejects unauthenticated WebSocket upgrades.');
  await a.command('resume'); await delay(600);
  const server = await a.command('counters');
  const report = { generatedAt: new Date().toISOString(), scope: 'Local protocol integration; not a human remote session or 300-room load test.',
    checks, localEchoRttMs: probes, server, humanGate: 'NOT EVALUATED', packetLoss: 'unknown' };
  await mkdir('reports', { recursive: true });
  await writeFile('reports/phase1-network.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await Promise.allSettled([room, second, other, tester].filter(r => r?.connection.isOpen).map(r => r!.leave()));
  await gateway.close();
}
