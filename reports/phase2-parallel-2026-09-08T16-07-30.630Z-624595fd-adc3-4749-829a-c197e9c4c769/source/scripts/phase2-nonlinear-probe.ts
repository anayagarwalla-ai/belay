/** One-candidate comparison. Run with the recorded nonlinear candidate applied
 * to this checkout. The historical engine is exported into disposable modules;
 * both engines receive the same baseline-generated inputs and fixed horizon. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initializePhysics } from '../shared/simulation';
import { penetration, sweepBox, type Solid } from '../shared/contact-geometry';
import type { Move, Vec3, SceneOptions } from '../shared/protocol';
import { construct, inputsFor, observe } from './phase2-motor-energy-probe';
import casesFile from '../tests/fixtures/phase2-motor-energy-cases.json';
import recoveryTapes from '../tests/fixtures/phase2-recovery-counterexamples.json';

const baseline = 'f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1';
type SimClass = typeof import('../shared/simulation').BelaySimulation;
type Profile = typeof import('../tuning').TUNING;
type Case = { id: string; fixture?: typeof casesFile.cases[number]; options?: SceneOptions; inputs: Move[][] };
type Engine = { nodes: Vec3[]; spans: { nodes: number[] }[]; terrain: { solids: Solid[] };
  constrain: (span: unknown, a: number, b: number, maximum: number, traction: number[], delta: Vec3[], dt: number) => void };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const constructCase = (Sim: SimClass, c: Case) => c.fixture ? construct(Sim, c.fixture) : new Sim(c.options);

function inputPlan(Sim: SimClass, fixture: typeof casesFile.cases[number], p: Profile): Case {
  const sim = construct(Sim, fixture), inputs: Move[][] = [];
  let held: Move[] = [];
  try {
    for (let tick = 0; tick < fixture.horizonSeconds * p.physicsHz; tick++) {
      if (tick % (fixture.decisionSeconds * p.physicsHz) === 0) held = inputsFor(fixture, sim);
      inputs.push(held.map(v => ({ ...v }))); sim.step(held);
      const state = sim.snapshot();
      if (state.run.status === 'failed' || state.incidents.length && state.incidents.every(i => i.status === 'recovered')) break;
    }
  } finally { sim.dispose(); }
  return { id: `row${fixture.row}`, fixture, inputs };
}

function run(Sim: SimClass, c: Case, p: Profile, traced: boolean) {
  const sim = constructCase(Sim, c), e = (sim as unknown as { engine: Engine }).engine;
  const finish = traced ? observe(sim, p) : undefined;
  const snapshots: string[] = [];
  const half = { x: p.rope.radius, y: p.rope.radius, z: p.rope.radius };
  let maxNodePenetrationM = 0, maxInteriorPenetrationM = 0, maxBodyPenetrationM = 0, maximumConstraintDistanceIncreaseM = 0,
    increasingConstraintCalls = 0, constraintCalls = 0, maximumBodyCorrectionM = 0, maximumRawBodySpeedMps = 0;
  let constraintWitness: unknown, contactWitness: unknown, bodyCorrectionWitness: unknown;
  let predicted: Vec3[] = [];
  const started = performance.now();
  if (traced) {
    const constrain = e.constrain.bind(e);
    e.constrain = (span, a, b, maximum, traction, delta, h) => {
      const beforeA = { ...e.nodes[a] }, beforeB = { ...e.nodes[b] }, beforeDistanceM = distance(beforeA, beforeB);
      constrain(span, a, b, maximum, traction, delta, h);
      if (beforeDistanceM <= maximum) return;
      constraintCalls++;
      const afterDistanceM = distance(e.nodes[a], e.nodes[b]), increase = afterDistanceM - beforeDistanceM;
      if (increase > 1e-9) increasingConstraintCalls++; // Numerical comparison only, not a length/contact acceptance ceiling.
      if (increase > maximumConstraintDistanceIncreaseM) {
        maximumConstraintDistanceIncreaseM = increase;
        constraintWitness = { tick: sim.tick + 1, a, b, maximum, beforeA, beforeB,
          afterA: { ...e.nodes[a] }, afterB: { ...e.nodes[b] }, beforeDistanceM, afterDistanceM };
      }
    };
    const worldStep = sim.world.step.bind(sim.world);
    sim.world.step = (...args) => { worldStep(...args); predicted = sim.bodies.map(b => ({ ...b.translation() })); };
    // Capture the actual pre-budget velocity setter; the shared observer records
    // the same quantity per tick but deliberately keeps its row array opaque.
    for (const body of sim.bodies) {
      const setLinvel = body.setLinvel.bind(body);
      body.setLinvel = (v, wake) => {
        if (predicted.length) maximumRawBodySpeedMps = Math.max(maximumRawBodySpeedMps, Math.hypot(v.x, v.y, v.z));
        setLinvel(v, wake);
      };
    }
  }
  try {
    for (const input of c.inputs) {
      predicted = []; sim.step(input);
      const state = sim.snapshot(); state.serverTime = 0;
      snapshots.push(hash(JSON.stringify(state)));
      if (traced) {
        const bodyHalf = { x: p.body.width / 2, y: p.body.height / 2, z: p.body.depth / 2 };
        for (const player of state.players) for (const solid of e.terrain.solids)
          maxBodyPenetrationM = Math.max(maxBodyPenetrationM, penetration(player.position, bodyHalf, solid)?.depth ?? 0);
        for (const player of state.players) if (predicted[player.id]) {
          const move = distance(player.position, predicted[player.id]);
          if (move > maximumBodyCorrectionM) { maximumBodyCorrectionM = move;
            bodyCorrectionWitness = { tick: sim.tick, player: player.id, before: predicted[player.id], after: player.position, displacementM: move }; }
        }
        for (const point of e.nodes) for (const solid of e.terrain.solids)
          maxNodePenetrationM = Math.max(maxNodePenetrationM, penetration(point, half, solid)?.depth ?? 0);
        for (const span of e.spans) for (let j = 1; j < span.nodes.length; j++) for (const solid of e.terrain.solids) {
          const a = e.nodes[span.nodes[j - 1]], b = e.nodes[span.nodes[j]], hit = sweepBox(a, b, half, solid);
          if (!hit) continue;
          const reverse = sweepBox(b, a, half, solid), t = (hit.time + (reverse ? 1 - reverse.time : 1)) / 2;
          const inside = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
          const depth = penetration(inside, half, solid)?.depth ?? 0;
          if (depth > maxInteriorPenetrationM) { maxInteriorPenetrationM = depth; contactWitness = { tick: sim.tick,
            a: { ...a }, b: { ...b }, inside, depthM: depth, solid: { ...solid } }; }
        }
      }
      if (performance.now() - started > 180_000) throw new Error(`Bounded replay timed out: ${c.id}`);
    }
    const state = sim.snapshot(); state.serverTime = 0;
    const observation = finish?.();
    if (observation) {
      // The previous observer's optional algebra reconstructs the old unscaled
      // constraint formula. Remove it for both engines; use actual before/after
      // measurements above and preserve all velocity/energy/position witnesses.
      for (const key of ['largestRemoval', 'largestPotential', 'largestRoute', 'largestConstraint'] as const) {
        const motion = observation[key]?.largestConstraintMove;
        if (motion) delete motion.constraint;
      }
    }
    const { rows: budgetRows, ...peaks } = observation ?? { rows: [] };
    return { snapshots, state, observedBudgetSteps: budgetRows.length, observation: peaks,
      maxNodePenetrationM, maxInteriorPenetrationM, maxBodyPenetrationM, contactWitness,
      maximumConstraintDistanceIncreaseM, increasingConstraintCalls, constraintCalls, constraintWitness,
      maximumBodyCorrectionM, bodyCorrectionWitness, maximumRawBodySpeedMps,
      replayWallMs: performance.now() - started };
  } finally { sim.dispose(); }
}

await initializePhysics(); mkdirSync('work', { recursive: true }); mkdirSync('reports', { recursive: true });
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline, 'shared', 'tuning.ts'], { encoding: 'utf8' }).trim().split('\n');
const candidateVersion = /version: '([^']+)'/.exec(readFileSync('tuning.ts', 'utf8'))?.[1];
assert.equal(candidateVersion, 'phase2-nonlinear-projection-1', 'Apply exactly the recorded experimental candidate first');
const results: unknown[] = [];
for (const wall of [900, 450]) {
  const dirs: string[] = [];
  try {
    const engines: { label: string; Sim: SimClass; profile: Profile }[] = [];
    for (const label of ['baseline', 'candidate']) {
      const dir = mkdtempSync(resolve('work/nonlinear-probe-')); dirs.push(dir);
      for (const file of files) {
        mkdirSync(resolve(dir, file, '..'), { recursive: true });
        let source = label === 'baseline' ? execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' }) : readFileSync(file, 'utf8');
        if (file === 'tuning.ts') source = source.replace(/wallNormalEffortN: \d+/, `wallNormalEffortN: ${wall}`);
        writeFileSync(join(dir, file), source);
      }
      const { BelaySimulation: Sim } = await import(pathToFileURL(join(dir, 'shared/simulation.ts')).href) as typeof import('../shared/simulation');
      const { TUNING } = await import(pathToFileURL(join(dir, 'tuning.ts')).href) as typeof import('../tuning');
      assert.equal(TUNING.phase2.wallNormalEffortN, wall);
      engines.push({ label, Sim, profile: TUNING });
    }
    const plans = casesFile.cases.map(f => inputPlan(engines[0].Sim, f, engines[0].profile));
    plans.push(...recoveryTapes.map(f => ({ id: `recovery${f.options.playerCount}`,
      options: { ...f.options, tickHz: 60 } as SceneOptions,
      inputs: f.runs.flatMap(run => Array.from({ length: run.ticks * 2 }, () => run.inputs.map(v => ({ ...v })))) })));
    for (const c of plans) {
      const inputSha256 = hash(c.inputs.map(input => JSON.stringify(input) + '\n').join(''));
      if (wall === 450 && c.fixture) assert.equal(inputSha256, c.fixture.sourceInputSha256);
      for (const engine of engines) {
        const plain = run(engine.Sim, c, engine.profile, false), traced = run(engine.Sim, c, engine.profile, true);
        assert.deepStrictEqual(traced.snapshots, plain.snapshots, 'Observation changed a physical snapshot');
        assert.deepStrictEqual(traced.state, plain.state);
        const { snapshots, ...metrics } = traced;
        if (wall === 450 && c.fixture && engine.label === 'baseline') {
          assert.equal(traced.state.diagnostics.maximumEnergyProjectionJ, c.fixture.sourceDiagnostics.maximumEnergyProjectionJ);
          assert.equal(traced.state.diagnostics.maximumPotentialExcessJ, c.fixture.sourceDiagnostics.maximumPotentialExcessJ);
        }
        results.push({ label: engine.label, case: c.id, wall, inputSha256, fixedInputTicks: c.inputs.length,
          exactObservationSnapshots: snapshots.length, ...metrics });
        console.log(JSON.stringify({ label: engine.label, case: c.id, wall, ticks: c.inputs.length,
          segmentM: traced.state.counters.maximumSegmentErrorM, energyRemovalJ: traced.state.diagnostics.maximumEnergyProjectionJ,
          potentialExcessJ: traced.state.diagnostics.maximumPotentialExcessJ, bodyCorrectionM: traced.maximumBodyCorrectionM,
          constraintIncreaseM: traced.maximumConstraintDistanceIncreaseM, interiorPenetrationM: traced.maxInteriorPenetrationM,
          bodyPenetrationM: traced.maxBodyPenetrationM,
          incident: traced.state.incidents[0]?.status, run: traced.state.run.status }));
        writeFileSync('work/phase2-nonlinear-progress.json', JSON.stringify(results, null, 2));
      }
    }
  } finally { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }); }
}
writeFileSync('reports/phase2-nonlinear-comparison.json', JSON.stringify({ baseline, candidateVersion, runtime: process.version,
  candidateEngineSha256: hash(readFileSync('shared/expedition-simulation.ts', 'utf8')),
  method: 'Four saved cases, same baseline-generated input sequence and fixed horizon for each engine, both nominal profiles, 60 Hz physics snapshots. No candidate early stopping at recovery. Every observed snapshot matches an unobserved control except serverTime.',
  limitations: 'Per-case wall time includes diagnostic overhead and is not a production CPU benchmark. Previous baseline-only multiplier reconstruction is omitted. Raw actuator and budget measurements are unchanged.',
  results }, null, 2) + '\n');
