import assert from 'node:assert/strict';
import NodeWebSocket from 'ws';
import type { Room } from '@colyseus/sdk';
import { TUNING } from '../tuning';
import type { Snapshot } from '../shared/protocol';
import { action, delay, distribution, encodePlane, outcomes, until, type LoadManifest, type LocalLoadTuning, type RoomPlan } from './local-load-model';

// The SDK selects globalThis.WebSocket when present. Force its supported ws implementation
// in this isolated generator, so pause()/resume()/terminate() affect actual socket I/O.
// Load the SDK only after selection; no fake bufferedAmount or server metric mutations.
globalThis.WebSocket = NodeWebSocket as unknown as typeof WebSocket;
const { observe } = await import('./client-utils');
const { Client } = await import('@colyseus/sdk');
type Credentials = { endpoint: string; operatorToken: string; testerToken: string };
type Watched = { room: Room; view: ReturnType<typeof observe>; received: number; lastReceiveMonoMs: number; maximumReceiveGapMs: number };
type LogicalClient = { plan: RoomPlan; index: number; seat: number; watched: Watched; roomId: string; joins: number; lastAck: number;
  receivedSnapshots: number; lastReceiveMonoMs: number; maximumReceiveGapMs: number };
export type GeneratorResult = {
  pid: number; generator: number; originMonoMs: number; clockAnchor: { wallMs: number; monoMs: number; requestedWallMs: number };
  clients: { roomIndex: number; roomId: string; seat: number; joins: number; finalAck: number; receivedSnapshots: number; maximumReceiveGapMs: number }[];
  scheduled: number; offered: number; observedAcknowledged: number; counts: Record<string, number>;
  latenessMs: ReturnType<typeof distribution>; offeredLatenessMs: ReturnType<typeof distribution>;
  raw: { layout: string; float64: string; statuses: string; exactAck: string; count: number; outcomes: typeof outcomes };
  faults: Record<string, unknown>[]; errors: string[];
};

export class LoadGenerator {
  private settings!: LocalLoadTuning;
  private credentials!: Credentials;
  private sdk!: InstanceType<typeof Client>;
  private clients: LogicalClient[] = [];
  private sockets = new Set<Room>();
  private timers = new Set<NodeJS.Timeout>();
  private plan?: LoadManifest;
  private generator = -1;
  private cursor = 0;
  private origin = 0;
  private anchor = { wallMs: 0, monoMs: 0, requestedWallMs: 0 };
  private late = new Float64Array();
  private status = new Uint8Array();
  private ack = new Uint8Array();
  private faults: Record<string, unknown>[] = [];
  private errors: string[] = [];
  private activeFaults: Promise<void>[] = [];
  private running = false;
  private finished?: () => void;
  initialize(settings: LocalLoadTuning) { this.settings = settings; return { pid: process.pid, transport: 'Colyseus SDK using ws real WebSocket' }; }
  private socket(room: Room) { return (room.connection.transport as unknown as { ws: NodeWebSocket }).ws; }
  private later(fn: () => void, ms: number) {
    const timer = setTimeout(() => { this.timers.delete(timer); fn(); }, Math.max(0, ms)); this.timers.add(timer); return timer;
  }
  private watch(room: Room, logical?: LogicalClient): Watched {
    room.reconnection.enabled = false;
    const watched: Watched = { room, view: observe(room), received: 0, lastReceiveMonoMs: 0, maximumReceiveGapMs: 0 };
    this.sockets.add(room); room.onLeave(() => this.sockets.delete(room)); room.onError(() => {});
    room.onMessage('snapshot', (snapshot: Snapshot) => {
      const now = performance.now();
      if (watched.lastReceiveMonoMs) watched.maximumReceiveGapMs = Math.max(watched.maximumReceiveGapMs, now - watched.lastReceiveMonoMs);
      watched.lastReceiveMonoMs = now; watched.received++;
      if (logical && this.plan && watched.view.localId >= 0) {
        logical.receivedSnapshots++;
        if (logical.lastReceiveMonoMs) logical.maximumReceiveGapMs = Math.max(logical.maximumReceiveGapMs, now - logical.lastReceiveMonoMs);
        logical.lastReceiveMonoMs = now;
        const acknowledged = snapshot.players[watched.view.localId]?.ackSeq ?? -1;
        logical.lastAck = Math.max(logical.lastAck, acknowledged);
        if (acknowledged > 0 && acknowledged <= this.plan.framesPerClient) {
          const index = logical.index * this.plan.framesPerClient + acknowledged - 1;
          if (index >= 0 && this.status[index] === outcomes.offered) this.ack[index] = 1;
        }
      }
    });
    return watched;
  }
  private async waitReady(watched: Watched) {
    await until(() => watched.view.localId >= 0 && !!watched.view.latest, this.settings.startupTimeoutMs, this.settings.probePollMs, 'fresh identity and snapshot');
  }
  private connect(credentials: Credentials) { this.credentials = credentials; this.sdk = new Client(credentials.endpoint); }
  async command(command: string, value: unknown) {
    if (command === 'prepare') return this.prepare(value as Credentials & { manifest: LoadManifest; generator: number });
    if (command === 'functional') { this.connect(value as Credentials); return this.functional(); }
    if (command === 'lifecycle') { this.connect(value as Credentials); return this.lifecycle(); }
    if (command === 'start') return this.start(value as { startAtWallMs: number });
    if (command === 'result') return this.result();
    if (command === 'close') { await this.closeSockets(); return { liveSockets: this.sockets.size }; }
    throw new Error(`Unknown generator command: ${command}`);
  }
  private async prepare(value: Credentials & { manifest: LoadManifest; generator: number }) {
    this.connect(value); this.plan = value.manifest; this.generator = value.generator;
    const created: Record<string, unknown>[] = [];
    for (const roomPlan of this.plan.rooms.filter(room => room.generator === this.generator)) {
      const before = performance.now();
      const owner = await this.sdk.create('belay', { token: value.operatorToken, scene: roomPlan.scene, playerCount: roomPlan.playerCount, seed: roomPlan.seed, tickHz: this.plan.tickHz });
      const roomId = owner.roomId;
      created.push({ ...roomPlan, roomId, createRequestedMonoMs: before, ownerJoinedMonoMs: performance.now() });
      for (let seat = 0; seat < roomPlan.playerCount; seat++) {
        const room = seat === 0 ? owner : await this.sdk.joinById(roomId, { token: value.testerToken, bot: true });
        const logical = { plan: roomPlan, index: this.clients.length, seat, roomId, joins: 1, lastAck: -1,
          receivedSnapshots: 0, lastReceiveMonoMs: 0, maximumReceiveGapMs: 0 } as LogicalClient;
        logical.watched = this.watch(room, logical); this.clients.push(logical); await this.waitReady(logical.watched);
        assert.equal(logical.watched.view.localId, seat, 'Server seat order differs from the frozen workload');
        assert.equal(logical.watched.view.latest!.players.length, roomPlan.playerCount, 'Actual body count differs from manifest; integrate Phase 2 server admission first');
        assert.equal(logical.watched.view.latest!.scene ?? 'flat', roomPlan.scene);
      }
    }
    const slots = this.clients.length * this.plan.framesPerClient;
    this.late = new Float64Array(slots); this.late.fill(NaN); this.status = new Uint8Array(slots); this.ack = new Uint8Array(slots);
    return { pid: process.pid, generator: this.generator, rooms: created, clients: this.clients.length, sockets: this.sockets.size };
  }
  sample() {
    return { generator: this.generator, atMonoMs: performance.now(), logicalClients: this.clients.length,
      openSockets: [...this.sockets].filter(room => room.connection.isOpen).length, processedScheduled: this.cursor,
      snapshotsReceived: this.clients.reduce((sum, client) => sum + client.receivedSnapshots, 0),
      latestSnapshotAgeMs: this.clients.map(client => ({ roomIndex: client.plan.index, seat: client.seat,
        ageMs: client.lastReceiveMonoMs ? performance.now() - client.lastReceiveMonoMs : null,
        connected: client.watched.room.connection.isOpen, lastAck: client.lastAck })),
      faultsApplied: this.faults.length, running: this.running };
  }
  private start({ startAtWallMs }: { startAtWallMs: number }) {
    if (!this.plan || this.running || this.cursor) throw new Error('Generator is not prepared or already started');
    this.anchor = { wallMs: Date.now(), monoMs: performance.now(), requestedWallMs: startAtWallMs };
    this.origin = this.anchor.monoMs + startAtWallMs - this.anchor.wallMs; this.running = true;
    const slow = this.clients.find(client => client.plan.index === 0 && client.seat === 1);
    const duration = this.plan.seconds * 1000;
    if (slow) this.later(() => {
      const reader = this.socket(slow.watched.room), healthy = this.clients.find(client => client.roomId === slow.roomId && client.seat === 0)!;
      const before = healthy.watched.view.latest?.tick;
      reader.pause(); const applied = performance.now();
      const event: Record<string, unknown> = { kind: 'real-socket-read-pause', roomId: slow.roomId, seat: slow.seat,
        dueMonoMs: this.origin + duration * this.settings.slowReaderStartFraction, appliedMonoMs: applied, healthyTickBefore: before };
      this.faults.push(event);
      this.later(() => { reader.resume(); event.restoredMonoMs = performance.now(); event.healthyTickAfter = healthy.watched.view.latest?.tick;
        event.healthyAdvanced = Number(event.healthyTickAfter) > Number(before); }, duration * this.settings.slowReaderDurationFraction);
    }, this.origin - performance.now() + duration * this.settings.slowReaderStartFraction);
    for (const client of this.clients.filter(client => client.seat === client.plan.playerCount - 1 && client.plan.index % this.settings.churnEveryRooms === 0)) {
      this.later(() => {
        const task = this.churn(client).catch(error => { this.errors.push(error instanceof Error ? error.message : 'churn failed'); });
        this.activeFaults.push(task);
      }, this.origin - performance.now() + duration * this.settings.churnStartFraction);
    }
    this.later(() => this.offer(), this.origin - performance.now());
    return { originMonoMs: this.origin, clockAnchor: this.anchor, clients: this.clients.length, scheduled: this.status.length };
  }
  private async churn(client: LogicalClient) {
    const oldSession = client.watched.room.sessionId;
    this.socket(client.watched.room).terminate();
    const event: Record<string, unknown> = { kind: 'disconnect-fresh-join', roomId: client.roomId, seat: client.seat,
      dueMonoMs: this.origin + this.plan!.seconds * 1000 * this.settings.churnStartFraction,
      appliedMonoMs: performance.now(), sameBodyReconnect: 'UNIMPLEMENTED; replacement join is not counted as reconnection' };
    this.faults.push(event);
    await delay(TUNING.body.maximumInputAgeMs + this.settings.probePollMs);
    const room = await this.sdk.joinById(client.roomId, { token: this.credentials.testerToken, bot: true });
    client.watched = this.watch(room, client); client.joins++;
    await this.waitReady(client.watched);
    event.freshJoinedMonoMs = performance.now(); event.newSession = room.sessionId !== oldSession; event.newSeat = client.watched.view.localId;
  }
  private offer() {
    if (!this.running || !this.plan) return;
    const count = this.clients.length, spacing = (1000 / this.plan.inputHz) / count;
    while (this.cursor < this.status.length) {
      const due = this.origin + this.cursor * spacing, now = performance.now();
      if (now < due) break;
      const clientIndex = this.cursor % count, round = Math.floor(this.cursor / count), client = this.clients[clientIndex];
      const index = clientIndex * this.plan.framesPerClient + round;
      const late = Math.max(0, now - due); this.late[index] = late;
      if (late > this.settings.maximumLatePeriods * 1000 / this.plan.inputHz) this.status[index] = outcomes.late;
      else if (!client.watched.room.connection.isOpen) this.status[index] = outcomes.disconnected;
      else if (this.socket(client.watched.room).bufferedAmount > this.settings.maximumInputBufferedBytes) this.status[index] = outcomes.backpressure;
      else {
        try { client.watched.room.send('input', action(client.plan.index, client.seat, round + 1, this.plan.inputHz)); this.status[index] = outcomes.offered; }
        catch { this.status[index] = outcomes.sendError; }
      }
      this.cursor++;
    }
    if (this.cursor < this.status.length) this.later(() => this.offer(), this.origin + this.cursor * spacing - performance.now());
    else { this.running = false; this.finished?.(); }
  }
  private async result(): Promise<GeneratorResult> {
    if (!this.plan) throw new Error('No manifest');
    if (this.running) await new Promise<void>(resolve => { this.finished = resolve; });
    await Promise.all(this.activeFaults);
    const counts = Object.fromEntries(Object.entries(outcomes).map(([key, code]) => [key, this.status.reduce((sum, status) => sum + Number(status === code), 0)]));
    return { pid: process.pid, generator: this.generator, originMonoMs: this.origin, clockAnchor: this.anchor,
      clients: this.clients.map(client => ({ roomIndex: client.plan.index, roomId: client.roomId, seat: client.seat, joins: client.joins,
        finalAck: client.lastAck, receivedSnapshots: client.receivedSnapshots, maximumReceiveGapMs: client.maximumReceiveGapMs })),
      scheduled: this.status.length, offered: counts.offered, observedAcknowledged: this.ack.reduce((sum, ack) => sum + ack, 0), counts,
      latenessMs: distribution(this.late), offeredLatenessMs: distribution(this.late.filter((_, i) => this.status[i] === outcomes.offered)),
      raw: { layout: 'client-major, round-minor. Float64 little-endian lateness ms, NaN=unprocessed. Uint8 status and exact observed-ack planes. Base64 is lossless binary inside JSON; decode with local-load-model.ts.',
        float64: encodePlane(this.late), statuses: encodePlane(this.status), exactAck: encodePlane(this.ack), count: this.status.length, outcomes },
      faults: this.faults, errors: this.errors };
  }
  private async lifecycle() {
    const rows: { roomId: string; createAtMonoMs: number; leaveAtMonoMs: number }[] = [];
    for (let index = 0; index < this.settings.lifecycleRooms; index++) {
      const createAtMonoMs = performance.now();
      const room = await this.sdk.create('belay', { token: this.credentials.operatorToken, scene: 'flat', playerCount: 2 });
      const watched = this.watch(room); await this.waitReady(watched); await delay(this.settings.lifecycleHoldMs);
      await room.leave(); rows.push({ roomId: room.roomId, createAtMonoMs, leaveAtMonoMs: performance.now() });
    }
    return rows;
  }
  private async functional() {
    const checks: { name: string; status: 'PASS'; evidence: unknown }[] = [];
    const create = async () => this.watch(await this.sdk.create('belay', { token: this.credentials.operatorToken, scene: 'flat', playerCount: 2 }));
    const a = await create(), b = await create();
    const partner = this.watch(await this.sdk.joinById(a.room.roomId, { token: this.credentials.testerToken }));
    try {
      await Promise.all([a, b, partner].map(client => this.waitReady(client)));
      assert.notEqual(a.view.localId, partner.view.localId);
      await assert.rejects(this.sdk.joinById(b.room.roomId, { token: 'invalid-local-fixture-token' }));
      await assert.rejects(this.sdk.create('belay', { token: this.credentials.testerToken, scene: 'flat', playerCount: 2 }));
      await assert.rejects(this.sdk.joinById(a.room.roomId, { token: this.credentials.testerToken }));
      checks.push({ name: 'private authentication, creation authorization and actual room cap', status: 'PASS', evidence: { roomIds: [a.room.roomId, b.room.roomId], seats: [a.view.localId, partner.view.localId] } });
      await a.view.command('pause'); const pausedTick = a.view.latest!.tick, otherBefore = b.view.latest!.tick;
      await until(() => b.view.latest!.tick > otherBefore, this.settings.startupTimeoutMs, this.settings.probePollMs, 'independent room advances');
      assert.equal(a.view.latest!.tick, pausedTick); await a.view.command('resume');
      checks.push({ name: 'room timing/state isolation', status: 'PASS', evidence: { pausedTick, otherBefore, otherAfter: b.view.latest!.tick } });
      partner.room.send('input', { x: 1, z: 0, brace: true, seq: 1 });
      await until(() => a.view.latest!.players[partner.view.localId].brace, this.settings.startupTimeoutMs, this.settings.probePollMs, 'brace applied');
      const braceAt = performance.now();
      const expiryObservationBoundMs = TUNING.body.maximumInputAgeMs + TUNING.maximumCatchupTicks * 1000 / TUNING.tickHz + this.settings.probePollMs;
      await until(() => !a.view.latest!.players[partner.view.localId].brace, expiryObservationBoundMs, this.settings.probePollMs, 'stalled input expires');
      checks.push({ name: 'input expiry on a still-connected socket', status: 'PASS', evidence: { observedClearDelayMs: performance.now() - braceAt, configuredInputAgeMs: TUNING.body.maximumInputAgeMs } });
      partner.room.send('input', { x: 1, z: 0, brace: true, seq: 2 });
      await until(() => a.view.latest!.players[partner.view.localId].brace, this.settings.startupTimeoutMs, this.settings.probePollMs, 'pre-disconnect brace');
      const disconnectedAt = performance.now(), playerId = partner.view.localId; this.socket(partner.room).terminate();
      await until(() => !a.view.latest!.players[playerId].connected && !a.view.latest!.players[playerId].brace,
        expiryObservationBoundMs, this.settings.probePollMs, 'disconnect clears input and seat');
      checks.push({ name: 'abrupt disconnect clears input and current seat', status: 'PASS', evidence: { playerId, observedClearDelayMs: performance.now() - disconnectedAt, sameBodyReconnect: 'UNIMPLEMENTED (Phase 4)' } });
      return checks;
    } finally { await this.closeSockets(); }
  }
  private async closeSockets() {
    for (const room of this.sockets) this.socket(room).resume();
    await Promise.allSettled([...this.sockets].filter(room => room.connection.isOpen).map(room => room.leave()));
    for (const room of this.sockets) this.socket(room).terminate(); this.sockets.clear();
  }
  async shutdown() {
    this.running = false; for (const timer of this.timers) clearTimeout(timer); this.timers.clear(); this.finished?.();
    await this.closeSockets();
  }
}
