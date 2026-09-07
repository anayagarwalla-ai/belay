import { beforeAll, describe, expect, it } from 'vitest';
import { initializePhysics, BelaySimulation } from '../shared/simulation';
import { penetration, sweepBox } from '../shared/contact-geometry';
import { physicalTerrain } from '../shared/terrain';
import type { SceneOptions } from '../shared/protocol';
import { TUNING } from '../tuning';
import fixtures from './fixtures/phase2-recovery-counterexamples.json';

beforeAll(initializePhysics);
describe.each(fixtures)('saved recovery rope contact ($options.playerCount players)', fixture => {
  it('checks interior rope crossings at every physics step, including between 30 Hz snapshots', () => {
    const sim = new BelaySimulation({ ...fixture.options, tickHz: 60 } as SceneOptions);
    const solids = physicalTerrain('rescue', fixture.options.seed).solids;
    const half = { x: TUNING.rope.radius, y: TUNING.rope.radius, z: TUNING.rope.radius };
    let maximumPenetration = 0;
    try {
      // Each original 30 Hz input is held over both 60 Hz physics steps.
      for (const run of fixture.runs) for (let tick = 0; tick < run.ticks * 2; tick++) {
        sim.step(run.inputs);
        const rope = sim.snapshot().rope;
        for (const p of rope.points) for (const solid of solids) maximumPenetration = Math.max(maximumPenetration, penetration(p, half, solid)?.depth ?? 0);
        for (const span of rope.spans) for (let j = span.startPoint + 1; j <= span.endPoint; j++) for (const solid of solids) {
          const a = rope.points[j - 1], b = rope.points[j], hit = sweepBox(a, b, half, solid);
          if (!hit) continue;
          const reverse = sweepBox(b, a, half, solid), t = (hit.time + (reverse ? 1 - reverse.time : 1)) / 2;
          const inside = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
          maximumPenetration = Math.max(maximumPenetration, penetration(inside, half, solid)?.depth ?? 0);
        }
      }
      // Reuse the existing terrain-contact budget; a small segment error alone
      // must not pass by allowing the rope-radius envelope to cross a bank.
      expect(maximumPenetration).toBeLessThanOrEqual(TUNING.physicsDiagnostics.maximumFloorErrorM);
    } finally { sim.dispose(); }
  });
});
