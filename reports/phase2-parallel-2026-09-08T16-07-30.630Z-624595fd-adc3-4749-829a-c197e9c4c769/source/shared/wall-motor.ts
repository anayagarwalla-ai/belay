import { TUNING } from '../tuning';
import type { Move, Vec3 } from './protocol';

/** A bounded velocity servo expressed as force, including gravity support in
 * the shared vertical/lateral budget. Contact resolution remains external. */
export function wallMotorVelocity(before: Vec3, input: Move, normal: Vec3, dt: number, reachableLedge = false): Vec3 {
  if (!input.brace && !input.x && !input.z) return { ...before };
  const p = TUNING.phase2, mass = TUNING.body.mass;
  const toward = -(input.x * normal.x + input.z * normal.z);
  const lateral = { x: normal.z, z: -normal.x };
  const along = input.x * lateral.x + input.z * lateral.z;
  const vn = before.x * normal.x + before.z * normal.z;
  const vl = before.x * lateral.x + before.z * lateral.z;
  const targetNormal = toward > 0 || input.brace ? -p.wallPressSpeed : Math.max(0, -toward) * p.wallPressSpeed;
  const targetY = input.brace ? 0 : toward * (toward > 0 ? p.wallClimbSpeed : p.wallDescendSpeed);
  const lateralError = (input.brace ? 0 : along * p.wallClimbSpeed) - vl;
  const verticalError = targetY - before.y, error = Math.hypot(lateralError, verticalError);
  const accelerationScale = error > 0 ? Math.min(1 / dt, p.wallAcceleration / error) : 0;
  let lateralForce = mass * lateralError * accelerationScale;
  let verticalForce = mass * (verticalError * accelerationScale + TUNING.gravity);
  const normalForce = Math.max(-p.wallNormalEffortN, Math.min(p.wallNormalEffortN, mass * (targetNormal - vn) / dt));
  const requested = Math.hypot(lateralForce, verticalForce);
  const scale = requested > 0 ? Math.min(1, (reachableLedge && toward > 0 ? p.ledgePullEffortN : p.wallFriction * Math.max(0, -normalForce)) / requested) : 0;
  lateralForce *= scale; verticalForce *= scale;
  return { x: before.x + (normalForce * normal.x + lateralForce * lateral.x) * dt / mass,
    y: before.y + verticalForce * dt / mass,
    z: before.z + (normalForce * normal.z + lateralForce * lateral.z) * dt / mass };
}
