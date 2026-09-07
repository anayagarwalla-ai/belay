import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { distribution } from './local-load-model';

type Frame = { functionName: string; url: string; lineNumber: number; columnNumber?: number };
type CpuProfile = { startTime: number; endTime: number; nodes: { id: number; callFrame: Frame }[]; samples: number[]; timeDeltas: number[] };
type HeapNode = { callFrame: Frame; selfSize: number; children: HeapNode[] };
type Measurements = { initializationStartUs: number; initializationEndUs: number;
  gc: { startMs: number; durationMs: number; kind: unknown }[];
  phases: { scene: string; mode: string; constructionStartUs: number; constructionEndUs: number;
    warmupStartUs: number; warmupEndUs: number; measuredStartUs: number; measuredEndUs: number;
    measuredStartPerfMs: number; measuredEndPerfMs: number; stepMs: number[]; snapshotMs: number[]; jsonMs: number[];
    status: string[]; iterations: number[]; processWindows: { memory: { rss: number }; hostFreeBytes: number; hostLoad: number[] }[];
    final: { run: unknown }; }[] };

export function cpuSummary(profile: CpuProfile) {
  if (profile.samples.length !== profile.timeDeltas.length) throw new Error('CPU samples/timeDeltas length mismatch');
  const nodes = new Map(profile.nodes.map(node => [node.id, node.callFrame]));
  const rows = new Map<string, { frame: Frame; samples: number; sampledTimeUs: number }>();
  profile.samples.forEach((id, index) => {
    const frame = nodes.get(id); if (!frame) throw new Error('CPU sample references missing node');
    const key = JSON.stringify([frame.functionName, frame.url, frame.lineNumber, frame.columnNumber]);
    const row = rows.get(key) ?? { frame, samples: 0, sampledTimeUs: 0 };
    row.samples++; row.sampledTimeUs += profile.timeDeltas[index]; rows.set(key, row);
  });
  const totalSampledUs = profile.timeDeltas.reduce((sum, value) => sum + value, 0);
  return { totalSamples: profile.samples.length, totalSampledMs: totalSampledUs / 1000,
    profileElapsedMs: (profile.endTime - profile.startTime) / 1000,
    scope: 'Whole Node --cpu-prof interval including initialization, warm-up, both measured scenes, snapshot/JSON and teardown. Delta-weighted sample shares can be affected by OS descheduling. Sample-count shares are also preserved. No per-scene clock slicing: V8 profiler clock and process.hrtime differ on this host.',
    positions: 'Raw zero-based transpiled line/column, not authored TypeScript locations. Function-name/source inspection is required for authored source references.',
    functions: [...rows.values()].map(row => ({ ...row, sampleFraction: row.samples / profile.samples.length,
      sampledTimeFraction: row.sampledTimeUs / totalSampledUs })).sort((a, b) => b.sampledTimeUs - a.sampledTimeUs) };
}
export function heapSummary(head: HeapNode) {
  const rows = new Map<string, { frame: Frame; estimatedSelfBytes: number }>();
  const stack = [head]; let totalEstimatedBytes = 0;
  while (stack.length) {
    const node = stack.pop()!; const key = JSON.stringify([node.callFrame.functionName, node.callFrame.url, node.callFrame.lineNumber]);
    const row = rows.get(key) ?? { frame: node.callFrame, estimatedSelfBytes: 0 };
    row.estimatedSelfBytes += node.selfSize; totalEstimatedBytes += node.selfSize; rows.set(key, row); stack.push(...node.children);
  }
  return { totalEstimatedBytes, scope: 'Cumulative sampled allocation estimate, including collected-object sampling requested for this pass; not live/retained JS heap, RSS, native/WASM bytes or per-room ownership. Sum each node selfSize once; do not add inclusive parent sizes.',
    functions: [...rows.values()].map(row => ({ ...row, fraction: row.estimatedSelfBytes / totalEstimatedBytes })).sort((a, b) => b.estimatedSelfBytes - a.estimatedSelfBytes) };
}
export function componentSummary(measurements: Measurements) {
  return measurements.phases.map(phase => {
    const sum = phase.stepMs.map((step, index) => step + phase.snapshotMs[index] + phase.jsonMs[index]);
    const gc = measurements.gc.flatMap(event => {
      const overlap = Math.min(event.startMs + event.durationMs, phase.measuredEndPerfMs) - Math.max(event.startMs, phase.measuredStartPerfMs);
      return overlap > 0 ? [overlap] : [];
    });
    // Terminal states never restart within this fixture. A transition tick still performs physics.
    const activeBefore = phase.stepMs.filter((_, i) => (i ? phase.status[i - 1] : phase.status[0]) === 'active');
    const terminalBefore = phase.stepMs.filter((_, i) => i > 0 && phase.status[i - 1] !== 'active');
    return { scene: phase.scene, mode: phase.mode, constructionMs: (phase.constructionEndUs - phase.constructionStartUs) / 1000,
      warmupMs: (phase.warmupEndUs - phase.warmupStartUs) / 1000, measuredWallMs: (phase.measuredEndUs - phase.measuredStartUs) / 1000,
      stepAll: distribution(phase.stepMs), activeBeforeStep: distribution(activeBefore), terminalBeforeStep: distribution(terminalBefore),
      stateClassification: 'Transition-to-terminal tick remains in active physics; first tick is treated as active only when its observed post-step state is active. Exact fixture states are retained in raw JSON.',
      snapshot: distribution(phase.snapshotMs), json: distribution(phase.jsonMs), pairedStepSnapshotJson: distribution(sum),
      componentScope: 'Invocation work only, no authority scheduling delay, Colyseus msgpack encoding, network queues or six-client fan-out. Recording tape remains enabled.',
      observedGc: { ...distribution(gc), totalMs: gc.reduce((total, value) => total + value, 0),
        fractionOfMeasuredWall: gc.reduce((total, value) => total + value, 0) / ((phase.measuredEndUs - phase.measuredStartUs) / 1000) },
      peakSampledRss: Math.max(...phase.processWindows.map(row => row.memory.rss)),
      minimumObservedHostFree: Math.min(...phase.processWindows.map(row => row.hostFreeBytes)),
      hostLoad: phase.processWindows.map(row => row.hostLoad), finalRun: phase.final.run };
  });
}
async function analyze(cpuDirectory: string, allocationDirectory: string) {
  const cpu = cpuSummary(JSON.parse(await readFile(path.join(cpuDirectory, 'simulation.cpuprofile'), 'utf8')) as CpuProfile);
  const components = componentSummary(JSON.parse(await readFile(path.join(cpuDirectory, 'cpu-measurements.json'), 'utf8')) as Measurements);
  const allocations: Record<string, ReturnType<typeof heapSummary>> = {};
  for (const scene of ['crossing', 'rescue']) {
    const profilePath = path.join(allocationDirectory, `allocation-${scene}.heapprofile.json`);
    let raw: string;
    try { raw = await readFile(profilePath, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      raw = gunzipSync(await readFile(`${profilePath}.gz`)).toString('utf8');
    }
    const saved = JSON.parse(raw) as { profile: { head: HeapNode } };
    allocations[scene] = heapSummary(saved.profile.head);
  }
  const result = { cpu, components, allocations, qualification: 'Local instrumented source-level investigation; no production/capacity/room-memory claim.' };
  await writeFile(path.join(cpuDirectory, 'analysis.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ components, allocationEstimates: Object.fromEntries(Object.entries(allocations).map(([scene, data]) => [scene, data.totalEstimatedBytes])) }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error('Usage: npx tsx scripts/local-load-profile-analysis.ts CPU_REPORT_DIRECTORY ALLOCATION_REPORT_DIRECTORY');
  await analyze(path.resolve(process.argv[2]), path.resolve(process.argv[3]));
}
