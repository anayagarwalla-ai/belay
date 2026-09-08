import { describe, expect, it } from 'vitest';
import { TUNING } from '../tuning';
import { fixedFeatureFixtures } from '../scripts/fixed-feature-fixtures';
import { fixedFeatureLimits, makeMaterialChain, projectMaterialPair, projectOneFixedConstraint,
  solveFixedFeatureFeasibility, validateFixedFeatureState, type FixedFeatureProblem } from '../scripts/fixed-feature-feasibility';

// These are bounded algebraic optimization fixtures, not time-stepped physics.
const fixtures = fixedFeatureFixtures(), originalInputs = JSON.stringify(fixtures);
const results = fixtures.map(f => solveFixedFeatureFeasibility(f.problem));
const entry = (name: string) => {
  const i = fixtures.findIndex(f => f.name === name);
  return { fixture: fixtures[i], result: results[i] };
};

describe('fixed-feature material-chain feasibility experiment', () => {
  it('retains physical masses, twelve segments per span, and one shared middle body', () => {
    const { chain } = entry('three-body-floor').fixture.problem;
    expect(chain.bodyCount).toBe(3);
    expect(chain.positions).toHaveLength(25);
    expect(chain.massesKg.slice(0, 3)).toEqual([80, 80, 80]);
    expect(chain.massesKg.slice(3)).toEqual(Array(22).fill(0.2));
    expect(chain.spans.map(s => s.nodeIds.length)).toEqual([13, 13]);
    expect(chain.spans.map(s => s.materialLengthM)).toEqual([3.6, 3.6]);
    expect(chain.spans[0].nodeIds.at(-1)).toBe(1);
    expect(chain.spans[1].nodeIds[0]).toBe(1);
    expect(new Set(chain.spans.flatMap(s => s.nodeIds)).size).toBe(25);
  });

  it('projects an edge exactly with the 400:1 physical mass ratio and preserves its center of mass', () => {
    const a = { x: 0, y: 0, z: 0 }, b = { x: 0.6, y: 0, z: 0 };
    const [p, q] = projectMaterialPair(a, b, 80, 0.2, 0.3);
    expect(p.x).toBeCloseTo(0.3 / 401, 14);
    expect(q.x).toBeCloseTo(0.6 - 120 / 401, 14);
    expect(q.x - p.x).toBeCloseTo(0.3, 14);
    expect(80 * p.x + 0.2 * q.x).toBeCloseTo(0.2 * 0.6, 14);
    expect(projectMaterialPair(a, { ...b, x: 0.2 }, 80, 0.2, 0.3)).toEqual([a, { ...b, x: 0.2 }]);
  });

  it('distributes a fixed edge-interior plane constraint by squared barycentric inverse mass', () => {
    const chain = makeMaterialChain([{ x: 0, y: -0.3, z: 0 }, { x: 3.6, y: 0.6, z: 0 }]);
    const particle = chain.spans[0].nodeIds[1]; chain.positions[particle].y = -0.3;
    const problem: FixedFeatureProblem = { chain, plane: { normal: { x: 0, y: 5, z: 0 }, offsetM: 0,
      samples: [{ kind: 'edge', a: 0, b: particle, fraction: 0.75, clearanceM: 0 }] } };
    const planeIndex = validateFixedFeatureState(problem, chain.positions).constraints.findIndex(c => c.kind === 'plane');
    const next = projectOneFixedConstraint(problem, planeIndex);
    // Denominator = .25²/80 + .75²/.2 = 3601/1280.
    expect(next[0].y + 0.3).toBeCloseTo(1.2 / 3601, 14);
    expect(next[particle].y + 0.3).toBeCloseTo(1440 / 3601, 14);
    expect(0.25 * next[0].y + 0.75 * next[particle].y).toBeCloseTo(0, 14);
    expect(next[0].x).toBe(chain.positions[0].x);
    expect(next[particle].x).toBe(chain.positions[particle].x);
  });

  it('rejects a locally repaired edge when the neighboring material edge becomes worse', () => {
    const { fixture, result } = entry('local-edge-regression');
    const problem = fixture.problem, nodes = problem.chain.spans[0].nodeIds;
    // Material nodes x = 0, .3, .9. Repairing edge 1 moves them to 0, .45, .75.
    const trial = projectOneFixedConstraint(problem, 1), check = validateFixedFeatureState(problem, trial);
    expect(trial[nodes[1]].x).toBeCloseTo(0.45, 14);
    expect(trial[nodes[2]].x).toBeCloseTo(0.75, 14);
    expect(check.constraints[1].residualM).toBeCloseTo(0, 14);
    expect(check.constraints[0].residualM).toBeCloseTo(0.15, 14);
    expect(check.acceptableGeometry).toBe(false);
    expect(result.status).toBe('geometrically-feasible');
    expect(result.validation.maximumSegmentExcessM).toBeLessThanOrEqual(fixedFeatureLimits().solverLengthTargetM);
  });

  it('checks actual nonlinear length after a displacement invisible to the initial length gradient', () => {
    const { fixture } = entry('local-edge-regression');
    const candidate = structuredClone(fixture.knownFeasiblePositions!);
    candidate[fixture.problem.chain.spans[0].nodeIds[1]].y += 0.3;
    const check = validateFixedFeatureState(fixture.problem, candidate);
    // A horizontal edge's first-order dot product with this vertical change is 0.
    expect(check.constraints[0].residualM).toBeCloseTo(Math.sqrt(0.3 ** 2 + 0.3 ** 2) - 0.3, 14);
    expect(check.acceptableGeometry).toBe(false);
  });

  it('returns only globally checked geometry in the two/three-body floor fixtures', () => {
    for (const name of ['two-body-floor', 'three-body-floor']) {
      const { fixture, result } = entry(name);
      expect(result.trace[0].acceptableGeometry).toBe(false);
      expect(result.status).toBe('geometrically-feasible');
      const validation = validateFixedFeatureState(fixture.problem, result.acceptedPositions!);
      expect(validation.acceptableGeometry).toBe(true);
      for (const constraint of validation.constraints) {
        const ceiling = constraint.kind === 'plane' || constraint.kind === 'pin'
          ? TUNING.physicsDiagnostics.maximumFloorErrorM : TUNING.phase2.solverToleranceM;
        expect(constraint.residualM).toBeLessThanOrEqual(ceiling);
      }
      expect(result.massMetricOptimalityCertified).toBe(false);
      expect(result.dynamicsEnergyFrictionQualified).toBe(false);
    }
  });

  it('retains a genuinely slack material state without pushing it into a taut decorative path', () => {
    const { fixture, result } = entry('slack-chain');
    expect(result.acceptedPositions).toEqual(fixture.problem.chain.positions);
    expect(result.massMetricObjectiveKgM2).toBe(0);
    expect(result.trace.every(t => t.maximumSweepMoveM === 0)).toBe(true);
  });

  it('validates the separately supplied feasible witness even when the solver exhausts its cap', () => {
    for (const fixture of fixtures.filter(f => f.knownFeasiblePositions)) {
      expect(validateFixedFeatureState(fixture.problem, fixture.knownFeasiblePositions!).acceptableGeometry).toBe(true);
    }
    const { result } = entry('taut-prescribed-lip');
    expect(result.status).toBe('bounded-failure');
    expect(result.failureReason).toBe('iteration-budget-exhausted');
    expect(result.acceptedPositions).toBeNull();
    expect(result.work.sweeps).toBe(TUNING.historicalDiagnostics.fixedFeatureSweeps);
    expect(result.validation.maximumSegmentExcessM).toBeGreaterThan(TUNING.physicsDiagnostics.maximumSegmentErrorM);
    // A small iterate change is not a feasibility certificate.
    expect(result.trace.at(-1)!.maximumSweepMoveM).toBeLessThan(TUNING.physicsDiagnostics.maximumFloorErrorM);
    expect(result.trace.at(-1)!.acceptableGeometry).toBe(false);
  });

  it.fails('KNOWN BOUNDED FAILURE: a feasible taut prescribed lip reaches all existing ceilings within 256 sweeps', () => {
    expect(entry('taut-prescribed-lip').result.validation.acceptableGeometry).toBe(true);
  });

  it('rejects the explicitly infeasible contact/material combination even with existing tolerances', () => {
    const { fixture, result } = entry('infeasible-prescribed-lip'), proof = fixture.infeasibilityProof!;
    // Each anchored half-chain has six .3 m material edges. Even allowing .02 m
    // excess per edge and .001 m for both contact and pin, it cannot reach y=2.039.
    const requiredRise = proof.minimumContactY - proof.fixedBodyY - 2 * TUNING.physicsDiagnostics.maximumFloorErrorM;
    const allowedLength = proof.halfSpanMaterialM + proof.materialEdgesPerHalf * TUNING.physicsDiagnostics.maximumSegmentErrorM;
    expect(requiredRise - allowedLength).toBeCloseTo(0.117, 12);
    expect(result.status).toBe('bounded-failure');
    expect(result.acceptedPositions).toBeNull();
    expect(result.trace.every(t => !t.acceptableGeometry)).toBe(true);
    expect(result.work.sweeps).toBe(256);
    expect(result.validation.maximumFixedBodyErrorM).toBe(0);
    expect(result.validation.maximumContactErrorM).toBeLessThanOrEqual(TUNING.physicsDiagnostics.maximumFloorErrorM);
    expect(result.validation.maximumSegmentExcessM).toBeGreaterThan(TUNING.physicsDiagnostics.maximumSegmentErrorM);
  });

  it('keeps bounded work, all material inputs and the frozen tolerances intact', () => {
    expect(JSON.stringify(fixtures)).toBe(originalInputs);
    expect(fixedFeatureLimits()).toEqual({ minimumSweeps: 12, maximumSweeps: 256, solverLengthTargetM: 0.005,
      maximumSegmentExcessM: 0.02, maximumSpanExcessM: 0.01, maximumContactErrorM: 0.001, maximumBodyOverlapM: 0.005 });
    for (const result of results) {
      expect(result.work.sweeps).toBeGreaterThanOrEqual(12);
      expect(result.work.projections).toBe(result.work.sweeps * result.work.constraintsPerSweep);
      expect(result.work.projections).toBeLessThanOrEqual(result.work.maximumProjections);
      expect(result.work.residualChecks).toBe(result.work.sweeps + 1);
      expect(result.work.residualChecks).toBeLessThanOrEqual(257);
    }
  });

  it('vetoes body overlap and nonfinite trial states instead of claiming complete contact qualification', () => {
    const chain = makeMaterialChain([{ x: 0, y: 0, z: 0 }, { x: 0.1, y: 0, z: 0 }]);
    const overlap = validateFixedFeatureState({ chain }, chain.positions);
    expect(overlap.maximumBodyOverlapM).toBeCloseTo(0.45, 14);
    expect(overlap.acceptableGeometry).toBe(false);
    const { fixture } = entry('slack-chain'), bad = structuredClone(fixture.problem.chain.positions);
    bad[0].x = Infinity;
    expect(validateFixedFeatureState(fixture.problem, bad).finite).toBe(false);
    expect(validateFixedFeatureState(fixture.problem, bad).acceptableGeometry).toBe(false);
  });

  it('rejects altered masses, material lengths, shared-node identity and duplicate contact features', () => {
    const { fixture } = entry('two-body-floor');
    const wrongMass = structuredClone(fixture.problem); wrongMass.chain.massesKg[2] = 80;
    const wrongLength = structuredClone(fixture.problem); wrongLength.chain.spans[0].materialLengthM = 4;
    const wrongNode = structuredClone(fixture.problem); wrongNode.chain.spans[0].nodeIds[1] = 0;
    const duplicate = structuredClone(fixture.problem); duplicate.plane!.samples.push(duplicate.plane!.samples[0]);
    for (const problem of [wrongMass, wrongLength, wrongNode, duplicate]) expect(() => solveFixedFeatureFeasibility(problem)).toThrow(RangeError);
  });
});
