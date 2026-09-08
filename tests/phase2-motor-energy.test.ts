import { beforeAll, describe, expect, it } from 'vitest';
import { BelaySimulation, initializePhysics } from '../shared/simulation';
import type { Move } from '../shared/protocol';
import { TUNING } from '../tuning';
import { construct, inputsFor, observe } from '../scripts/phase2-motor-energy-probe';
import { forceLimitedImpulse, impulseAccounting } from '../scripts/physics-budget-diagnostics';
import casesFile from './fixtures/phase2-motor-energy-cases.json';

function replay(row: number, ticks: number) {
  const fixture = casesFile.cases.find(c => c.row === row)!;
  const sim = construct(BelaySimulation, fixture), finish = observe(sim, TUNING);
  let input: Move[] = [];
  try {
    for (let tick = 0; tick < ticks; tick++) {
      if (tick % (fixture.decisionSeconds * TUNING.physicsHz) === 0) input = inputsFor(fixture, sim);
      sim.step(input);
    }
    return { snapshot: sim.snapshot(), trace: finish() };
  } finally { sim.dispose(); }
}

/** The saved scenarios exercise the checkout's engine. Historical source and
 * input fixtures remain unchanged; force bounds cover every observed motor step. */
describe('recorded motor and energy defects on current mechanics', () => {
  let idle: ReturnType<typeof replay>, braced: ReturnType<typeof replay>;
  beforeAll(async () => {
    await initializePhysics();
    idle = replay(73, 366);
    braced = replay(237, 204);
  });

  it('observes the idle-casualty energy case without attributing a wall motor', () => {
    expect(idle.snapshot.tick).toBe(366);
    expect(idle.trace.wallActuationsByPlayer[casesFile.cases.find(c => c.row === 73)!.spec.casualty]).toBe(0);
    expect(idle.trace.maximumIdleWallImpulseNs).toBe(0);
    expect(idle.trace.maximumRemovalJ).toBeGreaterThanOrEqual(0);
    expect(idle.snapshot.players.every(p => Object.values(p.velocity).every(Number.isFinite))).toBe(true);
  });

  it('reconstructs native motor work and projection diagnostics independently', () => {
    for (const { trace } of [idle, braced]) {
      expect(trace.maximumMotorWorkErrorJ).toBeLessThan(1e-6);
      expect(trace.maximumBudgetDiagnosticErrorJ).toBeLessThan(1e-6);
    }
    // Motor work is checked for every call above, including ground motors.
    // Wall force coverage does not depend on this old trajectory reaching a wall;
    // expedition-actuators.test.ts exercises the actual actuator at both rates.
  });

  it('committed potential remains within the mechanical budget including its existing tolerance', () => {
    expect(idle.trace.largestPotential!.beforeBudget!.unavoidablePotentialExcessJ).toBeLessThanOrEqual(0);
  });

  it('an individual active length projection does not increase its own endpoint distance', () => {
    const constraint = idle.trace.largestConstraint!.largestConstraintMove!.constraint!;
    expect(constraint.afterDistanceM).toBeLessThanOrEqual(constraint.beforeDistanceM);
  });

  it('the wall press actuator respects nominal normal effort', () => {
    expect(braced.trace.maximumWallNormalForceN).toBeLessThanOrEqual(TUNING.phase2.wallNormalEffortN);
  });

  it('lateral and vertical actuation share the nominal tangential motor budget', () => {
    expect(braced.trace.maximumWallTangentialForceN).toBeLessThanOrEqual(
      TUNING.phase2.wallFriction * TUNING.phase2.wallNormalEffortN + 1e-9);
  });
});

describe('design-only impulse bounds with physical units', () => {
  it('limits a 900 N press to 15 N s and 0.1875 m/s per 60 Hz step for an 80 kg body', () => {
    const impulse = forceLimitedImpulse({ x: 0, y: 0, z: -36 }, 900, 1 / 60);
    expect(impulse).toEqual({ x: 0, y: 0, z: -15 });
    const accounting = impulseAccounting({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: impulse.z / 80 }, 80, 1 / 60);
    expect(accounting.horizontalForceN).toBe(900);
    expect(accounting.workJ).toBe(1.40625);
  });

  it('gives the same 11.25 m/s velocity change and 5062.5 J work after one second at 30 and 60 Hz', () => {
    for (const hz of [30, 60]) {
      let velocity = 0, workJ = 0;
      for (let tick = 0; tick < hz; tick++) {
        const impulse = forceLimitedImpulse({ x: 80 * (100 - velocity), y: 0, z: 0 }, 900, 1 / hz);
        const next = velocity + impulse.x / 80;
        workJ += impulseAccounting({ x: velocity, y: 0, z: 0 }, { x: next, y: 0, z: 0 }, 80, 1 / hz).impulseWorkJ;
        velocity = next;
      }
      expect(velocity).toBeCloseTo(11.25, 10);
      expect(workJ).toBeCloseTo(5062.5, 8);
    }
  });

  it('shares a 1170 N tangential budget between lateral and vertical demands', () => {
    const impulse = forceLimitedImpulse({ x: 12, y: 16, z: 0 }, 1170, 1 / 60);
    expect(impulse.x).toBeCloseTo(11.7, 10);
    expect(impulse.y).toBeCloseTo(15.6, 10);
    expect(Math.hypot(impulse.x, impulse.y) * 60).toBeCloseTo(1170, 10);
  });
});
