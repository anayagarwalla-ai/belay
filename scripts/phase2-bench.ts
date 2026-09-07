import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { TUNING } from '../tuning';
import { initializePhysics } from '../shared/simulation';
import { FullWindowSamples, summarizeTrajectories } from './phase2-analysis';
import { runTrajectory, type EvidenceRecord } from './phase2-harness';
import { PHASE2_POLICIES, PHASE2_SCENES, trajectorySchedule } from './phase2-policies';
import { provenance, renderBotReport, writeBoundedJSON, type BotReport } from './phase2-report';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--smoke') || args.length > 1) throw new Error('Usage: phase2-bench.ts [--smoke]; numerical profiles come only from root tuning.ts.');
const mode = args.includes('--smoke') ? 'smoke' : 'full';
const schedule = trajectorySchedule(mode === 'smoke' ? TUNING.phase2Evidence.smokeTrajectories : TUNING.phase2Evidence.trajectoryRuns);
const capacity = schedule.reduce((count, spec) => count + Math.ceil(spec.horizonSeconds * spec.tickHz), 0);
const allTimings = new FullWindowSamples(capacity, TUNING.phase2Evidence.maximumTimingBytes);
const source = await provenance();
await initializePhysics();
const records: EvidenceRecord[] = [];
const processMemoryBefore = process.memoryUsage();
const started = performance.now();
let retainedRecordBytes = 0;
await mkdir('work', { recursive: true });
const progressPath = `work/phase2-${mode}-progress.jsonl`;
await writeFile(progressPath, '');
await writeBoundedJSON(`work/phase2-${mode}-progress-source.json`, { ...source,
  scope: 'Incomplete incremental records for interruption recovery and early failure review. Not a completed benchmark.',
  plannedTrajectories: schedule.length });
for (const spec of schedule) {
  const { record } = runTrajectory(spec, allTimings);
  const serialized = JSON.stringify(record) + '\n';
  retainedRecordBytes += Buffer.byteLength(serialized);
  if (retainedRecordBytes > TUNING.phase2Evidence.maximumReportBytes) throw new Error('Raw trajectory accumulation exceeds the root report bound; no complete benchmark is claimed.');
  records.push(record);
  await appendFile(progressPath, serialized);
  console.log(JSON.stringify({ trajectories: records.length, total: schedule.length, scene: spec.scene, policy: spec.policy,
    players: spec.playerCount, lastEnding: record.ending, lastEpisodes: record.episodes.length,
    lastTicks: record.ticks, wallSeconds: (performance.now() - started) / 1000 }));
}
const summary = summarizeTrajectories(records);
if (allTimings.count !== summary.stepAttempts) throw new Error('Full-window timing count does not reconcile with raw trajectory counts.');
const report: BotReport = { ...source, schema: 'phase2-local-evidence-1', generatedAt: new Date().toISOString(), mode,
  scope: `${records.length} fixed-profile local synthetic trajectories across teams 2–6, crossing/focused rescue and the declared policy matrix. Bounded observation is not completed-run evidence.`,
  humanFun: 'NOT EVALUATED', humanRescueStop: 'NOT EVALUATED', productionQualification: 'NOT TESTED',
  wallSeconds: (performance.now() - started) / 1000, processMemoryBefore, processMemoryAfter: process.memoryUsage(),
  timingMethod: 'Exact nearest-rank quantiles of every synchronous simulation.step attempt in this invocation, excluding policy, snapshot collection, network and scheduling. Recording is disabled in benchmark trajectories. Other local tasks may consume CPU; this invocation is not an isolated capacity measurement.',
  isolatedStepMs: allTimings.summary(), summary, records,
  strata: PHASE2_SCENES.flatMap(scene => TUNING.phase2Evidence.teamSizes.flatMap(playerCount => PHASE2_POLICIES.flatMap(policy => {
    const selected = records.filter(row => row.scene === scene && row.playerCount === playerCount && row.policy === policy);
    return selected.length ? [{ scene, playerCount, policy, metrics: summarizeTrajectories(selected) }] : [];
  }))),
};
const prefix = mode === 'smoke' ? 'reports/phase2-smoke' : 'reports/phase2-bots';
const file = await writeBoundedJSON(`${prefix}.json`, report);
await writeFile(`${prefix}.md`, renderBotReport(report, `${prefix.split('/').at(-1)}.json`));
console.log(JSON.stringify({ file, wallSeconds: report.wallSeconds, outcomes: { complete: summary.complete, fixtureRecovered: summary.fixtureRecovered,
  failed: summary.failed, censored: summary.censored, errors: summary.errors, incompleteEvidence: summary.incompleteEvidence },
  eventualRecovery: summary.eventualRecovery, firstAttemptRecovery: summary.firstAttemptRecovery, isolatedStepMs: report.isolatedStepMs }));
if (summary.errors || summary.incompleteEvidence) process.exitCode = 1;
