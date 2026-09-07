import { beforeAll, describe, expect, it } from 'vitest';
import { BelaySimulation, initializePhysics } from '../shared/simulation';
import type { SceneOptions, SimulationSnapshot } from '../shared/protocol';
import { TUNING } from '../tuning';
import fixtures from './fixtures/phase2-recovery-counterexamples.json';

/** Exact consecutive input blocks from the evidence task's seed-1701 recovery
 * tapes. Source hashes are retained in the fixture. These are unresolved failures,
 * not a relaxed acceptance ceiling; remove `fails` when a physical fix passes it. */
describe.each(fixtures)('known recovery defect ($options.playerCount players)', fixture => {
  let state: SimulationSnapshot;
  beforeAll(async () => {
    await initializePhysics();
    const sim = new BelaySimulation(fixture.options as SceneOptions);
    try {
      for (const run of fixture.runs) for (let tick = 0; tick < run.ticks; tick++) sim.step(run.inputs);
      state = sim.snapshot();
    } finally { sim.dispose(); }
  });
  it('replays every recorded frame and retains finite states and energy-correction diagnostics', () => {
    expect(state.tick).toBe(fixture.recordedFrames);
    expect(state.players.every(p => [...Object.values(p.position), ...Object.values(p.velocity)].every(Number.isFinite))).toBe(true);
    expect(state.rope.points.every(p => Object.values(p).every(Number.isFinite))).toBe(true);
    expect(state.diagnostics.maximumTerrainPenetrationM).toBeLessThanOrEqual(TUNING.physicsDiagnostics.maximumFloorErrorM);
    expect(state.diagnostics.maximumBodyOverlapM).toBeLessThanOrEqual(TUNING.physicsDiagnostics.maximumBodyOverlapM);
    expect(state.diagnostics.energyProjectionCount).toBeGreaterThan(0);
    expect(Number.isFinite(state.diagnostics.maximumEnergyProjectionJ)).toBe(true);
    expect(state.diagnostics.maximumEnergyProjectionJ).toBeGreaterThan(0);
  });
  it.fails('KNOWN FAILURE: stays within the existing 2 cm segment ceiling during focused recovery', () => {
    expect(state.counters.maximumSegmentErrorM).toBeLessThanOrEqual(TUNING.physicsDiagnostics.maximumSegmentErrorM);
  });
});
