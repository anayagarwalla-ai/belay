import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Server, matchMaker, type Client as ServerClient } from '@colyseus/core';
import { Client, type Room } from '@colyseus/sdk';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { BelayRoom } from '../server/BelayRoom';
import { issueAccess } from '../server/auth';
import { observe, delay } from '../scripts/client-utils';
import { TUNING } from '../tuning';
import type { BelaySimulation } from '../shared/simulation';
import type { Snapshot, Tape } from '../shared/protocol';

const httpServer = http.createServer();
let server: Server, sdk: Client, token: string;
const rooms: Room[] = [];
beforeAll(async () => {
  vi.stubEnv('BELAY_SESSION_SECRET', randomBytes(TUNING.server.tokenBytes).toString('hex'));
  server = new Server({ transport: new WebSocketTransport({ server: httpServer, maxPayload: TUNING.network.maximumFrameBytes }), greet: false, gracefullyShutdown: false });
  server.define('belay', BelayRoom); await server.listen(0, TUNING.server.host);
  sdk = new Client('ws://' + TUNING.server.host + ':' + (httpServer.address() as { port: number }).port);
  token = issueAccess('operator');
});
afterEach(async () => {
  await Promise.allSettled(rooms.splice(0).filter(r => r.connection.isOpen).map(r => r.leave(false)));
  await delay(30);
});
afterAll(async () => { await server.gracefullyShutdown(false); vi.unstubAllEnvs(); });
async function pair() {
  const room = await sdk.create('belay', { token }); room.reconnection.enabled = false; rooms.push(room); const a = observe(room);
  const other = await sdk.joinById(room.roomId, { token }); other.reconnection.enabled = false; rooms.push(other); const b = observe(other);
  await vi.waitFor(() => { expect(a.latest?.players.filter(p => p.connected)).toHaveLength(2); expect(b.latest).toBeDefined(); });
  return { room, other, a, b, authority: matchMaker.getLocalRoomById(room.roomId) as BelayRoom };
}

describe('room lifecycle and transport protection', () => {
  it('accounts skipped authoritative slots after a stall while keeping catch-up work bounded', async () => {
    const { authority, a } = await pair();
    const sim = (authority as unknown as { sim: BelaySimulation }).sim, step = sim.step.bind(sim); let stalled = false;
    const blocked = vi.spyOn(sim, 'step').mockImplementation((inputs, record) => {
      step(inputs, record);
      if (!stalled) { stalled = true; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, TUNING.body.maximumInputAgeMs * 2); }
    });
    let report!: { skippedTickSlots: number; droppedWallMs: number };
    await vi.waitFor(async () => { report = await a.command('counters') as typeof report; expect(report.skippedTickSlots).toBeGreaterThan(0); });
    blocked.mockRestore(); expect(report.droppedWallMs).toBeCloseTo(report.skippedTickSlots * 1000 / TUNING.tickHz, 6);
    await a.command('loadScene', {});
    expect((await a.command('counters') as typeof report).skippedTickSlots).toBe(0);
  });
  it('counts accepted messages rather than interpreting sequence gaps as input counts', async () => {
    const { room, a } = await pair();
    room.send('input', { x: 0, z: 0, brace: false, seq: 0 });
    room.send('input', { x: 0, z: 0, brace: false, seq: 0 });
    room.send('input', { x: 0, z: 0, brace: false, seq: 1000 });
    room.send('input', { x: 0, z: 0, brace: false, seq: 1001, position: { x: 99 } });
    const report = await a.command('counters') as { acceptedInputs: number; rejectedInputs: number; snapshotDeliveries: number; snapshotJsonBytesTotal: number };
    expect(report.acceptedInputs).toBe(2); expect(report.rejectedInputs).toBe(2);
    expect(report.snapshotDeliveries).toBeGreaterThan(0); expect(report.snapshotJsonBytesTotal).toBeGreaterThan(0);
    await a.command('loadScene', {});
    expect((await a.command('counters') as { acceptedInputs: number }).acceptedInputs).toBe(0);
  });
  it('delivers transitions once per seat, retains them through backpressure, and resets cursors with the epoch', async () => {
    const { room, other, authority, a } = await pair(); await a.command('pause');
    const receivedA: string[] = [], receivedB: string[] = [];
    room.onMessage('snapshot', (state: Snapshot) => receivedA.push(...(state.events ?? []).map(event => `${state.epoch}:${event.id}`)));
    other.onMessage('snapshot', (state: Snapshot) => receivedB.push(...(state.events ?? []).map(event => `${state.epoch}:${event.id}`)));
    const slow = authority.clients.find(c => c.sessionId === other.sessionId)!;
    Object.defineProperty(slow.ref, 'bufferedAmount', { configurable: true, get: () => TUNING.network.maximumSnapshotBufferedBytes + 1 });
    const inject = () => {
      const sim = (authority as unknown as { sim: BelaySimulation }).sim, snapshot = sim.snapshot.bind(sim);
      return vi.spyOn(sim, 'snapshot').mockImplementation(epoch => ({ ...snapshot(epoch), events: [{
        id: 0, epoch: epoch ?? 0, tick: 0, substep: 0, kind: 'catch', incidentId: 0, playerIds: [1], spanIds: [0], surfaceIds: [],
      }] }));
    };
    const first = inject();
    await vi.waitFor(() => expect(receivedA).toEqual(['0:0'])); await delay(100);
    expect(receivedA).toEqual(['0:0']); expect(receivedB).toEqual([]);
    delete (slow.ref as typeof slow.ref & { bufferedAmount?: number }).bufferedAmount;
    await vi.waitFor(() => expect(receivedB).toEqual(['0:0']));
    const serverReport = await a.command('counters') as { state: Snapshot };
    expect(serverReport.state.events).toHaveLength(1); // Operator evidence keeps history; normal snapshots carry deltas.
    first.mockRestore(); await a.command('loadScene', { seed: 9 }); const next = inject();
    await vi.waitFor(() => expect(receivedA).toEqual(['0:0', '1:0']));
    await vi.waitFor(() => expect(receivedB).toEqual(['0:0', '1:0'])); next.mockRestore();
  });
  it('limits non-input floods while another player continues receiving ticks', async () => {
    const { room, other, a, b } = await pair(); const before = b.latest!.tick;
    room.onMessage('pong', () => {});
    const closed = new Promise<void>(resolve => room.onLeave(() => resolve()));
    for (let i = 0; i < TUNING.network.maximumMessagesPerSecond + 10; i++) room.send('ping', i);
    await closed;
    await vi.waitFor(() => expect(b.latest!.tick).toBeGreaterThan(before));
    expect(other.connection.isOpen).toBe(true); expect(a.latest).toBeDefined();
  });
  it('skips obsolete snapshots for a backpressured connection while its partner keeps receiving state', async () => {
    const { room, authority, a, b } = await pair();
    const target = authority.clients.find(c => c.sessionId === room.sessionId)! as ServerClient;
    // Controlled transport-pressure injection; this is not measured internet packet loss.
    Object.defineProperty(target.ref, 'bufferedAmount', { configurable: true, get: () => TUNING.network.maximumSnapshotBufferedBytes + 1 });
    await delay(60); const frozenAt = a.latest!.tick, healthyAt = b.latest!.tick;
    await delay(120); expect(a.latest!.tick).toBe(frozenAt); expect(b.latest!.tick).toBeGreaterThan(healthyAt);
    delete (target.ref as typeof target.ref & { bufferedAmount?: number }).bufferedAmount;
    await vi.waitFor(() => expect(a.latest!.tick).toBeGreaterThan(frozenAt));
    const report = await a.command('counters') as { skippedSnapshots: number }; expect(report.skippedSnapshots).toBeGreaterThan(0);
  });
  it('uses one input sample for an exact paused batch even if the process stalls beyond the input expiry', async () => {
    const { room, authority, a } = await pair(); await a.command('pause'); await a.command('loadScene', { seed: 123 });
    const sim = (authority as unknown as { sim: BelaySimulation }).sim;
    const step = sim.step.bind(sim); let delayed = false;
    const original = vi.spyOn(sim, 'step').mockImplementation((inputs, record) => {
      step(inputs, record);
      if (!delayed) { delayed = true; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, TUNING.body.maximumInputAgeMs + 50); }
    });
    const move = { x: -1, z: 0, brace: false }; room.send('input', { ...move, seq: 1 });
    const result = await a.command('stepTicks', 30) as Snapshot; original.mockRestore();
    const tape = await a.command('tape') as Tape;
    expect(result.tick).toBe(30); expect(tape.frames.every(frame => frame.inputs[a.localId].x === -1)).toBe(true);
    expect(result.counters.distanceTravelledM[a.localId]).toBeGreaterThan(2);
  });
  it('closes a backpressured diagnostic reader instead of queueing full tape replies', async () => {
    const { room, authority, b } = await pair(); const target = authority.clients.find(c => c.sessionId === room.sessionId)!;
    Object.defineProperty(target.ref, 'bufferedAmount', { configurable: true, get: () => TUNING.network.maximumSnapshotBufferedBytes + 1 });
    let replies = 0; room.onMessage('debugResult', () => { replies++; });
    const closed = new Promise<void>(resolve => room.onLeave(() => resolve()));
    room.send('debug', { requestId: 'pressure-tape', command: 'tape' }); await closed;
    expect(replies).toBe(0); expect((await b.command('counters') as { rejectedDebugCommands: number }).rejectedDebugCommands).toBe(1);
  });
  it('rejects excess diagnostic bursts and admits commands after the rate window resets', async () => {
    const { a } = await pair();
    const allowed = Array.from({ length: TUNING.network.maximumDebugCommandsPerSecond }, () => a.command('counters'));
    const refused = expect(a.command('counters')).rejects.toThrow('Too many'); await Promise.all(allowed); await refused;
    await delay(1100); await expect(a.command('counters')).resolves.toHaveProperty('state');
  });
  it('resets timing windows with the scene so reports do not mix rates and families', async () => {
    const { a } = await pair(); await delay(200); const old = await a.command('counters') as { tickExecutionMs: { samples: number } };
    expect(old.tickExecutionMs.samples).toBeGreaterThan(0);
    await a.command('pause'); await a.command('loadScene', { family: 'loose', seed: 5 });
    const fresh = await a.command('counters') as { tickExecutionMs: { samples: number }; state: Snapshot };
    expect(fresh.tickExecutionMs.samples).toBeLessThan(old.tickExecutionMs.samples);
    expect(fresh.state.tick).toBe(0); expect(fresh.state.family).toBe('loose'); expect(fresh.state.epoch).toBe(1);
  });
});
