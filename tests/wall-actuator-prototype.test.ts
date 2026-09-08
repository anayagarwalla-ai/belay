import { describe, expect, it } from 'vitest';
import { assessWallFrictionMagnitude, proposeWallMotor, wallActuatorConfig } from '../scripts/wall-actuator-prototype';

const rest = { x: 0, z: 0, brace: false }, brace = { ...rest, brace: true };
const wall = { x: 0, y: 0, z: 1 }, zero = { x: 0, y: 0, z: 0 };
const config = wallActuatorConfig();
const square = (v: typeof zero) => v.x ** 2 + v.y ** 2 + v.z ** 2;

// Only algebraic calls: no simulation, Rapier initialization, servers or replay.
describe('unapplied bounded wall actuator', () => {
  it('separates the 900 N active normal cap from gravity-support motor effort', () => {
    const motor = proposeWallMotor(zero, brace, wall, 1 / 60);
    expect(motor.normalForceN).toBe(-900);
    expect(motor.normalImpulseNs).toBe(-15);
    expect(motor.velocity.z).toBe(-0.1875);
    expect(motor.lateralForceN).toBe(0);
    expect(motor.verticalForceN).toBeCloseTo(784.8, 10);
    expect(motor.velocity.y).toBeCloseTo(0.1635, 12); // Gravity advances separately.
    expect(motor.normalWorkJ).toBe(1.40625);
    expect(motor.tangentialWorkJ).toBeCloseTo(1.06929, 12);
    expect(motor.signedMotorWorkJ).toBeCloseTo(2.47554, 12);
    expect(motor.measuredNormalContactImpulseNs).toBeNull();
    expect(Math.hypot(motor.normalForceN, motor.verticalForceN)).toBeGreaterThan(900);
  });

  it('shares one tangential force budget and scales impulse by timestep at 30/60', () => {
    // Error (14,48) has length 50: shared 5 m/s² servo requests (1.4,4.8).
    // With 80 kg and gravity, tangential force before clipping is (112,1168.8) N.
    const before = { x: -14, y: -48, z: 100 };
    const at30 = proposeWallMotor(before, brace, wall, 1 / 30);
    const at60 = proposeWallMotor(before, brace, wall, 1 / 60);
    const scale = 1170 / Math.hypot(112, 1168.8);
    for (const motor of [at30, at60]) {
      expect(motor.normalForceN).toBe(-900);
      expect(motor.lateralForceN).toBeCloseTo(112 * scale, 10);
      expect(motor.verticalForceN).toBeCloseTo(1168.8 * scale, 10);
      expect(Math.hypot(motor.lateralForceN, motor.verticalForceN)).toBeCloseTo(1170, 10);
    }
    for (const axis of ['x', 'y', 'z'] as const) expect(at30.impulseNs[axis]).toBeCloseTo(2 * at60.impulseNs[axis], 12);
    // Same starting velocity, J30 = 2 J60: W30 = 2 W60 + |J60|²/m.
    expect(at30.signedMotorWorkJ).toBeCloseTo(2 * at60.signedMotorWorkJ + square(at60.impulseNs) / 80, 9);
  });

  it('uses a normal/tangent frame independently of the world x/z axes', () => {
    const axisAligned = proposeWallMotor({ x: -14, y: -48, z: 100 }, brace, wall, 1 / 60);
    const rotated = proposeWallMotor({ x: 48.8, y: -48, z: 88.4 }, brace, { x: 3, y: 0, z: 4 }, 1 / 60);
    expect(rotated.normal).toEqual({ x: 0.6, y: 0, z: 0.8 });
    expect(rotated.lateral).toEqual({ x: 0.8, y: 0, z: -0.6 });
    expect(rotated.normal.x * rotated.lateral.x + rotated.normal.z * rotated.lateral.z).toBe(0);
    expect(rotated.normalForceN).toBe(axisAligned.normalForceN);
    expect(rotated.lateralForceN).toBeCloseTo(axisAligned.lateralForceN, 10);
    expect(rotated.verticalForceN).toBeCloseTo(axisAligned.verticalForceN, 10);
    expect(rotated.signedMotorWorkJ).toBeCloseTo(axisAligned.signedMotorWorkJ, 10);
  });

  it('leaves unbraced zero input inactive and bounds zero-direction brace braking', () => {
    const before = { x: 8, y: 0, z: 4 };
    const idle = proposeWallMotor(before, rest, wall, 1 / 60);
    expect(idle.active).toBe(false);
    expect(idle.velocity).toEqual(before);
    expect(idle.impulseNs).toEqual(zero);
    expect(idle.signedMotorWorkJ).toBe(0);
    const braking = proposeWallMotor(before, brace, wall, 1 / 60);
    expect(braking.active).toBe(true);
    expect(braking.lateralForceN).toBe(-400);
    expect(braking.velocity.x).toBeCloseTo(8 - 1 / 12, 12);
    expect(braking.velocity.z).toBe(3.8125);
    expect(braking.signedMotorWorkJ).toBeLessThan(0);
  });

  it('does not overshoot a small normal velocity error or apply an unbounded outward brake', () => {
    const small = proposeWallMotor({ x: 0, y: 0, z: -0.44 }, brace, wall, 1 / 60);
    expect(small.velocity.z).toBeCloseTo(-0.45, 12);
    expect(small.normalForceN).toBeCloseTo(-48, 10);
    const intoWall = proposeWallMotor({ x: 0, y: 0, z: -10 }, brace, wall, 1 / 60);
    expect(intoWall.normalForceN).toBe(900);
    expect(intoWall.velocity.z).toBe(-9.8125);
    expect(intoWall.normalWorkJ).toBeLessThan(0);
    expect(intoWall.measuredNormalContactImpulseNs).toBeNull();
  });

  it('maps toward, away and along inputs into the wall frame and normalizes oversized input', () => {
    const toward = proposeWallMotor(zero, { x: 0, z: -1, brace: false }, wall, 1 / 60);
    const away = proposeWallMotor(zero, { x: 0, z: 1, brace: false }, wall, 1 / 60);
    const along = proposeWallMotor(zero, { x: 1, z: 0, brace: false }, wall, 1 / 60);
    expect(toward.normalForceN).toBe(-900);
    expect(toward.verticalForceN).toBe(1170);
    expect(away.normalForceN).toBe(900);
    expect(away.verticalForceN).toBeCloseTo(384.8, 10);
    expect(along.normalForceN).toBe(0);
    expect(along.lateralForceN).toBe(400);
    expect(along.verticalForceN).toBeCloseTo(784.8, 10);
    const diagonal = { x: Math.SQRT1_2, z: -Math.SQRT1_2, brace: false };
    const unit = proposeWallMotor(zero, diagonal, wall, 1 / 60);
    const oversized = proposeWallMotor(zero, { ...diagonal, x: 5, z: -5 }, wall, 1 / 60);
    expect(oversized.normalForceN).toBe(unit.normalForceN);
    expect(oversized.lateralForceN).toBeCloseTo(unit.lateralForceN, 10);
    expect(oversized.verticalForceN).toBeCloseTo(unit.verticalForceN, 10);
  });

  it('keeps the saved row 237/450 one-step motor witness bounded without replaying it', () => {
    // reports/phase2-motor-energy.json: row 237, 450 N, tick 203, player 5.
    const before = { x: -8.048179626464844, y: -0.7254924178123474, z: 4.927676677703857 };
    const motor = proposeWallMotor(before, brace, wall, 1 / 60, { ...config, normalEffortN: 450 });
    expect(motor.normalForceN).toBe(-450);
    expect(motor.normalImpulseNs).toBe(-7.5);
    expect(Math.hypot(motor.lateralForceN, motor.verticalForceN)).toBeCloseTo(585, 10);
    expect(motor.velocity.x).toBeLessThan(-7.9); // Previous setter reset it to exactly zero.
    expect(motor.velocity.z).toBeCloseTo(4.833926677703857, 12); // Previously -0.45.
    expect(motor.signedMotorWorkJ).toBeLessThan(0);
    const kineticDeltaJ = 40 * (square(motor.velocity) - square(before));
    expect(motor.signedMotorWorkJ).toBeCloseTo(kineticDeltaJ, 9);
    expect(motor.normalWorkJ + motor.tangentialWorkJ).toBeCloseTo(kineticDeltaJ, 9);
    const oldHorizontalN = 80 * 60 * Math.hypot(-before.x, -0.45 - before.z);
    expect(oldHorizontalN).toBeCloseTo(46461.5706182492, 7);
  });

  it('does not certify contact from a nominal motor budget or a magnitude comparison', () => {
    const motor = proposeWallMotor(zero, brace, wall, 1 / 60);
    expect(assessWallFrictionMagnitude(motor, null)).toEqual({ status: 'unverified',
      normalContactImpulseNs: null, capacityNs: null, coupledContactCertified: false });
    const insufficient = assessWallFrictionMagnitude(motor, 1); // Synthetic reaction only.
    expect(insufficient.status).toBe('outside-magnitude-bound');
    expect(insufficient.capacityNs).toBe(1.3);
    const enough = assessWallFrictionMagnitude(motor, 20); // Synthetic reaction only.
    expect(enough.status).toBe('within-magnitude-bound');
    expect(enough.capacityNs).toBe(26);
    expect(enough.coupledContactCertified).toBe(false);
    expect(() => assessWallFrictionMagnitude(motor, -1)).toThrow(RangeError);
  });

  it('rejects unsupported wall normals and invalid physical inputs', () => {
    expect(() => proposeWallMotor(zero, brace, zero, 1 / 60)).toThrow(RangeError);
    expect(() => proposeWallMotor(zero, brace, { x: 0, y: 1, z: 0 }, 1 / 60)).toThrow(RangeError);
    expect(() => proposeWallMotor(zero, brace, wall, 0)).toThrow(RangeError);
    expect(() => proposeWallMotor(zero, brace, wall, 1 / 60, { ...config, massKg: 0 })).toThrow(RangeError);
    expect(() => proposeWallMotor({ ...zero, x: NaN }, brace, wall, 1 / 60)).toThrow(RangeError);
  });
});
