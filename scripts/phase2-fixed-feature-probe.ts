import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { TUNING } from '../tuning';
import { fixedFeatureFixtures } from './fixed-feature-fixtures';
import { fixedFeatureLimits, solveFixedFeatureFeasibility, validateFixedFeatureState } from './fixed-feature-feasibility';

/** Six bounded position-only fixtures. No simulation import or initialization,
 * replay, timestep loop, benchmark, API contact measurement or runtime edit. */
const sourceFiles = ['scripts/fixed-feature-feasibility.ts', 'scripts/fixed-feature-fixtures.ts',
  'scripts/phase2-fixed-feature-probe.ts', 'tests/fixed-feature-feasibility.test.ts', 'shared/expedition-simulation.ts', 'tuning.ts'];
const fixtures = fixedFeatureFixtures();
const rows = fixtures.map(fixture => {
  const result = solveFixedFeatureFeasibility(fixture.problem);
  const proof = fixture.infeasibilityProof;
  return { ...fixture, inputValidation: validateFixedFeatureState(fixture.problem, fixture.problem.chain.positions),
    witnessValidation: fixture.knownFeasiblePositions ? validateFixedFeatureState(fixture.problem, fixture.knownFeasiblePositions) : null,
    toleranceAwareInfeasibilityGapM: proof ? proof.minimumContactY - proof.fixedBodyY
      - 2 * TUNING.physicsDiagnostics.maximumFloorErrorM - proof.halfSpanMaterialM
      - proof.materialEdgesPerHalf * TUNING.physicsDiagnostics.maximumSegmentErrorM : null,
    result };
});
const report = {
  scope: 'fixed-feature position-only feasibility, architecture A; not runtime dynamics qualification',
  outcome: {
    geometricallyAccepted: rows.filter(row => row.result.status === 'geometrically-feasible').map(row => row.name),
    failedWithValidatedFeasibleWitness: rows.filter(row => row.result.status === 'bounded-failure'
      && row.witnessValidation?.acceptableGeometry).map(row => row.name),
    failedWithIndependentInfeasibilityProof: rows.filter(row => row.result.status === 'bounded-failure'
      && row.toleranceAwareInfeasibilityGapM !== null && row.toleranceAwareInfeasibilityGapM > 0).map(row => row.name),
  },
  frozenReference: 'f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1',
  currentTuningVersion: TUNING.version,
  sourceSha256: Object.fromEntries(sourceFiles.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])),
  physicalParameters: { bodyMassKg: TUNING.body.mass, particleMassKg: TUNING.rope.particleMass,
    segmentsPerSpan: TUNING.rope.segments, ropeRadiusM: TUNING.rope.radius, collisionSkinM: TUNING.phase2.collisionSkin },
  limits: fixedFeatureLimits(),
  summary: rows.map(({ name, witnessValidation, result }) => ({ name, status: result.status, knownFeasibleWitness: witnessValidation?.acceptableGeometry ?? null,
    sweeps: result.work.sweeps, projections: result.work.projections, maximumSegmentExcessM: result.validation.maximumSegmentExcessM,
    maximumReachExcessM: result.validation.maximumReachExcessM, maximumContactErrorM: result.validation.maximumContactErrorM,
    maximumFixedBodyErrorM: result.validation.maximumFixedBodyErrorM })),
  rows,
};
writeFileSync('reports/phase2-fixed-feature-feasibility.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary, null, 2));
