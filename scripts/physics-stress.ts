import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { setImmediate } from 'node:timers/promises';
import { FAMILIES, TUNING, type Family, type TickHz } from '../tuning';
import { BelaySimulation, initializePhysics } from '../shared/simulation';
import { metricLimits, measurePhysics, physicalState, scenarioInputs, SCENARIOS } from './physics-scenarios';

// Baseline mode only changes the output name. The same assertions must fail before fixes.
const baseline = process.argv.includes('--baseline');
const stem = baseline ? 'phase1-physics-baseline' : 'phase1-physics-stress';
await initializePhysics();
const started = performance.now();
type Failure = { check: string; tick?: number; substep?: number; actual?: number; limit?: number; message?: string };
const records = [];
const families = Object.keys(FAMILIES) as Family[];
for (const family of families) for (const tickHz of [30, 60] as const) for (const scenario of SCENARIOS) {
  const sim = new BelaySimulation({ family, tickHz, seed: TUNING.seed });
  const inputs = scenarioInputs(scenario, sim.seed, tickHz);
  const seconds = scenario === 'long-walk' ? TUNING.physicsDiagnostics.longWalkSeconds : TUNING.physicsDiagnostics.scenarioSeconds;
  const ticks = seconds * tickHz;
  const failures: Failure[] = [];
  const failedChecks = new Set<string>();
  const maxima = Object.fromEntries(Object.keys(metricLimits).map(k => [k, 0]));
  const fail = (failure: Failure) => { if (!failedChecks.has(failure.check)) failures.push(failure); failedChecks.add(failure.check); };
  const inspect = (world: BelaySimulation, tick: number, substep?: number) => {
    const metrics = measurePhysics(world);
    if (!metrics.finite) { fail({ check: 'finite', tick, substep }); return false; }
    for (const key of Object.keys(metricLimits) as (keyof typeof metricLimits)[]) {
      maxima[key] = Math.max(maxima[key], metrics[key]);
      if (metrics[key] > metricLimits[key]) fail({ check: key, tick, substep, actual: metrics[key], limit: metricLimits[key] });
    }
    return true;
  };
  let replayMatches = false;
  try {
    for (let tick = 0; tick < ticks; tick++) {
      sim.step(inputs(tick), true);
      if (!inspect(sim, tick)) break;
    }
    const replay = new BelaySimulation({ family, tickHz, seed: sim.seed });
    // Inspect the first half of each 30 Hz tick too, using the identical 60 Hz internal
    // steps and held recorded inputs. Assert physical equality so this cannot hide a drift.
    const substepReplay = tickHz === 30 ? new BelaySimulation({ family, tickHz: 60, seed: sim.seed }) : undefined;
    try {
      for (const frame of sim.tape.frames) {
        assert.equal(frame.tick, replay.tick, 'tape tick order');
        assert.equal(frame.inputs.length, TUNING.players, 'bounded tape player count');
        assert(frame.inputs.every(v => Number.isFinite(v.x) && Number.isFinite(v.z)
          && Math.hypot(v.x, v.z) <= 1 + Number.EPSILON && typeof v.brace === 'boolean'), 'bounded normalized tape inputs');
        replay.step(frame.inputs);
        if (substepReplay) for (let substep = 0; substep < TUNING.physicsHz / tickHz; substep++) {
          substepReplay.step(frame.inputs);
          inspect(substepReplay, frame.tick, substep);
        }
      }
      assert.deepEqual(physicalState(replay), physicalState(sim));
      if (substepReplay) {
        const a = physicalState(substepReplay), b = physicalState(sim);
        assert.deepEqual(a.players, b.players); assert.deepEqual(a.rope, b.rope);
        assert.deepEqual({ ...a.counters, ticks: 0 }, { ...b.counters, ticks: 0 });
      }
      replayMatches = true;
    } catch (error) { fail({ check: 'exact-tape-replay', message: (error as Error).message.slice(0, 1000) }); }
    finally { replay.dispose(); substepReplay?.dispose(); }
    if (scenario === 'long-walk') {
      assert.equal(sim.tape.frames.length, tickHz * TUNING.network.maximumTapeSeconds);
      assert.equal(sim.tape.truncated, false);
      const first = structuredClone(sim.tape.frames[0]);
      sim.step(inputs(ticks), true);
      sim.step(inputs(ticks + 1), true);
      assert.equal(sim.tape.frames.length, tickHz * TUNING.network.maximumTapeSeconds);
      assert.equal(sim.tape.truncated, true);
      assert.deepEqual(sim.tape.frames[0], first);
      assert.equal(sim.tick, ticks + 2, 'simulation continues after tape cap');
      const minimumDistance = seconds * TUNING.body.walkSpeed * TUNING.physicsDiagnostics.minimumWalkSpeedFraction;
      for (const body of sim.bodies) {
        const position = body.translation();
        if (Math.hypot(position.x, position.z) < minimumDistance) fail({ check: 'long-walk-progress', actual: Math.hypot(position.x, position.z), limit: minimumDistance });
      }
    }
    records.push({ family, tickHz, seed: sim.seed, scenario, seconds, inspectedTicks: ticks,
      inspectedSubsteps: ticks * TUNING.physicsHz / tickHz, maxima, replayMatches,
      finalPositions: sim.bodies.map(body => ({ ...body.translation() })), counters: { ...sim.counters },
      tapeFrames: sim.tape.frames.length, tapeTruncated: sim.tape.truncated, failures });
  } finally { sim.dispose(); }
  console.log(`${family}/${tickHz}/${scenario}: ${failures.length ? `FAIL ${failures.map(v => v.check).join(', ')}` : 'PASS'}`);
}

const fixedStepChecks = [];
for (const family of families) {
  const create = (tickHz: TickHz) => new BelaySimulation({ family, tickHz });
  const thirty = create(30), sixty = create(60), paused = create(30);
  const inputs = scenarioInputs('random', TUNING.seed, 30);
  try {
    for (let tick = 0; tick < TUNING.physicsDiagnostics.scenarioSeconds * 30; tick++) {
      const frame = inputs(tick);
      thirty.step(frame); sixty.step(frame); sixty.step(frame);
      // Scheduling gaps never become elapsed simulation time. This exercises real event-loop yields.
      if (tick % 30 === 0) {
        const before = physicalState(paused);
        await setImmediate();
        assert.deepEqual(physicalState(paused), before, 'a paused simulation must not advance');
      }
      paused.step(frame);
    }
    assert.deepEqual(physicalState(paused), physicalState(thirty));
    const a = physicalState(thirty), b = physicalState(sixty);
    assert.deepEqual(a.players, b.players); assert.deepEqual(a.rope, b.rope);
    assert.deepEqual({ ...a.counters, ticks: 0 }, { ...b.counters, ticks: 0 });
    fixedStepChecks.push({ family, passed: true, heldInputsAt30And60Hz: true, schedulingIndependent: true });
  } finally { thirty.dispose(); sixty.dispose(); paused.dispose(); }
}
const sourceFiles = ['shared/simulation.ts', 'shared/movement.ts', 'shared/protocol.ts', 'shared/terrain.ts', 'tuning.ts', 'package-lock.json',
  'scripts/physics-scenarios.ts', 'scripts/physics-stress.ts'];
const sourceSha256 = Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path,
  createHash('sha256').update(await readFile(path)).digest('hex')])));
const failureCount = records.reduce((sum, record) => sum + record.failures.length, 0);
const report = {
  generatedAt: new Date().toISOString(), status: failureCount ? 'FAIL' : 'PASS', failureCount,
  command: `npx tsx scripts/physics-stress.ts${baseline ? ' --baseline' : ''}`,
  scope: 'Phase 1, two locked grey-box Rapier bodies and a PBD rope. Every internal substep inspected, including via an equivalence-asserted 60 Hz held-input replay for 30 Hz scenarios. Exact replay is same-runtime only.',
  humanGate: 'NOT EVALUATED', glacierMetrics: 'N/A', rescueMetrics: 'N/A', production300RoomQualification: 'NOT TESTED',
  machine: { platform: os.platform(), arch: os.arch(), node: process.version, cpu: os.cpus()[0].model },
  wallSeconds: (performance.now() - started) / 1000, tuning: TUNING, familyDefinitions: FAMILIES,
  sourceSha256, metricLimits, fixedStepChecks, records,
};
await mkdir('reports', { recursive: true });
await writeFile(`reports/${stem}.json`, JSON.stringify(report, null, 2) + '\n');
await writeFile(`reports/${stem}.md`, [
  '# Phase 1 adversarial physics diagnostics', '', `${report.status}: ${failureCount} failed checks. Generated ${report.generatedAt}.`, '',
  `Reproduce: \`${report.command}\`. ${report.scope}`, '',
  '| Family | Hz | Scenario | Peak overlap (m) | Peak segment error (m) | Peak chain excess (m) | Replay | Assertions |',
  '|---|---:|---|---:|---:|---:|---|---|',
  ...records.map(r => `| ${r.family} | ${r.tickHz} | ${r.scenario} | ${r.maxima.bodyOverlapM.toFixed(6)} | ${r.maxima.segmentErrorM.toFixed(6)} | ${r.maxima.chainErrorM.toFixed(6)} | ${r.replayMatches ? 'PASS' : 'FAIL'} | ${r.failures.map(f => f.check).join(', ') || 'PASS'} |`), '',
  'Exact tape replay, cap/truncation/continued stepping, 30/60 Hz held-input equivalence and scheduling-independent fixed steps are asserted. Long walks traverse beyond the original floor extent. Chain excess is bounded by the sum of the existing per-segment error budgets. JSON records the first failing tick and limits for each failed check, all configuration and source hashes.', '',
  'Glacier metrics: N/A. Rescue metrics: N/A. Production 300-room qualification: NOT TESTED. Human Gate 1: NOT EVALUATED. No human sessions consumed; no feel verdict inferred.', '',
].join('\n'));
assert.equal(failureCount, 0, `Physics stress failed ${failureCount} checks; see reports/${stem}.json`);
