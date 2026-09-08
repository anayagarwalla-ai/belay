import type { Vec3 } from './protocol';

/** Exact first intersection with a distance ball along the permitted mobility
 * direction. The usual linearized multiplier overshoots near a blocked wall.
 * If the ball cannot be reached along this direction, stop at its closest point;
 * the coupled solver must then move other degrees of freedom. */
export function distanceMultiplier(delta: Vec3, mobility: Vec3, maximum: number) {
  const squared = delta.x ** 2 + delta.y ** 2 + delta.z ** 2;
  if (squared <= maximum ** 2) return 0;
  const length = Math.sqrt(squared);
  const ux = mobility.x * delta.x / length, uy = mobility.y * delta.y / length, uz = mobility.z * delta.z / length;
  const a = ux * ux + uy * uy + uz * uz;
  const b = delta.x * ux + delta.y * uy + delta.z * uz;
  if (!(a > 0) || !(b > 0)) return 0;
  const c = squared - maximum ** 2, discriminant = b * b - a * c;
  return discriminant <= 0 ? b / a : c / (b + Math.sqrt(discriminant));
}

