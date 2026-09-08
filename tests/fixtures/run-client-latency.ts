import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { cpus } from 'node:os';
import { TUNING } from '../../tuning';
// Start the owned fixture, open and join it in this isolated browser session, then run this collector.
const output = process.argv[2] ?? 'work/phase2-client-latency-recapture.json';
const session = process.argv[3] ?? 'belay-latency-audit';
if (existsSync(output)) throw new Error(`Refusing to overwrite an existing capture: ${output}`);
const evaluate = (script: string) => JSON.parse(execFileSync('npx', ['--no-install', 'agent-browser', '--session', session, 'eval', '--stdin'],
  { input: script, encoding: 'utf8', maxBuffer: TUNING.phase2Evidence.maximumReportBytes }));
const files = ['tuning.ts', ...['client', 'server', 'shared'].flatMap(folder => readdirSync(folder).filter(name => /\.tsx?$/.test(name)).map(name => `${folder}/${name}`)),
  'tests/fixtures/client-loopback.tsx', 'tests/fixtures/client-latency-audit.ts', 'tests/fixtures/serve-client-loopback.ts', 'tests/fixtures/delayed-loopback.ts'];
const report = {
  generatedAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceFiles: files.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') })),
  runtime: { node: process.version, platform: process.platform, cpu: cpus()[0].model, logicalCpus: cpus().length,
    browser: evaluate('({userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight},devicePixelRatio})') },
  tuning: TUNING, scope: 'Eight sequential 10-second real-client windows, owned loopback authority and gateway DelayedStream on both directions of every client socket. Other project heavy jobs held by coordination; unrelated desktop activity remains. Not production hardware or human feel qualification.',
  policy: 'Crossing, mechanicsLoadSeed. Helpers approach near rim then brace based on their delayed snapshots; leader approaches bridge midpoint then braces, moves toward entry wall after falling, and braces after recovery. Leader changes input on the existing 0.5-second evidence cadence. No hidden capacity read by policy.',
  metricNotes: { addedRtt: 'Declared added ordered-stream RTT with zero jitter; HTTP setup is not delayed. Actual echo RTT is measured separately.',
    rawReconciliation: 'XZ magnitude of existing local predicted position plus remaining correction minus a newly received authoritative own-body position, at the production reconciliation branch; large corrections use the unchanged client cutoff.',
    appliedCorrection: 'Distance between final displayed output and the predictor base position, after safe-ground projection. Zero for disabled prediction.',
    receiptToRenderer: 'Receipt to first renderer.render completion callback for snapshots actually submitted; not monitor display latency. Superseded snapshots need not be drawn.',
    acknowledgement: 'Local input submission to receipt of a snapshot explicitly acknowledging that sequence. Latest-ack coalescing omits intermediate sequences; not loss.',
    events: 'Physical event receipt is recorded for all received deltas. Native first-drawn observations exist for bridge warning/collapse and incident falls; other physical event types have no separate draw timestamp.',
    unsupported: 'Disabled-prediction output differing from authoritative interpolation, or moved ordinary-ground output crossing unsupported terrain. Not an audit of authoritative physics penetration.',
    packetLoss: 'Unavailable from WebSocket; none is simulated.', retention: 'Raw frame/event rows keep the first telemetrySamples; metric summaries use existing bounded Samples. Truncation is reported.' },
  cases: [] as unknown[], errors: [] as unknown[], completedAt: null as string | null,
};
mkdirSync(dirname(output), { recursive: true });
const save = () => writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
save();
for (let index = 0; index < TUNING.clientLatency.teamSizes.length * TUNING.clientLatency.authorityHz.length * TUNING.clientLatency.addedRttMs.length; index++) {
  try {
    const row = evaluate(`window.BELAY_LATENCY.runCase(${index})`); report.cases.push(row); save();
    console.log(JSON.stringify({ index, ...row.spec, actualCaptureMs: row.actualCaptureMs, rtt: row.network.rttMs, staleGaps: row.staleGaps,
      correction: row.metrics.rawReconciliationM, receiptToRender: row.metrics.receiptToRendererSubmissionMs, unsupported: row.unsupportedPredictionFrames,
      events: row.firstReceivedEvents.map((event: { kind: string }) => event.kind), truncated: row.truncated }));
  } catch (error) { report.errors.push({ index, error: error instanceof Error ? error.message : String(error) }); save(); throw error; }
}
report.completedAt = new Date().toISOString(); report.errors.push(...evaluate('window.__consoleErrors')); save();
