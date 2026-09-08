import { TUNING, type TickHz } from '../../tuning';
import { REST, type Move, type Snapshot, type Vec3 } from '../../shared/protocol';
import { Samples } from '../../shared/stats';
import { LocalPrediction, supportedSweep } from '../../client/prediction';
import { onIce } from '../../client/terrain-view';
import { ClientEvidence } from '../../client/evidence';
import { BelayConnection } from '../../client/connection';

const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
type PredictorFields = { identity: string; tick: number; position?: Vec3; correction: Vec3 };
type Case = { playerCount: number; tickHz: TickHz; addedRttMs: number };
const cases: Case[] = TUNING.clientLatency.teamSizes.flatMap(playerCount => TUNING.clientLatency.authorityHz.flatMap(tickHz =>
  TUNING.clientLatency.addedRttMs.map(addedRttMs => ({ playerCount, tickHz: tickHz as TickHz, addedRttMs }))));

/** Test-entry instrumentation only. Every wrapped production method still runs once with its original receiver. */
export function installLatencyAudit(getConnection: () => BelayConnection | undefined) {
  let active = false, started = 0, epoch = -1, previousReceipt: number | null = null, staleTransitions = 0, staleGaps = 0;
  let frames: object[] = [], events: object[] = [], truncated = false, snapshots = 0, reconciliations = 0, unsupported = 0, hardCorrections = 0;
  let receipts = new WeakMap<Snapshot, number>(), rendered = new WeakSet<Snapshot>();
  const sends = new Map<number, number>(), eventIds = new Set<number>();
  const metrics = { snapshotIntervalsMs: new Samples(), acknowledgementLatencyMs: new Samples(), receiptToRendererSubmissionMs: new Samples(),
    rawReconciliationM: new Samples(), appliedCorrectionM: new Samples(), predictionFromInterpolationM: new Samples(), displayFromLatestAuthorityM: new Samples(), frameAgeMs: new Samples() };
  const keep = (rows: object[], row: object) => { if (rows.length < TUNING.network.telemetrySamples) rows.push(row); else truncated = true; };
  const observed = new WeakSet<BelayConnection>();
  const observeConnection = (connection: BelayConnection) => {
    if (observed.has(connection)) return; observed.add(connection);
    const snapshot = connection.onSnapshot, change = connection.onChange;
    connection.onSnapshot = state => {
      snapshot(state);
      if (!active || state.epoch !== epoch) return;
      const now = performance.now(); receipts.set(state, now); snapshots++;
      if (previousReceipt !== null) { const gap = now - previousReceipt; metrics.snapshotIntervalsMs.add(gap); if (gap > TUNING.network.staleSnapshotMs) staleGaps++; }
      previousReceipt = now;
      const ack = state.players.find(player => player.id === connection.localId)?.ackSeq;
      if (ack !== undefined) {
        const sent = sends.get(ack); if (sent !== undefined) metrics.acknowledgementLatencyMs.add(now - sent);
        for (const seq of sends.keys()) if (seq <= ack) sends.delete(seq);
      }
      for (const event of state.events ?? []) if (!eventIds.has(event.id)) {
        eventIds.add(event.id); keep(events, { ...event, firstReceivedAtMs: now - started, receivedInSnapshotTick: state.tick });
      }
    };
    connection.onChange = () => { change(); if (active && connection.status.startsWith('Connection stalled')) staleTransitions++; };
  };
  // oxlint-disable-next-line typescript/unbound-method -- Original receiver is preserved below.
  const sendInput = BelayConnection.prototype.sendInput;
  BelayConnection.prototype.sendInput = function () {
    const before = (this as unknown as { seq: number }).seq, now = performance.now(); sendInput.call(this);
    if (active && this === getConnection() && (this as unknown as { seq: number }).seq > before) {
      if (sends.size < TUNING.network.telemetrySamples) sends.set(before, now); else truncated = true;
    }
  };
  // oxlint-disable-next-line typescript/unbound-method -- Original receiver is preserved below.
  const sample = LocalPrediction.prototype.sample;
  LocalPrediction.prototype.sample = function (state, display, localId, input, dt, ageMs, canMove) {
    const fields = this as unknown as PredictorFields, own = state.players.find(player => player.id === localId);
    const enabled = canMove && !state.paused && (own?.support === 'ground' || !own?.support) && own?.rescueState !== 'lost' && own && !onIce(own.position, state.terrain);
    const identity = `${state.epoch}:${localId}:${own?.support ?? 'ground'}:${own?.rescueState ?? 'safe'}:${state.terrain?.bridges.filter(b => b.collapsed).map(b => b.id).join(',') ?? ''}`;
    const correcting = enabled && fields.position && fields.identity === identity && fields.tick !== state.tick;
    const raw = correcting ? Math.hypot(fields.position!.x + fields.correction.x - own.position.x, fields.position!.z + fields.correction.z - own.position.z) : null;
    const result = sample.call(this, state, display, localId, input, dt, ageMs, canMove);
    if (active && state.epoch === epoch && result && own) {
      const interpolated = display.players.find(player => player.id === localId)!.position;
      const deviation = distance(result, interpolated), authorityOffset = distance(result, own.position);
      const unsafe = enabled ? authorityOffset > Number.EPSILON && !supportedSweep(own.position, result, state) : deviation > Number.EPSILON;
      if (unsafe) unsupported++;
      if (raw !== null) { reconciliations++; metrics.rawReconciliationM.add(raw); if (raw > TUNING.network.hardCorrectionDistance) hardCorrections++; }
      const applied = enabled && fields.position ? distance(result, fields.position) : 0;
      metrics.appliedCorrectionM.add(applied); metrics.predictionFromInterpolationM.add(deviation); metrics.displayFromLatestAuthorityM.add(authorityOffset); metrics.frameAgeMs.add(ageMs);
      keep(frames, { atMs: performance.now() - started, tick: state.tick, support: own.support, canMove, ageMs,
        rawReconciliationM: raw, appliedCorrectionM: applied, predictionFromInterpolationM: deviation, displayFromLatestAuthorityM: authorityOffset, unsupported: unsafe });
    }
    return result;
  };
  // oxlint-disable-next-line typescript/unbound-method -- Original receiver is preserved below.
  const drawn = ClientEvidence.prototype.drawn;
  ClientEvidence.prototype.drawn = function (state, bridges, players, now) {
    drawn.call(this, state, bridges, players, now);
    const received = receipts.get(state);
    if (active && state.epoch === epoch && received !== undefined && !rendered.has(state)) {
      rendered.add(state); metrics.receiptToRendererSubmissionMs.add(performance.now() - received);
    }
  };
  const control = async (options: object) => {
    const response = await fetch('/audit/control', { method: 'POST', body: JSON.stringify(options) });
    if (!response.ok) throw new Error('Loopback audit control failed.');
  };
  const wait = async (condition: () => boolean) => {
    const end = performance.now() + TUNING.network.joinTimeoutMs;
    while (!condition()) { if (performance.now() >= end) throw new Error('Latency case setup timed out.'); await new Promise(resolve => setTimeout(resolve, TUNING.localLoad.probePollMs)); }
  };
  const start = (connection: BelayConnection) => {
    active = false; observeConnection(connection); started = performance.now(); epoch = connection.latest!.epoch;
    previousReceipt = null; staleTransitions = staleGaps = snapshots = reconciliations = unsupported = hardCorrections = 0;
    frames = []; events = []; truncated = false; receipts = new WeakMap(); rendered = new WeakSet(); sends.clear(); eventIds.clear();
    Object.values(metrics).forEach(samples => samples.clear()); connection.resetMeasurements(); connection.evidence.reset(epoch, started); active = true;
  };
  return { cases, async runCase(index: number) {
    const spec = cases[index], connection = getConnection(); if (!spec || !connection?.room) throw new Error('Join the latency fixture first.');
    await connection.command('pause'); await control({ partners: 0, helperPolicy: false });
    await control({ network: { addedRttMs: spec.addedRttMs, jitterMs: TUNING.clientLatency.jitterMs } });
    const previousEpoch = connection.latest?.epoch;
    await connection.command('loadScene', { scene: 'crossing', playerCount: spec.playerCount, tickHz: spec.tickHz, seed: TUNING.phase2.mechanicsLoadSeed });
    await wait(() => connection.latest?.epoch !== previousEpoch && connection.latest?.players.length === spec.playerCount);
    await control({ partners: spec.playerCount - 1, helperPolicy: true });
    await wait(() => connection.latest?.players.filter(player => player.connected).length === spec.playerCount);
    await new Promise(resolve => setTimeout(resolve, TUNING.localLoad.warmupMs));
    await connection.command('resume'); await wait(() => connection.latest?.paused === false);
    start(connection); const first = structuredClone(connection.latest!); let fell = false;
    const drive = () => {
      const state = connection.latest!, own = state.players.find(player => player.id === connection.localId)!, gap = state.terrain!.crevasses[0];
      if (own.rescueState !== 'safe') fell = true;
      const input: Move = fell ? own.rescueState === 'safe' || own.rescueState === 'lost' ? { ...REST, brace: true } : { x: 0, z: -1, brace: false }
        : own.position.z < (gap.minZ + gap.maxZ) / 2 ? { x: 0, z: 1, brace: false } : { ...REST, brace: true };
      connection.input = input;
    };
    drive(); const driver = setInterval(drive, TUNING.phase2Evidence.actionSeconds * 1000);
    try {
      await new Promise(resolve => setTimeout(resolve, TUNING.clientLatency.sampleSeconds * 1000)); active = false;
      const report = { spec, scene: 'crossing', seed: TUNING.phase2.mechanicsLoadSeed, jitterMs: TUNING.clientLatency.jitterMs,
        actualCaptureMs: performance.now() - started, startTick: first.tick, endTick: connection.latest!.tick, epoch,
        startingPlayers: first.players.length, endingPlayers: connection.latest!.players.length, snapshots, staleTransitions, staleGaps,
        metrics: Object.fromEntries(Object.entries(metrics).map(([key, samples]) => [key, samples.summary()])),
        reconciliations, hardCorrections, unsupportedPredictionFrames: unsupported, truncated, rawFrames: frames, firstReceivedEvents: events,
        presentation: connection.evidence.report(), network: connection.networkCounters(), endingState: structuredClone(connection.latest),
        endingView: connection.viewCounters(), sentAwaitingObservedAckAtEnd: sends.size };
      connection.releaseInput(); await connection.command('pause'); await control({ helperPolicy: false });
      return { ...report, serverAfterWindow: await connection.command('counters') };
    } finally { active = false; clearInterval(driver); connection.releaseInput(); }
  } };
}
