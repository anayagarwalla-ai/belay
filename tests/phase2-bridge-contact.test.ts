import { beforeAll, describe, expect, it } from 'vitest';
import { initializePhysics, BelaySimulation } from '../shared/simulation';
import type { SceneOptions } from '../shared/protocol';
import { TUNING } from '../tuning';
import { physicalTerrain } from '../shared/terrain';
import { penetration, sweepBox } from '../shared/contact-geometry';
import fixtures from './fixtures/phase2-bridge-contact-counterexamples.json';

beforeAll(initializePhysics);
describe.each(fixtures)('saved bridge/bank cascade (ordinal $ordinal)', fixture => {
  it('replays the original accepted inputs within unchanged physical bounds', () => {
    const sim = new BelaySimulation(fixture.options as SceneOptions);
    try {
      for (const run of fixture.runs) for (let tick = 0; tick < run.ticks; tick++) sim.step(run.inputs);
      const state = sim.snapshot(), limits = TUNING.physicsDiagnostics;
      expect(state.tick).toBe(fixture.recordedFrames);
      expect(state.counters.maximumSegmentErrorM).toBeLessThanOrEqual(limits.maximumSegmentErrorM);
      expect(state.counters.maximumSpanErrorM).toBeLessThanOrEqual(limits.maximumSpanErrorM);
      expect(state.diagnostics.maximumTerrainPenetrationM).toBeLessThanOrEqual(limits.maximumFloorErrorM);
      expect(state.diagnostics.maximumBodyOverlapM).toBeLessThanOrEqual(limits.maximumBodyOverlapM);
      expect(state.diagnostics.maximumPotentialExcessJ).toBeLessThanOrEqual(TUNING.phase2.energyToleranceJ);
      expect(Number.isFinite(state.diagnostics.maximumEnergyProjectionJ)).toBe(true);
      expect(state.players.every(p => [...Object.values(p.position), ...Object.values(p.velocity)].every(Number.isFinite))).toBe(true);
    } finally { sim.dispose(); }
  }, 120_000); // Longest saved input tape contains 984 authoritative ticks.
  it('keeps the whole rope outside surviving bridge/bank solids between 30 Hz snapshots', () => {
    const sim = new BelaySimulation({ ...fixture.options, tickHz: 60 } as SceneOptions);
    const terrain = physicalTerrain('crossing', fixture.options.seed);
    const half = { x: TUNING.rope.radius, y: TUNING.rope.radius, z: TUNING.rope.radius };
    let maximumPenetrationM = 0;
    try {
      for (const run of fixture.runs) for (let tick = 0; tick < run.ticks * 2; tick++) {
        sim.step(run.inputs);
        const state = sim.snapshot(), collapsed = new Set(state.terrain.bridges.filter(b => b.collapsed).map(b => b.id));
        const solids = terrain.solids.filter(s => s.bridgeId === undefined || !collapsed.has(s.bridgeId));
        for (const p of state.rope.points) for (const solid of solids)
          maximumPenetrationM = Math.max(maximumPenetrationM, penetration(p, half, solid)?.depth ?? 0);
        for (const span of state.rope.spans) for (let j = span.startPoint + 1; j <= span.endPoint; j++) for (const solid of solids) {
          const a = state.rope.points[j - 1], b = state.rope.points[j], hit = sweepBox(a, b, half, solid);
          if (!hit) continue;
          const reverse = sweepBox(b, a, half, solid), t = (hit.time + (reverse ? 1 - reverse.time : 1)) / 2;
          const inside = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
          maximumPenetrationM = Math.max(maximumPenetrationM, penetration(inside, half, solid)?.depth ?? 0);
        }
      }
      expect(sim.tick).toBe(fixture.recordedFrames * 2);
      expect(maximumPenetrationM).toBeLessThanOrEqual(TUNING.physicsDiagnostics.maximumFloorErrorM);
    } finally { sim.dispose(); }
  }, 120_000);
});
