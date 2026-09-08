import { Client, type Room } from '@colyseus/sdk';
import { TUNING, FAMILIES } from '../tuning';
import { REST, type ClientConfig, type DebugCommand, type Move, type SceneOptions, type Snapshot } from '../shared/protocol';
import { Samples } from '../shared/stats';
import { ClientEvidence } from './evidence';
import { sameTopology } from './presentation';

export class BelayConnection {
  room?: Room;
  latest?: Snapshot;
  history: { at: number; state: Snapshot }[] = [];
  localId = -1;
  operator = false;
  status = 'Ready';
  input: Move = { ...REST };
  sessionNumber = 0;
  readonly evidence = new ClientEvidence();
  viewCounters: () => unknown = () => null;
  private seq = 0;
  private generation = 0;
  private disposed = false;
  private stalled = false;
  private joinAbort?: AbortController;
  private joinDeadline?: ReturnType<typeof setTimeout>;
  private inputTimer?: ReturnType<typeof setInterval>;
  private pingTimer?: ReturnType<typeof setInterval>;
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private pings = new Set<number>();
  private rtts = new Samples();
  private jitter = new Samples();
  private intervals = new Samples();
  private lastRtt?: number;
  private lastSnapshotAt: number | null = null;
  private joinedAt: number | null = null;
  private measurementsStartedAt = new Date().toISOString();
  private lastSession: { reason: string; state: Snapshot | null; network: ReturnType<BelayConnection['networkCounters']>; presentation: ReturnType<ClientEvidence['report']> } | null = null;
  missedProbes = 0;
  receivedSnapshots = 0;
  onChange: () => void = () => {};
  onSnapshot: (snapshot: Snapshot) => void = () => {};
  onInputReset: () => void = () => {};

  async join() {
    if (this.disposed || this.room || this.status === 'Connecting') return;
    const generation = ++this.generation;
    this.sessionNumber++;
    this.clearScene();
    this.resetMeasurements();
    this.status = 'Connecting'; this.onChange();
    const abort = new AbortController();
    this.joinAbort = abort;
    this.joinDeadline = setTimeout(() => {
      if (generation === this.generation) this.detach('Connection timed out — try joining again');
    }, TUNING.network.joinTimeoutMs);
    try {
      const response = await fetch('/game/belay/config', { cache: 'no-store', signal: abort.signal });
      if (!response.ok) throw new Error('The protected test connection is unavailable.');
      const config = await response.json() as ClientConfig;
      if (generation !== this.generation || this.disposed) return;
      const client = new Client(location.origin.replace(/^http/, 'ws') + config.endpoint);
      const room = await client.joinById(config.roomId, { token: config.token });
      // The current phase has no 60-second body reservation yet; SDK retries would queue stale controls
      // against a body already released by the server. Explicit rejoin is honest at this gate.
      room.reconnection.enabled = false;
      if (generation !== this.generation || this.disposed) { void room.leave(false).catch(() => {}); return; }
      clearTimeout(this.joinDeadline); this.joinAbort = undefined;
      this.operator = config.operator; this.room = room; this.joinedAt = performance.now();
      const current = () => this.room === room && generation === this.generation && !this.disposed;
      this.joinDeadline = setTimeout(() => { if (current() && !this.latest) this.detach('No game state arrived — try joining again'); }, TUNING.network.joinTimeoutMs);
      const identity = ({ id }: { id: number }) => {
        if (!current() || !Number.isInteger(id) || id < 0 || id >= TUNING.hardCap) return;
        this.localId = id; this.onChange();
      };
      room.onMessage('seat', identity);
      room.onMessage('identity', identity);
      room.onMessage('snapshot', (snapshot: Snapshot) => {
        if (!current()) return;
        const now = performance.now();
        const firstState = !this.latest;
        // After event-loop suspension, the socket callback can run before the overdue input interval.
        const recovering = this.stalled || this.lastSnapshotAt !== null && now - this.lastSnapshotAt > TUNING.network.staleSnapshotMs;
        if (firstState) clearTimeout(this.joinDeadline);
        if (this.latest && !sameTopology(snapshot, this.latest)) {
          this.history = []; this.resetMeasurements();
          this.evidence.reset(snapshot.epoch, now);
          this.input = { ...REST }; this.onInputReset();
        }
        if (this.receivedSnapshots && this.lastSnapshotAt !== null) this.intervals.add(now - this.lastSnapshotAt);
        this.lastSnapshotAt = now; this.receivedSnapshots++;
        if (recovering || firstState) {
          this.history = [];
          this.input = { ...REST }; this.onInputReset(); this.stalled = false; this.status = 'Connected'; this.onChange();
        }
        this.latest = snapshot; this.history.push({ at: now, state: snapshot });
        this.evidence.receive(snapshot, this.localId, now);
        if (this.history.length > TUNING.network.snapshotHistory) this.history.shift();
        this.onSnapshot(snapshot);
      });
      room.onMessage('pong', (sent: number) => {
        if (!current() || !this.pings.delete(sent)) return;
        const rtt = performance.now() - sent;
        this.rtts.add(rtt);
        if (this.lastRtt !== undefined) this.jitter.add(Math.abs(rtt - this.lastRtt));
        this.lastRtt = rtt;
      });
      room.onMessage('debugResult', ({ requestId, result, error }: { requestId: string; result: unknown; error?: string }) => {
        if (!current()) return;
        const pending = this.pending.get(requestId);
        if (!pending) return;
        clearTimeout(pending.timer); this.pending.delete(requestId);
        if (error) pending.reject(new Error(error)); else pending.resolve(result);
      });
      room.onDrop(() => { if (current()) this.detach('Connection lost — rejoin the test'); });
      room.onLeave(() => { if (current()) this.detach('Disconnected — rejoin the test'); });
      room.onError((_code, message) => {
        if (!current()) return;
        this.status = message ?? 'Connection error'; this.onChange();
      });
      this.inputTimer = setInterval(() => this.sendInput(), 1000 / TUNING.network.inputHz);
      this.pingTimer = setInterval(() => {
        if (!current() || !room.connection.isOpen) return;
        const now = performance.now();
        for (const sent of this.pings) if (now - sent > TUNING.network.probeTimeoutMs) { this.pings.delete(sent); this.missedProbes++; }
        this.pings.add(now); room.send('ping', now);
      }, TUNING.network.pingIntervalMs);
      room.send('identify');
      this.status = this.latest ? 'Connected' : 'Waiting for first game state'; this.onChange();
    } catch (error) {
      if (generation === this.generation && !this.disposed) this.detach(error instanceof Error ? error.message : 'Unable to connect.');
    }
  }

  sendInput() {
    if (!this.room?.connection.isOpen || this.localId < 0) return;
    const freshAt = this.lastSnapshotAt ?? this.joinedAt;
    if (freshAt !== null && performance.now() - freshAt > TUNING.network.staleSnapshotMs) {
      if (!this.stalled) {
        this.stalled = true; this.input = { ...REST }; this.onInputReset();
        this.room.send('input', { ...REST, seq: this.seq++ });
        this.status = 'Connection stalled — waiting for fresh state'; this.onChange();
      }
      return;
    }
    if (!this.latest?.players.some(player => player.id === this.localId && player.connected)) return;
    this.room.send('input', { ...this.input, seq: this.seq++ });
  }
  get acceptsMovement() {
    return Boolean(this.room?.connection.isOpen && this.latest?.players.some(player => player.id === this.localId && player.connected) && !this.stalled && this.lastSnapshotAt !== null
      && performance.now() - this.lastSnapshotAt <= TUNING.network.staleSnapshotMs);
  }
  releaseInput() { this.input = { ...REST }; this.sendInput(); }
  async leave() {
    this.releaseInput();
    this.detach('Ready');
  }
  private clearScene() {
    this.latest = undefined; this.history = []; this.localId = -1; this.operator = false;
    this.seq = 0; this.stalled = false; this.lastSnapshotAt = null; this.joinedAt = null; this.input = { ...REST }; this.onInputReset();
    this.evidence.reset();
  }
  private detach(reason: string) {
    const room = this.room;
    if (this.status !== 'Ready' || this.latest) this.lastSession = { reason, state: this.latest ? structuredClone(this.latest) : null, network: this.networkCounters(), presentation: this.evidence.report() };
    ++this.generation;
    this.joinAbort?.abort(); this.joinAbort = undefined;
    clearTimeout(this.joinDeadline); clearInterval(this.inputTimer); clearInterval(this.pingTimer);
    this.room = undefined; this.clearScene(); this.resetMeasurements();
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Connection closed.')); }
    this.pending.clear(); this.status = reason;
    // Close immediately; UI cleanup cannot depend on a reply over a broken connection.
    if (room?.connection.isOpen) { room.reconnection.enabled = false; void room.leave(false).catch(() => {}); }
    this.onChange();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.onChange = () => {}; this.onInputReset = () => {}; this.onSnapshot = () => {};
    void this.leave();
  }
  command(command: DebugCommand['command'], value?: unknown): Promise<unknown> {
    if (!this.room?.connection.isOpen) return Promise.reject(new Error('Join the test rope first.'));
    if (this.pending.size >= TUNING.network.maximumPendingDebugCommands) return Promise.reject(new Error('Wait for the current test commands to finish.'));
    const room = this.room, requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(requestId); reject(new Error('Test command timed out.')); }, TUNING.network.debugTimeoutMs);
      this.pending.set(requestId, { resolve, reject, timer });
      try { room.send('debug', { requestId, command, value }); }
      catch (error) { clearTimeout(timer); this.pending.delete(requestId); reject(error instanceof Error ? error : new Error('Test command could not be sent.')); }
    });
  }
  resetMeasurements() {
    this.rtts.clear(); this.jitter.clear(); this.intervals.clear(); this.pings.clear();
    this.lastRtt = undefined; this.receivedSnapshots = 0; this.missedProbes = 0;
    this.measurementsStartedAt = new Date().toISOString();
  }
  networkCounters() {
    return { measurementStartedAt: this.measurementsStartedAt, sessionNumber: this.sessionNumber,
      sceneEpoch: this.latest?.epoch ?? null, rttMs: this.rtts.summary(), jitterSuccessiveRttDifferenceMs: this.jitter.summary(),
      snapshotIntervalMs: this.intervals.summary(), receivedSnapshots: this.receivedSnapshots,
      missedEchoProbes: this.missedProbes, packetLoss: null,
      packetLossNote: 'Wire loss is unavailable from WebSocket. Missed probes are not packet loss.',
      lastSnapshotAgeMs: this.lastSnapshotAt !== null ? performance.now() - this.lastSnapshotAt : null,
      interpolationMs: TUNING.network.interpolationMs, inputHz: TUNING.network.inputHz };
  }
  async networkProfile(profile?: { addedRttMs: number; jitterMs: number }) {
    const response = await fetch('/test-network', { ...(profile ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) } : {}),
      signal: AbortSignal.timeout(TUNING.network.debugTimeoutMs) });
    if (!response.ok) throw new Error('Network profile requires a valid operator session and bounded RTT/jitter values.');
    const result: unknown = await response.json();
    if (profile) this.resetMeasurements();
    return result;
  }
  async captureReport() {
    const captureStartedAt = new Date().toISOString(), generation = this.generation;
    const client = this.networkCounters();
    const state = this.latest ? structuredClone(this.latest) : null;
    const connection = { connected: Boolean(this.room?.connection.isOpen), localPlayerId: this.localId, status: this.status,
      sessionNumber: this.sessionNumber, roomId: this.room?.roomId ?? null };
    const lastClosedSession = this.lastSession ? structuredClone(this.lastSession) : null;
    const presentation = this.evidence.report(), view = structuredClone(this.viewCounters());
    let server: unknown = null;
    try { if (this.operator && this.room?.connection.isOpen) server = await this.command('counters'); }
    catch (error) { server = { unavailable: true, reason: error instanceof Error ? error.message : 'Server report unavailable.' }; }
    let impairment: unknown;
    try { impairment = await this.networkProfile(); }
    catch { impairment = { unavailable: true }; }
    const serverState = (server as { state?: Snapshot } | null)?.state;
    return { generatedAt: new Date().toISOString(), captureStartedAt, userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      phase: TUNING.phase, gateVerdict: 'NOT EVALUATED', tuning: TUNING, familyDefinitions: FAMILIES,
      connection, client, server, impairment, state, lastClosedSession, presentation, view,
      rescueVerdict: 'NOT EVALUATED',
      roleEvidenceNote: 'Role active/idle/unchanged-hold seconds are mechanical/input proxies. Being dragged under load can accrue roleActiveSeconds without purposeful input; it cannot establish agency or pass the human rescue stop.',
      captureChange: { sessionChanged: generation !== this.generation, sceneChanged: state?.epoch !== this.latest?.epoch,
        serverSceneMatches: serverState ? serverState.epoch === state?.epoch : null },
      connectionAtFinish: { connected: Boolean(this.room?.connection.isOpen), sessionNumber: this.sessionNumber, sceneEpoch: this.latest?.epoch ?? null } };
  }
  debugApi() {
    return {
      getState: () => this.latest ? structuredClone(this.latest) : null,
      counters: () => ({ connection: { connected: Boolean(this.room?.connection.isOpen), localPlayerId: this.localId, status: this.status },
        network: this.networkCounters(), physics: this.latest?.counters ?? null }),
      setSeed: (seed: number) => this.command('setSeed', seed),
      loadScene: (scene: SceneOptions = {}) => this.command('loadScene', scene),
      stepTicks: (ticks: number) => this.command('stepTicks', ticks),
      pause: () => this.command('pause'), resume: () => this.command('resume'),
      serverCounters: () => this.command('counters'), tape: () => this.command('tape'),
      networkProfile: (profile?: { addedRttMs: number; jitterMs: number }) => this.networkProfile(profile),
      resetMeasurements: () => this.resetMeasurements(), captureReport: () => this.captureReport(),
      presentation: () => ({ view: this.viewCounters(), cues: this.evidence.report() }),
    };
  }
}
export type BelayDebugApi = ReturnType<BelayConnection['debugApi']>;
declare global { interface Window { BELAY?: BelayDebugApi } }
