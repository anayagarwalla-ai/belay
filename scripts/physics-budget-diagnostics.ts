import type { Vec3 } from '../shared/protocol';

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

/** Translational impulse accounting: kg, m/s, s -> N s, N and J. */
export function impulseAccounting(before: Vec3, desired: Vec3, massKg: number, dtSeconds: number) {
  const impulseNs = { x: massKg * (desired.x - before.x), y: massKg * (desired.y - before.y), z: massKg * (desired.z - before.z) };
  const forceN = { x: impulseNs.x / dtSeconds, y: impulseNs.y / dtSeconds, z: impulseNs.z / dtSeconds };
  return { impulseNs, forceN, horizontalForceN: Math.hypot(forceN.x, forceN.z),
    workJ: massKg / 2 * (dot(desired, desired) - dot(before, before)),
    impulseWorkJ: dot(before, impulseNs) + dot(impulseNs, impulseNs) / (2 * massKg) };
}

/** Reconstruct the existing kinetic-only budget projection; this is an observer,
 * not a new runtime projection or an acceptance policy. All energies are joules. */
export function kineticBudget(initialEnergyJ: number, motorWorkJ: number, toleranceJ: number,
  finalPotentialJ: number, preProjectionKineticJ: number) {
  const availableJ = initialEnergyJ + motorWorkJ + toleranceJ - finalPotentialJ;
  const removedJ = Math.max(0, preProjectionKineticJ - Math.max(0, availableJ));
  const scale = removedJ > 0 && preProjectionKineticJ > 0
    ? Math.sqrt(Math.max(0, availableJ) / preProjectionKineticJ) : 1;
  return { availableJ, removedJ, scale, unavoidablePotentialExcessJ: Math.max(0, -availableJ),
    postProjectionKineticJ: preProjectionKineticJ * scale * scale };
}

/** Proposed actuator primitive for analysis/tests only. It is never imported by
 * shared mechanics. Bound a vector impulse using a physical force and timestep. */
export function forceLimitedImpulse(desiredImpulseNs: Vec3, maximumForceN: number, dtSeconds: number): Vec3 {
  const length = Math.hypot(desiredImpulseNs.x, desiredImpulseNs.y, desiredImpulseNs.z);
  const scale = length ? Math.min(1, maximumForceN * dtSeconds / length) : 0;
  return { x: desiredImpulseNs.x * scale, y: desiredImpulseNs.y * scale, z: desiredImpulseNs.z * scale };
}
