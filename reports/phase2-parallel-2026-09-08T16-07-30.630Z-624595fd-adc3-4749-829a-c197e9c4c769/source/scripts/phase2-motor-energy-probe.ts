/** Read-only observation of the pinned diagnostic engine. Fixture positions enter
 * rigid-body descriptors before bodies/harnesses/rope are constructed. No mechanics
 * source, solver parameter, impulse or post-start position is changed. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import RAPIER from '@dimforge/rapier3d-compat';
import { initializePhysics, type BelaySimulation } from '../shared/simulation';
import type { Move, Vec3, PhysicalDiagnostics, TerrainState } from '../shared/protocol';
import type { Contact } from '../shared/contact-geometry';
import { impulseAccounting, kineticBudget } from './physics-budget-diagnostics';
import casesFile from '../tests/fixtures/phase2-motor-energy-cases.json';
import { FAMILIES } from '../tuning';

const baseline = 'f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1';
type Case = typeof casesFile.cases[number];
type SimClass = typeof import('../shared/simulation').BelaySimulation;
type Profile = typeof import('../tuning').TUNING;
type Span = { id: number; nodes: number[] };
type Engine = {
  nodes: Vec3[]; previous: Vec3[]; contacts: Contact[]; diagnostics: PhysicalDiagnostics;
  nodeNormals: Vec3[][]; brace: boolean[];
  terrain: { state: TerrainState }; spans: Span[]; substep: (inputs: Move[]) => void;
  routeRope: () => void; updateSpans: (dt: number) => void;
  constrain: (span: Span, a: number, b: number, maximum: number, traction: number[], delta: Vec3[], dt: number) => void;
};
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const core = (sim: BelaySimulation) => (sim as unknown as { engine: Engine }).engine;
const physical = (sim: BelaySimulation) => { const state = sim.snapshot(); state.serverTime = 0; return state; };

export function construct(Sim: SimClass, fixture: Case) {
  // The wrapper forwards the actual World receiver via original.call(this, ...).
  // eslint-disable-next-line typescript/unbound-method
  const original = RAPIER.World.prototype.createRigidBody;
  let created = 0;
  RAPIER.World.prototype.createRigidBody = function (description) {
    const p = fixture.positions[created++]; assert(p, 'Unexpected body in fixture construction');
    description.setTranslation(p.x, p.y, p.z);
    return original.call(this, description);
  };
  let sim: BelaySimulation;
  try { sim = new Sim({ scene: 'rescue', playerCount: fixture.spec.n, seed: 1701, family: 'balanced', tickHz: 60 }); }
  finally { RAPIER.World.prototype.createRigidBody = original; }
  assert.equal(created, fixture.spec.n);
  const terrain = core(sim).terrain.state;
  terrain.ice = fixture.spec.surface === 'ice' ? [{ ...terrain.bounds, id: 0 }] : [];
  return sim;
}

export function inputsFor(fixture: Case, sim: BelaySimulation): Move[] {
  const state = sim.snapshot(), gap = state.terrain.crevasses[0];
  return state.players.map(player => {
    const held = fixture.spec.policy === 'idle-casualty' ? player.id === fixture.spec.casualty : player.id !== fixture.spec.casualty;
    if (held) return { x: 0, z: 0, brace: fixture.spec.policy === 'static-helpers' };
    if (player.id === fixture.spec.casualty || player.support !== 'ground') {
      if (player.support === 'ground' && state.incidents.some(i => i.playerIds.includes(player.id))) return { x: 0, z: 0, brace: true };
      return { x: 0, z: -1, brace: false }; // Both bounded cases select the near bank.
    }
    if (state.tick / state.tickHz < fixture.catchSeconds) return { x: 0, z: 0, brace: true };
    return { x: 0, z: player.position.z < (gap.minZ + gap.maxZ) / 2 ? -1 : 1, brace: false };
  });
}

function energy(sim: BelaySimulation, p: Profile) {
  const e = core(sim), dt = 1 / p.physicsHz;
  const bodies = sim.bodies.map(b => ({ position: { ...b.translation() }, velocity: { ...b.linvel() } }));
  let initialOrderJ = bodies.reduce((sum, b) => sum + p.body.mass / 2 * dot(b.velocity, b.velocity) + p.body.mass * p.gravity * b.position.y, 0);
  let ropeKineticJ = 0, ropePotentialJ = 0, maximumRopeSpeedMps = 0;
  for (let id = sim.playerCount; id < e.nodes.length; id++) {
    const d = distance(e.nodes[id], e.previous[id]);
    ropeKineticJ += p.rope.particleMass * d ** 2 / (2 * dt * dt);
    ropePotentialJ += p.rope.particleMass * p.gravity * e.nodes[id].y;
    initialOrderJ += p.rope.particleMass * (d ** 2 / (2 * dt * dt) + p.gravity * e.nodes[id].y);
    maximumRopeSpeedMps = Math.max(maximumRopeSpeedMps, d / dt);
  }
  const bodyKineticJ = bodies.reduce((sum, b) => sum + p.body.mass / 2 * dot(b.velocity, b.velocity), 0);
  const bodyPotentialJ = bodies.reduce((sum, b) => sum + p.body.mass * p.gravity * b.position.y, 0);
  return { bodies, bodyKineticJ, bodyPotentialJ, ropeKineticJ, ropePotentialJ, maximumRopeSpeedMps,
    initialOrderJ, totalJ: bodyKineticJ + bodyPotentialJ + ropeKineticJ + ropePotentialJ };
}
type Energy = ReturnType<typeof energy>;
type Motor = ReturnType<typeof impulseAccounting> & { player: number; contact: string; input: Move; before: Vec3; desired: Vec3;
  normalForceN: number; lateralForceN: number; actuatedWall: boolean };
type Constraint = { a: number; b: number; beforeA: Vec3; beforeB: Vec3; afterA: Vec3; afterB: Vec3;
  normalsA: Vec3[]; normalsB: Vec3[]; mobilityA: Vec3; mobilityB: Vec3; direction: Vec3;
  beforeDistanceM: number; afterDistanceM: number; denominatorPerKg: number; lambdaKgM: number };
type Motion = { node: number; body: boolean; distanceM: number; before: Vec3; after: Vec3; span?: number; constraintLengthM?: number; constraint?: Constraint };
type Budget = ReturnType<typeof kineticBudget> & { bodyKineticJ: number; ropeKineticJ: number; bodyPotentialJ: number; ropePotentialJ: number; maximumRopeSpeedMps: number };
type Step = { tick: number; initial: Energy; inputs: Move[]; motorWorkJ: number; motors: Motor[]; projectionCountBefore: number;
  afterRapier?: Energy; beforeBudget?: Budget; phase: 'motor' | 'projection';
  largestConstraintMove?: Motion; largestRouteMove?: Motion; maximumCommittedBodySpeedMps: number;
  contacts: { player: number; normal: Vec3; normalImpulseNs: number; tangentImpulseMagnitudeSumNs: number }[] };
type Witness = Step & { after: Energy; postProjectionResidualJ: number; diagnostics: PhysicalDiagnostics;
  bodyCorrections: { player: number; from: Vec3; to: Vec3; displacementM: number }[] };

export function observe(sim: BelaySimulation, p: Profile) {
  const e = core(sim), dt = 1 / p.physicsHz;
  let step: Step | undefined;
  const rows: unknown[] = [];
  let largestHorizontal: (Motor & { tick: number; contacts: Step['contacts'] }) | undefined;
  let largestRemoval: Witness | undefined, largestPotential: Witness | undefined, largestRoute: Witness | undefined, largestConstraint: Witness | undefined;
  let maximumRemovalJ = 0, maximumResidualJ = -Infinity, maximumRouteM = 0, maximumConstraintM = 0, wallActuations = 0;
  let maximumBudgetDiagnosticErrorJ = 0, maximumMotorWorkErrorJ = 0;
  const wallActuationsByPlayer = Array(sim.playerCount).fill(0);
  let maximumWallNormalForceN = 0, maximumWallTangentialForceN = 0, maximumIdleWallImpulseNs = 0;
  function budget() {
    assert(step); if (step.beforeBudget) return;
    const actual = energy(sim, p), d = e.diagnostics;
    step.beforeBudget = { ...kineticBudget(step.initial.initialOrderJ, step.motorWorkJ, p.phase2.energyToleranceJ,
      d.potentialEnergyJ + actual.ropePotentialJ, d.kineticEnergyJ + actual.ropeKineticJ),
      bodyKineticJ: d.kineticEnergyJ, ropeKineticJ: actual.ropeKineticJ, bodyPotentialJ: d.potentialEnergyJ,
      ropePotentialJ: actual.ropePotentialJ, maximumRopeSpeedMps: actual.maximumRopeSpeedMps };
  }
  sim.bodies.forEach((body, player) => {
    const original = body.setLinvel.bind(body);
    body.setLinvel = (desired, wake) => {
      assert(step);
      if (step.phase === 'motor') {
        const before = { ...body.linvel() }, input = step.inputs[player], contact = e.contacts[player];
        const account = impulseAccounting(before, desired, p.body.mass, dt), normalForceN = dot(account.forceN, contact.normal);
        const motor = { ...account, player, input: { ...input }, contact: contact.support, before, desired: { ...desired }, normalForceN,
          lateralForceN: Math.hypot(account.forceN.x - normalForceN * contact.normal.x, account.forceN.z - normalForceN * contact.normal.z),
          actuatedWall: contact.support === 'wall' && !!(input.brace || input.x || input.z) };
        step.motors.push(motor); step.motorWorkJ += account.workJ;
        if (motor.actuatedWall) {
          wallActuations++; wallActuationsByPlayer[player]++;
          maximumWallNormalForceN = Math.max(maximumWallNormalForceN, Math.abs(motor.normalForceN));
          maximumWallTangentialForceN = Math.max(maximumWallTangentialForceN, Math.hypot(motor.lateralForceN, motor.forceN.y));
        } else if (contact.support === 'wall') maximumIdleWallImpulseNs = Math.max(maximumIdleWallImpulseNs,
          Math.hypot(motor.forceN.x, motor.forceN.y, motor.forceN.z) * dt);
      } else if (e.diagnostics.energyProjectionCount > step.projectionCountBefore) budget();
      else step.maximumCommittedBodySpeedMps = Math.max(step.maximumCommittedBodySpeedMps, Math.hypot(desired.x, desired.y, desired.z));
      original(desired, wake);
    };
  });
  const worldStep = sim.world.step.bind(sim.world);
  sim.world.step = (...args) => {
    worldStep(...args); assert(step); step.afterRapier = energy(sim, p); step.phase = 'projection';
    for (let player = 0; player < sim.playerCount; player++) {
      const collider = sim.bodies[player].collider(0);
      sim.world.contactPairsWith(collider, other => sim.world.contactPair(collider, other, manifold => {
        let normalImpulseNs = 0, tangentImpulseMagnitudeSumNs = 0;
        for (let j = 0; j < manifold.numContacts(); j++) { normalImpulseNs += manifold.contactImpulse(j);
          tangentImpulseMagnitudeSumNs += Math.hypot(manifold.contactTangentImpulseX(j), manifold.contactTangentImpulseY(j)); }
        if (normalImpulseNs || tangentImpulseMagnitudeSumNs) step!.contacts.push({ player, normal: { ...manifold.normal() }, normalImpulseNs, tangentImpulseMagnitudeSumNs });
      }));
    }
  };
  const constrain = e.constrain.bind(e);
  e.constrain = (span, a, b, maximum, traction, delta, h) => {
    const beforeA = { ...e.nodes[a] }, beforeB = { ...e.nodes[b] };
    const tractionA = traction[a], tractionB = traction[b];
    constrain(span, a, b, maximum, traction, delta, h); assert(step);
    for (const [node, before] of [[a, beforeA], [b, beforeB]] as const) {
      const d = distance(before, e.nodes[node]);
      if (d > (step.largestConstraintMove?.distanceM ?? 0)) {
        // Reconstruct the existing linearized solve only for a new peak. These
        // observed values never feed back into the engine or alter its arguments.
        const beforeDistanceM = distance(beforeA, beforeB);
        const direction = { x: (beforeB.x - beforeA.x) / beforeDistanceM,
          y: (beforeB.y - beforeA.y) / beforeDistanceM, z: (beforeB.z - beforeA.z) / beforeDistanceM };
        const axes = ['x', 'y', 'z'] as const;
        const mobility = (id: number, sign: number, availableTraction: number) => {
          const mass = id < sim.playerCount ? p.body.mass : p.rope.particleMass;
          const w = { x: 1 / mass, y: 1 / mass, z: 1 / mass };
          if (id < sim.playerCount && e.brace[id] && e.contacts[id].support === 'ground' && availableTraction > 0) {
            w.x /= FAMILIES[sim.family].braceMassMultiplier; w.z /= FAMILIES[sim.family].braceMassMultiplier;
          }
          for (const normal of e.nodeNormals[id]) if (sign * dot(direction, normal) < 0)
            for (const axis of axes) if (normal[axis]) w[axis] = 0;
          return { mass, w };
        };
        const A = mobility(a, 1, tractionA), B = mobility(b, -1, tractionB);
        const denominator = () => axes.reduce((sum, axis) => sum + direction[axis] ** 2 * (A.w[axis] + B.w[axis]), 0);
        let denominatorPerKg = denominator(), lambdaKgM = denominatorPerKg ? (beforeDistanceM - maximum) / denominatorPerKg : 0;
        const demand = ({ mass, w }: typeof A) => lambdaKgM * mass / h * Math.hypot(
          direction.x * (w.x ? 1 / mass - w.x : 0), direction.z * (w.z ? 1 / mass - w.z : 0));
        if (a < sim.playerCount && demand(A) > tractionA || b < sim.playerCount && demand(B) > tractionB) {
          for (const item of [A, B]) for (const axis of axes) if (item.w[axis]) item.w[axis] = 1 / item.mass;
          denominatorPerKg = denominator(); lambdaKgM = denominatorPerKg ? (beforeDistanceM - maximum) / denominatorPerKg : 0;
        }
        step.largestConstraintMove = { node, body: node < sim.playerCount,
          distanceM: d, before, after: { ...e.nodes[node] }, span: span.id, constraintLengthM: maximum,
          constraint: { a, b, beforeA, beforeB, afterA: { ...e.nodes[a] }, afterB: { ...e.nodes[b] },
            normalsA: e.nodeNormals[a].map(n => ({ ...n })), normalsB: e.nodeNormals[b].map(n => ({ ...n })),
            mobilityA: A.w, mobilityB: B.w, direction, beforeDistanceM, afterDistanceM: distance(e.nodes[a], e.nodes[b]), denominatorPerKg, lambdaKgM } };
      }
    }
  };
  const route = e.routeRope.bind(e);
  const prior = e.nodes.map(v => ({ ...v }));
  e.routeRope = () => {
    for (let i = 0; i < e.nodes.length; i++) Object.assign(prior[i], e.nodes[i]);
    route(); assert(step);
    for (let node = 0; node < e.nodes.length; node++) {
      const d = distance(prior[node], e.nodes[node]);
      if (d > (step.largestRouteMove?.distanceM ?? 0)) step.largestRouteMove = { node, body: node < sim.playerCount, distanceM: d,
        before: { ...prior[node] }, after: { ...e.nodes[node] } };
    }
  };
  const update = e.updateSpans.bind(e);
  e.updateSpans = h => { budget(); update(h); };
  const substep = e.substep.bind(e);
  e.substep = inputs => {
    const motorBefore = e.diagnostics.motorWorkJ;
    step = { tick: sim.tick + 1, initial: energy(sim, p), inputs: inputs.map(v => ({ ...v })), motorWorkJ: 0, motors: [],
      projectionCountBefore: e.diagnostics.energyProjectionCount, phase: 'motor', maximumCommittedBodySpeedMps: 0, contacts: [] };
    substep(inputs);
    if (!step.beforeBudget) return; // Existing terminal-boundary early return performs no integration.
    const after = energy(sim, p), b = step.beforeBudget;
    const residualJ = after.totalJ - (step.initial.initialOrderJ + step.motorWorkJ + p.phase2.energyToleranceJ);
    const witness = { ...step, after, postProjectionResidualJ: residualJ, diagnostics: { ...e.diagnostics },
      bodyCorrections: after.bodies.map((body, id) => ({ player: id,
        from: step!.afterRapier!.bodies[id].position, to: body.position,
        displacementM: distance(body.position, step!.afterRapier!.bodies[id].position) })) };
    rows.push({ tick: step.tick, initialEnergyJ: step.initial.initialOrderJ, motorWorkJ: step.motorWorkJ,
      ...b, postProjectionEnergyJ: after.totalJ, postProjectionResidualJ: residualJ,
      maximumCommittedBodySpeedMps: step.maximumCommittedBodySpeedMps,
      maximumPostProjectionBodySpeedMps: Math.max(...after.bodies.map(v => Math.hypot(v.velocity.x, v.velocity.y, v.velocity.z))),
      largestConstraintMoveM: step.largestConstraintMove?.distanceM ?? 0, largestRouteMoveM: step.largestRouteMove?.distanceM ?? 0 });
    for (const motor of step.motors) if (motor.actuatedWall && motor.horizontalForceN > (largestHorizontal?.horizontalForceN ?? -1)) {
      largestHorizontal = { ...motor, tick: step.tick, contacts: step.contacts.filter(c => c.player === motor.player) };
    }
    if (b.removedJ > maximumRemovalJ) { maximumRemovalJ = b.removedJ; largestRemoval = witness; }
    if (residualJ > maximumResidualJ) { maximumResidualJ = residualJ; largestPotential = witness; }
    if ((step.largestRouteMove?.distanceM ?? 0) > maximumRouteM) { maximumRouteM = step.largestRouteMove!.distanceM; largestRoute = witness; }
    if ((step.largestConstraintMove?.distanceM ?? 0) > maximumConstraintM) { maximumConstraintM = step.largestConstraintMove!.distanceM; largestConstraint = witness; }
    maximumBudgetDiagnosticErrorJ = Math.max(maximumBudgetDiagnosticErrorJ, Math.abs(maximumRemovalJ - e.diagnostics.maximumEnergyProjectionJ));
    maximumMotorWorkErrorJ = Math.max(maximumMotorWorkErrorJ, Math.abs(step.motorWorkJ - (e.diagnostics.motorWorkJ - motorBefore)));
  };
  return () => ({ rows, wallActuations, wallActuationsByPlayer, maximumWallNormalForceN, maximumWallTangentialForceN, maximumIdleWallImpulseNs, largestHorizontal, largestRemoval, largestPotential, largestRoute, largestConstraint,
    maximumRemovalJ, maximumResidualJ, maximumRouteM, maximumConstraintM, maximumBudgetDiagnosticErrorJ, maximumMotorWorkErrorJ });
}

function run(Sim: SimClass, fixture: Case, profile: Profile, observed: boolean) {
  const sim = construct(Sim, fixture), finish = observed ? observe(sim, profile) : undefined;
  const inputHash = createHash('sha256'); const samples: string[] = [];
  let inputs: Move[] = [], nextDecision = 0;
  const started = performance.now();
  try {
    for (let tick = 0; tick < fixture.horizonSeconds * profile.physicsHz; tick++) {
      if (tick >= nextDecision) { inputs = inputsFor(fixture, sim); nextDecision += fixture.decisionSeconds * profile.physicsHz; }
      inputHash.update(JSON.stringify(inputs)); inputHash.update('\n'); sim.step(inputs);
      const state = physical(sim); samples.push(hash(state));
      if (state.run.status === 'failed' || state.incidents.length && state.incidents.every(i => i.status === 'recovered')) break;
      if (performance.now() - started > 120_000) throw new Error('Bounded diagnostic case exceeded 120 seconds.');
    }
    return { final: physical(sim), samples, inputSha256: inputHash.digest('hex'), observation: finish?.() };
  } finally { sim.dispose(); }
}

async function main() {
  mkdirSync('work', { recursive: true }); mkdirSync('reports', { recursive: true }); await initializePhysics();
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline, 'shared', 'tuning.ts'], { encoding: 'utf8' }).trim().split('\n');
  const results: unknown[] = [];
  for (const wall of [450, 900]) {
    const dir = mkdtempSync(resolve('work/motor-energy-baseline-'));
    try {
      for (const file of files) {
        mkdirSync(resolve(dir, file, '..'), { recursive: true });
        let source = execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' });
        if (file === 'tuning.ts') source = source.replace(/wallNormalEffortN: \d+/, `wallNormalEffortN: ${wall}`);
        writeFileSync(join(dir, file), source);
      }
      const { BelaySimulation: Sim } = await import(pathToFileURL(join(dir, 'shared/simulation.ts')).href) as typeof import('../shared/simulation');
      const { TUNING } = await import(pathToFileURL(join(dir, 'tuning.ts')).href) as typeof import('../tuning');
      assert.equal(TUNING.phase2.wallNormalEffortN, wall);
      for (const fixture of casesFile.cases) {
        const plain = run(Sim, fixture, TUNING, false), traced = run(Sim, fixture, TUNING, true);
        assert.deepStrictEqual(traced.samples, plain.samples, 'Observation changed an intermediate physical snapshot');
        assert.deepStrictEqual(traced.final, plain.final, 'Observation changed final state'); assert.equal(traced.inputSha256, plain.inputSha256);
        if (wall === 450) {
          assert.equal(traced.inputSha256, fixture.sourceInputSha256, 'Original re-cut input digest changed');
          assert.equal(traced.final.diagnostics.maximumEnergyProjectionJ, fixture.sourceDiagnostics.maximumEnergyProjectionJ);
          assert.equal(traced.final.diagnostics.maximumPotentialExcessJ, fixture.sourceDiagnostics.maximumPotentialExcessJ);
        }
        results.push({ row: fixture.row, wallNormalEffortN: wall, spec: fixture.spec, fixture: fixture.positions,
          exactObservationSnapshots: traced.samples.length, inputSha256: traced.inputSha256, final: traced.final, ...traced.observation });
        console.log(JSON.stringify({ row: fixture.row, wall, ticks: traced.final.tick, exactSnapshots: traced.samples.length,
          wallActuations: traced.observation?.wallActuations, maximumHorizontalForceN: traced.observation?.largestHorizontal?.horizontalForceN ?? 0,
          maximumRemovalJ: traced.observation?.maximumRemovalJ, maximumResidualJ: traced.observation?.maximumResidualJ,
          budgetReconstructionErrorJ: traced.observation?.maximumBudgetDiagnosticErrorJ }));
        writeFileSync('work/phase2-motor-energy-progress.json', JSON.stringify(results, null, 2));
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  writeFileSync('reports/phase2-motor-energy.json', JSON.stringify({ baseline, runtime: process.version,
    construction: 'Existing recorded initial positions set on rigid-body descriptors before construction; initial ice geometry set before the first step. No post-start teleport or mechanics source patch.',
    observation: 'Wrappers call each original method once with original arguments. Every intermediate and final snapshot is equal to an unobserved control, excluding only serverTime.',
    limitations: 'Rapier manifold impulses are sampled immediately after its step; they exclude subsequent custom rope/contact projection. No normal-force attribution is inferred from a total velocity residual.',
    casesSourceSha256: casesFile.sourceReportSha256, results }, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
