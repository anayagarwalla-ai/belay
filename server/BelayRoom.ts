import { Room, type Client } from '@colyseus/core';
import { performance } from 'node:perf_hooks';
import { TUNING, isFamily } from '../tuning';
import { REST, parseInput, type Move, type SceneOptions, type DebugCommand } from '../shared/protocol';
import { BelaySimulation, initializePhysics } from '../shared/simulation';
import { Samples } from '../shared/stats';
import { verifyAccess, type Access } from './auth';

type Seat = { id: number; input: Move; seq: number; receivedAt: number; operator: boolean; bot: boolean;
  windowStarted: number; messages: number };

export class BelayRoom extends Room {
  maxClients = TUNING.players;
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
  private droppedWallMs = 0;

  async onCreate(options: SceneOptions & { token?: string; persistent?: boolean } = {}) {
    if (verifyAccess(options.token)?.role !== 'operator') throw new Error('Only the test operator can create a room.');
    this.autoDispose = !options.persistent;
    await initializePhysics();
    if (TUNING.players > TUNING.hardCap) throw new Error('Room hard cap exceeded');
    this.sim = new BelaySimulation(this.validateScene(options));
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
    if (id < 0) throw new Error('This Phase 1 rope already has two players.');
    this.seats.set(client.sessionId, { id, input: { ...REST }, seq: -1, receivedAt: 0,
      operator: auth.role === 'operator', bot: options.bot === true, windowStarted: performance.now(), messages: 0 });
    client.send('seat', { id, operator: auth.role === 'operator' });
    this.sendSnapshot();
  }
  onLeave(client: Client) { this.seats.delete(client.sessionId); this.sendSnapshot(); }
  onDispose() { clearTimeout(this.timer); this.sim.dispose(); }

  private receiveInput(client: Client, value: unknown) {
    const seat = this.seats.get(client.sessionId);
    if (!seat) return;
    const now = performance.now();
    if (now - seat.windowStarted >= 1000) { seat.windowStarted = now; seat.messages = 0; }
    if (++seat.messages > TUNING.network.maximumMessagesPerSecond) { this.rejectedInputs++; return; }
    const frame = parseInput(value);
    if (!frame || frame.seq <= seat.seq) { this.rejectedInputs++; return; }
    seat.input = { x: frame.x, z: frame.z, brace: frame.brace };
    seat.seq = frame.seq; seat.receivedAt = now;
  }

  private currentInputs() {
    const inputs: Move[] = this.sim.bodies.map(() => ({ ...REST }));
    const now = performance.now();
    for (const seat of this.seats.values()) if (now - seat.receivedAt <= TUNING.body.maximumInputAgeMs) inputs[seat.id] = seat.input;
    return inputs;
  }

  private schedule = () => {
    const frameMs = 1000 / this.sim.tickHz;
    const now = performance.now();
    let count = 0;
    while (now >= this.nextTick && count < TUNING.maximumCatchupTicks) {
      const started = performance.now(), late = Math.max(0, started - this.nextTick);
      this.scheduling.add(late);
      if (!this.paused && this.seats.size) this.sim.step(this.currentInputs(), true);
      this.sendSnapshot();
      const work = performance.now() - started;
      this.tickTimes.add(work); this.combined.add(late + work);
      this.nextTick += frameMs; count++;
    }
    if (now >= this.nextTick) {
      this.droppedWallMs += now - this.nextTick;
      this.nextTick = now + frameMs;
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
    const snapshot = this.snapshot();
    this.snapshotBytes = Buffer.byteLength(JSON.stringify(snapshot));
    this.broadcast('snapshot', snapshot);
  }
  private report() {
    return { physics: this.sim.counters, tickExecutionMs: this.tickTimes.summary(), schedulingLatenessMs: this.scheduling.summary(),
      schedulingPlusExecutionMs: this.combined.summary(), rejectedInputs: this.rejectedInputs, droppedWallMs: this.droppedWallMs,
      snapshotBytes: this.snapshotBytes, ropePointCount: this.sim.points.length,
      tapeFrames: this.sim.tape.frames.length, tapeTruncated: this.sim.tape.truncated, processMemory: process.memoryUsage(),
      memoryAttribution: 'Process RSS/heap includes all rooms and shared runtime; not per-room memory.',
      tickHz: this.sim.tickHz, physicsHz: TUNING.physicsHz, family: this.sim.family, seed: this.sim.seed,
      simulatedPlayers: this.sim.bodies.length, connectedPlayers: this.seats.size,
      phase: TUNING.phase, gateVerdict: 'NOT EVALUATED', packetLoss: 'Unknown; WebSocket does not expose wire retransmissions.' };
  }
  private validateScene(value: SceneOptions) {
    if (value.seed !== undefined && (!Number.isSafeInteger(value.seed) || value.seed < 0 || value.seed > 0xffffffff)) throw new Error('Seed must be an unsigned 32-bit integer.');
    if (value.family !== undefined && !isFamily(value.family)) throw new Error('Unknown tuning family.');
    if (value.tickHz !== undefined && value.tickHz !== 30 && value.tickHz !== 60) throw new Error('Tick rate must be 30 or 60.');
    return value;
  }
  private debug(client: Client, request: DebugCommand) {
    if (!request || typeof request.requestId !== 'string' || request.requestId.length > TUNING.network.maximumFrameBytes) return;
    const seat = this.seats.get(client.sessionId);
    try {
      if (!seat?.operator) throw new Error('Test controls are restricted to the local operator.');
      let result: unknown;
      if (request.command === 'counters') result = this.report();
      else if (request.command === 'tape') result = this.sim.tape;
      else if (request.command === 'pause' || request.command === 'resume') {
        this.paused = request.command === 'pause'; result = { paused: this.paused };
      } else if (request.command === 'stepTicks') {
        if (!this.paused) throw new Error('Pause the room before stepping.');
        const count = request.value as number;
        if (!Number.isSafeInteger(count) || count < 1 || count > TUNING.network.maximumStepTicks) throw new Error('Invalid tick count.');
        for (let i = 0; i < count; i++) this.sim.step(this.currentInputs(), true);
        result = this.snapshot();
      } else if (request.command === 'setSeed' || request.command === 'loadScene') {
        const options = request.command === 'setSeed' ? { seed: request.value as number }
          : request.value as SceneOptions;
        if (!options || typeof options !== 'object' || Object.keys(options).some(k => !['seed', 'family', 'tickHz'].includes(k))) throw new Error('Only the flat Phase 1 scene can be loaded.');
        const next = new BelaySimulation(this.validateScene({ seed: this.sim.seed, family: this.sim.family, tickHz: this.sim.tickHz, ...options }));
        this.sim.dispose(); this.sim = next; this.epoch++;
        for (const current of this.seats.values()) { current.input = { ...REST }; current.receivedAt = 0; }
        this.nextTick = performance.now() + 1000 / this.sim.tickHz;
        result = this.snapshot();
      } else throw new Error('Unknown debug command.');
      client.send('debugResult', { requestId: request.requestId, result }); this.sendSnapshot();
    } catch (error) {
      client.send('debugResult', { requestId: request.requestId, error: error instanceof Error ? error.message : 'Debug command failed.' });
    }
  }
}
