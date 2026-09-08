import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BelaySimulation, initializePhysics } from '../shared/simulation';
import { constructScene } from './fixtures/construct-scene';
import { Phase2Policy, trajectorySchedule } from '../scripts/phase2-policies';
import { physicalTerrain } from '../shared/terrain';
import { expeditionContactHalf, penetration, supportAt } from '../shared/contact-geometry';
import { REST, type Move, type SimulationSnapshot } from '../shared/protocol';
import { TUNING } from '../tuning';
import { cameraFrame, displayedSpans, interpolateState } from '../client/presentation';
import { groundSupports, LocalPrediction, supportedSweep } from '../client/prediction';
import { groundPatches, onIce, terrainSolids, topSurfaceOccludesBody } from '../client/terrain-view';
import { nearestWall } from '../client/controls';
import { ClientEvidence } from '../client/evidence';
import { BelayConnection } from '../client/connection';

type Policy = 'catch' | 'climb' | 'cross' | 'ice' | 'weak-bridge' | 'stable-cross';
const traces = new Map<string, SimulationSnapshot[]>();
const half = { x: TUNING.body.width / 2, y: TUNING.body.height / 2, z: TUNING.body.depth / 2 };
beforeAll(initializePhysics);
function trace(count: number, policy: Policy) {
  const key = `${count}:${policy}`, cached = traces.get(key); if (cached) return cached;
  const scene = policy === 'catch' || policy === 'climb' ? 'rescue' : 'crossing';
  const options = { scene, playerCount: count, seed: policy === 'weak-bridge' ? TUNING.phase2.mechanicsLoadSeed : TUNING.seed } as const;
  const sim = policy === 'stable-cross' ? constructScene(options, (p, id) => ({ ...p, x: TUNING.phase2.bridgeLaneOffsets[1], z: -id * 0.65 })) : new BelaySimulation(options);
  const frames = [sim.snapshot(1)];
  const rescue = new Phase2Policy({ ...trajectorySchedule(10)[5], playerCount: count });
  const horizon = policy === 'climb' ? TUNING.phase2Evidence.rescueSeconds : TUNING.phase2.mechanicsProbeSeconds;
  try {
    for (let tick = 0; tick < sim.tickHz * horizon; tick++) {
      const inputs: Move[] = sim.bodies.map((body, id) => {
        if (policy === 'catch' || policy === 'climb') return id === Math.floor(count / 2)
          ? policy === 'climb' && tick > sim.tickHz ? { x: 0, z: -1, brace: false } : REST : { ...REST, brace: true };
        if (policy === 'weak-bridge') {
          const gap = frames[0].terrain.crevasses[0];
          return body.translation().z < (id ? gap.minZ - TUNING.phase2.rescueSafeOffset : (gap.minZ + gap.maxZ) / 2)
            ? { x: 0, z: 1, brace: false } : { ...REST, brace: true };
        }
        // A brief common sideways input enters the public ice patch; it is a fixed regression probe, not a recovery policy.
        return policy === 'ice' && body.translation().x < frames[0].terrain.ice[0].minX + TUNING.body.width ? { x: 1, z: 0, brace: false } : { x: 0, z: 1, brace: false };
      });
      sim.step(policy === 'climb' ? rescue.inputs(frames.at(-1)!) : inputs); frames.push(sim.snapshot(1));
      if (policy === 'climb' && frames.at(-1)!.incidents.some(i => i.status === 'recovered')) break;
    }
  } finally { sim.dispose(); }
  traces.set(key, frames); return frames;
}
function frameCamera(state: SimulationSnapshot, localId: number) {
  const aspect = 390 / 494, frame = cameraFrame(state.players, localId, aspect);
  const camera = new THREE.OrthographicCamera(-frame.span * aspect / 2, frame.span * aspect / 2, frame.span / 2, -frame.span / 2,
    TUNING.rope.floorHeight, TUNING.camera.distance * 4);
  const az = TUNING.camera.azimuthDegrees * Math.PI / 180, el = TUNING.camera.elevationDegrees * Math.PI / 180;
  const target = new THREE.Vector3(frame.target.x, frame.target.y, frame.target.z);
  camera.position.copy(target).add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(TUNING.camera.distance));
  camera.lookAt(target); camera.updateMatrixWorld(); return camera;
}

describe.each([2, 4, 6])('actual %i-player snapshots (bounded 30 Hz review)', count => {
  it.each(['catch', 'climb', 'cross', 'ice'] as const)('keeps %s positions/span topology finite, prediction supported and interpolation outside real terrain', policy => {
    const frames = trace(count, policy), predictors = Array.from({ length: count }, () => new LocalPrediction());
    let maximumPenetration = 0, unsupportedMoves = 0, wallCueMismatch = 0;
    const states = new Set<string>(), supports = new Set<string>();
    for (let index = 1; index < frames.length; index++) {
      const state = frames[index], previous = frames[index - 1], at = index * 1000 / state.tickHz;
      const rendered = interpolateState(state, [{ at: at - 1000 / state.tickHz, state: previous }, { at, state }], at + TUNING.network.interpolationMs - 500 / state.tickHz);
      const actualSolids = physicalTerrain(state.scene, state.seed).solids.filter(solid => solid.bridgeId === undefined || !state.terrain.bridges.find(b => b.id === solid.bridgeId)?.collapsed);
      for (const player of state.players) {
        states.add(player.rescueState); supports.add(player.support);
        const position = rendered.players[player.id].position;
        for (const solid of actualSolids) maximumPenetration = Math.max(maximumPenetration, penetration(position, half, solid)?.depth ?? 0);
        const predicted = predictors[player.id].sample(state, rendered, player.id, { x: 1, z: 1, brace: false }, 1 / TUNING.physicsHz, 0, true)!;
        if (player.support === 'ground' && !onIce(player.position, state.terrain)) {
          const moved = Math.hypot(predicted.x - player.position.x, predicted.z - player.position.z) > Number.EPSILON;
          if (moved && (!groundSupports(player.position, state) || !supportedSweep(player.position, predicted, state))) unsupportedMoves++;
        } else expect(predicted).toEqual(position);
        if (player.support === 'wall') {
          const contact = supportAt(player.position, expeditionContactHalf, actualSolids), cue = nearestWall(player.position, state.terrain);
          if (!cue || contact.support !== 'wall' || cue.direction.x !== -contact.normal.x || cue.direction.z !== -contact.normal.z) wallCueMismatch++;
        }
      }
      const spans = displayedSpans(rendered);
      expect(spans).toHaveLength(count - 1);
      expect(spans.reduce((sum, span) => sum + span.points.length - 1, 0)).toBe(rendered.rope.points.length - spans.length);
      expect(spans.every(span => span.points.every(p => Object.values(p).every(Number.isFinite)))).toBe(true);
    }
    expect(maximumPenetration).toBeLessThanOrEqual(TUNING.physicsDiagnostics.maximumFloorErrorM);
    expect(unsupportedMoves).toBe(0); expect(wallCueMismatch).toBe(0);
    if (policy === 'catch' || policy === 'climb') {
      expect(states.has('falling')).toBe(true); expect(states.has('hanging')).toBe(true); expect(supports.has('wall')).toBe(true);
    }
    if (policy === 'climb') expect(frames.at(-1)!.events.some(event => event.kind === 'recovery')).toBe(true);
    if (policy === 'ice') expect(frames.some(frame => frame.players.some(p => onIce(p.position, frame.terrain)))).toBe(true);
  }, 60_000); // Real six-body trajectories can exceed 30 s when the full physics suite shares the machine.
  it('keeps actual bodies framed and identifies near-bank faces hiding deeper ice-offset falls', () => {
    const frames = trace(count, 'ice'); let outside = 0;
    for (const state of frames) {
      for (const localId of [0, Math.floor(count / 2)]) {
        const camera = frameCamera(state, localId);
        for (const player of state.players) {
          const projected = new THREE.Vector3(player.position.x, player.position.y, player.position.z).project(camera);
          if (Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1 || Math.abs(projected.z) > 1) outside++;
        }
      }
    }
    expect(outside).toBe(0);
    // Whether this policy produces a deep fall changes with physics. Exercise
    // the occlusion boundary explicitly, using the same actual terrain.
    const terrain = frames[0].terrain, gap = terrain.crevasses[0];
    const deep = { x: 0, y: -gap.depth / 2, z: (gap.minZ + gap.maxZ) / 2 };
    expect(groundPatches(terrain.bounds, terrain.crevasses).some(patch => topSurfaceOccludesBody(patch, 0, deep))).toBe(true);
  });
});

describe('actual evidence and contact boundary regressions', () => {
  it('never claims an offscreen first warning was drawn after unloading or after a later warning episode', () => {
    const frames = trace(4, 'stable-cross'), evidence = new ClientEvidence();
    const firstCue = frames.findIndex(state => state.terrain.bridges[1].cue > 0);
    const ended = frames.findIndex((state, index) => index > firstCue && state.terrain.bridges[1].cue === 0 && !state.terrain.bridges[1].collapsed);
    expect(firstCue).toBeGreaterThan(0); expect(ended).toBeGreaterThan(firstCue);
    for (let index = firstCue; index <= ended; index++) evidence.receive(frames[index], 0, index);
    evidence.drawn(frames[ended], new Set([1]), new Set(), ended);
    const later = frames.find((state, index) => index > ended && state.terrain.bridges[1].cue > 0);
    if (later) { evidence.receive(later, 0, ended + 1); evidence.drawn(later, new Set([1]), new Set(), ended + 2); }
    expect(evidence.report().observations.find(o => o.kind === 'bridge-cue' && o.id === 1)).toMatchObject({ firstDrawnAtMs: null, endedBeforeDraw: true });
  });
  it('does not backfill a previously hidden fall after actual recovery at the rim', () => {
    const frames = trace(2, 'climb'), evidence = new ClientEvidence();
    for (let index = 0; index < frames.length; index++) evidence.receive(frames[index], 0, index);
    const recovered = frames.at(-1)!; expect(recovered.incidents[0].status).toBe('recovered');
    evidence.drawn(recovered, new Set(), new Set([0, 1]), frames.length);
    expect(evidence.report().observations.find(o => o.kind === 'fall')).toMatchObject({ firstDrawnAtMs: null, endedBeforeDraw: true });
  });
  it('records received server cue onset and collapse deltas exactly once, without hidden load data', () => {
    const frames = trace(2, 'weak-bridge'), evidence = new ClientEvidence(); let cursor = -1;
    for (let index = 0; index < frames.length; index++) {
      const state = frames[index], events = state.events.filter(event => event.id > cursor);
      evidence.receive({ ...state, events }, 0, index);
      evidence.drawn(state, new Set([0]), new Set(state.players.map(p => p.id)), index);
      if (events.length) cursor = events.at(-1)!.id;
    }
    const report = evidence.report(), onset = frames.at(-1)!.events.find(event => event.kind === 'cue')!;
    expect(onset).toBeDefined(); expect(frames.at(-1)!.terrain.bridges[0].collapsed).toBe(true);
    expect(report.observations.find(o => o.kind === 'bridge-cue')?.serverCueOnset).toEqual({ eventId: onset.id, tick: onset.tick, substep: onset.substep });
    expect(new Set(report.physicalEvents.map(event => event.id)).size).toBe(report.physicalEvents.length);
    expect(JSON.stringify(report)).not.toContain('capacity');
  });
  it('uses a real bank normal at a route corner instead of pointing toward an open outer edge', () => {
    const terrain = trace(2, 'catch')[0].terrain;
    const position = { x: terrain.bounds.maxX - TUNING.phase2.collisionSkin, y: -1, z: half.z + TUNING.phase2.collisionSkin };
    expect(supportAt(position, half, terrainSolids(terrain)).normal).toEqual({ x: 0, y: 0, z: 1 });
    expect(nearestWall(position, terrain)?.direction).toEqual({ x: 0, y: 0, z: -1 });
  });
  it('includes exact ice boundaries in the authoritative low-traction region', () => {
    const state = trace(2, 'cross')[0], ice = state.terrain.ice[0];
    expect(onIce({ x: ice.minX, y: half.y, z: ice.minZ }, state.terrain)).toBe(true);
    expect(onIce({ x: ice.maxX, y: half.y, z: ice.maxZ }, state.terrain)).toBe(true);
  });
  it('freezes actual diagnostics/cue evidence before a delayed report crosses a scene reset', async () => {
    const old = trace(2, 'climb').at(-1)!, next = { ...trace(6, 'cross')[0], epoch: old.epoch + 1 };
    const connection = new BelayConnection(); connection.latest = old; connection.localId = 0;
    connection.evidence.receive(old, 0, 0);
    let finish!: (value: unknown) => void;
    vi.spyOn(connection, 'networkProfile').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const capture = connection.captureReport(); connection.latest = next; connection.evidence.receive(next, 0, 1); finish({ test: true });
    const report = await capture;
    expect(report.state).toEqual(old); expect(report.state?.diagnostics?.energyProjectionCount).toBe(old.diagnostics.energyProjectionCount);
    expect(report.state?.diagnostics?.maximumEnergyProjectionJ).toBe(old.diagnostics.maximumEnergyProjectionJ);
    expect(report.state?.diagnostics?.maximumPotentialExcessJ).toBe(old.diagnostics.maximumPotentialExcessJ);
    expect(report.presentation.sceneEpoch).toBe(old.epoch); expect(report.captureChange.sceneChanged).toBe(true);
    expect(report.rescueVerdict).toBe('NOT EVALUATED'); connection.dispose();
  });
});
