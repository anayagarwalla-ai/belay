import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Room } from '@colyseus/sdk';
import { PracticeTeam } from '../client/practice-team';
import { TUNING } from '../tuning';
import type { Snapshot } from '../shared/protocol';
import { phase2State } from './fixtures/phase2-state';

type Message = { identity: { id: number }; seat: { id: number }; snapshot: Snapshot };
class Peer {
  connection = { isOpen: true };
  reconnection = { enabled: true };
  sent: { type: string; value: unknown }[] = [];
  handlers = new Map<string, (value: never) => void>();
  disconnected: (() => void)[] = [];
  ready = true;
  constructor(readonly id: number, readonly world: World) {}
  onMessage<K extends keyof Message>(type: K, callback: (value: Message[K]) => void) { this.handlers.set(type, callback as (value: never) => void); }
  onLeave(callback: () => void) { this.disconnected.push(callback); }
  onDrop(callback: () => void) { this.disconnected.push(callback); }
  onError() {}
  emit<K extends keyof Message>(type: K, value: Message[K]) { this.handlers.get(type)?.(value as never); }
  send(type: string, value: unknown) {
    if (!this.connection.isOpen) throw new Error('Closed socket');
    this.sent.push({ type, value });
    if (type === 'identify' && this.ready) { this.emit('identity', { id: this.id }); this.world.broadcast(); }
  }
  leave = vi.fn(async () => {
    this.connection.isOpen = false; this.world.occupied.delete(this.id);
    this.disconnected.forEach(callback => callback()); this.world.broadcast();
  });
  get sdk() { return this as unknown as Room; }
}
class World {
  ready = true;
  state = phase2State(4, 'crossing');
  occupied = new Set([0]);
  peers: Peer[] = [];
  team = new PracticeTeam(() => ({ id: 0, ready: this.ready, snapshot: this.snapshot() }), () => {});
  snapshot() {
    const state = structuredClone(this.state);
    for (const player of state.players) { player.connected = this.occupied.has(player.id); player.label = player.id === 0 ? 'Climber 1' : `BOT ${player.id + 1}`; }
    return state;
  }
  broadcast() { for (const peer of this.peers) if (peer.connection.isOpen) peer.emit('snapshot', this.snapshot()); }
  reserve() {
    const id = this.state.players.find(player => !this.occupied.has(player.id))!.id;
    this.occupied.add(id); const peer = new Peer(id, this); this.peers.push(peer); return peer;
  }
  join = vi.fn(async () => this.reserve().sdk);
}
const worlds: World[] = [];
const make = () => { const world = new World(); worlds.push(world); return world; };
beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'] }));
afterEach(() => { worlds.splice(0).forEach(world => world.team.stop()); vi.useRealTimers(); });

describe('practice bot ownership', () => {
  it.each([2, 4, 6])('fills only the empty seats of a %i-person rope and sends bounded normal inputs', async count => {
    const world = make(); world.state = phase2State(count, 'crossing');
    if (count > 2) world.occupied.add(1); // Another human already occupies this seat.
    const needed = count - world.occupied.size;
    await world.team.start('recovery', world.join);
    expect(world.join).toHaveBeenCalledTimes(needed); expect(world.occupied.size).toBe(count);
    expect(world.team.status).toMatchObject({ state: 'running', count: needed });
    await vi.advanceTimersByTimeAsync(100);
    for (const peer of world.peers) {
      expect(peer.reconnection.enabled).toBe(false);
      const inputs = peer.sent.filter(message => message.type === 'input'); expect(inputs.length).toBeGreaterThan(0);
      inputs.forEach((message, seq) => {
        const move = message.value as { x: number; z: number; brace: boolean; seq: number };
        expect(Object.keys(move).sort()).toEqual(['brace', 'seq', 'x', 'z']); expect(move.seq).toBe(seq);
        expect(Math.hypot(move.x, move.z)).toBeLessThanOrEqual(1.000001);
      });
    }
    world.team.stop(); expect(world.occupied.has(0)).toBe(true);
    expect(world.occupied.size).toBe(count - needed); expect(vi.getTimerCount()).toBe(0);
    expect(world.peers.every(peer => peer.leave.mock.calls.length === 1)).toBe(true);
  });
  it('refuses an unready owner, flat scene, full rope, and duplicate start without joining extra clients', async () => {
    const world = make(); world.ready = false;
    await expect(world.team.start('recovery', world.join)).rejects.toThrow('fresh');
    world.ready = true; world.state.scene = 'flat';
    await expect(world.team.start('recovery', world.join)).rejects.toThrow('rescue or crossing');
    world.state.scene = 'crossing'; world.occupied = new Set([0, 1, 2, 3]);
    await expect(world.team.start('recovery', world.join)).rejects.toThrow('full'); expect(world.join).not.toHaveBeenCalled();
    world.occupied = new Set([0]); await world.team.start('bad', world.join);
    await expect(world.team.start('recovery', world.join)).rejects.toThrow('already'); expect(world.join).toHaveBeenCalledTimes(3);
  });
  it('cancels a pending reservation promptly and closes its late arrival without replacing a newer session', async () => {
    const world = make(); let finish!: (room: Room) => void;
    const join = vi.fn(() => new Promise<Room>(resolve => { finish = resolve; }));
    const starting = world.team.start('recovery', join);
    await vi.waitFor(() => expect(join).toHaveBeenCalledOnce());
    world.team.stop(); await starting; expect(vi.getTimerCount()).toBe(0);
    const late = world.reserve(); // Old reservation arrives after its UI was cancelled.
    await world.team.start('bad', world.join); const active = world.team.status;
    finish(late.sdk); await Promise.resolve(); await Promise.resolve();
    expect(late.leave).toHaveBeenCalledWith(false); expect(world.team.status).toEqual(active);
  });
  it('times out a bot that joins but never sends identity/state, then permits a fresh attempt', async () => {
    const world = make(); let peer!: Peer;
    const join = vi.fn(async () => { peer = world.reserve(); peer.ready = false; return peer.sdk; });
    const starting = world.team.start('recovery', join);
    await vi.waitFor(() => expect(join).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(TUNING.network.joinTimeoutMs); await starting;
    expect(world.team.status.message).toContain('timed out'); expect(peer.leave).toHaveBeenCalledWith(false);
    expect(vi.getTimerCount()).toBe(0); await world.team.start('bad', world.join); expect(world.team.status.state).toBe('running');
  });
  it('releases already joined seats when another admission fails', async () => {
    const world = make(); world.join.mockRejectedValueOnce(new Error('Room closed'));
    await expect(world.team.start('recovery', world.join)).rejects.toThrow('Room closed');
    expect(world.occupied.size).toBe(1); expect(vi.getTimerCount()).toBe(0);
    const join = vi.fn().mockImplementationOnce(world.join).mockRejectedValueOnce(new Error('Concurrent human took final seat'));
    await expect(world.team.start('recovery', join)).rejects.toThrow('Concurrent human');
    expect(world.occupied.size).toBe(1); expect(world.peers[0].leave).toHaveBeenCalledOnce();
  });
  it.each(['owner', 'snapshot', 'socket'] as const)('stops all owned bots on a stale/lost %s', async fault => {
    const world = make(); await world.team.start('recovery', world.join);
    if (fault === 'owner') world.ready = false;
    if (fault === 'socket') await world.peers[0].leave();
    await vi.advanceTimersByTimeAsync(TUNING.network.staleSnapshotMs + 50);
    expect(world.occupied.size).toBe(1); expect(world.team.status.state).toBe('idle'); expect(vi.getTimerCount()).toBe(0);
  });
  it('rests while paused or terminal and rebuilds its policy after an epoch reset', async () => {
    const world = make(); world.state = phase2State(2, 'crossing'); world.state.paused = true;
    await world.team.start('recovery', world.join); await vi.advanceTimersByTimeAsync(20);
    const last = () => world.peers[0].sent.at(-1)!.value;
    expect(last()).toMatchObject({ x: 0, z: 0, brace: false });
    world.state.paused = false; world.broadcast(); await vi.advanceTimersByTimeAsync(20);
    expect(last()).toMatchObject({ z: expect.any(Number) }); expect(last()).not.toMatchObject({ x: 0, z: 0 });
    world.state.run!.status = 'failed'; world.broadcast(); await vi.advanceTimersByTimeAsync(20);
    expect(last()).toMatchObject({ x: 0, z: 0, brace: false });
    world.state = phase2State(2); world.state.epoch++; world.broadcast(); await vi.advanceTimersByTimeAsync(20);
    expect(last()).not.toMatchObject({ x: 0, z: 0 });
  });
  it('enforces the finite practice deadline even with healthy paused connections', async () => {
    const world = make(); world.state = phase2State(2); world.state.paused = true;
    await world.team.start('recovery', world.join);
    const refresh = setInterval(() => world.broadcast(), TUNING.network.hudUpdateMs);
    await vi.advanceTimersByTimeAsync(TUNING.bot.practiceSeconds * 1000); clearInterval(refresh);
    expect(world.team.status.message).toContain('time limit'); expect(world.occupied.size).toBe(1); expect(vi.getTimerCount()).toBe(0);
  });
});
