import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

type Summary = { samples: number; p50: number | null; p95: number | null; p99: number | null; max: number | null };
type Frame = { atMs: number; tick: number; ageMs: number; unsupported: boolean; rawReconciliationM: number | null;
  appliedCorrectionM: number; predictionFromInterpolationM: number; displayFromLatestAuthorityM: number };
type Event = { id: number; epoch: number; tick: number; kind: string; firstReceivedAtMs: number; receivedInSnapshotTick: number };
type Observation = { kind: string; id: number; epoch: number; firstReceivedAtMs: number; firstDrawnAtMs: number | null;
  firstReceivedTick: number; firstDrawnTick: number | null; endedBeforeDraw: boolean };
type Case = { spec: { playerCount: number; tickHz: number; addedRttMs: number }; actualCaptureMs: number;
  epoch: number; startTick: number; endTick: number; startingPlayers: number; endingPlayers: number;
  snapshots: number; reconciliations: number; hardCorrections: number; staleTransitions: number; staleGaps: number;
  unsupportedPredictionFrames: number; truncated: boolean; rawFrames: Frame[]; firstReceivedEvents: Event[];
  metrics: Record<string, Summary>; presentation: { truncated: boolean; observations: Observation[] };
  network: { receivedSnapshots: number; packetLoss: null; rttMs: Summary; missedEchoProbes: number } };
type Report = { errors: unknown[]; generatedAt: string; completedAt: string; sourceCommit: string;
  sourceFiles: { path: string; sha256: string }[]; cases: Case[];
  tuning: { clientLatency: { teamSizes: number[]; authorityHz: number[]; addedRttMs: number[]; sampleSeconds: number };
    network: { telemetrySamples: number; hardCorrectionDistance: number; staleSnapshotMs: number } } };

const path = process.argv[2] ?? 'reports/phase2-client-latency.json';
// Use the evidence/tools commit here after subsequent client changes; omitted means the current working files.
const sourceRef = process.argv[3];
const bytes = readFileSync(path), report = JSON.parse(bytes.toString()) as Report;
assert.deepEqual(report.errors, []);
assert(Date.parse(report.completedAt) > Date.parse(report.generatedAt));
const profile = report.tuning.clientLatency;
const expected = profile.teamSizes.flatMap(playerCount => profile.authorityHz.flatMap(tickHz => profile.addedRttMs.map(addedRttMs => ({ playerCount, tickHz, addedRttMs }))));
assert.deepEqual(report.cases.map(row => row.spec), expected, 'Incomplete or reordered latency matrix');
const problems: object[] = [];
for (const row of report.cases) {
  assert(row.actualCaptureMs >= profile.sampleSeconds * 1000);
  assert.equal(row.startingPlayers, row.spec.playerCount); assert.equal(row.endingPlayers, row.spec.playerCount);
  assert.equal(row.truncated, false); assert.equal(row.presentation.truncated, false);
  assert(row.rawFrames.length <= report.tuning.network.telemetrySamples);
  assert.equal(row.network.receivedSnapshots, row.snapshots); assert.equal(row.network.packetLoss, null);
  assert.equal(row.metrics.snapshotIntervalsMs.samples, row.snapshots - 1);
  assert.equal(row.reconciliations, row.rawFrames.filter(frame => frame.rawReconciliationM !== null).length);
  assert.equal(row.hardCorrections, row.rawFrames.filter(frame => (frame.rawReconciliationM ?? 0) > report.tuning.network.hardCorrectionDistance).length);
  assert.equal(row.unsupportedPredictionFrames, row.rawFrames.filter(frame => frame.unsupported).length);
  const frameMetrics = { frameAgeMs: 'ageMs', rawReconciliationM: 'rawReconciliationM', appliedCorrectionM: 'appliedCorrectionM',
    predictionFromInterpolationM: 'predictionFromInterpolationM', displayFromLatestAuthorityM: 'displayFromLatestAuthorityM' } as const;
  for (const [metric, field] of Object.entries(frameMetrics)) {
    const values = row.rawFrames.map(frame => frame[field]).filter(value => value !== null).sort((a, b) => a - b);
    assert(values.every(Number.isFinite));
    const summary = row.metrics[metric]; assert.equal(summary.samples, values.length);
    for (const [key, rank] of [['p50', 0.5], ['p95', 0.95], ['p99', 0.99], ['max', 1]] as const) {
      assert.equal(summary[key], values[Math.ceil(values.length * rank) - 1] ?? null, `${metric}.${key}`);
    }
  }
  for (const summary of Object.values(row.metrics)) {
    assert(summary.samples >= 0 && summary.samples <= report.tuning.network.telemetrySamples);
    if (summary.samples) assert(summary.p50! <= summary.p95! && summary.p95! <= summary.p99! && summary.p99! <= summary.max!);
  }
  assert(row.metrics.receiptToRendererSubmissionMs.p50! >= 0);
  assert(row.metrics.receiptToRendererSubmissionMs.samples <= row.snapshots);
  assert.equal(new Set(row.firstReceivedEvents.map(event => event.id)).size, row.firstReceivedEvents.length);
  for (const event of row.firstReceivedEvents) {
    assert.equal(event.epoch, row.epoch); assert(event.tick <= event.receivedInSnapshotTick);
    assert(event.firstReceivedAtMs >= 0 && event.firstReceivedAtMs <= row.actualCaptureMs);
  }
  for (let index = 0; index < row.rawFrames.length; index++) {
    const frame = row.rawFrames[index];
    assert(frame.tick >= row.startTick && frame.tick <= row.endTick);
    assert(frame.atMs >= 0 && frame.atMs <= row.actualCaptureMs);
    if (index) assert(frame.atMs >= row.rawFrames[index - 1].atMs);
  }
  for (const observation of row.presentation.observations) {
    assert.equal(observation.epoch, row.epoch);
    if (observation.firstDrawnTick !== null) assert(observation.firstDrawnTick >= observation.firstReceivedTick);
    if (observation.endedBeforeDraw) assert.equal(observation.firstDrawnAtMs, null);
    if (observation.firstDrawnAtMs !== null && observation.firstDrawnAtMs < observation.firstReceivedAtMs) {
      problems.push({ spec: row.spec, kind: observation.kind, id: observation.id, drawBeforeReceiptMs: observation.firstReceivedAtMs - observation.firstDrawnAtMs });
    }
  }
  const negativeAges = row.rawFrames.filter(frame => frame.ageMs < 0);
  if (negativeAges.length) problems.push({ spec: row.spec, negativeAgeFrames: negativeAges.length, minimumAgeMs: Math.min(...negativeAges.map(frame => frame.ageMs)) });
}
const sourceMismatches = report.sourceFiles.filter(file => {
  const source = sourceRef ? execFileSync('git', ['show', `${sourceRef}:${file.path}`]) : readFileSync(file.path);
  return createHash('sha256').update(source).digest('hex') !== file.sha256;
}).map(file => file.path);
assert.deepEqual(sourceMismatches, [], 'Measured source hashes differ: supply the evidence/tools commit as the third argument when validating after a fix');
console.log(JSON.stringify({ artifact: path, sha256: createHash('sha256').update(bytes).digest('hex'), cases: report.cases.length,
  frames: report.cases.reduce((sum, row) => sum + row.rawFrames.length, 0), sourceRef: sourceRef ?? 'working files',
  integrity: 'valid matrix, retention, source hashes and independently recomputed raw-frame summaries',
  clockDefects: problems, interpretation: problems.length ? 'Native draw-delay and frame-age timing are invalid in this preserved capture; this is not a timing-quality pass.' : 'No reversed receipt/draw timestamps or negative frame ages observed.' }, null, 2));
