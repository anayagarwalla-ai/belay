import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { Client } from '@colyseus/sdk';
import { createGateway } from '../server/gateway';
import { localClient, observe, delay } from './client-utils';
import { Samples } from '../shared/stats';
import { TUNING } from '../tuning';

const { config } = await localClient();
process.env.BELAY_SESSION_SECRET = JSON.parse(await readFile('work/dev-session.json', 'utf8')).secret;
const gateway = createGateway();
await new Promise<void>(resolve => gateway.server.listen(0, TUNING.server.host, resolve));
const base = `http://${TUNING.server.host}:${(gateway.server.address() as { port: number }).port}`;
const client = new Client(base.replace('http', 'ws') + '/game');
const room = await client.create('belay', { token: config.token });
const observer = observe(room), rows: unknown[] = [];
let active: Samples | undefined;
room.onMessage('pong', (sent: number) => active?.add(performance.now() - sent));
try {
  for (const addedRttMs of TUNING.network.rttBracketsMs) {
    const profile = { addedRttMs, jitterMs: TUNING.network.emulatedJitterMs };
    assert.equal((await fetch(base + '/test-network', { method: 'POST', body: JSON.stringify(profile) })).status, 200);
    active = new Samples();
    for (let i = 0; i < 12; i++) { room.send('ping', performance.now()); await delay(50); }
    await delay(addedRttMs + TUNING.network.maximumJitterMs * 2);
    assert.equal(active.summary().samples, 12);
    assert(active.summary().p50! > addedRttMs - TUNING.network.maximumJitterMs);
    rows.push({ ...profile, actualEchoRttMs: active.summary(), tickHz: observer.latest?.tickHz });
  }
  const report = { generatedAt: new Date().toISOString(), scope: 'Automated 30 Hz transport delay qualification only. Not the conditional human 30/60 Hz comparison.',
    rows, packetLoss: 'unavailable; no loss is simulated', humanSessionsConsumed: 0 };
  await writeFile('reports/phase1-latency.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { if (room.connection.isOpen) await room.leave(); await gateway.close(); }
