import { describe, expect, it } from 'vitest';
import { ropeRoute, ropeReach } from '../shared/rope-route';
import { blockingNormalsAt, sweepBox, vectorDistance } from '../shared/contact-geometry';
import { TUNING } from '../tuning';
const solid = { id: 0, minX: -10, maxX: 10, minY: -10, maxY: 0, minZ: -10, maxZ: 0 };
const half = { x: TUNING.rope.radius, y: TUNING.rope.radius, z: TUNING.rope.radius };

describe('material rope contact bends', () => {
  it('keeps a slack unobstructed link straight', () => {
    const a = { x: 0, y: 1, z: 0 }, b = { x: 0.1, y: 1, z: 0 };
    expect(ropeRoute(a, b, [solid])).toEqual({ points: [a, b], length: 0.1 });
  });
  it('routes around a lip without moving or pinning either material endpoint', () => {
    const a = { x: 0, y: 0.05, z: -0.1 }, b = { x: 0.05, y: -0.1, z: 0.05 };
    const initial = structuredClone([a, b]);
    const route = ropeRoute(a, b, [solid]);
    expect([a, b]).toEqual(initial); expect(route.points).toHaveLength(3);
    expect(route.length).toBeGreaterThan(vectorDistance(a, b));
    for (let j = 1; j < route.points.length; j++) expect(sweepBox(route.points[j - 1], route.points[j], half, solid)).toBeNull();
    const over = ropeRoute(a, { x: b.x, y: 0.06, z: b.z }, [solid]);
    expect(over.points).toHaveLength(2); // Contact disappears when the particle slides past the edge.
  });
  it('routes opposite faces of a thin bridge through two corners', () => {
    const bridge = { ...solid, minX: -0.3, maxX: 0.3, minZ: -0.1, maxZ: 0.1, minY: -0.25 };
    const route = ropeRoute({ x: 0, y: -0.1, z: -0.2 }, { x: 0, y: -0.1, z: 0.2 }, [bridge]);
    expect(route.points).toHaveLength(4);
    for (let j = 1; j < route.points.length; j++) expect(sweepBox(route.points[j - 1], route.points[j], half, bridge)).toBeNull();
  });
  it('allows tangent motion around a convex corner but blocks motion into the bank', () => {
    const p = { x: 0, y: 0.039, z: 0.039 };
    expect(blockingNormalsAt(p, half, [solid], { x: 0, y: 0, z: -1 })).toHaveLength(0);
    expect(blockingNormalsAt(p, half, [solid], { x: 0, y: -1, z: -1 })).toHaveLength(1);
  });
  it('removes a stale bank bend and slides the bridge contact at their shared corner', () => {
    const bank = { ...solid, maxZ: 8 };
    const bridge = { ...solid, id: 1, minX: -3.3, maxX: -1.1, minY: -0.25, minZ: 8, maxZ: 10.8 };
    const a = { x: -1.05699475, y: -0.18632353, z: 8.09871739 };
    const b = { x: -1.13111947, y: 0.06222414, z: 8.00999492 };
    // Frozen geometry from failed campaign ordinal 12. The stale two-bend
    // route was 0.330 m; neither endpoint is allowed to move in this test.
    for (const solids of [[bank, bridge], [bridge, bank]]) {
      const route = ropeRoute(a, b, solids);
      expect(route.length).toBeLessThan(0.32);
      expect(route.points[0]).toEqual(a); expect(route.points.at(-1)).toEqual(b);
      for (let j = 1; j < route.points.length; j++) for (const obstacle of solids)
        expect(sweepBox(route.points[j - 1], route.points[j], half, obstacle)).toBeNull();
    }
  });
  it('uses the strongest separately proven reach bound across overlapping solids', () => {
    const a = { x: 0.1, y: -0.1, z: 0 }, b = { x: -0.1, y: 0.1, z: 0 };
    const first = { ...solid, maxX: 0, maxZ: 10 };
    const second = { ...first, id: 1, maxX: -0.01, maxY: 0.01 };
    const individual = [first, second].map(obstacle => ropeReach(a, b, [obstacle], 0.4));
    expect(Math.max(...individual.map(route => route.length))).toBeGreaterThan(vectorDistance(a, b));
    for (const solids of [[first, second], [second, first]])
      expect(ropeReach(a, b, solids, 0.4).length).toBe(Math.max(...individual.map(route => route.length)));
    // A finite obstacle with another possible route must keep the chord bound.
    const thin = { ...first, minY: -0.11, minX: -0.11 };
    expect(ropeReach(a, b, [thin], 0.4).length).toBe(vectorDistance(a, b));
  });
});
