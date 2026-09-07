import { TUNING } from '../tuning';
import { type Move, type Vec3, REST } from '../shared/protocol';
import { BelaySimulation } from '../shared/simulation';
import { seededRandom } from '../shared/terrain';

export const SCENARIOS = ['crossing', 'circling', 'opposing', 'brace-switches', 'random', 'long-walk'] as const;
export type Scenario = typeof SCENARIOS[number];
const limits = TUNING.physicsDiagnostics;
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** All controls enter through the same bounded Move path used by authoritative fixed steps. */
export function scenarioInputs(scenario: Scenario, seed: number, tickHz: number) {
  const random = seededRandom(seed);
  let inputs: Move[] = [REST, REST];
  return (tick: number): Move[] => {
    const seconds = tick / tickHz;
    if (scenario === 'crossing') {
      const angle = seconds * limits.crossingRadiansPerSecond;
      inputs = [{ x: Math.cos(angle), z: Math.sin(angle), brace: false },
        { x: -Math.cos(angle), z: -Math.sin(angle), brace: false }];
    } else if (scenario === 'circling') {
      inputs = [0, 1].map(i => ({
        x: Math.cos(seconds * limits.circlingRadiansPerSecond + i * limits.circlingPhaseRadians),
        z: Math.sin(seconds * limits.circlingRadiansPerSecond + i * limits.circlingPhaseRadians),
        brace: tick % limits.circleBracePeriodsTicks[i] < limits.circleBraceTicks,
      }));
    } else if (scenario === 'opposing' || scenario === 'brace-switches') {
      inputs = [0, 1].map(i => ({ x: i ? 1 : -1, z: 0,
        brace: scenario === 'brace-switches' && tick % limits.togglePeriodsTicks[i] === 0 }));
    } else if (scenario === 'random') {
      if (tick % Math.round(tickHz * limits.randomActionSeconds) === 0) {
        inputs = [0, 1].map(() => ({ x: random() * 2 - 1, z: random() * 2 - 1,
          brace: random() < limits.randomBraceChance }));
      }
    } else inputs = [0, 1].map(() => ({ x: 1, z: 1, brace: false }));
    return inputs;
  };
}

export function physicalState(sim: BelaySimulation) {
  const { players, rope, counters } = sim.snapshot();
  return { players, rope, counters };
}

export function measurePhysics(sim: BelaySimulation) {
  const [a, b] = sim.bodies.map(body => body.translation());
  const span = distance(sim.points[0], sim.points[sim.points.length - 1]);
  let chain = 0, segmentErrorM = 0;
  for (let i = 1; i < sim.points.length; i++) {
    const segment = distance(sim.points[i - 1], sim.points[i]);
    chain += segment;
    segmentErrorM = Math.max(segmentErrorM, segment - sim.length / TUNING.rope.segments);
  }
  const velocities = sim.bodies.map(body => body.linvel());
  const values = [a, b, ...sim.points, ...velocities].flatMap(v => [v.x, v.y, v.z]);
  values.push(sim.tension, sim.tensionN, ...sim.counters.distanceTravelledM,
    sim.counters.maximumSpeedMps, sim.counters.maximumJoltMps2);
  return {
    finite: values.every(Number.isFinite),
    bodyOverlapM: Math.max(0, Math.min(TUNING.body.width - Math.abs(a.x - b.x),
      TUNING.body.height - Math.abs(a.y - b.y), TUNING.body.depth - Math.abs(a.z - b.z))),
    floorErrorM: Math.max(0, TUNING.body.height / 2 - a.y, TUNING.body.height / 2 - b.y,
      ...sim.points.slice(1, -1).map(p => TUNING.rope.floorHeight - p.y)),
    spanErrorM: Math.max(0, span - sim.length), segmentErrorM,
    chainErrorM: Math.max(0, chain - sim.length),
    speedMps: Math.max(...velocities.map(v => Math.hypot(v.x, v.y, v.z))),
  };
}

export const metricLimits = {
  bodyOverlapM: limits.maximumBodyOverlapM, floorErrorM: limits.maximumFloorErrorM,
  spanErrorM: limits.maximumSpanErrorM, segmentErrorM: limits.maximumSegmentErrorM,
  chainErrorM: TUNING.rope.segments * limits.maximumSegmentErrorM,
  speedMps: TUNING.body.walkSpeed * limits.maximumSpeedMultiplier,
};
