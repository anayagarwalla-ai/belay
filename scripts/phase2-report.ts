import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdir, open, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { TUNING, FAMILIES } from '../tuning';
import { summarizeTrajectories, type Quantiles } from './phase2-analysis';
import type { EvidenceRecord } from './phase2-harness';

export async function hashFile(path: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

/** Hash every installed file in the actual resolved package dependency closure,
 * including native optional packages. Do not substitute lockfile declarations
 * for the mutable JavaScript/transpiler executable that will actually run. */
export async function packageRuntimeAssets(packageFile: string, role: string) {
  const assets: { role: string; path: string; sha256: string }[] = [], visited = new Set<string>();
  const visit = async (manifestPath: string, prefix: string) => {
    const resolved = await realpath(manifestPath); if (visited.has(resolved)) return; visited.add(resolved);
    const folder = dirname(resolved), manifest = JSON.parse(await readFile(resolved, 'utf8')) as {
      dependencies?: Record<string, string>; optionalDependencies?: Record<string, string> };
    const walk = async (directory: string) => {
      for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name === 'node_modules') continue;
        const filename = join(directory, entry.name);
        if (entry.isDirectory()) await walk(filename);
        else {
          assets.push({ role: `${prefix}/${relative(folder, filename)}`, path: filename, sha256: await hashFile(filename) });
          if (Buffer.byteLength(JSON.stringify(assets)) > TUNING.phase2Evidence.parallel.maximumMetadataBytes) throw new Error('Runtime dependency manifest exceeds root metadata bound.');
        }
      }
    };
    await walk(folder);
    const require = createRequire(resolved);
    const dependencies = { ...manifest.dependencies, ...manifest.optionalDependencies };
    for (const name of Object.keys(dependencies).sort()) {
      let dependency: string;
      try { dependency = require.resolve(`${name}/package.json`); }
      catch (error) { if (Object.hasOwn(manifest.optionalDependencies ?? {}, name) && (error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') continue; throw error; }
      await visit(dependency, `${prefix}/dependency:${name}`);
    }
  };
  await visit(packageFile, role);
  return assets.sort((a, b) => a.role.localeCompare(b.role));
}

export async function provenance() {
  const paths = ['tuning.ts', 'package.json', 'tsconfig.json', 'package-lock.json', ...(await readdir('shared')).filter(name => name.endsWith('.ts')).map(name => `shared/${name}`),
    ...(await readdir('scripts')).filter(name => name.startsWith('phase2-') && (name.endsWith('.ts') || name.endsWith('.mjs'))).map(name => `scripts/${name}`)].sort();
  const files = await Promise.all(paths.map(async path => ({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })));
  const entrypoint = process.argv[1] ?? null;
  const assets = await Promise.all([
    { role: 'node', path: process.execPath },
    { role: 'tsx-loader', path: fileURLToPath(import.meta.resolve('tsx')) },
    { role: 'rapier-js-and-inlined-wasm', path: fileURLToPath(import.meta.resolve('@dimforge/rapier3d-compat')) },
  ].map(async asset => ({ ...asset, sha256: await hashFile(asset.path) })));
  assets.push(...await packageRuntimeAssets(fileURLToPath(import.meta.resolve('tsx/package.json')), 'tsx-runtime'));
  if (process.env.ESBUILD_BINARY_PATH) assets.push({ role: 'esbuild-binary-override', path: process.env.ESBUILD_BINARY_PATH,
    sha256: await hashFile(process.env.ESBUILD_BINARY_PATH) });
  return { gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), files,
    sourceManifestSha256: createHash('sha256').update(JSON.stringify(files)).digest('hex'),
    runtime: { entrypoint, entrypointSha256: entrypoint ? createHash('sha256').update(await readFile(entrypoint)).digest('hex') : null,
      execArgv: [...process.execArgv], assets,
      nodeOptionsSha256: createHash('sha256').update(process.env.NODE_OPTIONS ?? '').digest('hex') },
    tuning: TUNING, familyDefinitions: FAMILIES,
    machine: { platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model ?? 'unknown',
      availableCpus: os.availableParallelism(), totalMemoryBytes: os.totalmem(), node: process.version } };
}

export async function writeBoundedJSON(path: string, value: unknown, maximumBytes: number = TUNING.phase2Evidence.maximumReportBytes) {
  const text = JSON.stringify(value, null, 2) + '\n';
  const bytes = Buffer.byteLength(text);
  if (bytes > maximumBytes) throw new Error(`Evidence output exceeds root byte bound: ${path} (${bytes} bytes).`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, text);
  await rename(`${path}.tmp`, path);
  return { path, bytes, sha256: createHash('sha256').update(text).digest('hex') };
}

export async function readBoundedJSON(path: string, maximumBytes: number): Promise<unknown> {
  const file = await open(path, 'r');
  try {
    const { size } = await file.stat();
    if (size > maximumBytes) throw new Error('Evidence input exceeds the root byte bound.');
    const bytes = Buffer.alloc(size);
    let offset = 0;
    while (offset < size) {
      const read = await file.read(bytes, offset, size - offset, offset);
      if (!read.bytesRead) throw new Error('Evidence input changed while reading.');
      offset += read.bytesRead;
    }
    if ((await file.read(Buffer.alloc(1), 0, 1, size)).bytesRead) throw new Error('Evidence input grew while reading.');
    return JSON.parse(bytes.toString('utf8'));
  } finally { await file.close(); }
}

export type BotReport = Awaited<ReturnType<typeof provenance>> & {
  generatedAt: string; schema: string; scope: string; mode: 'smoke' | 'full'; wallSeconds: number;
  humanFun: 'NOT EVALUATED'; humanRescueStop: 'NOT EVALUATED'; productionQualification: 'NOT TESTED';
  timingMethod: string; isolatedStepMs: Quantiles;
  processMemoryBefore: NodeJS.MemoryUsage; processMemoryAfter: NodeJS.MemoryUsage;
  summary: ReturnType<typeof summarizeTrajectories>;
  strata: { scene: string; playerCount: number; policy: string; metrics: ReturnType<typeof summarizeTrajectories> }[];
  records: EvidenceRecord[];
  executionModel?: string;
  timingReconciliation?: string;
  evidenceStatus?: 'COMPLETE' | 'INCOMPLETE';
};
const number = (value: number | null) => value === null ? 'unknown' : String(value);
const fraction = (value: number | null) => value === null ? 'unknown' : `${(value * 100).toFixed(2)}%`;

export function renderBotReport(report: BotReport, rawPath: string) {
  const s = report.summary;
  const targets = report.tuning.phase2Evidence.targets;
  const targetComparisons = ['recovery', 'bad'].flatMap(policy => ['crossing', 'rescue'].flatMap(scene => {
    const selected = report.records.filter(record => record.policy === policy && record.scene === scene);
    if (!selected.length) return [];
    const metrics = summarizeTrajectories(selected);
    const label = `${scene} / ${policy}`;
    return [
      `| ${label} | Successful rescue duration | ${targets.rescueSeconds.join('–')} s | p50 ${number(metrics.rescueSecondsSuccessfulOnly.p50)} s; n=${metrics.rescueSecondsSuccessfulOnly.count} |`,
      `| ${label} | First-attempt episode recovery | ${targets.firstAttemptRecoveryFraction.map(fraction).join('–')} | ${fraction(metrics.firstAttemptRecovery.conservativeSuccessFraction)}; ${metrics.firstAttemptRecovery.successes}/${metrics.firstAttemptRecovery.started}; unresolved=${metrics.firstAttemptRecovery.censored} |`,
      `| ${label} | Eventual episode recovery | ${targets.eventualRecoveryFraction.map(fraction).join('–')} | observed lower bound ${fraction(metrics.eventualRecovery.conservativeSuccessFraction)}; upper if all unresolved recover ${fraction(metrics.eventualRecovery.upperBoundIfAllCensoredSucceed)} |`,
      `| ${label} | Per-player episode idle proxy | <${fraction(targets.maximumIdleFraction)} | p50 ${fraction(metrics.perPlayerSimulationIdleFractionProxy.p50)}; p95 ${fraction(metrics.perPlayerSimulationIdleFractionProxy.p95)}; n=${metrics.perPlayerSimulationIdleFractionProxy.count} |`,
      ...(scene === 'crossing' ? [
        `| ${label} | Incidents per observed run | ${targets.incidentsPerRun.join('–')} | p50 ${number(metrics.incidentCountPerTrajectory.p50)}; range ${number(metrics.incidentCountPerTrajectory.min)}–${number(metrics.incidentCountPerTrajectory.max)}; n=${selected.length} |`,
        `| ${label} | First fall | <${targets.firstFallBeforeSeconds} s | ${selected.filter(record => record.firstFallSeconds !== null && record.firstFallSeconds < targets.firstFallBeforeSeconds).length}/${selected.length} observed before threshold; no observed incident=${metrics.trajectoriesWithoutIncident} |`,
        `| ${label} | Completed run duration | ${targets.runSeconds.join('–')} s | p50 ${number(metrics.completedRunSecondsOnly.p50)} s; n=${metrics.completedRunSecondsOnly.count}; censored=${metrics.censored} |`,
      ] : []),
    ];
  }));
  const worst = (values: number[]) => values.length ? Math.max(...values) : null;
  const lines = ['# Phase 2 local bot evidence', '', report.scope, '',
    ...(report.evidenceStatus ? [`Evidence status: **${report.evidenceStatus}**.`, ''] : []),
    `Generated ${report.generatedAt}. Mode: **${report.mode}**. Source manifest: \`${report.sourceManifestSha256}\`.`, '',
    `Raw trajectory records and full root configuration: [${rawPath}](${rawPath}).`, '',
    '**Human fun and the human Phase 2 rescue stop: NOT EVALUATED. Production room capacity/reconnect: NOT TESTED.**', '',
    '## Outcomes and denominators', '',
    `Observed ${s.trajectories} trajectories: ${s.crossingTrajectories} crossing trajectories; ${s.complete} crossing completions; ${s.failed} physical terminal failures across both scenes; ${s.fixtureRecovered} focused-fixture recoveries; ${s.censored} administrative timeouts; ${s.errors} errors. ${s.incompleteEvidence} records have incomplete evidence. A focused recovery is not a completed glacier run.`, '',
    '| Scene | Players | Policy | Trajectories | Run complete | Fixture recovered | Failed | Censored | Episodes recovered / started | First-attempt / started | Cascades |',
    '|---|---:|---|---:|---:|---:|---:|---:|---|---|---:|',
    ...report.strata.map(({ scene, playerCount, policy, metrics: m }) => `| ${scene} | ${playerCount} | ${policy} | ${m.trajectories} | ${m.complete} | ${m.fixtureRecovered} | ${m.failed} | ${m.censored} | ${m.eventualRecovery.successes} / ${m.eventualRecovery.started} | ${m.firstAttemptRecovery.successes} / ${m.firstAttemptRecovery.started} | ${m.cascadeCount} |`), '',
    `Across both deliberately different scenes, eventual episode recovery is ${fraction(s.eventualRecovery.conservativeSuccessFraction)} (${s.eventualRecovery.successes}/${s.eventualRecovery.started}), with ${s.eventualRecovery.censored} unresolved episodes. First-attempt recovery is ${fraction(s.firstAttemptRecovery.conservativeSuccessFraction)} (${s.firstAttemptRecovery.successes}/${s.firstAttemptRecovery.started}). These aggregate mixtures are descriptive, not a population or human success rate; use the scene/team/policy strata.`, '',
    '## Timing and missing outcomes', '',
    `Successful episode duration: p50 ${number(s.rescueSecondsSuccessfulOnly.p50)} s, p95 ${number(s.rescueSecondsSuccessfulOnly.p95)} s, n=${s.rescueSecondsSuccessfulOnly.count}. Unresolved rescue observations: n=${s.unresolvedRescueObservationSeconds.count}; their observation limits are not success durations.`, '',
    `Completed crossing duration: median ${number(s.completedRunSecondsOnly.p50)} s, n=${s.completedRunSecondsOnly.count}. Any terminal crossing outcome: median ${number(s.anyTerminalRunSecondsOnly.p50)} s, n=${s.anyTerminalRunSecondsOnly.count}. Descriptive censor-aware time-to-terminal median: ${number(s.runDurationSurvival.medianSeconds)} s; independent censoring is not established.`, '',
    `First fall among observed falls: median ${number(s.firstFallSecondsObservedOnly.p50)} s, n=${s.firstFallSecondsObservedOnly.count}; ${s.trajectoriesWithoutIncident} trajectories have no observed incident. The raw file retains those exposures and outcomes. Focused rescue starts at a supplied hazard and is not natural first-incident pacing.`, '',
    `${s.fourIncidentSelection.observedTrajectories} crossing trajectories happened to contain four incidents; ${s.fourIncidentSelection.completed} completed. This post-observation selection is not a controlled four-incident completion experiment and does not qualify the plan's completion target.`, '',
    '## Root targets and observed synthetic results', '',
    'Targets are quoted from this report\'s root configuration. These scene/policy comparisons pool team sizes only to make misses visible; the strata above retain sizes. They do not qualify human targets or equate a successful-only median with the duration of every attempted rescue. Censored run incident counts may grow beyond the observation window.', '',
    '| Scene / policy | Metric | Root target | Observation |',
    '|---|---|---|---|', ...targetComparisons, '',
    `Controlled four-incident completion target ${targets.fourIncidentCompletionFraction.map(fraction).join('–')}: **NOT EVALUATED** by this naturally observed matrix.`, '',
    '## Static policies and activity proxies', '',
    `Verified whole-episode recoveries with supported helpers' inputs held at static brace: **${s.staticBraceRecoveryCounterexamples}**. Verified whole-episode recoveries with the last harness input frozen to rest: **${s.frozenTailRecoveryCounterexamples}**. In the two-player focused fixture the tail is the casualty, so frozen-tail success there means an inactive casualty was recovered, not an inactive helper. The actual held IDs and intervention ticks are in every record. Crossing interventions start after an observed incident; earlier dynamic catch input is not relabelled as static from onset.`, '',
    'These are model counterexamples, not proof of human fun or causal blame. Simulation roleActive/roleIdle/staticHold counters and the harness input-idle, unchanged-input and motionless fractions are explicitly proxies. A held key can be useful and moving can be irrelevant. The human arbitrary-fall/static-role stop still requires a human check; any counterexample must be disclosed before advancing.', '',
    '## Measurement scope and reproducibility', '',
    `Worst observed span excess ${number(worst(report.records.map(record => record.maximumSpanErrorM)))} m; segment excess ${number(worst(report.records.map(record => record.maximumSegmentErrorM)))} m; terrain penetration ${number(worst(report.records.map(record => record.diagnostics.maximumTerrainPenetrationM)))} m; body overlap ${number(worst(report.records.map(record => record.diagnostics.maximumBodyOverlapM)))} m. The raw records retain each scene/seed/policy and the energy/work diagnostics. These maxima are measurements, not an assertion that the mechanical bounds passed.`, '',
    `${report.timingMethod} Sample count=${report.isolatedStepMs.count}; p50=${number(report.isolatedStepMs.p50)} ms, p95=${number(report.isolatedStepMs.p95)} ms, p99=${number(report.isolatedStepMs.p99)} ms, max=${number(report.isolatedStepMs.max)} ms. ${report.timingReconciliation ?? `Raw counts reconcile to ${s.stepAttempts} step attempts and ${s.executedTicks} completed authority ticks.`} No recent-sample ring or mean of quantiles is used.`, '',
    report.executionModel ?? 'Worlds run sequentially in one local process. processMemoryBefore/After includes runtime, the full timing buffer and report ownership; it is not per-room memory attribution. There is no transport, scheduler deadline, production worker topology or reconnect workload in this result.', '',
    'The matrix is frozen before execution. It pairs the same seed/family across policies and cycles every team size. Bad-bot idle/brace chances and mistake probability were not adjusted to hit recovery targets. Inputs use visible public terrain/state and do not read hidden bridge capacity. Every timeout stays censored; errors and missing incident/event evidence remain visible.', '',
    report.schema === 'phase2-parallel-result-1'
      ? 'Run from the repository root with `node scripts/phase2-parallel-entry.mjs --plan` to inspect the plan, or `node scripts/phase2-parallel-entry.mjs --run` to start a new four-worker invocation. Replay and stress remain separate bounded workloads. Historical reports are unchanged.'
      : 'Run from the repository root with `npx tsx scripts/phase2-bench.ts --smoke` or `npx tsx scripts/phase2-bench.ts`. Run `npx tsx scripts/phase2-replay.ts` and `npx tsx scripts/phase2-stress.ts` for their separate bounded results. Historical Phase 1 reports are unchanged.', ''];
  return lines.join('\n');
}
