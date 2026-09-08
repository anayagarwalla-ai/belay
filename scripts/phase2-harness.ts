import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { setImmediate as yieldImmediate } from 'node:timers/promises';
import { TUNING } from '../tuning';
import { BelaySimulation } from '../shared/simulation';
import { normalizeMove, type IncidentState, type Move, type PhysicalDiagnostics, type PhysicalEvent, type SimulationSnapshot, type Tape } from '../shared/protocol';
import { FullWindowSamples, type EpisodeEvidence, type TrajectoryRecord, type TimingSink } from './phase2-analysis';
import { Phase2Policy, type TrajectorySpec } from './phase2-policies';

export type EvidenceRecord = TrajectoryRecord & {
  eventCounts: Partial<Record<PhysicalEvent['kind'], number>>;
  diagnostics: PhysicalDiagnostics;
  counterPolicy: { armedTick: number | null; heldPlayerIds: number[]; wholeEpisodeHoldVerifiedIds: number[];
    interventions: { armedTick: number; releasedTick: number | null; heldPlayerIds: number[]; incidentIds: number[] }[] };
  finalBodyStates: { id: number; position: { x: number; y: number; z: number }; support: string; rescueState: string }[];
};

export function physicalState(snapshot: SimulationSnapshot) {
  const { serverTime: _wallClock, ...state } = snapshot;
  return state;
}
export const stateHash = (snapshot: SimulationSnapshot) => createHash('sha256').update(JSON.stringify(physicalState(snapshot))).digest('hex');
const copyEpisode = (episode: IncidentState, tick: number): EpisodeEvidence => ({ ...episode,
  playerIds: [...episode.playerIds], roleActiveSeconds: [...episode.roleActiveSeconds],
  roleIdleSeconds: [...episode.roleIdleSeconds], staticHoldSeconds: [...episode.staticHoldSeconds], observedUntilTick: tick });
const unchanged = (a: Move, b: Move) => a.brace === b.brace && Math.hypot(a.x - b.x, a.z - b.z) <= TUNING.phase2Evidence.inputChangeEpsilon;

function validateState(snapshot: SimulationSnapshot) {
  if (snapshot.players.length !== snapshot.playerCount) throw new Error('Player count changed within a trajectory.');
  if (snapshot.rope.spans.length !== snapshot.playerCount - 1) throw new Error('Rope span count does not match ordered harnesses.');
  if (snapshot.players.some(player => !player.support || !player.rescueState)) throw new Error('Missing Phase 2 player state.');
  for (const player of snapshot.players) for (const value of Object.values(player.position).concat(Object.values(player.velocity))) {
    if (!Number.isFinite(value)) throw new Error(`Nonfinite physical state at player ${player.id}.`);
  }
  for (const point of snapshot.rope.points) if (![point.x, point.y, point.z].every(Number.isFinite)) throw new Error('Nonfinite rope particle.');
  for (const value of Object.values(snapshot.diagnostics)) if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Nonfinite physical diagnostic.');
  for (const value of Object.values(snapshot.counters).flat()) if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Nonfinite simulation counter.');
  for (const incident of snapshot.incidents) {
    for (const values of [incident.roleActiveSeconds, incident.roleIdleSeconds, incident.staticHoldSeconds]) {
      if (values.length !== snapshot.playerCount || values.some(value => !Number.isFinite(value) || value < 0)) throw new Error('Invalid incident participation counters.');
    }
  }
  for (const span of snapshot.rope.spans) {
    if (span.b !== span.a + 1 || span.startPoint < 0 || span.endPoint >= snapshot.rope.points.length) throw new Error('Invalid adjacent span topology.');
  }
}

function* trajectorySteps(spec: TrajectorySpec, allTimings?: TimingSink, recordTape = false, stopReason?: () => string | null) {
  const simulation = new BelaySimulation(spec);
  try {
    const policy = new Phase2Policy(spec);
    const maximumTicks = Math.ceil(spec.horizonSeconds * spec.tickHz);
    const timings = new FullWindowSamples(maximumTicks, TUNING.phase2Evidence.maximumTimingBytes);
    const episodes = new Map<number, EpisodeEvidence>();
    const wholeEpisodeHold = new Map<number, boolean>();
    const eventCounts: Partial<Record<PhysicalEvent['kind'], number>> = {};
    const idle = Array<number>(spec.playerCount).fill(0), held = Array<number>(spec.playerCount).fill(0);
    const longestHeld = Array<number>(spec.playerCount).fill(0), rescueExposure = Array<number>(spec.playerCount).fill(0);
    const motionless = Array<number>(spec.playerCount).fill(0);
    const inputDigest = createHash('sha256');
    let snapshot = simulation.snapshot(), lastValidSnapshot = snapshot, previousInputs: Move[] | undefined;
    let lastEventId: number | undefined, lastTick = snapshot.tick, attempts = 0;
    let ending: TrajectoryRecord['ending'] = 'censored', error: string | null = null, completeEvidence = true;
    try {
      validateState(snapshot);
      for (let tick = 0; tick < maximumTicks; tick++) {
        const stopped = stopReason?.();
        if (stopped) throw new Error(stopped);
        const before = snapshot;
        const inputs = policy.inputs(before).map(normalizeMove);
        // These are the exact bounded arguments submitted to step(), not network authentication evidence.
        inputDigest.update(JSON.stringify(inputs)); inputDigest.update('\n');
        const started = performance.now();
        attempts++;
        try { simulation.step(inputs, recordTape); }
        finally { const elapsed = performance.now() - started; timings.add(elapsed); allTimings?.add(elapsed); }
        snapshot = simulation.snapshot();
        validateState(snapshot);
        lastValidSnapshot = snapshot;
        if (snapshot.tick !== lastTick + 1) throw new Error('Simulation skipped an authority tick.');
        lastTick = snapshot.tick;
        const dt = 1 / spec.tickHz;
        for (const incident of snapshot.incidents) {
          const existing = episodes.get(incident.id);
          if (existing && existing.fallTick !== incident.fallTick) throw new Error('An incident ID was reused.');
          episodes.set(incident.id, copyEpisode(incident, snapshot.tick));
          if (!wholeEpisodeHold.has(incident.id)) {
            const fromStart = policy.observations.counterArmedTick !== null && policy.observations.counterArmedTick <= incident.fallTick;
            wholeEpisodeHold.set(incident.id, fromStart && policy.observations.heldPlayerIds.length > 0);
          }
          if (incident.status === 'active' || existing?.status === 'active') {
            for (const id of policy.observations.heldPlayerIds) {
              if (inputs[id].x !== 0 || inputs[id].z !== 0 || inputs[id].brace !== (spec.policy === 'static-brace')) wholeEpisodeHold.set(incident.id, false);
            }
          }
        }
        for (const event of snapshot.events) {
          if (lastEventId !== undefined && event.id <= lastEventId) continue;
          if (lastEventId !== undefined && event.id !== lastEventId + 1) completeEvidence = false;
          lastEventId = event.id;
          eventCounts[event.kind] = (eventCounts[event.kind] ?? 0) + 1;
        }
        const inRescue = before.incidents.some(incident => incident.status === 'active') || snapshot.incidents.some(incident => incident.status === 'active');
        if (inRescue) for (let id = 0; id < spec.playerCount; id++) {
          rescueExposure[id] += dt;
          const input = inputs[id];
          if (!input.x && !input.z && !input.brace) idle[id] += dt;
          held[id] = previousInputs && unchanged(input, previousInputs[id]) ? held[id] + dt : dt;
          longestHeld[id] = Math.max(longestHeld[id], held[id]);
          const a = before.players[id].position, b = snapshot.players[id].position;
          if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= TUNING.phase2Evidence.movementEpsilonM) motionless[id] += dt;
        } else held.fill(0);
        previousInputs = inputs;
        if (snapshot.run.status === 'failed') { ending = 'failed'; break; }
        if (spec.scene === 'rescue' && episodes.size > 0 && [...episodes.values()].every(episode => episode.status === 'recovered')) {
          ending = 'fixture-recovered'; break;
        }
        if (snapshot.run.status === 'complete') { ending = 'complete'; break; }
        yield;
      }
    } catch (cause) {
      ending = 'error'; error = cause instanceof Error ? cause.message : String(cause); completeEvidence = false;
      snapshot = lastValidSnapshot; // Error rows retain the last valid state, not JSON-null substitutions for NaN.
    }
    for (const episode of episodes.values()) if (episode.status === 'active') episode.observedUntilTick = snapshot.tick;
    if (episodes.size !== snapshot.diagnostics.incidentsStarted) completeEvidence = false;
    const heldRecoveries = [...episodes.values()].filter(episode => episode.status === 'recovered' && wholeEpisodeHold.get(episode.id)).map(episode => episode.id);
    const record: EvidenceRecord = {
      ordinal: spec.ordinal, seed: spec.seed, family: spec.family, scene: spec.scene, playerCount: spec.playerCount,
      policy: spec.policy, tickHz: spec.tickHz, horizonSeconds: spec.horizonSeconds, observedSeconds: snapshot.tick / spec.tickHz,
      ticks: snapshot.tick, stepAttempts: attempts, ending, runStatus: snapshot.run.status, progress: snapshot.run.progress,
      firstFallSeconds: snapshot.diagnostics.firstFallSeconds, episodes: [...episodes.values()], inputIdleSeconds: idle,
      longestUnchangedInputSeconds: longestHeld, rescueObservationSeconds: rescueExposure, rescueMotionlessSeconds: motionless,
      staticCounterexampleEpisodes: spec.policy === 'static-brace' ? heldRecoveries : [],
      frozenCounterexampleEpisodes: spec.policy === 'frozen-tail' ? heldRecoveries : [],
      maximumSpanErrorM: snapshot.counters.maximumSpanErrorM, maximumSegmentErrorM: snapshot.counters.maximumSegmentErrorM,
      maximumSpeedMps: snapshot.counters.maximumSpeedMps, stepExecutionMs: timings.summary(), finalStateSha256: stateHash(snapshot),
      policyInputsSha256: inputDigest.digest('hex'), error, evidenceComplete: completeEvidence, eventCounts,
      diagnostics: { ...snapshot.diagnostics },
      counterPolicy: { armedTick: policy.observations.counterArmedTick, heldPlayerIds: [...policy.observations.heldPlayerIds], wholeEpisodeHoldVerifiedIds: heldRecoveries,
        interventions: structuredClone(policy.observations.interventions) },
      finalBodyStates: snapshot.players.map(player => ({ id: player.id, position: { ...player.position }, support: player.support ?? 'missing', rescueState: player.rescueState ?? 'missing' })),
    };
    const tape = recordTape ? structuredClone(simulation.tape) : undefined;
    return { record, tape, finalState: physicalState(snapshot) };
  } finally { simulation.dispose(); }
}

/** Same state machine as the asynchronous worker path; yields do not modify inputs or physics. */
export function runTrajectory(spec: TrajectorySpec, allTimings?: TimingSink, recordTape = false) {
  const steps = trajectorySteps(spec, allTimings, recordTape);
  let next = steps.next();
  while (!next.done) next = steps.next();
  return next.value;
}

export async function runTrajectoryAsync(spec: TrajectorySpec, allTimings?: TimingSink, recordTape = false,
  control: { stopReason?: () => string | null; onYield?: () => Promise<void> } = {}) {
  const steps = trajectorySteps(spec, allTimings, recordTape, control.stopReason);
  try {
    let next = steps.next();
    while (!next.done) {
      await yieldImmediate(); // Permit IPC, cancellation and flushing outside simulation.step timing.
      await control.onYield?.();
      next = steps.next();
    }
    return next.value;
  } finally { steps.return(undefined as never); }
}

export function replayTape(tape: Tape) {
  if (!tape || !Array.isArray(tape.frames) || !Number.isSafeInteger(tape.tickHz) || tape.tickHz <= 0) throw new Error('Invalid tape shape.');
  if (tape.version !== TUNING.version) throw new Error('Tape simulation version does not match the current build.');
  if (tape.truncated) throw new Error('A truncated tape cannot verify a complete trajectory.');
  if (!tape.scene || !tape.playerCount) throw new Error('Phase 2 replay requires explicit scene and player count.');
  if (tape.frames.length > tape.tickHz * TUNING.network.maximumTapeSeconds || tape.frames.length > TUNING.physicsHz * TUNING.network.maximumTapeSeconds) throw new Error('Tape exceeds the root frame bound.');
  const simulation = new BelaySimulation(tape);
  try {
    for (const frame of tape.frames) {
      if (frame.tick !== simulation.tick || frame.inputs.length !== tape.playerCount) throw new Error('Tape sequence/body count is invalid.');
      for (const input of frame.inputs) if (!Number.isFinite(input.x) || !Number.isFinite(input.z) || Math.abs(input.x) > 1 || Math.abs(input.z) > 1 || typeof input.brace !== 'boolean') {
        throw new Error('Tape contains invalid controls.');
      }
      simulation.step(frame.inputs);
    }
    const snapshot = simulation.snapshot(); validateState(snapshot);
    return { frames: tape.frames.length, finalStateSha256: stateHash(snapshot), finalState: physicalState(snapshot) };
  } finally { simulation.dispose(); }
}
