import { FAMILIES, TUNING, type Family } from '../tuning';
import type { Vec3 } from '../shared/protocol';

/** Pure, position-only architecture-A experiment. No world, time integration,
 * contact discovery, friction, velocity correction, or runtime acceptance. */
export type MaterialChain = {
  family: Family;
  bodyCount: number;
  positions: Vec3[];
  massesKg: number[];
  spans: { a: number; b: number; nodeIds: number[]; materialLengthM: number }[];
};
export type PlaneSample = { kind: 'node'; node: number; clearanceM: number }
  | { kind: 'edge'; a: number; b: number; fraction: number; clearanceM: number };
export type FixedFeatureProblem = {
  chain: MaterialChain;
  // One prescribed planar feature. offsetM is signed distance along the
  // normalized normal. Samples/feature identity remain fixed for the solve.
  plane?: { normal: Vec3; offsetM: number; samples: PlaneSample[] };
  // Fixture-only kinematic boundary constraints, not brace or altered masses.
  fixedBodies?: { body: number; position: Vec3 }[];
};
type LengthConstraint = { kind: 'material' | 'span' | 'reach'; ids: [number, number]; maximumM: number };
type PlaneConstraint = { kind: 'plane'; ids: number[]; weights: number[]; normal: Vec3; offsetM: number };
type PinConstraint = { kind: 'pin'; ids: [number]; position: Vec3 };
type Constraint = LengthConstraint | PlaneConstraint | PinConstraint;

const zero = (): Vec3 => ({ x: 0, y: 0, z: 0 });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const distance = (a: Vec3, b: Vec3) => norm(sub(a, b));
const finite = (a: Vec3) => [a.x, a.y, a.z].every(Number.isFinite);

export function fixedFeatureLimits() {
  return {
    minimumSweeps: TUNING.phase2.solverIterations,
    maximumSweeps: TUNING.phase2.maximumSolverIterations,
    solverLengthTargetM: TUNING.phase2.solverToleranceM,
    maximumSegmentExcessM: TUNING.physicsDiagnostics.maximumSegmentErrorM,
    maximumSpanExcessM: TUNING.physicsDiagnostics.maximumSpanErrorM,
    maximumContactErrorM: TUNING.physicsDiagnostics.maximumFloorErrorM,
    maximumBodyOverlapM: TUNING.physicsDiagnostics.maximumBodyOverlapM,
  };
}

/** Retains every physical body and all eleven internal material particles per
 * span. Adjacent spans use one shared middle-body index. Default interpolation
 * is a fixture initializer, not a replacement for the runtime's dynamic shape. */
export function makeMaterialChain(bodyPositions: Vec3[], particlesBySpan?: Vec3[][],
  family: Family = 'balanced'): MaterialChain {
  if (bodyPositions.length < 2 || bodyPositions.length > TUNING.hardCap || bodyPositions.some(p => !finite(p))) {
    throw new RangeError('Finite body positions within the existing team cap are required');
  }
  if (!Object.hasOwn(FAMILIES, family)) throw new RangeError('Unknown material family');
  const segments = TUNING.rope.segments, bodyCount = bodyPositions.length;
  if (particlesBySpan && (particlesBySpan.length !== bodyCount - 1
    || particlesBySpan.some(p => p.length !== segments - 1 || p.some(v => !finite(v))))) {
    throw new RangeError('Each span requires exactly the existing internal material particles');
  }
  const positions = bodyPositions.map(p => ({ ...p })), massesKg: number[] = bodyPositions.map(() => TUNING.body.mass);
  const spans: MaterialChain['spans'] = [];
  for (let a = 0; a < bodyCount - 1; a++) {
    const b = a + 1, nodeIds = [a];
    for (let j = 1; j < segments; j++) {
      const p = particlesBySpan?.[a][j - 1] ?? add(bodyPositions[a], scale(sub(bodyPositions[b], bodyPositions[a]), j / segments));
      nodeIds.push(positions.length); positions.push({ ...p }); massesKg.push(TUNING.rope.particleMass);
    }
    nodeIds.push(b); spans.push({ a, b, nodeIds, materialLengthM: FAMILIES[family].ropeLength });
  }
  return { family, bodyCount, positions, massesKg, spans };
}

function compile(problem: FixedFeatureProblem): Constraint[] {
  const { chain, plane } = problem, { bodyCount, positions, massesKg, spans } = chain;
  // Reconstruct the existing topology to reject mutated mass/material/identity,
  // rather than accepting a decorative or whole-team cable representation.
  if (!Number.isInteger(bodyCount) || bodyCount < 2 || bodyCount > TUNING.hardCap) throw new RangeError('A valid physical body count is required');
  const reference = makeMaterialChain(positions.slice(0, bodyCount), undefined, chain.family);
  const sameSpans = spans.length === reference.spans.length && spans.every((span, i) => {
    const expected = reference.spans[i];
    return span.a === expected.a && span.b === expected.b && span.materialLengthM === expected.materialLengthM
      && span.nodeIds.length === expected.nodeIds.length && span.nodeIds.every((id, j) => id === expected.nodeIds[j]);
  });
  if (positions.length !== reference.positions.length || positions.some(p => !finite(p))
    || massesKg.length !== reference.massesKg.length || massesKg.some((m, i) => m !== reference.massesKg[i])
    || !sameSpans) throw new RangeError('The physical material chain topology, masses and lengths must be retained');
  const constraints: Constraint[] = [];
  const materialPairs = new Set<string>();
  for (const span of spans) {
    const segment = span.materialLengthM / TUNING.rope.segments;
    for (let j = 1; j < span.nodeIds.length; j++) {
      const ids: [number, number] = [span.nodeIds[j - 1], span.nodeIds[j]];
      materialPairs.add(`${Math.min(...ids)}:${Math.max(...ids)}`);
      constraints.push({ kind: 'material', ids, maximumM: segment });
    }
    // These are the same valid redundant material-reach bounds as the runtime.
    constraints.push({ kind: 'span', ids: [span.a, span.b], maximumM: span.materialLengthM });
    for (let j = 1; j < span.nodeIds.length - 1; j++) {
      constraints.push({ kind: 'reach', ids: [span.a, span.nodeIds[j]], maximumM: j * segment });
      constraints.push({ kind: 'reach', ids: [span.nodeIds[j], span.b], maximumM: (TUNING.rope.segments - j) * segment });
    }
  }
  const validId = (id: number) => Number.isInteger(id) && id >= 0 && id < positions.length;
  if (plane) {
    const length = norm(plane.normal);
    if (!finite(plane.normal) || !(length > 0) || !Number.isFinite(length) || !Number.isFinite(plane.offsetM)) throw new RangeError('A finite nonzero fixed-plane normal and offset are required');
    // At most one fixed sample per node and per material edge. No discovery loop.
    if (plane.samples.length > positions.length + materialPairs.size) throw new RangeError('Fixed sample count exceeds the material topology');
    const seen = new Set<string>(), normal = scale(plane.normal, 1 / length);
    for (const sample of plane.samples) {
      if (!Number.isFinite(sample.clearanceM) || sample.clearanceM < 0) throw new RangeError('Finite nonnegative clearance is required');
      let ids: number[], weights: number[], key: string;
      if (sample.kind === 'node') {
        if (!validId(sample.node)) throw new RangeError('Invalid contact node');
        ids = [sample.node]; weights = [1]; key = `node:${sample.node}`;
      } else {
        key = `${Math.min(sample.a, sample.b)}:${Math.max(sample.a, sample.b)}`;
        if (!validId(sample.a) || !validId(sample.b) || sample.a === sample.b || !materialPairs.has(key)
          || !Number.isFinite(sample.fraction) || sample.fraction < 0 || sample.fraction > 1) throw new RangeError('A fixed barycentric sample on an existing material edge is required');
        ids = [sample.a, sample.b]; weights = [1 - sample.fraction, sample.fraction]; key = `edge:${key}`;
      }
      if (seen.has(key)) throw new RangeError('Duplicate fixed contact sample');
      seen.add(key); constraints.push({ kind: 'plane', ids, weights, normal, offsetM: plane.offsetM + sample.clearanceM });
    }
  }
  const pins = problem.fixedBodies ?? [], pinned = new Set<number>();
  if (pins.length > bodyCount) throw new RangeError('Too many fixed bodies');
  for (const pin of pins) {
    if (!Number.isInteger(pin.body) || pin.body < 0 || pin.body >= bodyCount || !finite(pin.position)
      || pinned.has(pin.body)) throw new RangeError('A unique physical body is required for each fixed boundary');
    pinned.add(pin.body); constraints.push({ kind: 'pin', ids: [pin.body], position: { ...pin.position } });
  }
  return constraints;
}

/** Exact mass-metric projection of a unilateral distance ball. Returns new
 * positions; a slack edge is unchanged. No restricted-axis approximation. */
export function projectMaterialPair(a: Vec3, b: Vec3, massA: number, massB: number, maximumM: number): [Vec3, Vec3] {
  if (!finite(a) || !finite(b) || ![massA, massB].every(m => Number.isFinite(m) && m > 0)
    || !Number.isFinite(maximumM) || maximumM <= 0) throw new RangeError('Finite positions, positive physical masses and material length are required');
  const separation = sub(b, a), d = norm(separation);
  if (d <= maximumM) return [{ ...a }, { ...b }];
  const direction = scale(separation, 1 / d), lambda = (d - maximumM) / (1 / massA + 1 / massB);
  return [add(a, scale(direction, lambda / massA)), sub(b, scale(direction, lambda / massB))];
}

function project(constraint: Constraint, shifted: Vec3[], massesKg: number[]): Vec3[] {
  if (constraint.kind === 'pin') return [{ ...constraint.position }];
  if (constraint.kind !== 'plane') return projectMaterialPair(shifted[0], shifted[1],
    massesKg[constraint.ids[0]], massesKg[constraint.ids[1]], constraint.maximumM);
  const distanceToPlane = shifted.reduce((sum, p, j) => sum + constraint.weights[j] * dot(constraint.normal, p), 0);
  const deficit = Math.max(0, constraint.offsetM - distanceToPlane);
  const inverseMass = constraint.ids.reduce((sum, id, j) => sum + constraint.weights[j] ** 2 / massesKg[id], 0);
  return shifted.map((p, j) => add(p, scale(constraint.normal, deficit * constraint.weights[j] / (inverseMass * massesKg[constraint.ids[j]]))));
}

/** One projector exposed only for algebraic falsifiers. Its output is NOT an
 * accepted coupled state. Constraint order: material, span/reach, plane, pins. */
export function projectOneFixedConstraint(problem: FixedFeatureProblem, constraintIndex: number, positions = problem.chain.positions) {
  const constraints = compile(problem), constraint = constraints[constraintIndex];
  if (!constraint || positions.length !== problem.chain.positions.length || positions.some(p => !finite(p))) throw new RangeError('Valid constraint index and positions are required');
  const result = positions.map(p => ({ ...p }));
  const projected = project(constraint, constraint.ids.map(id => positions[id]), problem.chain.massesKg);
  constraint.ids.forEach((id, j) => { result[id] = projected[j]; });
  return result;
}

function residuals(problem: FixedFeatureProblem, constraints: Constraint[], positions: Vec3[]) {
  const limits = fixedFeatureLimits();
  const values = constraints.map(constraint => {
    if (constraint.kind === 'pin') return distance(positions[constraint.ids[0]], constraint.position);
    if (constraint.kind === 'plane') return Math.max(0, constraint.offsetM
      - constraint.ids.reduce((sum, id, j) => sum + constraint.weights[j] * dot(constraint.normal, positions[id]), 0));
    // Actual nonlinear endpoint distance, never a stale linearized residual.
    return Math.max(0, distance(positions[constraint.ids[0]], positions[constraint.ids[1]]) - constraint.maximumM);
  });
  const maximum = (kind: Constraint['kind']) => Math.max(0, ...values.filter((_, i) => constraints[i].kind === kind));
  const maximumSegmentExcessM = maximum('material'), maximumSpanExcessM = maximum('span');
  const maximumReachExcessM = maximum('reach'), maximumContactErrorM = maximum('plane'), maximumFixedBodyErrorM = maximum('pin');
  let maximumBodyOverlapM = 0;
  for (let a = 0; a < problem.chain.bodyCount; a++) for (let b = a + 1; b < problem.chain.bodyCount; b++) {
    const p = positions[a], q = positions[b];
    maximumBodyOverlapM = Math.max(maximumBodyOverlapM, Math.min(TUNING.body.width - Math.abs(p.x - q.x),
      TUNING.body.height - Math.abs(p.y - q.y), TUNING.body.depth - Math.abs(p.z - q.z)));
  }
  const finiteState = positions.every(finite) && values.every(Number.isFinite) && Number.isFinite(maximumBodyOverlapM);
  const solverLengthTargetSatisfied = Math.max(maximumSegmentExcessM, maximumSpanExcessM, maximumReachExcessM) <= limits.solverLengthTargetM;
  const physicalGeometricCeilingsSatisfied = maximumSegmentExcessM <= limits.maximumSegmentExcessM
    && maximumSpanExcessM <= limits.maximumSpanExcessM && maximumContactErrorM <= limits.maximumContactErrorM
    && maximumFixedBodyErrorM <= limits.maximumContactErrorM && maximumBodyOverlapM <= limits.maximumBodyOverlapM;
  return { finite: finiteState, maximumSegmentExcessM, maximumSpanExcessM, maximumReachExcessM,
    maximumContactErrorM, maximumFixedBodyErrorM, maximumBodyOverlapM,
    solverLengthTargetSatisfied, physicalGeometricCeilingsSatisfied,
    acceptableGeometry: finiteState && solverLengthTargetSatisfied && physicalGeometricCeilingsSatisfied,
    constraints: constraints.map((constraint, i) => ({ kind: constraint.kind, nodeIds: [...constraint.ids], residualM: values[i] })) };
}

export function validateFixedFeatureState(problem: FixedFeatureProblem, positions: Vec3[]) {
  if (positions.length !== problem.chain.positions.length) throw new RangeError('All material positions are required');
  return residuals(problem, compile(problem), positions);
}

/** Mass-weighted Dykstra: x <- P_C^M(x+p_C), p_C <- x_old+p_C-x.
 * Correction memory is a position-space optimization variable, NOT measured
 * rope tension, passive reaction, force or impulse. Exact local projections do
 * not imply finite-budget coupled convergence or certify the global minimizer.
 * Working iterates may worsen other edges; none is published as an accepted
 * candidate until the complete actual residual gate passes. */
export function solveFixedFeatureFeasibility(problem: FixedFeatureProblem) {
  const constraints = compile(problem), limits = fixedFeatureLimits();
  const positions = problem.chain.positions.map(p => ({ ...p }));
  const corrections = constraints.map(c => c.ids.map(zero));
  let validation = residuals(problem, constraints, positions), sweeps = 0, projections = 0, residualChecks = 1;
  const trace: { sweep: number; maximumSegmentExcessM: number; maximumSpanExcessM: number; maximumReachExcessM: number;
    maximumContactErrorM: number; maximumFixedBodyErrorM: number; maximumBodyOverlapM: number; maximumSweepMoveM: number; acceptableGeometry: boolean }[] = [];
  let arithmeticFailure = false;
  for (; sweeps < limits.maximumSweeps;) {
    const before = positions.map(p => ({ ...p }));
    for (let c = 0; c < constraints.length; c++) {
      const constraint = constraints[c], shifted = constraint.ids.map((id, j) => add(positions[id], corrections[c][j]));
      if (shifted.some(p => !finite(p))) { arithmeticFailure = true; break; }
      const projected = project(constraint, shifted, problem.chain.massesKg); projections++;
      const nextCorrections = projected.map((p, j) => sub(shifted[j], p));
      if (projected.some(p => !finite(p)) || nextCorrections.some(p => !finite(p))) { arithmeticFailure = true; break; }
      constraint.ids.forEach((id, j) => { positions[id] = projected[j]; });
      corrections[c] = nextCorrections;
    }
    sweeps++; validation = residuals(problem, constraints, positions); residualChecks++;
    const { maximumSegmentExcessM, maximumSpanExcessM, maximumReachExcessM, maximumContactErrorM,
      maximumFixedBodyErrorM, maximumBodyOverlapM, acceptableGeometry } = validation;
    trace.push({ sweep: sweeps, maximumSegmentExcessM, maximumSpanExcessM, maximumReachExcessM, maximumContactErrorM,
      maximumFixedBodyErrorM, maximumBodyOverlapM, maximumSweepMoveM: Math.max(...positions.map((p, i) => distance(p, before[i]))), acceptableGeometry });
    if (arithmeticFailure || !validation.finite || sweeps >= limits.minimumSweeps && acceptableGeometry) break;
  }
  const accepted = !arithmeticFailure && validation.acceptableGeometry && sweeps >= limits.minimumSweeps;
  return {
    status: accepted ? 'geometrically-feasible' as const : 'bounded-failure' as const,
    failureReason: accepted ? null : arithmeticFailure || !validation.finite ? 'nonfinite-arithmetic' as const : 'iteration-budget-exhausted' as const,
    acceptedPositions: accepted ? positions.map(p => ({ ...p })) : null,
    // Diagnostic only. On failure, this must not be treated as an accepted state.
    lastWorkingPositions: positions, validation, trace, limits,
    work: { sweeps, projections, residualChecks, constraintsPerSweep: constraints.length,
      maximumProjections: limits.maximumSweeps * constraints.length,
      maximumResidualChecks: limits.maximumSweeps + 1 },
    massMetricObjectiveKgM2: problem.chain.massesKg.reduce((sum, m, i) => sum + m / 2 * distance(positions[i], problem.chain.positions[i]) ** 2, 0),
    massMetricOptimalityCertified: false as const,
    dynamicsEnergyFrictionQualified: false as const,
  };
}
