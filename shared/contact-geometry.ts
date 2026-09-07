import { TUNING } from '../tuning';
import type { Rect, Vec3 } from './protocol';

export type Solid = Rect & { id: number; minY: number; maxY: number; bridgeId?: number };
export type Contact = { support: 'ground' | 'wall' | 'air'; normal: Vec3; solid?: Solid };
export const copyVector = (v: Vec3): Vec3 => ({ ...v });
export const vectorDistance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const axes = ['x', 'y', 'z'] as const;
const limits = (solid: Solid, half: Vec3) => ({
  x: [solid.minX - half.x, solid.maxX + half.x], y: [solid.minY - half.y, solid.maxY + half.y],
  z: [solid.minZ - half.z, solid.maxZ + half.z],
});

export function penetration(p: Vec3, half: Vec3, solid: Solid) {
  const bounds = limits(solid, half);
  if (axes.some(axis => p[axis] <= bounds[axis][0] || p[axis] >= bounds[axis][1])) return null;
  let depth = Infinity, normal: Vec3 = { x: 0, y: 0, z: 0 };
  for (const axis of axes) for (const side of [0, 1]) {
    const d = Math.abs(p[axis] - bounds[axis][side]);
    if (d < depth) { depth = d; normal = { x: 0, y: 0, z: 0 }; normal[axis] = side ? 1 : -1; }
  }
  return { depth, normal };
}

export function sweepBox(from: Vec3, to: Vec3, half: Vec3, solid: Solid) {
  const bounds = limits(solid, half);
  let enter = -Infinity, exit = Infinity, normal: Vec3 = { x: 0, y: 0, z: 0 };
  for (const axis of axes) {
    const delta = to[axis] - from[axis];
    if (!delta) { if (from[axis] <= bounds[axis][0] || from[axis] >= bounds[axis][1]) return null; continue; }
    const a = (bounds[axis][0] - from[axis]) / delta, b = (bounds[axis][1] - from[axis]) / delta;
    const near = Math.min(a, b), far = Math.max(a, b);
    if (near > enter) { enter = near; normal = { x: 0, y: 0, z: 0 }; normal[axis] = delta > 0 ? -1 : 1; }
    exit = Math.min(exit, far);
    if (enter > exit) return null;
  }
  return enter >= 0 && enter <= 1 && exit > 0 ? { time: enter, normal, solid } : null;
}

/** Conservative swept AABB correction for the locked boxes and rope particles. */
export function projectMotion(from: Vec3, desired: Vec3, half: Vec3, solids: Solid[]) {
  let p = { ...from }, target = { ...desired }, projections = 0;
  const normals: Vec3[] = [];
  for (let pass = 0; pass < TUNING.phase2.collisionSweepPasses; pass++) {
    let overlapFound = false;
    for (const solid of solids) {
      const overlap = penetration(p, half, solid);
      if (!overlap) continue;
      for (const axis of axes) {
        const correction = overlap.normal[axis] * (overlap.depth + TUNING.phase2.collisionSkin);
        p[axis] += correction; target[axis] += correction;
      }
      normals.push(overlap.normal); projections++; overlapFound = true;
    }
    let first: ReturnType<typeof sweepBox> = null;
    for (const solid of solids) {
      const hit = sweepBox(p, target, half, solid);
      if (hit && (!first || hit.time < first.time)) first = hit;
    }
    if (!first) { p = target; if (!overlapFound) break; continue; }
    const delta = { x: target.x - p.x, y: target.y - p.y, z: target.z - p.z };
    for (const axis of axes) p[axis] += delta[axis] * first.time + first.normal[axis] * TUNING.phase2.collisionSkin;
    const inward = Math.min(0, dot(delta, first.normal));
    target = { ...p };
    for (const axis of axes) target[axis] += (delta[axis] - first.normal[axis] * inward) * (1 - first.time);
    normals.push(first.normal); projections++;
  }
  return { position: p, normals, projections };
}

export function supportAt(p: Vec3, half: Vec3, solids: Solid[]): Contact {
  for (const solid of solids) {
    const foot = p.y - half.y;
    if (Math.abs(foot - solid.maxY) <= TUNING.phase2.groundContactTolerance
      && p.x + half.x > solid.minX && p.x - half.x < solid.maxX
      && p.z + half.z > solid.minZ && p.z - half.z < solid.maxZ) {
      return { support: 'ground', normal: { x: 0, y: 1, z: 0 }, solid };
    }
  }
  let nearest: Contact | undefined, distance = Infinity;
  for (const solid of solids) {
    if (p.y - half.y >= solid.maxY || p.y + half.y <= solid.minY || solid.bridgeId !== undefined) continue;
    for (const axis of ['x', 'z'] as const) {
      const other = axis === 'x' ? 'z' : 'x';
      const otherMin = other === 'x' ? solid.minX : solid.minZ, otherMax = other === 'x' ? solid.maxX : solid.maxZ;
      if (p[other] + half[other] <= otherMin || p[other] - half[other] >= otherMax) continue;
      const bounds = axis === 'x' ? [solid.minX, solid.maxX] : [solid.minZ, solid.maxZ];
      for (const side of [0, 1]) {
        const sign = side ? 1 : -1;
        const gap = sign * (p[axis] - bounds[side]) - half[axis];
        if (gap >= -TUNING.phase2.collisionSkin && gap <= TUNING.phase2.wallContactTolerance && gap < distance) {
          const normal = { x: 0, y: 0, z: 0 }; normal[axis] = sign;
          nearest = { support: 'wall', normal, solid }; distance = gap;
        }
      }
    }
  }
  return nearest ?? { support: 'air', normal: { x: 0, y: 0, z: 0 } };
}

export function contactNormalsAt(p: Vec3, half: Vec3, solids: Solid[]) {
  const normals: Vec3[] = [];
  for (const solid of solids) {
    const bounds = limits(solid, half), tolerance = TUNING.phase2.collisionSkin * 2;
    for (const axis of axes) for (const side of [0, 1]) {
      if (Math.abs(p[axis] - bounds[axis][side]) > tolerance) continue;
      if (axes.some(other => other !== axis && (p[other] < bounds[other][0] - tolerance || p[other] > bounds[other][1] + tolerance))) continue;
      const normal = { x: 0, y: 0, z: 0 }; normal[axis] = side ? 1 : -1; normals.push(normal);
    }
  }
  return normals;
}
