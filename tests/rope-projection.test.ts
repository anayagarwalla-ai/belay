import { describe, expect, it } from 'vitest';
import { distanceMultiplier } from '../shared/rope-projection';

describe('unilateral distance projection with blocked coordinates', () => {
  it('leaves slack unchanged and reaches the length ball with ordinary mobility', () => {
    expect(distanceMultiplier({ x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, 2)).toBe(0);
    expect(distanceMultiplier({ x: 3, y: 4, z: 0 }, { x: 2, y: 2, z: 2 }, 3)).toBeCloseTo(1, 12);
  });
  it('stops at the closest feasible point when a contact blocks the required direction', () => {
    const d = { x: 3, y: 0.001, z: 0 }, w = { x: 0, y: 5, z: 0 };
    const lambda = distanceMultiplier(d, w, 1), length = Math.hypot(d.x, d.y);
    expect(d.y - lambda * w.y * d.y / length).toBeCloseTo(0, 12);
    expect(Number.isFinite(lambda)).toBe(true);
  });
  it('never expands its own distance across every axis mask and a 400:1 mass ratio', () => {
    for (let mask = 0; mask < 8; mask++) for (let i = 1; i <= 128; i++) {
      const delta = { x: Math.sin(i) * 4, y: Math.cos(i) * 3, z: Math.sin(i * 2) };
      const mobility = { x: mask & 1 ? 1 / 80 : 0, y: mask & 2 ? 1 / 0.2 : 0, z: mask & 4 ? 1 / 80 : 0 };
      const length = Math.hypot(delta.x, delta.y, delta.z), lambda = distanceMultiplier(delta, mobility, 0.3);
      const after = Math.hypot(...(['x', 'y', 'z'] as const).map(axis => delta[axis] - lambda * mobility[axis] * delta[axis] / length));
      expect(after).toBeLessThanOrEqual(length + 1e-12);
      expect(lambda).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(lambda)).toBe(true);
    }
  });
});
