import { Client, type Room } from '@colyseus/sdk';
import { TUNING } from '../tuning';
import { REST, type ClientConfig, type DebugCommand, type Move, type SceneOptions, type Snapshot } from '../shared/protocol';
import { Samples } from '../shared/stats';

export class BelayConnection {
  room?: Room;
  latest?: Snapshot;
  history: { at: number; state: Snapshot }[] = [];
  localId = -1;
  operator = false;
  status = 'Ready';
  input: Move = { ...REST };
  private seq = 0;
  private inputTimer?: ReturnType<typeof setInterval>;
  private pingTimer?: ReturnType<typeof setInterval>;
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private pings = new Set<number>();
  private rtts = new Samples();
  private jitter = new Samples();
  private intervals = new Samples();
  private lastRtt?: number;
  private lastSnapshotAt = 0;
  missedProbes = 0;
  receivedSnapshots = 0;
  onChange: () => void = () => {};
  onSnapshot: (snapshot: Snapshot) => void = () => {};

  async join() {
    if (this.room || this.status === 'Connecting') return;
    this.status = 'Connecting'; this.onChange();
    try {
      const response = await fetch('/game/belay/config', { cache: 'no-store' });
      if (!response.ok) throw new Error('The protected test connection is unavailable.');
      const config = await response.json() as ClientConfig;
      this.operator = config.operator;
      const client = new Client(location.origin.replace(/^http/, 'ws') + config.endpoint);
      const room = await client.joinById(config.roomId, { token: config.token });
      this.room = room;
      room.onMessage('seat', ({ id }: { id: number }) => { this.localId = id; this.onChange(); });
      room.onMessage('snapshot', (snapshot: Snapshot) => {
        const now = performance.now();
        // The first join snapshot may precede listener setup; slot identity also arrives per snapshot below.
        if (this.latest && snapshot.epoch !== this.latest.epoch) this.history = [];
        if (this.lastSnapshotAt) this.intervals.add(now - this.lastSnapshotAt);
        this.lastSnapshotAt = now; this.receivedSnapshots++;
        this.latest = snapshot; this.history.push({ at: now, state: snapshot });
        if (this.history.length > TUNING.network.snapshotHistory) this.history.shift();
        this.onSnapshot(snapshot);
      });
      room.onMessage('identity', ({ id }: { id: number }) => { this.localId = id; this.onChange(); });
      room.onMessage('pong', (sent: number) => {
        if (!this.pings.delete(sent)) return;
        const rtt = performance.now() - sent;
        this.rtts.add(rtt);
        if (this.lastRtt !== undefined) this.jitter.add(Math.abs(rtt - this.lastRtt));
        this.lastRtt = rtt;
      });
      room.onMessage('debugResult', ({ requestId, result, error }: { requestId: string; result: unknown; error?: string }) => {
        const pending = this.pending.get(requestId);
        if (!pending) return;
        clearTimeout(pending.timer); this.pending.delete(requestId);
        if (error) pending.reject(new Error(error)); else pending.resolve(result);
      });
      room.onLeave(() => { this.clearTimers(); this.room = undefined; this.localId = -1; this.status = 'Disconnected — reconnect to the test'; this.onChange(); });
      room.onError((_code, message) => { this.status = message ?? 'Connection error'; this.onChange(); });
      this.inputTimer = setInterval(() => this.sendInput(), 1000 / TUNING.network.inputHz);
      this.pingTimer = setInterval(() => {
        const now = performance.now();
        for (const sent of this.pings) if (now - sent > TUNING.network.probeTimeoutMs) { this.pings.delete(sent); this.missedProbes++; }
        this.pings.add(now); room.send('ping', now);
      }, TUNING.network.pingIntervalMs);
      room.send('identify');
      this.status = 'Connected'; this.onChange();
    } catch (error) {
      this.status = error instanceof Error ? error.message : 'Unable to connect.';
      this.onChange();
    }
  }
  sendInput() { this.room?.send('input', { ...this.input, seq: this.seq++ }); }
  releaseInput() { this.input = { ...REST }; this.sendInput(); }
  async leave() { this.releaseInput(); this.clearTimers(); if (this.room?.connection.isOpen) await this.room.leave(); this.room = undefined; }
  private clearTimers() { clearInterval(this.inputTimer); clearInterval(this.pingTimer); }
  dispose() {
    void this.leave();
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Connection closed.')); }
    this.pending.clear();
  }
  command(command: DebugCommand['command'], value?: unknown): Promise<unknown> {
    if (!this.room) return Promise.reject(new Error('Join the test rope first.'));
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(requestId); reject(new Error('Test command timed out.')); }, TUNING.network.debugTimeoutMs);
      this.pending.set(requestId, { resolve, reject, timer });
      this.room!.send('debug', { requestId, command, value });
    });
  }
  networkCounters() {
    return { rttMs: this.rtts.summary(), jitterSuccessiveRttDifferenceMs: this.jitter.summary(),
      snapshotIntervalMs: this.intervals.summary(), receivedSnapshots: this.receivedSnapshots,
      missedEchoProbes: this.missedProbes, packetLoss: null,
      packetLossNote: 'Wire loss is unavailable from WebSocket. Missed probes are not packet loss.',
      lastSnapshotAgeMs: this.lastSnapshotAt ? performance.now() - this.lastSnapshotAt : null,
      interpolationMs: TUNING.network.interpolationMs, inputHz: TUNING.network.inputHz };
  }
  debugApi() {
    return {
      getState: () => this.latest ? structuredClone(this.latest) : null,
      counters: () => ({ network: this.networkCounters(), physics: this.latest?.counters ?? null }),
      setSeed: (seed: number) => this.command('setSeed', seed),
      loadScene: (scene: SceneOptions = {}) => this.command('loadScene', scene),
      stepTicks: (ticks: number) => this.command('stepTicks', ticks),
      pause: () => this.command('pause'), resume: () => this.command('resume'),
      serverCounters: () => this.command('counters'), tape: () => this.command('tape'),
      networkProfile: async (profile?: { addedRttMs: number; jitterMs: number }) => {
        const response = await fetch('/test-network', profile ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) } : {});
        if (!response.ok) throw new Error('Network profile requires a valid operator session and bounded RTT/jitter values.');
        return response.json();
      },
    };
  }
}
export type BelayDebugApi = ReturnType<BelayConnection['debugApi']>;
declare global { interface Window { BELAY: BelayDebugApi } }
