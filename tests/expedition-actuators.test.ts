import { describe, expect, it } from 'vitest';
import { TUNING } from '../tuning';
import { REST, normalizeMove } from '../shared/protocol';
import { wallMotorVelocity } from '../shared/wall-motor';
import { expeditionMotorVelocity } from '../shared/expedition-movement';
import { expeditionContactHalf, supportAt } from '../shared/contact-geometry';

describe('physical rescue actuation', () => {
  it('keeps a nearly mantled climber on wall support until their feet clear the lip', () => {
    const bank = { id: 0, minX: -12, maxX: 12, minY: -12, maxY: 0, minZ: 0, maxZ: 480 };
    const position = { x: 0, y: expeditionContactHalf.y - 0.04, z: bank.maxZ + expeditionContactHalf.z - 0.00001 };
    expect(supportAt(position, expeditionContactHalf, [bank]).support).toBe('wall');
    expect(supportAt({ ...position, y: expeditionContactHalf.y + TUNING.phase2.contactSeparationM }, expeditionContactHalf, [bank]).support).toBe('ground');
  });
  it('allows slow braced footwork and leaves a static brace planted', () => {
    const rest = { x: 0, y: 0, z: 0 };
    expect(expeditionMotorVelocity(rest, { ...REST, brace: true }, 1 / 60, 'balanced')).toEqual(rest);
    const haul = expeditionMotorVelocity(rest, { x: 0, z: -1, brace: true }, 1 / 60, 'balanced');
    expect(haul.z).toBeLessThan(0); expect(Math.abs(haul.z)).toBeLessThanOrEqual(TUNING.phase2.haulSpeed);
  });
  it('does not actuate an idle climber even beside a reachable ledge', () => {
    const before = { x: 2, y: -3, z: 1 };
    expect(wallMotorVelocity(before, REST, { x: 0, y: 0, z: 1 }, 1 / 60, true)).toEqual(before);
  });
  it('bounds press and combined foot forces across approach speeds, directions and both authority rates', () => {
    for (const hz of [30, 60]) for (const sign of [-1, 1]) for (let i = -20; i <= 20; i++) {
      const before = { x: i / 2, y: i / 3, z: i }, input = normalizeMove({ x: Math.sin(i), z: Math.cos(i), brace: i % 3 === 0 });
      const after = wallMotorVelocity(before, input, { x: 0, y: 0, z: sign }, 1 / hz);
      const force = { x: (after.x - before.x) * TUNING.body.mass * hz, y: (after.y - before.y) * TUNING.body.mass * hz,
        z: (after.z - before.z) * TUNING.body.mass * hz };
      expect(Math.abs(force.z)).toBeLessThanOrEqual(TUNING.phase2.wallNormalEffortN + 1e-9);
      expect(Math.hypot(force.x, force.y)).toBeLessThanOrEqual(TUNING.phase2.wallFriction * Math.max(0, -sign * force.z) + 1e-9);
    }
  });
  it('requires hauling below the lip but permits an active mantle within hand reach', () => {
    const rest = { x: 0, y: 0, z: 0 }, toward = { x: 0, z: -1, brace: false }, normal = { x: 0, y: 0, z: 1 }, dt = 1 / 60;
    const feet = wallMotorVelocity(rest, toward, normal, dt, false), hands = wallMotorVelocity(rest, toward, normal, dt, true);
    expect(feet.y / dt).toBeLessThan(TUNING.gravity);
    expect(hands.y / dt).toBeGreaterThan(TUNING.gravity);
    expect(hands.y / dt * TUNING.body.mass).toBeLessThanOrEqual(TUNING.phase2.ledgePullEffortN);
  });
});
