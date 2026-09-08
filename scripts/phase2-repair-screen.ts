import { mkdir, appendFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { TUNING } from '../tuning';
import { initializePhysics } from '../shared/simulation';
import { trajectorySchedule } from './phase2-policies';
import { runTrajectoryAsync } from './phase2-harness';
import { provenance, writeBoundedJSON } from './phase2-report';

const profile = TUNING.phase2Evidence.repairScreen, shard = Number(process.argv[2]);
if (process.argv.length !== 3 || !Number.isInteger(shard) || shard < 0 || shard >= profile.shards)
  throw new Error('Usage: node --max-old-space-size=256 --import tsx scripts/phase2-repair-screen.ts SHARD_INDEX');
const schedule = trajectorySchedule(TUNING.phase2Evidence.trajectoryRuns)
  .filter(spec => (profile.seeds as readonly number[]).includes(spec.seed)).filter((_, index) => index % profile.shards === shard)
  .map(spec => ({ ...spec, horizonSeconds: Math.min(spec.horizonSeconds, profile.seconds) }));
const directory = `reports/phase2-repair-screen-${new Date().toISOString().replaceAll(':', '-')}-${shard}-${randomUUID()}`;
await mkdir(directory, { recursive: false });
const source = await provenance(), started = Date.now();
await writeBoundedJSON(`${directory}/manifest.json`, { source, schedule, shard,
  scope: 'Bounded early-contact regression screen. No full run-length distribution or production timing qualification.' });
console.log(JSON.stringify({ directory, planned: schedule.length }));
let failure: string | null = null;
const stop = () => failure ??= Date.now() - started > profile.maximumWallMs ? 'Screen deadline reached'
  : process.memoryUsage().rss > TUNING.phase2Evidence.parallel.maximumWorkerRssBytes ? 'Screen RSS guard reached'
  : typeof process.availableMemory !== 'function' || process.availableMemory() < TUNING.phase2Evidence.parallel.minimumOngoingAvailableBytes ? 'Screen available-memory guard reached' : null;
const interrupted = () => { failure = 'Operator interrupted the screen'; };
process.on('SIGINT', interrupted); process.on('SIGTERM', interrupted);
await initializePhysics();
let observed = 0;
for (const spec of schedule) {
  if (stop()) break;
  const { record, tape } = await runTrajectoryAsync(spec, undefined, true, { stopReason: stop });
  await appendFile(`${directory}/records.jsonl`, `${JSON.stringify(record)}\n`); observed++;
  const limits = TUNING.physicsDiagnostics;
  if (record.error || !record.evidenceComplete || record.maximumSegmentErrorM > limits.maximumSegmentErrorM
    || record.maximumSpanErrorM > limits.maximumSpanErrorM || record.diagnostics.maximumTerrainPenetrationM > limits.maximumFloorErrorM
    || record.diagnostics.maximumBodyOverlapM > limits.maximumBodyOverlapM || record.diagnostics.maximumPotentialExcessJ > TUNING.phase2.energyToleranceJ) {
    failure ??= `Physical/evidence bound failed at ordinal ${spec.ordinal}`;
    await writeBoundedJSON(`${directory}/failure-tape.json`, tape);
  }
  console.log(JSON.stringify({ observed, planned: schedule.length, ordinal: spec.ordinal, ending: record.ending,
    maximumSegmentErrorM: record.maximumSegmentErrorM, failure }));
  if (failure) break;
}
const finalSource = await provenance();
if (finalSource.sourceManifestSha256 !== source.sourceManifestSha256) failure ??= 'Source changed during screen';
await writeBoundedJSON(`${directory}/result.json`, { complete: observed === schedule.length, passed: !failure && observed === schedule.length,
  observed, planned: schedule.length, failure, wallSeconds: (Date.now() - started) / 1000 });
if (failure || observed !== schedule.length) process.exitCode = 1;
