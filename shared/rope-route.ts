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
  const edges: ({ free: typeof axes[number]; min: number; max: number } | null)[] = [null, null];
  for (let pass = 0; pass < TUNING.phase2.ropeContactBends; pass++) {
    let inserted = false;
    for (let j = 1; j < points.length && !inserted; j++) for (const solid of solids) {
      const p = points[j - 1], q = points[j], enter = sweepBox(p, q, radius, solid);
      if (!enter) continue;
      const leave = sweepBox(q, p, radius, solid);
      if (!leave) continue; // Node penetration is handled by the swept body/node projection.
      const u = axes.find(axis => enter.normal[axis])!, v = axes.find(axis => leave.normal[axis])!;
      let bends: Vec3[], freeAxis: typeof axes[number];
      if (u !== v) {
        const free = axes.find(axis => axis !== u && axis !== v)!;
        freeAxis = free;
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
          return { bends: [c, d], free, length: distance(p, c) + distance(c, d) + distance(d, q) };
        })).sort((x, y) => x.length - y.length);
        bends = candidates[0].bends; freeAxis = candidates[0].free;
      }
      edges.splice(j, 0, ...bends.map(() => ({ free: freeAxis, min: face(solid, freeAxis, -1), max: face(solid, freeAxis, 1) })));
      points.splice(j, 0, ...bends); inserted = true; break;
    }
    if (!inserted) break;
  }
  // Routing around a second solid can make an earlier bend unnecessary (for
  // example, the coplanar top of a bridge and its bank). String-pull only the
  // massless contacts, preserving every material endpoint and clear segment.
  for (let j = 1; j < points.length - 1;) {
    if (!solids.some(solid => sweepBox(points[j - 1], points[j + 1], radius, solid))) {
      points.splice(j, 1); edges.splice(j, 1); j = Math.max(1, j - 1);
    } else j++;
  }
  // After another obstacle reroutes the link, the surviving contact's free
  // coordinate must slide to the new geodesic. Otherwise its stale coordinate
  // makes the route gradient disagree with the length we are constraining.
  for (let pass = 0; pass < TUNING.phase2.ropeContactBends; pass++) for (let j = 1; j < points.length - 1; j++) {
    const edge = edges[j]!, p = points[j - 1], c = points[j], q = points[j + 1];
    const other = axes.filter(axis => axis !== edge.free);
    const left = Math.hypot(...other.map(axis => p[axis] - c[axis])), right = Math.hypot(...other.map(axis => q[axis] - c[axis]));
    if (!left && !right) continue;
    const candidate = { ...c, [edge.free]: Math.max(edge.min, Math.min(edge.max,
      (p[edge.free] * right + q[edge.free] * left) / (left + right))) };
    if (distance(p, candidate) + distance(candidate, q) > distance(p, c) + distance(c, q)) continue;
    const clear = (point: Vec3) => !solids.some(solid => sweepBox(p, point, radius, solid) || sweepBox(point, q, radius, solid));
    if (!clear(candidate)) {
      // A neighbouring bank can truncate this edge's free interval. Approach
      // that boundary from the current feasible point instead of retaining a
      // stale bend merely because the unconstrained optimum is obstructed.
      if (!clear(c)) continue;
      let low = 0, high = 1;
      const optimum = candidate[edge.free];
      for (let search = 0; search < TUNING.phase2.ropeProjectionLineSearchSteps; search++) {
        const fraction = (low + high) / 2;
        candidate[edge.free] = c[edge.free] + fraction * (optimum - c[edge.free]);
        if (clear(candidate)) low = fraction; else high = fraction;
      }
      candidate[edge.free] = c[edge.free] + low * (optimum - c[edge.free]);
    }
    points[j] = candidate;
  }
  return { points, length: points.slice(1).reduce((sum, p, j) => sum + distance(points[j], p), 0) };
}

/** A redundant reach bound may use a routed length only when no alternative
 * face can possibly fit inside the subchain budget. This proof avoids dragging
 * harnesses toward an arbitrarily selected route around a finite obstacle. */
export function ropeReach(a: Vec3, b: Vec3, solids: Solid[], maximum: number) {
  let bound = { points: [a, b], length: distance(a, b) };
  // Every feasible route around a union also avoids each individual solid.
  // Take the strongest separately proven lower bound, never sum those lengths
  // or assume a particular route through the union's multiple corners.
  for (const s of solids) {
    const enter = sweepBox(a, b, radius, s), leave = sweepBox(b, a, radius, s);
    if (!enter || !leave) continue;
    const u = axes.find(axis => enter.normal[axis])!, v = axes.find(axis => leave.normal[axis])!;
    if (u === v) continue;
    let unique = true;
    for (const axis of axes) for (const sign of [-1, 1]) {
      if (axis === u && enter.normal[axis] === sign || axis === v && leave.normal[axis] === sign) continue;
      const plane = face(s, axis, sign);
      if (Math.abs(a[axis] - plane) + Math.abs(b[axis] - plane) <= maximum) unique = false;
    }
    if (!unique) continue;
    const route = ropeRoute(a, b, [s]);
    if (route.points.length === 3 && route.length > bound.length) bound = route;
  }
  return bound;
}
