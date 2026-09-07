import { TUNING, FAMILIES, type Family } from '../tuning';
import type { Move, Vec3 } from './protocol';

export function motorVelocity(velocity: Vec3, input: Move, dt: number, family: Family): Vec3 {
  const targetX = input.brace ? 0 : input.x * TUNING.body.walkSpeed;
  const targetZ = input.brace ? 0 : input.z * TUNING.body.walkSpeed;
  const dx = targetX - velocity.x, dz = targetZ - velocity.z;
  const difference = Math.hypot(dx, dz);
  const acceleration = input.brace ? FAMILIES[family].braceFriction * TUNING.gravity
    : input.x || input.z ? TUNING.body.acceleration : TUNING.body.coastDeceleration;
  const blend = difference ? Math.min(1, acceleration * dt / difference) : 0;
  return { x: velocity.x + dx * blend, y: velocity.y, z: velocity.z + dz * blend };
}
