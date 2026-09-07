import { fork } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { Session } from 'node:inspector';
import { PerformanceObserver } from 'node:perf_hooks';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUNING } from '../tuning';
import { distribution } from './local-load-model';

/** A fixed diagnostic experiment derived from existing root limits, never physics tuning. */
export const PROFILE_FIXTURE = {
  scenes: ['crossing', 'rescue'] as const, playerCount: TUNING.hardCap,
  warmupTicks: TUNING.localLoad.warmupMs * TUNING.tickHz / 1000,
  measuredTicks: TUNING.phase2Evidence.replaySeconds * TUNING.tickHz,
  sampleEveryTicks: TUNING.localLoad.sampleMs * TUNING.tickHz / 1000,
  maximumWallMs: TUNING.localLoad.maximumWallMs, maximumRssBytes: TUNING.localLoad.maximumTotalRssBytes,
  maximumArtifactBytes: TUNING.localLoad.maximumReportBytes,
};
const monotonicUs = () => Number(process.hrtime.bigint() / BigInt(1000));
const post = (session: Session, method: string, params?: object) => new Promise<object | undefined>((resolve, reject) => {
  session.post(method, params, (error, result) => error ? reject(error) : resolve(result));
});

async function childProfile(mode: 'cpu' | 'allocation', directory: string) {
  if (!process.send || !process.connected) throw new Error('Profiler requires its own IPC parent');
  process.on('disconnect', () => process.exit(1));
  const { BelaySimulation, initializePhysics } = await import('../shared/simulation');
  const initializationStartUs = monotonicUs(); await initializePhysics(); const initializationEndUs = monotonicUs();
  const gc: { startMs: number; durationMs: number; kind: unknown }[] = [];
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) gc.push({ startMs: entry.startTime, durationMs: entry.duration,
      kind: (entry as unknown as { detail: { kind: number } }).detail.kind });
  });
  observer.observe({ entryTypes: ['gc'] });
  const phases: unknown[] = [];
  for (const scene of PROFILE_FIXTURE.scenes) {
    const constructionStartUs = monotonicUs();
    const sim = new BelaySimulation({ scene, playerCount: PROFILE_FIXTURE.playerCount, seed: TUNING.seed, tickHz: TUNING.tickHz });
    const constructionEndUs = monotonicUs();
    const inputsAt = (tick: number) => sim.bodies.map((_, seat) => {
      const phase = Math.floor(tick / (TUNING.tickHz * TUNING.phase2Evidence.recoveryBraceCycleSeconds));
      return { x: 0, z: scene === 'crossing' ? 1 : -1,
        brace: scene === 'crossing' ? false : seat !== Math.floor(sim.playerCount / 2) && (phase + seat) % 2 === 0 };
    });
    const warmupStartUs = monotonicUs();
    for (let tick = 0; tick < PROFILE_FIXTURE.warmupTicks; tick++) sim.step(inputsAt(tick), true);
    await yieldTurn(); const warmupEndUs = monotonicUs();
    let session: Session | undefined;
    if (mode === 'allocation') {
      session = new Session(); session.connect();
      // V8's local inspector only; no inspector network listener. Sampling interval uses its documented default.
      await post(session, 'HeapProfiler.startSampling', { includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    }
    const stepMs: number[] = [], snapshotMs: number[] = [], jsonMs: number[] = [], status: string[] = [], iterations: number[] = [];
    const processWindows: unknown[] = []; const measuredStartUs = monotonicUs(), measuredStartPerfMs = performance.now();
    let jsonBytes = 0;
    for (let tick = 0; tick < PROFILE_FIXTURE.measuredTicks; tick++) {
      const inputs = inputsAt(tick + PROFILE_FIXTURE.warmupTicks);
      const started = performance.now(); sim.step(inputs, true); const stepped = performance.now();
      const snapshot = sim.snapshot(); const snapped = performance.now();
      jsonBytes += Buffer.byteLength(JSON.stringify(snapshot)); const encoded = performance.now();
      stepMs.push(stepped - started); snapshotMs.push(snapped - stepped); jsonMs.push(encoded - snapped);
      status.push(snapshot.run.status); iterations.push(snapshot.diagnostics.solverIterations);
      if ((tick + 1) % PROFILE_FIXTURE.sampleEveryTicks === 0) {
        const memory = process.memoryUsage();
        processWindows.push({ tick, atUs: monotonicUs(), memory, cpu: process.cpuUsage(), hostFreeBytes: os.freemem(), hostLoad: os.loadavg() });
        if (memory.rss > PROFILE_FIXTURE.maximumRssBytes) throw new Error('Owned profiler RSS cap exceeded');
        await yieldTurn();
      }
    }
    const measuredEndUs = monotonicUs(), measuredEndPerfMs = performance.now();
    if (session) {
      const heap = await post(session, 'HeapProfiler.stopSampling');
      await writeFile(path.join(directory, `${mode}-${scene}.heapprofile.json`), JSON.stringify(heap)); session.disconnect();
    }
    const final = sim.snapshot(); const beforeDispose = process.memoryUsage(); sim.dispose(); await yieldTurn();
    const phase = { scene, mode, constructionStartUs, constructionEndUs, warmupStartUs, warmupEndUs, measuredStartUs, measuredEndUs,
      measuredStartPerfMs, measuredEndPerfMs, stepMs, snapshotMs, jsonMs, status, iterations, jsonBytes,
      step: distribution(stepMs), snapshot: distribution(snapshotMs), json: distribution(jsonMs),
      activeSteps: distribution(stepMs.filter((_, index) => status[index] === 'active')),
      terminalSteps: distribution(stepMs.filter((_, index) => status[index] !== 'active')),
      final: { tick: final.tick, run: final.run, incidents: final.incidents, counters: final.counters, diagnostics: final.diagnostics },
      processWindows, beforeDispose, afterDispose: process.memoryUsage() };
    phases.push(phase); process.send?.({ progress: { mode, scene, stepP99: phase.step.p99, activeTicks: phase.activeSteps.count } });
  }
  await yieldTurn(); observer.disconnect();
  await writeFile(path.join(directory, `${mode}-measurements.json`), JSON.stringify({ mode, pid: process.pid, initializationStartUs, initializationEndUs,
    profiler: mode === 'cpu' ? 'Node --cpu-prof, default 1000us sampling from installed --help' : 'Inspector HeapProfiler.startSampling, default 32768-byte Poisson interval; collected-object flags requested; sampling estimates are not room memory attribution',
    fixture: PROFILE_FIXTURE, gc, phases }));
}

async function run() {
  const directory = path.resolve('reports', `local-load-profile-${randomUUID()}`); await mkdir(directory);
  const sourcePaths = execFileSync('git', ['ls-files', 'shared', 'server', 'tuning.ts', 'package-lock.json'], { encoding: 'utf8' }).trim().split('\n');
  sourcePaths.push('scripts/local-load-profile.ts');
  const hashes = Object.fromEntries(await Promise.all(sourcePaths.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])));
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ fixture: PROFILE_FIXTURE, tuning: TUNING,
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), hashes, node: process.version,
    machine: { arch: os.arch(), memory: os.totalmem(), cpus: os.availableParallelism(), load: os.loadavg(), free: os.freemem() },
    scope: `Bounded six-body invocation profiling; corrected baseline smoke/full1000 and other tasks may contend. No capacity claim. Fixed ${PROFILE_FIXTURE.warmupTicks}-tick simulation warm-up, ${PROFILE_FIXTURE.measuredTicks} measured ticks per scene in each pass. Tape recording retained. Snapshot+JSON component is a proxy, not Colyseus encoding/fan-out.`,
    guard: 'Independent parent wall timeout, V8 heap cap, sampled owned RSS and total artifact cap. Raw host free memory recorded; one-room transport attempt separately retains its original free-memory guard.',
  }, null, 2));
  const exits: unknown[] = [];
  const modes: ('cpu' | 'allocation')[] = process.argv.includes('--allocation-only') ? ['allocation'] : ['cpu', 'allocation'];
  for (const mode of modes) {
    const child = fork(fileURLToPath(import.meta.url), ['--child', mode, directory], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      execArgv: ['--import', 'tsx', `--max-old-space-size=${TUNING.localLoad.authorityHeapMiB}`,
        ...(mode === 'cpu' ? ['--cpu-prof', `--cpu-prof-dir=${directory}`, '--cpu-prof-name=simulation.cpuprofile'] : [])] });
    let log = ''; const collect = (data: Buffer) => { if (log.length < TUNING.localLoad.maximumChildLogBytes) log += data.toString().slice(0, TUNING.localLoad.maximumChildLogBytes - log.length); };
    child.stdout?.on('data', collect); child.stderr?.on('data', collect);
    child.on('message', message => console.log(JSON.stringify(message)));
    const timeout = setTimeout(() => child.kill('SIGTERM'), PROFILE_FIXTURE.maximumWallMs);
    const force = setTimeout(() => child.kill('SIGKILL'), PROFILE_FIXTURE.maximumWallMs + TUNING.localLoad.shutdownGraceMs);
    const onSignal = () => child.kill('SIGTERM'); process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
    const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
    clearTimeout(timeout); clearTimeout(force); process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
    exits.push({ mode, pid: child.pid, ...exit, log });
    await writeFile(path.join(directory, 'teardown.json'), JSON.stringify(exits));
    if (exit.code !== 0) throw new Error(`${mode} profiler failed; partial artifacts retained at ${directory}`);
    const bytes = await Promise.all((await readdir(directory)).map(async file => (await readFile(path.join(directory, file))).byteLength));
    if (bytes.reduce((sum, value) => sum + value, 0) > PROFILE_FIXTURE.maximumArtifactBytes) throw new Error('Profiler artifact cap exceeded; do not continue');
  }
  console.log(JSON.stringify({ directory, status: 'COMPLETE', exits }));
}
if (process.argv[2] === '--child') {
  await childProfile(process.argv[3] as 'cpu' | 'allocation', process.argv[4]); process.exit(0);
} else if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await run();
