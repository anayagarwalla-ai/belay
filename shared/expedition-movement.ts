import { TUNING, FAMILIES, type Family } from '../tuning';
import type { Move, Vec3 } from './protocol';

/** Braced footwork is a slow, force-limited haul. With no direction it is the
 * same planted anchor; no input-dependent recovery reward or position snap. */
export function expeditionMotorVelocity(velocity: Vec3, input: Move, dt: number, family: Family): Vec3 {
  const speed = input.brace ? TUNING.phase2.haulSpeed : TUNING.phase2.walkingSpeed;
  const dx = input.x * speed - velocity.x, dz = input.z * speed - velocity.z;
  const difference = Math.hypot(dx, dz);
  const acceleration = input.brace ? FAMILIES[family].braceFriction * TUNING.gravity
    : input.x || input.z ? TUNING.phase2.walkingAcceleration : TUNING.body.coastDeceleration;
  const blend = difference ? Math.min(1, acceleration * dt / difference) : 0;
  return { x: velocity.x + dx * blend, y: velocity.y, z: velocity.z + dz * blend };
}
