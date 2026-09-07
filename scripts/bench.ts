import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { BelaySimulation, initializePhysics } from '../shared/simulation';
import { seededRandom } from '../shared/terrain';
import { Samples } from '../shared/stats';
import { TUNING, FAMILIES, type Family } from '../tuning';
import { REST, type Move } from '../shared/protocol';

await initializePhysics();
const families = Object.keys(FAMILIES) as Family[];
const timings = new Samples();
const records: { seed: number; family: Family; spanErrorM: number; segmentErrorM: number; distanceM: number[]; tautTransitions: number; maxJoltMps2: number }[] = [];
const memoryBefore = process.memoryUsage();
const start = performance.now();
for (let run = 0; run < TUNING.bot.benchmarkRuns; run++) {
  const family = families[run % families.length], seed = TUNING.seed + run;
  const sim = new BelaySimulation({ family, seed });
  const random = seededRandom(seed);
  let inputs: Move[] = [REST, REST];
  for (let tick = 0; tick < TUNING.bot.benchmarkSeconds * TUNING.tickHz; tick++) {
    if (tick % Math.round(TUNING.bot.actionSeconds * TUNING.tickHz) === 0) inputs = [0, 1].map(() => {
      const value = random();
      return value < TUNING.bot.idleChance ? { ...REST } : {
        x: random() < 0.5 ? -1 : 1, z: random() < 0.5 ? -1 : 1,
        brace: value < TUNING.bot.idleChance + TUNING.bot.braceChance,
      };
    });
    const before = performance.now(); sim.step(inputs); timings.add(performance.now() - before);
  }
  records.push({ seed, family, spanErrorM: sim.counters.maximumSpanErrorM,
    segmentErrorM: sim.counters.maximumSegmentErrorM, distanceM: [...sim.counters.distanceTravelledM],
    tautTransitions: sim.counters.tautTransitions, maxJoltMps2: sim.counters.maximumJoltMps2 });
  sim.dispose();
  if ((run + 1) % 250 === 0) console.log(`${run + 1}/${TUNING.bot.benchmarkRuns} flat-ground trajectories`);
}
const quantile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)];
const summary = families.map(family => {
  const values = records.filter(r => r.family === family);
  return { family, trajectories: values.length, medianDistanceM: quantile(values.flatMap(r => r.distanceM), 0.5),
    p95SegmentErrorM: quantile(values.map(r => r.segmentErrorM), 0.95),
    maxSpanErrorM: Math.max(...values.map(r => r.spanErrorM)), medianTautTransitions: quantile(values.map(r => r.tautTransitions), 0.5) };
});
const source = await readFile('shared/simulation.ts', 'utf8');
const report = { generatedAt: new Date().toISOString(), phase: 1, humanGate: 'NOT EVALUATED',
  scope: '1000 deterministic 20-second two-bot flat trajectories. Not glacier runs and not a production room load test.',
  machine: { platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0].model, memoryBytes: os.totalmem() },
  tuning: TUNING, familyDefinitions: FAMILIES,
  sourceAndTuningSha256: createHash('sha256').update(source + JSON.stringify({ TUNING, FAMILIES })).digest('hex'),
  wallSeconds: (performance.now() - start) / 1000, isolatedSimulationTickMs: timings.summary(),
  processMemoryBefore: memoryBefore, processMemoryAfter: process.memoryUsage(), summary, records };
await mkdir('reports', { recursive: true });
await writeFile('reports/phase1-bots.json', JSON.stringify(report, null, 2) + '\n');
const lines = ['# Phase 1 bot diagnostics', '', report.scope, '', `Generated: ${report.generatedAt}. CPU: ${report.machine.cpu}.`, '',
  '| Family | Trajectories | Median distance per climber (m) | p95 maximum segment violation (m) | Worst span violation (m) | Median taut transitions |',
  '|---|---:|---:|---:|---:|---:|', ...summary.map(r => `| ${r.family} | ${r.trajectories} | ${r.medianDistanceM.toFixed(2)} | ${r.p95SegmentErrorM.toFixed(4)} | ${r.maxSpanErrorM.toFixed(4)} | ${r.medianTautTransitions} |`), '',
  `Isolated simulation tick: p50 ${report.isolatedSimulationTickMs.p50?.toFixed(3)} ms; p95 ${report.isolatedSimulationTickMs.p95?.toFixed(3)} ms. Excludes network, scheduling and serialization.`, '',
  '| Required later metric | Status |', '|---|---|', '| Glacier run duration / incidents / first fall | N/A: no runs or hazards in Phase 1 |',
  '| Rescue success / cascade / inactivity | N/A: no rescue in Phase 1 |', '| 300-room production tick, memory, reconnect success | NOT TESTED: Phase 6 gate |',
  '| Human fun and latency threshold | NOT EVALUATED: awaiting Gate 1 |', '',
  'Process memory is shared runtime memory, not a per-room allocation measurement. No human tuning sessions were consumed.', ''];
await writeFile('reports/phase1-bots.md', lines.join('\n'));
console.log(JSON.stringify({ wallSeconds: report.wallSeconds, summary, isolatedSimulationTickMs: report.isolatedSimulationTickMs }));
