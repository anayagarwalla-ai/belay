import { Room, ClientState, type Client } from '@colyseus/core';
import { performance } from 'node:perf_hooks';
import { TUNING } from '../tuning';
import { REST, parseInput, type Move, type SceneOptions, type DebugCommand } from '../shared/protocol';
import { BelaySimulation, initializePhysics } from '../shared/simulation';
import { Samples } from '../shared/stats';
import { verifyAccess, type Access } from './auth';
import { assertOccupiedSeatsFit, resolveScene } from './scenes';

type Seat = { id: number; input: Move; seq: number; receivedAt: number; operator: boolean; bot: boolean; eventCursor: number;
  windowStarted: number; messages: number; debugWindowStarted: number; debugCommands: number };

export class BelayRoom extends Room {
  maxClients: number = TUNING.players;
  maxMessagesPerSecond = TUNING.network.maximumMessagesPerSecond; // Includes ping, identify, and debug messages as well as movement.
  autoDispose = false;
  private sim!: BelaySimulation;
  private seats = new Map<string, Seat>();
  private timer?: ReturnType<typeof setTimeout>;
  private paused = false;
  private epoch = 0;
  private nextTick = 0;
  private tickTimes = new Samples();
  private scheduling = new Samples();
  private combined = new Samples();
  private snapshotBytes = 0;
  private rejectedInputs = 0;
  private acceptedInputs = 0;
  private snapshotDeliveries = 0;
  private snapshotJsonBytesTotal = 0;
  private droppedWallMs = 0;
  private skippedTickSlots = 0;
  private skippedSnapshots = 0;
  private rejectedDebugCommands = 0;

  async onCreate(options: SceneOptions & { token?: string; persistent?: boolean } = {}) {
    if (verifyAccess(options.token)?.role !== 'operator') throw new Error('Only the test operator can create a room.');
    this.autoDispose = !options.persistent;
    await initializePhysics();
    if (TUNING.players > TUNING.hardCap) throw new Error('Room hard cap exceeded');
    const { token: _token, persistent: _persistent, ...scene } = options;
    this.sim = new BelaySimulation(resolveScene(scene));
    this.maxClients = this.sim.bodies.length;
    this.onMessage('input', (client, value) => this.receiveInput(client, value));
    this.onMessage('ping', (client, value) => {
      if (typeof value === 'number' && Number.isFinite(value)) client.send('pong', value);
    });
    this.onMessage('debug', (client, value: DebugCommand) => this.debug(client, value));
    this.onMessage('identify', client => { const seat = this.seats.get(client.sessionId); if (seat) client.send('identity', { id: seat.id }); });
    this.nextTick = performance.now() + 1000 / this.sim.tickHz;
    this.schedule();
  }

  onAuth(_client: Client, options: { token?: string }) {
    const access = verifyAccess(options?.token);
    if (!access) throw new Error('This test session requires a valid, unexpired invitation.');
    return access;
  }
  onJoin(client: Client, options: { bot?: boolean }, auth: Access) {
    const used = new Set([...this.seats.values()].map(s => s.id));
    const id = this.sim.bodies.findIndex((_, i) => !used.has(i));
    if (id < 0) throw new Error(`This test rope already has ${this.sim.bodies.length} players.`);
    this.seats.set(client.sessionId, { id, input: { ...REST }, seq: -1, receivedAt: 0,
      eventCursor: this.sim.snapshot(this.epoch).events.at(-1)?.id ?? -1,
      operator: auth.role === 'operator', bot: options.bot === true, windowStarted: performance.now(), messages: 0,
      debugWindowStarted: performance.now(), debugCommands: 0 });
    client.send('seat', { id, operator: auth.role === 'operator' });
    this.sendSnapshot();
  }
  onLeave(client: Client) { this.seats.delete(client.sessionId); this.sendSnapshot(); }
  onDispose() { clearTimeout(this.timer); this.sim?.dispose(); }

  private receiveInput(client: Client, value: unknown) {
    const seat = this.seats.get(client.sessionId);
    if (!seat) return;
    const now = performance.now();
    if (now - seat.windowStarted >= 1000) { seat.windowStarted = now; seat.messages = 0; }
    if (++seat.messages > TUNING.network.maximumMessagesPerSecond) { this.rejectedInputs++; return; }
    const frame = parseInput(value);
    if (!frame || frame.seq <= seat.seq) { this.rejectedInputs++; return; }
    seat.input = { x: frame.x, z: frame.z, brace: frame.brace };
    seat.seq = frame.seq; seat.receivedAt = now; this.acceptedInputs++;
  }

  private currentInputs() {
    const inputs: Move[] = this.sim.bodies.map(() => ({ ...REST }));
    const now = performance.now();
    for (const seat of this.seats.values()) if (now - seat.receivedAt <= TUNING.body.maximumInputAgeMs) inputs[seat.id] = seat.input;
    return inputs;
  }

  private schedule = () => {
    const frameMs = 1000 / this.sim.tickHz;
    let now = performance.now();
    let count = 0;
    while (now >= this.nextTick && count < TUNING.maximumCatchupTicks) {
      const started = performance.now(), late = Math.max(0, started - this.nextTick);
      this.scheduling.add(late);
      if (!this.paused && this.seats.size) this.sim.step(this.currentInputs(), true);
      this.sendSnapshot();
      const work = performance.now() - started;
      this.tickTimes.add(work); this.combined.add(late + work);
      this.nextTick += frameMs; count++; now = performance.now();
    }
    if (now >= this.nextTick) {
      const skipped = Math.floor((now - this.nextTick) / frameMs) + 1;
      this.skippedTickSlots += skipped; this.droppedWallMs += skipped * frameMs;
      this.nextTick += skipped * frameMs; // Keep the original slot grid; never hide missed deadlines by rebasing it.
    }
    this.timer = setTimeout(this.schedule, Math.max(0, this.nextTick - performance.now()));
  };

  private snapshot() {
    const snapshot = this.sim.snapshot(this.epoch);
    snapshot.paused = this.paused;
    for (const seat of this.seats.values()) {
      snapshot.players[seat.id].connected = true;
      snapshot.players[seat.id].ackSeq = seat.seq;
      snapshot.players[seat.id].label = seat.bot ? `BOT ${seat.id + 1}` : `Climber ${seat.id + 1}`;
    }
    return snapshot;
  }
  private sendSnapshot() {
    if (!this.clients.length) return;
    const snapshot = this.snapshot();
    // Most seats share a cursor, so serialize the estimate once per distinct event batch.
    const batches = new Map<number, { message: typeof snapshot; bytes: number }>();
    for (const client of this.clients) {
      // A joining client receives its first snapshot on the next tick after its handshake.
      // Colyseus otherwise enqueues every snapshot while it waits for that acknowledgement.
      if (client.state !== ClientState.JOINED) continue;
      const socket = client.ref as typeof client.ref & { bufferedAmount?: number };
      if ((socket.bufferedAmount ?? 0) > TUNING.network.maximumSnapshotBufferedBytes) { this.skippedSnapshots++; continue; }
      const seat = this.seats.get(client.sessionId);
      if (!seat) continue;
      let batch = batches.get(seat.eventCursor);
      if (!batch) {
        const message = { ...snapshot, events: snapshot.events.filter(event => event.id > seat.eventCursor) };
        batch = { message, bytes: Buffer.byteLength(JSON.stringify(message)) }; batches.set(seat.eventCursor, batch);
      }
      client.send('snapshot', batch.message);
      seat.eventCursor = snapshot.events.at(-1)?.id ?? seat.eventCursor;
      this.snapshotBytes = batch.bytes; this.snapshotDeliveries++; this.snapshotJsonBytesTotal += batch.bytes;
    }
  }
  private report() {
    return { physics: this.sim.counters, tickExecutionMs: this.tickTimes.summary(), schedulingLatenessMs: this.scheduling.summary(),
      schedulingPlusExecutionMs: this.combined.summary(), rejectedInputs: this.rejectedInputs, acceptedInputs: this.acceptedInputs,
      snapshotDeliveries: this.snapshotDeliveries, snapshotJsonBytesTotal: this.snapshotJsonBytesTotal,
      byteAccounting: 'UTF-8 JSON estimate for actual snapshot recipients; excludes transport encoding, framing and TLS.',
      timingScope: `Most recent ${TUNING.network.telemetrySamples} completed callbacks; skipped required deadlines are separately counted, not included in these percentiles.`,
      droppedWallMs: this.droppedWallMs, skippedTickSlots: this.skippedTickSlots,
      skippedSnapshots: this.skippedSnapshots, rejectedDebugCommands: this.rejectedDebugCommands, state: this.snapshot(),
      snapshotBytes: this.snapshotBytes, ropePointCount: this.sim.points.length,
      tapeFrames: this.sim.tape.frames.length, tapeTruncated: this.sim.tape.truncated, processMemory: process.memoryUsage(),
      memoryAttribution: 'Process RSS/heap includes all rooms and shared runtime; not per-room memory.',
      tickHz: this.sim.tickHz, physicsHz: TUNING.physicsHz, family: this.sim.family, seed: this.sim.seed,
      simulatedPlayers: this.sim.bodies.length, connectedPlayers: this.seats.size,
      scene: this.sim.scene, playerCount: this.sim.playerCount,
      phase: TUNING.phase, gateVerdict: 'HUMAN EVIDENCE UNMEASURED', gate1Authorization: 'Implementation stop bypassed by user instruction on 2026-09-07',
      packetLoss: 'Unknown; WebSocket does not expose wire retransmissions.' };
  }
  private debug(client: Client, request: DebugCommand) {
    if (!request || typeof request.requestId !== 'string' || request.requestId.length > TUNING.network.maximumFrameBytes) return;
    const seat = this.seats.get(client.sessionId);
    const socket = client.ref as typeof client.ref & { bufferedAmount?: number };
    if ((socket.bufferedAmount ?? 0) > TUNING.network.maximumSnapshotBufferedBytes) {
      this.rejectedDebugCommands++; client.leave(1008, 'Diagnostic connection is not reading its replies.'); return;
    }
    try {
      if (!seat?.operator) throw new Error('Test controls are restricted to the local operator.');
      const now = performance.now();
      if (now - seat.debugWindowStarted >= 1000) { seat.debugWindowStarted = now; seat.debugCommands = 0; }
      if (++seat.debugCommands > TUNING.network.maximumDebugCommandsPerSecond) {
        this.rejectedDebugCommands++; throw new Error('Too many test commands; wait a second before retrying.');
      }
      let result: unknown;
      if (request.command === 'counters') result = this.report();
      else if (request.command === 'tape') result = this.sim.tape;
      else if (request.command === 'pause' || request.command === 'resume') {
        this.paused = request.command === 'pause'; result = { paused: this.paused };
      } else if (request.command === 'stepTicks') {
        if (!this.paused) throw new Error('Pause the room before stepping.');
        const count = request.value as number;
        if (!Number.isSafeInteger(count) || count < 1 || count > TUNING.network.maximumStepTicks) throw new Error('Invalid tick count.');
        // One requested batch has one sampled input frame. Wall-clock expiry inside this
        // synchronous loop would make the resulting tape depend on machine speed.
        const inputs = this.currentInputs();
        for (let i = 0; i < count; i++) this.sim.step(inputs, true);
        result = this.snapshot();
      } else if (request.command === 'setSeed' || request.command === 'loadScene') {
        const options = request.command === 'setSeed' ? { seed: request.value as number }
          : request.value as SceneOptions;
        const scene = resolveScene(options, { seed: this.sim.seed, family: this.sim.family, tickHz: this.sim.tickHz,
          scene: this.sim.scene, playerCount: this.sim.playerCount });
        assertOccupiedSeatsFit(scene.playerCount, [...this.seats.values()].map(current => current.id));
        const next = new BelaySimulation(scene);
        this.sim.dispose(); this.sim = next; this.epoch++;
        this.maxClients = this.sim.bodies.length; // Colyseus also updates automatic room locking when this changes.
        this.tickTimes.clear(); this.scheduling.clear(); this.combined.clear();
        this.rejectedInputs = 0; this.acceptedInputs = 0; this.snapshotDeliveries = 0; this.snapshotJsonBytesTotal = 0;
        this.droppedWallMs = 0; this.skippedTickSlots = 0; this.skippedSnapshots = 0; this.rejectedDebugCommands = 0;
        for (const current of this.seats.values()) { current.input = { ...REST }; current.receivedAt = 0; current.eventCursor = -1; }
        this.nextTick = performance.now() + 1000 / this.sim.tickHz;
        result = this.snapshot();
      } else throw new Error('Unknown debug command.');
      const reply = { requestId: request.requestId, result };
      if (Buffer.byteLength(JSON.stringify(reply)) > TUNING.network.maximumDebugResponseBytes) throw new Error('Diagnostic response is too large; reset and capture a shorter scene.');
      client.send('debugResult', reply); this.sendSnapshot();
    } catch (error) {
      client.send('debugResult', { requestId: request.requestId, error: error instanceof Error ? error.message : 'Debug command failed.' });
    }
  }
}
