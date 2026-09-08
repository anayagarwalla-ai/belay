import { TUNING } from '../tuning';
import type { Move, Vec3 } from '../shared/protocol';

/** Experimental motor proposal only. This module never initializes physics,
 * solves contact, or derives passive reaction from a velocity change. */
export function wallActuatorConfig() {
  return {
    massKg: TUNING.body.mass as number,
    gravityMps2: TUNING.gravity as number,
    climbSpeedMps: TUNING.phase2.wallClimbSpeed as number,
    descendSpeedMps: TUNING.phase2.wallDescendSpeed as number,
    servoAccelerationMps2: TUNING.phase2.wallAcceleration as number,
    pressSpeedMps: TUNING.phase2.wallPressSpeed as number,
    normalEffortN: TUNING.phase2.wallNormalEffortN as number,
    nominalTangentialMultiplier: TUNING.phase2.wallFriction as number,
  };
}
export type WallActuatorConfig = ReturnType<typeof wallActuatorConfig>;

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const clamp = (value: number, bound: number) => Math.max(-bound, Math.min(bound, value));
const finiteVector = (v: Vec3) => [v.x, v.y, v.z].every(Number.isFinite);

/** SI units. Outward horizontal normal, world-up vertical, lateral = (nz,0,-nx).
 * Gravity is NOT advanced here; gravity feedforward is active motor effort.
 * The normal and shared lateral/vertical effort limits are separate budgets.
 * A nominal tangential budget is not a measured Coulomb contact capacity. */
export function proposeWallMotor(before: Vec3, input: Move, wallNormal: Vec3, dtSeconds: number,
  config: WallActuatorConfig = wallActuatorConfig()) {
  if (!finiteVector(before) || !finiteVector(wallNormal) || !Number.isFinite(input.x)
    || !Number.isFinite(input.z) || typeof input.brace !== 'boolean') throw new RangeError('Finite vectors and a boolean brace are required');
  if (!(dtSeconds > 0) || !Number.isFinite(dtSeconds) || !(config.massKg > 0)
    || Object.values(config).some(value => !Number.isFinite(value) || value < 0)) throw new RangeError('Positive timestep/mass and finite nonnegative tuning are required');
  const normalLength = Math.hypot(wallNormal.x, wallNormal.z);
  if (wallNormal.y !== 0 || !(normalLength > 0) || !Number.isFinite(normalLength)) throw new RangeError('A nonzero horizontal wall normal is required');
  const normal = { x: wallNormal.x / normalLength, y: 0, z: wallNormal.z / normalLength };
  const lateral = { x: normal.z, y: 0, z: -normal.x };
  const inputLength = Math.hypot(input.x, input.z);
  if (!Number.isFinite(inputLength)) throw new RangeError('Finite input magnitude is required');
  const inputScale = inputLength > 1 ? 1 / inputLength : 1;
  const toward = -(input.x * inputScale * normal.x + input.z * inputScale * normal.z);
  const along = input.x * inputScale * lateral.x + input.z * inputScale * lateral.z;
  const active = input.brace || input.x !== 0 || input.z !== 0;
  const normalVelocity = dot(before, normal), lateralVelocity = dot(before, lateral);
  const nominalTangentialBudgetN = config.nominalTangentialMultiplier * config.normalEffortN;
  let normalForceN = 0, lateralForceN = 0, verticalForceN = 0;
  if (active) {
    const targetNormal = toward > 0 || input.brace ? -config.pressSpeedMps : Math.max(0, -toward) * config.pressSpeedMps;
    const targetLateral = input.brace ? 0 : along * config.climbSpeedMps;
    const targetVertical = input.brace ? 0 : toward * (toward > 0 ? config.climbSpeedMps : config.descendSpeedMps);
    normalForceN = clamp(config.massKg * ((targetNormal - normalVelocity) / dtSeconds), config.normalEffortN);
    // Reuse wallAcceleration as a shared two-axis servo bound. Gravity support
    // is then included before clipping the combined tangential motor force.
    const lateralError = targetLateral - lateralVelocity, verticalError = targetVertical - before.y;
    const errorLength = Math.hypot(lateralError, verticalError);
    const acceleration = Math.min(errorLength / dtSeconds, config.servoAccelerationMps2);
    lateralForceN = errorLength > 0 ? config.massKg * (lateralError / errorLength) * acceleration : 0;
    verticalForceN = (errorLength > 0 ? config.massKg * (verticalError / errorLength) * acceleration : 0)
      + config.massKg * config.gravityMps2;
    const requestedLength = Math.hypot(lateralForceN, verticalForceN);
    const forceScale = requestedLength > 0 ? Math.min(1, nominalTangentialBudgetN / requestedLength) : 0;
    lateralForceN *= forceScale; verticalForceN *= forceScale;
  }
  const normalImpulseNs = normalForceN * dtSeconds, lateralImpulseNs = lateralForceN * dtSeconds;
  const verticalImpulseNs = verticalForceN * dtSeconds;
  const impulseNs = {
    x: normal.x * normalImpulseNs + lateral.x * lateralImpulseNs,
    y: verticalImpulseNs,
    z: normal.z * normalImpulseNs + lateral.z * lateralImpulseNs,
  };
  const velocity = { x: before.x + impulseNs.x / config.massKg, y: before.y + impulseNs.y / config.massKg,
    z: before.z + impulseNs.z / config.massKg };
  const normalWorkJ = normalVelocity * normalImpulseNs + normalImpulseNs ** 2 / (2 * config.massKg);
  const tangentialWorkJ = lateralVelocity * lateralImpulseNs + before.y * verticalImpulseNs
    + (lateralImpulseNs ** 2 + verticalImpulseNs ** 2) / (2 * config.massKg);
  const signedMotorWorkJ = dot(before, impulseNs) + dot(impulseNs, impulseNs) / (2 * config.massKg);
  // Reject unrepresentable arithmetic rather than silently publishing NaN/Infinity.
  if (!finiteVector(velocity) || !finiteVector(impulseNs)
    || ![nominalTangentialBudgetN, normalWorkJ, tangentialWorkJ, signedMotorWorkJ].every(Number.isFinite)) {
    throw new RangeError('Motor proposal exceeds finite arithmetic range');
  }
  return { active, velocity, impulseNs, normal, lateral, normalForceN, lateralForceN, verticalForceN,
    normalImpulseNs, lateralImpulseNs, verticalImpulseNs,
    tangentialImpulseMagnitudeNs: Math.hypot(lateralImpulseNs, verticalImpulseNs),
    nominalTangentialBudgetN, nominalTangentialMultiplier: config.nominalTangentialMultiplier,
    normalWorkJ, tangentialWorkJ, signedMotorWorkJ,
    // No contact measurement enters this helper. Motor effort is never returned as reaction.
    measuredNormalContactImpulseNs: null };
}
export type WallMotorProposal = ReturnType<typeof proposeWallMotor>;

/** Necessary magnitude comparison only, assuming the proposed tangential motor
 * is transmitted by friction with this coefficient. The caller must supply the
 * actual compressive reaction for the same solved substep/contact; neither a
 * motor setting nor an earlier/native-only contact impulse supplies that fact.
 * Other tangential contact demand must also share the cone. Even a passing
 * comparison does not certify contact, complementarity, or coupled feasibility. */
export function assessWallFrictionMagnitude(motor: WallMotorProposal, normalContactImpulseNs: number | null) {
  if (normalContactImpulseNs === null) return { status: 'unverified' as const,
    normalContactImpulseNs, capacityNs: null, coupledContactCertified: false as const };
  if (!Number.isFinite(normalContactImpulseNs) || normalContactImpulseNs < 0) throw new RangeError('A finite nonnegative compressive reaction impulse is required');
  const capacityNs = motor.nominalTangentialMultiplier * normalContactImpulseNs;
  if (!Number.isFinite(capacityNs)) throw new RangeError('Contact capacity exceeds finite arithmetic range');
  return { status: motor.tangentialImpulseMagnitudeNs <= capacityNs ? 'within-magnitude-bound' as const : 'outside-magnitude-bound' as const,
    normalContactImpulseNs, capacityNs, coupledContactCertified: false as const };
}
