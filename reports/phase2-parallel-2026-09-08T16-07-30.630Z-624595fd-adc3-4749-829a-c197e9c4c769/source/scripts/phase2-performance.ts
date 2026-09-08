/** Bounded, same-runtime allocation-only comparison against a committed engine.
 * Run: npx tsx scripts/phase2-performance.ts [baseline commit] [equivalence|benchmark]
 * Reports are diagnostic local timings, never production or physical-bound qualification. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, freemem, loadavg, platform, arch } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { serialize } from 'node:v8';
import { BelaySimulation, initializePhysics } from '../shared/simulation';
import { REST, type Move, type SceneOptions, type SimulationSnapshot } from '../shared/protocol';
import { FAMILIES, TUNING } from '../tuning';

const baseline = process.argv[2] ?? 'f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1';
const mode = process.argv[3] ?? 'equivalence';
assert(['equivalence', 'benchmark'].includes(mode));
const revision = execFileSync('git', ['rev-parse', '--verify', `${baseline}^{commit}`], { encoding: 'utf8' }).trim();
const digest = (value: unknown) => createHash('sha256').update(serialize(value)).digest('hex');
mkdirSync('work', { recursive: true }); mkdirSync('reports', { recursive: true });
const referenceDirectory = mkdtempSync(resolve('work/phase2-reference-'));
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', revision, 'shared', 'tuning.ts'], { encoding: 'utf8' }).trim().split('\n');
for (const file of files) {
  const target = join(referenceDirectory, file);
  mkdirSync(resolve(target, '..'), { recursive: true });
  writeFileSync(target, execFileSync('git', ['show', `${revision}:${file}`]));
}
const reference = await import(pathToFileURL(join(referenceDirectory, 'shared/simulation.ts')).href) as typeof import('../shared/simulation');
await initializePhysics();
const physical = (sim: BelaySimulation) => { const state = sim.snapshot(11); state.serverTime = 0; return state; };
type Fixture = { name: string; options: SceneOptions; seconds: number; policy: 'walk' | 'load' | 'rescue' | 'flat' };
const fixtures: Fixture[] = [];
for (const playerCount of [2, 3, 4, 5, 6]) for (const tickHz of [30, 60] as const) {
  for (const scene of ['flat', 'rescue', 'crossing'] as const) fixtures.push({ name: `${scene}-${playerCount}-${tickHz}`,
    options: { scene, playerCount, tickHz, seed: 1701, family: 'balanced' },
    seconds: scene === 'crossing' ? 25 : 8, policy: scene === 'crossing' ? 'walk' : scene });
  fixtures.push({ name: `load-${playerCount}-${tickHz}`, options: { scene: 'crossing', playerCount, tickHz, seed: 2000, family: 'balanced' }, seconds: 10, policy: 'load' });
}
for (const family of Object.keys(FAMILIES) as (keyof typeof FAMILIES)[]) if (family !== 'balanced') {
  fixtures.push({ name: `rescue-6-30-${family}`, options: { scene: 'rescue', playerCount: 6, tickHz: 30, seed: 1701, family }, seconds: 8, policy: 'rescue' });
}
function inputs(fixture: Fixture, state: SimulationSnapshot): Move[] {
  const seconds = state.tick / state.tickHz;
  return state.players.map((player, id) => {
    if (fixture.policy === 'walk') return { x: 0, z: 1, brace: false };
    if (fixture.policy === 'rescue') return id === Math.floor(state.playerCount / 2)
      ? seconds < 2 ? REST : { x: 0, z: -1, brace: false }
      : { x: 0, z: 0, brace: true };
    if (fixture.policy === 'load') {
      const gap = state.terrain.crevasses[0];
      if (state.incidents.length) return id === 0 ? REST : { x: 0, z: 1, brace: false };
      return player.position.z < (id ? gap.minZ - TUNING.phase2.rescueSafeOffset : (gap.minZ + gap.maxZ) / 2)
        ? { x: 0, z: 1, brace: false } : { ...REST, brace: true };
    }
    return { x: Math.floor(seconds / 2) % 2 ? -1 : 1, z: id % 2 ? 0.25 : -0.25, brace: seconds >= 4 && seconds < 5 };
  });
}
const started = new Date().toISOString(), startLoad = loadavg();
const results: unknown[] = [];
const sourceHashes = Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]));
try {
  if (mode === 'equivalence') {
    for (const fixture of fixtures) {
      const a = new reference.BelaySimulation(fixture.options), b = new BelaySimulation(fixture.options);
      const samples: { tick: number; hash: string }[] = [];
      try {
        assert.deepStrictEqual(physical(b), physical(a), `${fixture.name} initial`);
        for (let tick = 0; tick < a.tickHz * fixture.seconds; tick++) {
          a.step(inputs(fixture, physical(a)), true);
          b.step(a.tape.frames[tick].inputs, true);
          if (tick % Math.max(1, a.tickHz / 2) === 0 || tick + 1 === a.tickHz * fixture.seconds) {
            const expected = physical(a); assert.deepStrictEqual(physical(b), expected, `${fixture.name} tick ${tick + 1}`);
            samples.push({ tick: tick + 1, hash: digest(expected) });
          }
        }
        assert.deepStrictEqual(b.tape, a.tape, `${fixture.name} normalized recorded tape`);
        const final = physical(a);
        results.push({ ...fixture, frames: a.tape.frames.length, tapeHash: digest(a.tape), samples,
          finalRun: final.run, eventKinds: [...new Set(final.events.map(e => e.kind))], diagnostics: final.diagnostics });
        console.log(`Exact ${fixture.name}: ${samples.length} sampled states plus initial; ${final.run.status}`);
      } finally { a.dispose(); b.dispose(); }
    }
  } else {
    // Fixed tapes are recorded once from the baseline; every timed replay receives
    // identical frames. Paired order alternates to reduce, not eliminate, warm-up bias.
    for (const fixture of fixtures.filter(f => f.options.playerCount === 6 && f.options.tickHz === 30 && f.options.family === 'balanced' && f.policy !== 'load')) {
      const recorder = new reference.BelaySimulation(fixture.options);
      const frames: Move[][] = [];
      try { for (let tick = 0; tick < 300; tick++) { const move = inputs(fixture, physical(recorder)); recorder.step(move, true); frames.push(recorder.tape.frames[tick].inputs); } }
      finally { recorder.dispose(); }
      const runs: unknown[] = [];
      for (let repetition = 0; repetition < 4; repetition++) for (const engine of repetition % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
        const Sim = engine === 'baseline' ? reference.BelaySimulation : BelaySimulation;
        const sim = new Sim(fixture.options), durations: number[] = [];
        let activeTicks = 0;
        try {
          for (let tick = 0; tick < 60; tick++) sim.step(frames[tick]);
          const cpu = process.cpuUsage(), begin = performance.now(), memoryBefore = process.memoryUsage();
          for (let tick = 60; tick < frames.length; tick++) {
            const t = performance.now(); sim.step(frames[tick]); durations.push(performance.now() - t);
            if (sim.snapshot().run.status === 'active' || fixture.policy === 'flat') activeTicks++;
          }
          const elapsedMs = performance.now() - begin, cpuDelta = process.cpuUsage(cpu);
          durations.sort((a, b) => a - b);
          runs.push({ engine, repetition, warmupTicks: 60, measuredTicks: durations.length, activeTicks,
            elapsedMs, stepTotalMs: durations.reduce((a, b) => a + b, 0),
            stepP50Ms: durations[Math.ceil(durations.length * .5) - 1], stepP95Ms: durations[Math.ceil(durations.length * .95) - 1],
            stepP99Ms: durations[Math.ceil(durations.length * .99) - 1], maxStepMs: durations.at(-1),
            cpuDelta, memoryBefore, memoryAfter: process.memoryUsage(), finalHash: digest(physical(sim)), hostLoad: loadavg() });
        } finally { sim.dispose(); }
      }
      const hashes = (runs as { finalHash: string }[]).map(r => r.finalHash); assert(hashes.every(h => h === hashes[0]));
      results.push({ ...fixture, seconds: frames.length / recorder.tickHz, tapeHash: digest(frames), runs }); console.log(`Timed ${fixture.name}: four alternating pairs, final states identical`);
    }
  }
  const output = `reports/phase2-performance-${mode}.json`;
  writeFileSync(output, JSON.stringify({ mode, baseline: revision, sourceHashes, started, finished: new Date().toISOString(),
    runtime: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logicalCPUs: cpus().length },
    host: { startLoad, endLoad: loadavg(), freeBytes: freemem() },
    comparison: 'Node assert.deepStrictEqual; only snapshot serverTime replaced with zero. Input tapes and final/sample states include diagnostics and events. SHA256 uses V8 serialization, preserving signed zero.',
    limitations: 'Same-runtime finite fixtures only. Timings share a host with other tasks; no CPU affinity, forced GC, deadline, scaling, memory attribution or physical-bound pass is claimed.', results }, null, 2) + '\n');
  console.log(output);
} finally { rmSync(referenceDirectory, { recursive: true, force: true }); }
