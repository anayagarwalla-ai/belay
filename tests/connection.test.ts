import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BelayConnection } from '../client/connection';
import { TUNING } from '../tuning';
import type { Snapshot } from '../shared/protocol';

const transport = vi.hoisted(() => ({ join: vi.fn() }));
vi.mock('@colyseus/sdk', () => ({ Client: class { joinById = transport.join; } }));
type Messages = { seat: { id: number }; identity: { id: number }; snapshot: Snapshot; pong: number;
  debugResult: { requestId: string; result?: unknown; error?: string } };
class FakeRoom {
  connection = { isOpen: true };
  reconnection = { enabled: true };
  sent: { type: string; value: unknown }[] = [];
  private messages = new Map<keyof Messages, (value: unknown) => void>();
  private leaves: (() => void)[] = [];
  private drops: (() => void)[] = [];
  onMessage<K extends keyof Messages>(type: K, callback: (value: Messages[K]) => void) { this.messages.set(type, callback as (value: unknown) => void); }
  onLeave(callback: () => void) { this.leaves.push(callback); }
  onDrop(callback: () => void) { this.drops.push(callback); }
  onError() {}
  send(type: string, value?: unknown) { if (!this.connection.isOpen) throw new Error('closed socket'); this.sent.push({ type, value }); }
  emit<K extends keyof Messages>(type: K, value: Messages[K]) { this.messages.get(type)?.(value); }
  drop() { this.connection.isOpen = false; this.drops.forEach(fn => fn()); this.leaves.forEach(fn => fn()); }
  leave = vi.fn(async () => { this.connection.isOpen = false; this.leaves.forEach(fn => fn()); });
}
const snapshot = (epoch = 0): Snapshot => ({ version: TUNING.version, epoch, tick: 1, serverTime: Date.now(), seed: 1,
  family: 'balanced', tickHz: 30, paused: false,
  players: [0, 1].map(id => ({ id, position: { x: id, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, brace: false, connected: true, label: 'test', ackSeq: 0 })),
  rope: { points: [], length: 3.6, tension: 0, tensionN: 0, slackM: 2.6 },
  counters: { ticks: 1, elapsedSeconds: 1 / 30, maximumSpanErrorM: 0, maximumSegmentErrorM: 0, maximumSpeedMps: 0,
    maximumJoltMps2: 0, tautTransitions: 0, totalTensionSeconds: 0, distanceTravelledM: [0, 0] } });
const connections: BelayConnection[] = [];
const make = () => { const c = new BelayConnection(); connections.push(c); return c; };
const config = { roomId: 'test-room', token: 'test-token', endpoint: '/game', operator: true };
const configFetch = () => Promise.resolve(new Response(JSON.stringify(config)));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  vi.stubGlobal('fetch', vi.fn(configFetch)); vi.stubGlobal('location', { origin: 'http://localhost:8787' });
  transport.join.mockReset();
});
afterEach(() => { connections.splice(0).forEach(c => c.dispose()); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function joined(c = make()) {
  const room = new FakeRoom(); transport.join.mockResolvedValueOnce(room); await c.join(); room.emit('identity', { id: 0 }); room.emit('snapshot', snapshot());
  return { c, room };
}

describe('connection lifetime', () => {
  it('clears live state, inputs, timers and pending commands immediately on a dropped socket', async () => {
    const { c, room } = await joined();
    c.input = { x: 1, z: 0, brace: true }; const command = c.command('counters'); const rejected = expect(command).rejects.toThrow('closed');
    room.drop(); await rejected;
    expect(c.debugApi().getState()).toBeNull(); expect(c.history).toHaveLength(0); expect(c.localId).toBe(-1);
    expect(c.input).toEqual({ x: 0, z: 0, brace: false });
    const sent = room.sent.length; await vi.advanceTimersByTimeAsync(1000); expect(room.sent).toHaveLength(sent);
    expect((await c.captureReport()).lastClosedSession?.state?.epoch).toBe(0);
  });
  it('aborts a fetch when disposed and never reserves a seat afterward', async () => {
    let finish!: (r: Response) => void; let signal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => { signal = init.signal as AbortSignal; return new Promise<Response>(resolve => { finish = resolve; }); }));
    const c = make(), joining = c.join(); c.dispose(); expect(signal?.aborted).toBe(true);
    finish(new Response(JSON.stringify(config))); await joining;
    expect(transport.join).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it('closes a reservation that finishes after disposal instead of occupying an invisible body', async () => {
    let finish!: (r: FakeRoom) => void;
    transport.join.mockReturnValueOnce(new Promise<FakeRoom>(resolve => { finish = resolve; }));
    const c = make(), joining = c.join(); await vi.advanceTimersByTimeAsync(0);
    c.dispose(); const room = new FakeRoom(); finish(room); await joining;
    expect(room.leave).toHaveBeenCalledWith(false); expect(c.room).toBeUndefined(); expect(vi.getTimerCount()).toBe(0);
  });
  it('allows a fresh attempt after timeout and isolates a late old reservation', async () => {
    let finish!: (r: FakeRoom) => void;
    transport.join.mockReturnValueOnce(new Promise<FakeRoom>(resolve => { finish = resolve; }));
    const c = make(), oldJoin = c.join(); await vi.advanceTimersByTimeAsync(TUNING.network.joinTimeoutMs);
    expect(c.status).toContain('timed out');
    const { room: fresh } = await joined(c);
    const late = new FakeRoom(); finish(late); await oldJoin;
    expect(late.leave).toHaveBeenCalledWith(false); expect(c.room).toBe(fresh); expect(c.status).toBe('Connected');
  });
  it('ignores old room events after an explicit rejoin and resets controls and sequence', async () => {
    const { c, room: old } = await joined(); c.input = { x: 1, z: 1, brace: true }; c.sendInput(); await c.leave();
    const { room: fresh } = await joined(c); old.drop(); old.emit('identity', { id: 1 }); old.emit('snapshot', snapshot(99));
    expect(c.localId).toBe(0); expect(c.latest?.epoch).toBe(0); expect(c.room).toBe(fresh);
    c.sendInput(); expect(fresh.sent.at(-1)?.value).toEqual({ x: 0, z: 0, brace: false, seq: 0 });
  });
  it('does not let a late error from an aborted fetch clobber a new connection', async () => {
    let fail!: (error: Error) => void;
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise<Response>((_resolve, reject) => { fail = reject; })).mockImplementation(configFetch));
    const c = make(), oldJoin = c.join(); await c.leave(); await joined(c); fail(new Error('old request failed')); await oldJoin;
    expect(c.status).toBe('Connected');
  });
  it('does not start the SDK retry queue without the Phase 4 server reservation protocol', async () => {
    const { room } = await joined(); expect(room.reconnection.enabled).toBe(false);
  });
  it('does not move before its first authoritative state and times out a handshake-only connection', async () => {
    const c = make(), room = new FakeRoom(); transport.join.mockResolvedValueOnce(room); await c.join(); room.emit('identity', { id: 0 });
    c.input = { x: 1, z: 0, brace: true }; await vi.advanceTimersByTimeAsync(TUNING.network.staleSnapshotMs * 2);
    expect(c.acceptsMovement).toBe(false); expect(c.status).toContain('stalled');
    expect(room.sent.filter(m => m.type === 'input').every(m => (m.value as { x: number }).x === 0)).toBe(true);
    await vi.advanceTimersByTimeAsync(TUNING.network.joinTimeoutMs); expect(c.room).toBeUndefined(); expect(c.status).toContain('No game state');
  });
  it('stops buffering movement during a stalled stream and requires fresh input on recovery', async () => {
    const { c, room } = await joined(); c.input = { x: 1, z: 0, brace: true };
    await vi.advanceTimersByTimeAsync(TUNING.network.staleSnapshotMs + 50);
    expect(c.status).toContain('stalled'); expect(c.input).toEqual({ x: 0, z: 0, brace: false });
    c.resetMeasurements(); // Clearing counters must not make an old scene appear fresh.
    const sentInputs = room.sent.filter(m => m.type === 'input').length;
    await vi.advanceTimersByTimeAsync(1000); expect(room.sent.filter(m => m.type === 'input')).toHaveLength(sentInputs);
    c.input = { x: 1, z: 0, brace: true }; // A held key or stale producer must not survive recovery.
    room.emit('snapshot', snapshot()); await vi.advanceTimersByTimeAsync(20);
    expect(c.status).toBe('Connected'); expect(room.sent.filter(m => m.type === 'input').at(-1)?.value).toMatchObject({ x: 0, z: 0, brace: false });
  });
});
describe('measurement and command bounds', () => {
  it('starts a clean measurement window on scene reset and rejoin', async () => {
    const { c, room } = await joined();
    await vi.advanceTimersByTimeAsync(TUNING.network.pingIntervalMs);
    const ping = room.sent.find(m => m.type === 'ping')!.value as number;
    await vi.advanceTimersByTimeAsync(10); room.emit('pong', ping);
    expect(c.networkCounters().rttMs.samples).toBe(1);
    room.emit('snapshot', snapshot(1)); expect(c.networkCounters().rttMs.samples).toBe(0);
    expect(c.history).toHaveLength(1); expect(c.networkCounters().receivedSnapshots).toBe(1);
    await c.leave(); await joined(c); expect(c.networkCounters().rttMs.samples).toBe(0); expect(c.sessionNumber).toBe(2);
  });
  it('bounds unanswered debug commands and clears their timers on leave', async () => {
    const { c } = await joined();
    const pending = Array.from({ length: TUNING.network.maximumPendingDebugCommands }, () => c.command('counters').catch(e => e));
    await expect(c.command('counters')).rejects.toThrow('Wait'); await c.leave(); await Promise.all(pending);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('lets tester reports capture local evidence without requesting privileged server counters', async () => {
    const { c, room } = await joined(); c.operator = false;
    const report = await c.captureReport(); expect(report.server).toBeNull(); expect(report.state?.epoch).toBe(0);
    expect(room.sent.some(m => m.type === 'debug')).toBe(false);
  });
  it('can still save local evidence when the socket closes during a server report request', async () => {
    const { c, room } = await joined(); const collecting = c.captureReport(); room.drop();
    const report = await collecting; expect(report.server).toMatchObject({ unavailable: true });
    expect(report.state?.tick).toBe(1); expect(report.connectionAtFinish.connected).toBe(false); expect(report.captureChange.sessionChanged).toBe(true);
  });
  it('freezes scene evidence and marks a scene change during a delayed report', async () => {
    const { c, room } = await joined(); c.operator = false;
    let complete!: (r: Response) => void; vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { complete = resolve; })));
    const collecting = c.captureReport(); room.emit('snapshot', snapshot(1)); complete(new Response('{}'));
    const report = await collecting; expect(report.client.sceneEpoch).toBe(0); expect(report.state?.epoch).toBe(0);
    expect(report.captureChange.sceneChanged).toBe(true); expect(report.connectionAtFinish.sceneEpoch).toBe(1);
  });
  it('does not mix a newly joined room into an old capture', async () => {
    const { c } = await joined(); c.operator = false;
    let complete!: (r: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { complete = resolve; })).mockImplementation(configFetch));
    const collecting = c.captureReport(); await c.leave(); await joined(c); complete(new Response('{}'));
    const report = await collecting; expect(report.connection.sessionNumber).toBe(1); expect(report.connectionAtFinish.sessionNumber).toBe(2);
    expect(report.captureChange.sessionChanged).toBe(true);
  });
});
