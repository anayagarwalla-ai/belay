/** Bounded build-runtime experiment; no server, transport, or numerical changes.
 * Adapted from physics commit bd8254c scripts/phase2-performance.ts.
 * Run: npx tsx scripts/local-load-runtime-build.ts
 */
import assert from 'node:assert/strict';
import { execFileSync, fork } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serialize } from 'node:v8';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { build, stop, version as esbuildVersion } from 'esbuild';
import { TUNING } from '../tuning';
import type { Move, SimulationSnapshot } from '../shared/protocol';
import type { BelaySimulation } from '../shared/simulation';
import { distribution } from './local-load-model';

const fixture = { scenes: ['crossing', 'rescue'] as const, playerCount: 6, tickHz: 30 as const,
  seed: 1701, family: 'balanced' as const, warmupTicks: 60, measuredTicks: 240, pairs: 4 };
const hash = (value: unknown) => createHash('sha256').update(serialize(value)).digest('hex');
const physical = (sim: BelaySimulation) => { const state = sim.snapshot(11); state.serverTime = 0; return state; };
function inputs(scene: string, state: SimulationSnapshot): Move[] {
  return state.players.map((_, seat) => scene === 'crossing' ? { x: 0, z: 1, brace: false }
    : seat === Math.floor(state.playerCount / 2)
      ? { x: 0, z: state.tick / state.tickHz < 2 ? 0 : -1, brace: false }
      : { x: 0, z: 0, brace: true });
}
function memoryCheck() {
  const memory = process.memoryUsage();
  assert(memory.rss <= TUNING.localLoad.maximumTotalRssBytes, 'Owned experiment RSS cap exceeded');
  return { memory, hostFreeBytes: os.freemem(), hostLoad: os.loadavg() };
}

async function childRun(directory: string, candidatePath: string) {
  assert(process.send && process.connected, 'Owned IPC parent required');
  process.on('disconnect', () => process.exit(1));
  const reference = await import('../shared/simulation');
  const candidate = await import(pathToFileURL(candidatePath).href) as typeof reference;
  await reference.initializePhysics(); await candidate.initializePhysics();
  const normalizedTapes: Record<string, Move[][]> = {};
  const equivalence: unknown[] = [];
  const timed: unknown[] = [];
  const persist = async (status: string, failure?: string) => writeFile(path.join(directory, 'measurements.json'),
    JSON.stringify({ status, failure, fixture, normalizedTapes, equivalence, timed }, null, 2));
  try {
    // Finish BOTH exact-equivalence fixtures before ANY measured A/B run.
    for (const scene of fixture.scenes) {
      const options = { scene, playerCount: fixture.playerCount, tickHz: fixture.tickHz, seed: fixture.seed, family: fixture.family };
      const a = new reference.BelaySimulation(options), b = new candidate.BelaySimulation(options);
      const samples: { tick: number; snapshotHash: string }[] = [];
      try {
        const initial = physical(a); assert.deepStrictEqual(physical(b), initial, `${scene} initial`);
        samples.push({ tick: 0, snapshotHash: hash(initial) });
        for (let tick = 0; tick < fixture.warmupTicks + fixture.measuredTicks; tick++) {
          a.step(inputs(scene, physical(a)), true);
          b.step(a.tape.frames[tick].inputs, true);
          const expected = physical(a); assert.deepStrictEqual(physical(b), expected, `${scene} tick ${tick + 1}`);
          samples.push({ tick: tick + 1, snapshotHash: hash(expected) });
          if ((tick + 1) % fixture.tickHz === 0) { memoryCheck(); await yieldTurn(); }
        }
        assert.deepStrictEqual(b.tape, a.tape, `${scene} full normalized tape`);
        normalizedTapes[scene] = a.tape.frames.map(frame => frame.inputs);
        const final = physical(a);
        equivalence.push({ scene, samples, tapeHash: hash(a.tape), frameCount: a.tape.frames.length,
          finalRun: final.run, diagnostics: final.diagnostics });
        await persist('EQUIVALENCE IN PROGRESS');
        process.send?.({ stage: 'equivalence', scene, snapshots: samples.length, frames: a.tape.frames.length, status: 'PASS' });
      } finally { a.dispose(); b.dispose(); }
    }
    await persist('EQUIVALENCE PASS; TIMING IN PROGRESS');
    for (const scene of fixture.scenes) {
      const frames = normalizedTapes[scene], runs: { finalHash: string; [key: string]: unknown }[] = [];
      timed.push({ scene, tapeHash: hash(frames), runs });
      for (let repetition = 0; repetition < fixture.pairs; repetition++) {
        const order = repetition % 2 ? ['esbuild', 'tsx'] as const : ['tsx', 'esbuild'] as const;
        for (const runtime of order) {
          const Sim = runtime === 'tsx' ? reference.BelaySimulation : candidate.BelaySimulation;
          const sim = new Sim({ scene, playerCount: fixture.playerCount, tickHz: fixture.tickHz, seed: fixture.seed, family: fixture.family });
          try {
            for (let tick = 0; tick < fixture.warmupTicks; tick++) sim.step(frames[tick]);
            await yieldTurn();
            let state = sim.snapshot(); const rawStepMs = [], activeBefore = [];
            const before = memoryCheck(), cpu = process.cpuUsage(), begin = performance.now();
            for (let tick = fixture.warmupTicks; tick < frames.length; tick++) {
              activeBefore.push(state.run.status === 'active');
              const start = performance.now(); sim.step(frames[tick]); rawStepMs.push(performance.now() - start);
              state = sim.snapshot();
            }
            const elapsedMs = performance.now() - begin, cpuDelta = process.cpuUsage(cpu), after = memoryCheck();
            assert(activeBefore.every(Boolean), `${scene} ${runtime} has non-active measured ticks`);
            const final = physical(sim);
            const run = { runtime, repetition, order: [...order], warmupTicks: fixture.warmupTicks,
              measuredTicks: rawStepMs.length, activeTicks: activeBefore.filter(Boolean).length,
              rawStepMs, activeBefore, step: distribution(rawStepMs), stepTotalMs: rawStepMs.reduce((sum, ms) => sum + ms, 0),
              elapsedMs, cpuDelta, before, after, finalHash: hash(final), finalRun: final.run };
            runs.push(run);
            await persist('TIMING IN PROGRESS');
            process.send?.({ stage: 'timing', scene, runtime, repetition, stepTotalMs: run.stepTotalMs, activeTicks: run.activeTicks });
          } finally { sim.dispose(); await yieldTurn(); }
        }
      }
      assert(runs.every(run => run.finalHash === runs[0].finalHash), `${scene} timed final states differ`);
      await persist('TIMING IN PROGRESS');
    }
    await persist('COMPLETE');
  } catch (error) { await persist('FAILED', String(error)); throw error; }
}

async function run() {
  const id = randomUUID(), directory = path.resolve('reports', `local-load-runtime-${id}`);
  const buildDirectory = path.resolve('work', `local-load-runtime-${id}`), candidatePath = path.join(buildDirectory, 'simulation.mjs');
  await mkdir(directory); await mkdir(buildDirectory, { recursive: true });
  const sourcePaths = execFileSync('git', ['ls-files', 'shared', 'tuning.ts', 'package-lock.json'], { encoding: 'utf8' }).trim().split('\n');
  sourcePaths.push('scripts/local-load-runtime-build.ts');
  const sourceHashes = Object.fromEntries(await Promise.all(sourcePaths.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])));
  const buildOptions = { entryPoints: ['shared/simulation.ts'], bundle: true, packages: 'external' as const,
    platform: 'node' as const, format: 'esm' as const, target: 'node26', keepNames: false, minify: false, sourcemap: false,
    outfile: candidatePath, metafile: true };
  try {
    const result = await build(buildOptions); await stop();
    const code = await readFile(candidatePath, 'utf8');
    await writeFile(path.join(directory, 'build-metafile.json'), JSON.stringify(result.metafile, null, 2));
    const tsxRequire = createRequire(import.meta.resolve('tsx'));
    await writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ fixture,
      startedAt: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      sourceHashes, tuning: TUNING, esbuildVersion, tsxVersion: tsxRequire('tsx/package.json').version,
      tsxEsbuildVersion: tsxRequire('esbuild/package.json').version, buildOptions, bundleBytes: Buffer.byteLength(code),
      bundleSha256: createHash('sha256').update(code).digest('hex'), generatedNameHelperPresent: code.includes('__name'),
      node: process.version, uv: process.versions.uv, machine: { arch: os.arch(), release: os.release(), cpu: os.cpus()[0]?.model,
        cpus: os.availableParallelism(), totalMemory: os.totalmem(), ...memoryCheck() },
      method: 'Physics bd8254c exact-comparison method, bounded two-fixture subset; every snapshot and full tape; serverTime only normalized to zero; deepStrictEqual and V8 serialization hashes preserve signed zero. Four alternating same-process pairs per scene; fixed60-tick warm-up,240 active measuredticks; step-only timing, separate snapshot observation.',
      guard: 'Independent parent180s wall timeout; root1GiB V8 heap cap, sampled3GiB child RSS cap and64MiB report cap. Independent invocation experiment, as with the prior profiler. Raw host free memory recorded; existing transport/load512MiB guard unchanged and no socket attempt made.',
      limits: 'Same Node/Rapier process and finite fixtures. Bundling/transformation/runtime treatment differs as well as keepNames; this does not isolate helper removal. No forced GC, CPU affinity, server/network/load, numerical changes or capacity claim.',
    }, null, 2));
    const child = fork(fileURLToPath(import.meta.url), ['--child', directory, candidatePath],
      { execArgv: ['--import', 'tsx', `--max-old-space-size=${TUNING.localLoad.authorityHeapMiB}`], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let log = '';
    const collect = (chunk: Buffer) => { log += chunk.toString().slice(0, Math.max(0, TUNING.localLoad.maximumChildLogBytes - log.length)); };
    child.stdout?.on('data', collect); child.stderr?.on('data', collect);
    child.on('message', message => console.log(JSON.stringify(message)));
    const timeout = setTimeout(() => child.kill('SIGTERM'), TUNING.localLoad.maximumWallMs);
    const force = setTimeout(() => child.kill('SIGKILL'), TUNING.localLoad.maximumWallMs + TUNING.localLoad.shutdownGraceMs);
    const onSignal = () => child.kill('SIGTERM'); process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
    let exit;
    try { exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      child.once('error', reject); child.once('exit', (code, signal) => resolve({ code, signal }));
    }); } finally { clearTimeout(timeout); clearTimeout(force); process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal); }
    await writeFile(path.join(directory, 'teardown.json'), JSON.stringify({ pid: child.pid, ...exit, log, finishedAt: new Date().toISOString() }, null, 2));
    assert.equal(exit.code, 0, `Build-runtime experiment failed; evidence retained at ${directory}`);
    const sizes = await Promise.all((await readdir(directory)).map(async file => (await readFile(path.join(directory, file))).byteLength));
    assert(sizes.reduce((a, b) => a + b, 0) <= TUNING.localLoad.maximumReportBytes, 'Report cap exceeded');
    console.log(JSON.stringify({ directory, status: 'COMPLETE', ...exit }));
  } finally { await stop(); await rm(buildDirectory, { recursive: true, force: true }); }
}
if (process.argv[2] === '--child') { await childRun(process.argv[3], process.argv[4]); process.exit(0); }
else if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await run();
