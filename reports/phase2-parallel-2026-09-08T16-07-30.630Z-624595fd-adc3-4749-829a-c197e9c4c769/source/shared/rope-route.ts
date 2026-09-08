import { TUNING } from '../tuning';
import type { Vec3 } from './protocol';
import { sweepBox, vectorDistance as distance, type Solid } from './contact-geometry';
const axes = ['x', 'y', 'z'] as const;
const radius = { x: TUNING.rope.radius, y: TUNING.rope.radius, z: TUNING.rope.radius };
const face = (s: Solid, axis: typeof axes[number], sign: number) => {
  const min = axis === 'x' ? s.minX : axis === 'y' ? s.minY : s.minZ;
  const max = axis === 'x' ? s.maxX : axis === 'y' ? s.maxY : s.maxZ;
  return (sign > 0 ? max : min) + sign * (TUNING.rope.radius + TUNING.phase2.collisionSkin);
};

/** Contact bends within a material link. The bend has no mass and is not a rope
 * attachment: both endpoint particles retain their physical mass and can slide
 * past it. Unfolding the two faces gives the shortest path along their edge. */
export function ropeRoute(a: Vec3, b: Vec3, solids: Solid[]) {
  const points = [a, b];
  for (let pass = 0; pass < TUNING.phase2.ropeContactBends; pass++) {
    let inserted = false;
    for (let j = 1; j < points.length && !inserted; j++) for (const solid of solids) {
      const p = points[j - 1], q = points[j], enter = sweepBox(p, q, radius, solid);
      if (!enter) continue;
      const leave = sweepBox(q, p, radius, solid);
      if (!leave) continue; // Node penetration is handled by the swept body/node projection.
      const u = axes.find(axis => enter.normal[axis])!, v = axes.find(axis => leave.normal[axis])!;
      let bends: Vec3[];
      if (u !== v) {
        const free = axes.find(axis => axis !== u && axis !== v)!;
        const c = { ...p, [u]: face(solid, u, enter.normal[u]), [v]: face(solid, v, leave.normal[v]) };
        const left = Math.hypot(p[u] - c[u], p[v] - c[v]), right = Math.hypot(q[u] - c[u], q[v] - c[v]);
        c[free] = (p[free] * right + q[free] * left) / (left + right);
        bends = [c];
      } else {
        // Opposite faces occur at thin snow bridges. Choose the shortest of the
        // four routes around a side face, using the same unfolded construction.
        const candidates = axes.filter(axis => axis !== u).flatMap(side => [-1, 1].map(sign => {
          const free = axes.find(axis => axis !== u && axis !== side)!;
          const c = { ...p, [u]: face(solid, u, enter.normal[u]), [side]: face(solid, side, sign) };
          const d = { ...q, [u]: face(solid, u, leave.normal[u]), [side]: c[side] };
          const left = Math.hypot(p[u] - c[u], p[side] - c[side]), middle = Math.abs(c[u] - d[u]);
          const right = Math.hypot(q[u] - d[u], q[side] - d[side]), total = left + middle + right;
          c[free] = p[free] + (q[free] - p[free]) * left / total;
          d[free] = p[free] + (q[free] - p[free]) * (left + middle) / total;
          return { bends: [c, d], length: distance(p, c) + distance(c, d) + distance(d, q) };
        })).sort((x, y) => x.length - y.length);
        bends = candidates[0].bends;
      }
      points.splice(j, 0, ...bends); inserted = true; break;
    }
    if (!inserted) break;
  }
  return { points, length: points.slice(1).reduce((sum, p, j) => sum + distance(points[j], p), 0) };
}

/** A redundant reach bound may use a routed length only when no alternative
 * face can possibly fit inside the subchain budget. This proof avoids dragging
 * harnesses toward an arbitrarily selected route around a finite obstacle. */
export function ropeReach(a: Vec3, b: Vec3, solids: Solid[], maximum: number) {
  const direct = { points: [a, b], length: distance(a, b) };
  const crossed = solids.filter(s => sweepBox(a, b, radius, s));
  if (crossed.length !== 1) return direct;
  const s = crossed[0], enter = sweepBox(a, b, radius, s)!, leave = sweepBox(b, a, radius, s);
  if (!leave) return direct;
  const u = axes.find(axis => enter.normal[axis])!, v = axes.find(axis => leave.normal[axis])!;
  if (u === v) return direct;
  for (const axis of axes) for (const sign of [-1, 1]) {
    if (axis === u && enter.normal[axis] === sign || axis === v && leave.normal[axis] === sign) continue;
    const plane = face(s, axis, sign);
    if (Math.abs(a[axis] - plane) + Math.abs(b[axis] - plane) <= maximum) return direct;
  }
  const route = ropeRoute(a, b, solids);
  return route.points.length === 3 ? route : direct;
}
