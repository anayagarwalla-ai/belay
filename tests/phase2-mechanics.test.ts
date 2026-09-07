import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BelaySimulation, initializePhysics } from '../shared/simulation';
import { physicalTerrain } from '../shared/terrain';
import { REST, type SceneOptions } from '../shared/protocol';
import { TUNING } from '../tuning';

const sims: BelaySimulation[] = [];
const create = (options: SceneOptions = {}) => { const s = new BelaySimulation(options); sims.push(s); return s; };
beforeAll(initializePhysics);
afterEach(() => { for (const s of sims.splice(0)) s.dispose(); });
const hold = { ...REST, brace: true };

describe('Phase 2 contract and support', () => {
  it('preserves the legacy flat/two default while validating all new scene bounds', () => {
    const s = create(); expect(s.scene).toBe('flat'); expect(s.playerCount).toBe(2); expect(s.snapshot().run.status).toBe('testing');
    for (const playerCount of [0, 1, 7, 2.5, NaN]) expect(() => create({ playerCount })).toThrow('Player count');
    expect(() => create({ scene: 'invalid' as 'flat' })).toThrow('Unknown scene');
  });
  it('keeps seeded bridge capacities stable and out of ordinary snapshots', () => {
    expect(physicalTerrain('crossing', 1701).capacities).toEqual(physicalTerrain('crossing', 1701).capacities);
    expect(physicalTerrain('crossing', 1701).capacities).not.toEqual(physicalTerrain('crossing', 1702).capacities);
    expect(JSON.stringify(create({ scene: 'crossing' }).snapshot().terrain)).not.toContain('capacity');
  });
  it('does not grant airborne movement or brace anchoring', () => {
    const free = create({ scene: 'rescue' }), braced = create({ scene: 'rescue' });
    for (let tick = 0; tick < free.tickHz / 2; tick++) {
      free.step([hold, REST]); braced.step([hold, { x: 1, z: 1, brace: true }]);
      expect(braced.bodies[1].translation()).toEqual(free.bodies[1].translation());
      expect(braced.bodies[1].linvel()).toEqual(free.bodies[1].linvel());
    }
    expect(free.bodies[1].translation().y).toBeLessThan(0); expect(free.bodies[1].linvel().y).toBeLessThan(0);
  });
  it('freezes a terminal result time while debug ticks and bounded tape recording may continue', () => {
    const s = create({ scene: 'rescue' });
    for (const body of s.bodies) body.setTranslation({ x: 0, y: TUNING.phase2.terminalY - TUNING.body.height, z: 1 }, true);
    s.step([REST, REST], true); const elapsed = s.snapshot().run.elapsedSeconds;
    for (let tick = 0; tick < TUNING.tickHz; tick++) s.step([REST, REST], true);
    expect(s.snapshot().run.status).toBe('failed'); expect(s.snapshot().run.elapsedSeconds).toBe(elapsed);
    expect(s.tick).toBe(TUNING.tickHz + 1); expect(s.tape.frames).toHaveLength(s.tick);
  });
  it('records a static-helper successful climb as a counterexample, not a forced role gate', () => {
    const s = create({ scene: 'rescue' });
    for (let tick = 0; tick < s.tickHz * TUNING.phase2.mechanicsProbeSeconds; tick++) s.step([hold, { x: 0, z: -1, brace: false }]);
    const incident = s.snapshot().incidents[0]; expect(incident.status).toBe('recovered');
    expect(incident.staticHoldSeconds[0]).toBeGreaterThan(incident.roleActiveSeconds[0]);
    expect(s.snapshot().events.some(e => e.kind === 'climb')).toBe(true);
  });
  it.each([30, 60] as const)('shows a load cue before collapse, then records a linked cascade at %i Hz', tickHz => {
    const s = create({ scene: 'crossing', seed: TUNING.phase2.mechanicsLoadSeed, tickHz });
    const gap = s.snapshot().terrain.crevasses[0]; let cueAt: number | undefined;
    for (let tick = 0; tick < tickHz * TUNING.phase2.mechanicsProbeSeconds; tick++) {
      const incident = s.snapshot().incidents[0];
      s.step(s.bodies.map((body, id) => incident ? id === 0 ? REST : { x: 0, z: 1, brace: false }
        : body.translation().z < (id ? gap.minZ - TUNING.phase2.rescueSafeOffset : (gap.minZ + gap.maxZ) / 2)
          ? { x: 0, z: 1, brace: false } : hold));
      if (cueAt === undefined && s.snapshot().terrain.bridges[0].cue > 0) cueAt = tick;
    }
    const v = s.snapshot(), collapse = v.events.find(e => e.kind === 'collapse');
    expect(cueAt).toBeDefined(); expect(collapse).toBeDefined();
    const cueEvent = v.events.find(e => e.kind === 'cue' && e.surfaceIds.includes(gap.id));
    expect(cueEvent).toBeDefined(); expect(cueEvent!.tick).toBe(cueAt);
    expect(collapse!.tick - cueAt!).toBeGreaterThanOrEqual(Math.floor(TUNING.phase2.bridgeWarningSeconds * tickHz) - 1);
    expect(v.terrain.bridges[0].collapsed).toBe(true); expect(v.incidents[0].cascades).toBeGreaterThan(0);
    expect(v.incidents[0].firstAttemptSuccess).toBe(false); expect(v.incidents[0].playerIds).toEqual(expect.arrayContaining([0, 1]));
  });
  it('emits one cue-onset event for a sustained visible bridge cue', () => {
    const s = create({ scene: 'crossing' }), gap = s.snapshot().terrain.crevasses[0];
    for (let tick = 0; tick < s.tickHz * TUNING.phase2.mechanicsProbeSeconds; tick++) {
      s.step(s.bodies.map((body, id) => body.translation().z < (id ? gap.minZ - TUNING.phase2.rescueSafeOffset : (gap.minZ + gap.maxZ) / 2)
        ? { x: 0, z: 1, brace: false } : hold));
    }
    const v = s.snapshot(7), cues = v.events.filter(e => e.kind === 'cue' && e.surfaceIds.includes(gap.id));
    expect(v.terrain.bridges[0].cue).toBeGreaterThan(0); expect(v.terrain.bridges[0].collapsed).toBe(false);
    expect(cues).toHaveLength(1); expect(cues[0].epoch).toBe(7);
    expect(cues[0].substep).toBeGreaterThanOrEqual(0); expect(cues[0].substep).toBeLessThan(TUNING.physicsHz / s.tickHz);
    expect(JSON.stringify(cues[0])).not.toContain('capacity');
  });
});

describe.each([2, 3, 4, 5, 6])('%i-body shared harness mechanics', playerCount => {
  it.each([30, 60] as const)('fits the whole team past the finish and freezes finish time at %i Hz', tickHz => {
    const s = create({ scene: 'crossing', playerCount, tickHz });
    for (let tick = 0; tick < tickHz * TUNING.phase2.mechanicsProbeSeconds * 3; tick++) s.step(s.bodies.map(() => ({ x: 0, z: 1, brace: false })));
    const run = s.snapshot().run; expect(run.status).toBe('complete'); expect(run.progress).toBe(1);
    for (const p of s.snapshot().players) { expect(p.position.z).toBeGreaterThanOrEqual(TUNING.phase2.finishZ); expect(p.support).toBe('ground'); }
    s.step(s.bodies.map(() => REST)); expect(s.snapshot().run.elapsedSeconds).toBe(run.elapsedSeconds);
  });
  it.each([30, 60] as const)('catches with bounded contacts and rope errors at %i Hz', tickHz => {
    const s = create({ scene: 'rescue', playerCount, tickHz }), faller = Math.floor(playerCount / 2);
    for (let tick = 0; tick < tickHz * TUNING.phase2.mechanicsProbeSeconds; tick++) s.step(s.bodies.map((_, id) => id === faller ? REST : hold));
    const v = s.snapshot(); expect(v.playerCount).toBe(playerCount); expect(v.rope.spans).toHaveLength(playerCount - 1);
    expect(v.incidents.length).toBeGreaterThan(0); expect(v.run.status).toBe('active');
    expect(v.incidents[0].status).toBe('active'); // No motor input by the faller must not manufacture recovery.
    expect(v.players.every(p => [p.position.x, p.position.y, p.position.z, p.velocity.x, p.velocity.y, p.velocity.z].every(Number.isFinite))).toBe(true);
    expect(v.diagnostics.maximumTerrainPenetrationM).toBeLessThan(TUNING.physicsDiagnostics.maximumFloorErrorM);
    expect(v.diagnostics.maximumBodyOverlapM).toBeLessThan(TUNING.physicsDiagnostics.maximumBodyOverlapM);
    expect(v.counters.maximumSpanErrorM).toBeLessThan(TUNING.physicsDiagnostics.maximumSpanErrorM);
    expect(v.counters.maximumSegmentErrorM).toBeLessThan(TUNING.physicsDiagnostics.maximumSegmentErrorM);
    for (let id = 1; id < v.rope.spans.length; id++) expect(v.rope.points[v.rope.spans[id - 1].endPoint]).toEqual(v.rope.points[v.rope.spans[id].startPoint]);
  });
  it('replays the exact scene/team tape and matches held inputs at both authority rates', () => {
    const a = create({ scene: 'rescue', playerCount, tickHz: 30 }), b = create({ scene: 'rescue', playerCount, tickHz: 60 });
    for (let tick = 0; tick < TUNING.tickHz; tick++) {
      const input = a.bodies.map((_, id) => id === Math.floor(playerCount / 2) ? REST : hold);
      a.step(input, true); b.step(input); b.step(input);
    }
    expect(a.snapshot().players).toEqual(b.snapshot().players); expect(a.snapshot().rope).toEqual(b.snapshot().rope);
    const replay = create(a.tape); for (const frame of a.tape.frames) replay.step(frame.inputs);
    expect(replay.snapshot().players).toEqual(a.snapshot().players); expect(replay.snapshot().rope).toEqual(a.snapshot().rope);
  });
});
