import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as pauseTimer } from 'node:timers/promises';
import { TUNING } from '../tuning';
import { LocalChild } from './local-load-supervisor';
import { delay, manifest as makeManifest, until, type LoadManifest } from './local-load-model';
import { acceptanceAudit, auditGenerators, type AuthorityInspection } from './local-load-analysis';
import type { GeneratorResult } from './local-load-generator';

type ProcessSample = { pid: number; role: string; memory: NodeJS.MemoryUsage; fromMonoMs: number; toMonoMs: number; [key: string]: unknown };
type WorkerSample = { process: ProcessSample; population: { [key: string]: unknown } };
type SampleWindow = { stage: string; sequence: number; controllerMonoMs: number; controllerMemory: NodeJS.MemoryUsage;
  hostFreeMemoryBytes: number; hostLoadAverage: number[]; totalOwnedRssBytes: number; workers: WorkerSample[] };
type Credentials = { endpoint: string; operatorToken: string; testerToken: string; pid: number };

export async function runLocalLoad(manifest: LoadManifest, outputDirectory: string) {
  const settings = manifest.settings, children: LocalChild[] = [], samples: SampleWindow[] = [];
  const lifecycle: { kind: string; sample: WorkerSample; cycle?: number; events?: unknown }[] = [], functional: unknown[] = [];
  const started = performance.now(); let stage = 'startup', sampling = false, sequence = 0, evidenceBytes = 0, sampleBytes = 0;
  const cancellation = new AbortController();
  const pause = (ms: number) => pauseTimer(ms, undefined, { signal: cancellation.signal });
  let abortReason: string | null = null;
  let rejectAbort!: (error: Error) => void;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  // Attach a handler immediately; the same promise still rejects the in-progress workflow race.
  void aborted.catch(() => {});
  const abort = (reason: string) => { if (!abortReason) { abortReason = reason; rejectAbort(new Error(reason)); cancellation.abort(); } };
  const onSignal = () => abort('Operator interrupted the local diagnostic');
  const secrets: string[] = [];
  await mkdir(outputDirectory, { recursive: false });
  const writeEvidence = async (filename: string, value: unknown) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, filename === 'result.json' ? undefined : 2) + '\n';
    const bytes = Buffer.byteLength(text);
    if (evidenceBytes + bytes > settings.maximumReportBytes) throw new Error('Evidence output byte cap exceeded; preserve the incomplete run');
    if (secrets.some(secret => text.includes(secret))) throw new Error('Refusing to write a private credential into evidence');
    await writeFile(path.join(outputDirectory, filename), text, { flag: 'wx', mode: 0o600 }); evidenceBytes += bytes;
  };
  const sourcePaths = [...execFileSync('git', ['ls-files', 'shared', 'server', 'tuning.ts', 'package-lock.json'], { encoding: 'utf8' }).trim().split('\n'), 'scripts/client-utils.ts',
    'scripts/local-load-run.ts', 'scripts/local-load-model.ts', 'scripts/local-load-generator.ts', 'scripts/local-load-authority.ts',
    'scripts/local-load-worker.ts', 'scripts/local-load-supervisor.ts', 'scripts/local-load-analysis.ts'];
  const sourceHashes = Object.fromEntries(await Promise.all(sourcePaths.map(async filename => [filename, createHash('sha256').update(await readFile(filename)).digest('hex')])));
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8')) as { packages: Record<string, { version: string }> };
  const versions = Object.fromEntries(await Promise.all(['@colyseus/core', '@colyseus/sdk', '@colyseus/ws-transport', '@dimforge/rapier3d-compat', 'ws'].map(async name => {
    const installed = JSON.parse(await readFile(`node_modules/${name}/package.json`, 'utf8')) as { version: string };
    return [name, { installed: installed.version, locked: lock.packages[`node_modules/${name}`]?.version }];
  })));
  await writeEvidence('manifest.json', { manifest, tuning: TUNING, revision, dirty, sourceHashes,
    invocation: process.argv, generatedAt: new Date().toISOString(), machine: { platform: os.platform(), release: os.release(), arch: os.arch(),
      cpus: os.cpus().map(cpu => cpu.model), availableParallelism: os.availableParallelism(), totalMemoryBytes: os.totalmem(), node: process.version },
    installedVersions: versions,
    scope: 'Bounded loopback sockets on one shared machine. Authority and generators have independent child-process event loops. Other machine activity is uncontrolled and host load/free memory are sampled. No production placement, capacity, human or launch qualification.',
    limits: ['Sampled RSS/free-memory stops have cadence-sized overshoot; V8 heap limits do not cap native/WASM allocations.',
      'Read-only authority inspection serializes existing summaries once per sample and adds observer overhead.',
      'No public tunnel, provisioning, dev-session credentials, external messages, or cross-process PID adoption.'] });
  const wall = setTimeout(() => abort('Maximum whole-run wall time reached'), settings.maximumWallMs - (performance.now() - started));
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  const authority = new LocalChild('authority', settings); children.push(authority);
  let sampleTask: Promise<void> | undefined;
  const takeSample = async (): Promise<SampleWindow> => {
    const results = await Promise.all(children.map(child => child.request<WorkerSample>('sample', undefined, TUNING.network.debugTimeoutMs)));
    const controllerMemory = process.memoryUsage(), totalOwnedRssBytes = controllerMemory.rss + results.reduce((sum, result) => sum + result.process.memory.rss, 0);
    const sample: SampleWindow = { stage, sequence: sequence++, controllerMonoMs: performance.now(), controllerMemory,
      hostFreeMemoryBytes: os.freemem(), hostLoadAverage: os.loadavg(), totalOwnedRssBytes, workers: results };
    samples.push(sample);
    // Check the raw window as it arrives rather than accumulating without an evidence bound.
    sampleBytes += Buffer.byteLength(JSON.stringify(sample));
    if (sampleBytes > settings.maximumReportBytes) abort('Sample evidence cap reached');
    if (totalOwnedRssBytes > settings.maximumTotalRssBytes) abort('Owned process RSS cap reached');
    if (sample.hostFreeMemoryBytes < settings.minimumFreeMemoryBytes) abort('Host free memory guard reached');
    return sample;
  };
  let before: AuthorityInspection | undefined, after: AuthorityInspection | undefined;
  let generators: GeneratorResult[] = [], preparation: unknown[] = [], finalEmpty: AuthorityInspection | undefined;
  let failure: string | null = null;
  let teardown: Awaited<ReturnType<LocalChild['stop']>>[] = [];
  const workflow = async () => {
    const credentials = await authority.request<Credentials>('initialize', settings);
    secrets.push(credentials.operatorToken, credentials.testerToken);
    for (let i = 0; i < manifest.generators; i++) { const generator = new LocalChild('generator', settings); children.push(generator); await generator.request('initialize', settings); }
    sampling = true;
    sampleTask = (async () => { while (sampling) { await takeSample(); await delay(settings.sampleMs); } })().catch(error => abort(`Sampling failed: ${error instanceof Error ? error.message : String(error)}`));
    const generatorsChildren = children.slice(1);
    stage = 'functional';
    functional.push(...await generatorsChildren[0].request<unknown[]>('functional', credentials));
    await until(async () => (await authority.request<AuthorityInspection>('inspect')).worldCount === 0, settings.startupTimeoutMs, settings.probePollMs, 'functional rooms dispose');
    stage = 'lifecycle';
    lifecycle.push({ kind: 'initialized-empty-baseline', sample: await authority.request('sample') });
    for (let cycle = 0; cycle < settings.lifecycleCycles; cycle++) {
      const events = await generatorsChildren[0].request('lifecycle', credentials);
      await until(async () => (await authority.request<AuthorityInspection>('inspect')).worldCount === 0, settings.startupTimeoutMs, settings.probePollMs, 'cycle rooms dispose');
      lifecycle.push({ kind: 'after-create-dispose-cycle', cycle, events, sample: await authority.request('sample') });
    }
    stage = 'population-ramp';
    preparation = await Promise.all(generatorsChildren.map((child, generator) => child.request('prepare', { ...credentials, manifest, generator })));
    before = await authority.request<AuthorityInspection>('inspect');
    if (before.worldCount !== manifest.rooms.length || before.connected !== manifest.expectedClients) throw new Error('Authority population differs from manifest');
    stage = 'warmup'; await pause(settings.warmupMs);
    before = await authority.request<AuthorityInspection>('inspect');
    const startAtWallMs = Date.now() + settings.startLeadMs;
    await Promise.all(generatorsChildren.map(child => child.request('start', { startAtWallMs })));
    stage = 'fixed-input-window'; await pause(settings.startLeadMs + manifest.seconds * 1000);
    // Allow offered messages and final acknowledgements to reach their actual endpoints.
    stage = 'drain'; await pause(TUNING.body.maximumInputAgeMs + settings.sampleMs);
    generators = await Promise.all(generatorsChildren.map(child => child.request<GeneratorResult>('result')));
    after = await authority.request<AuthorityInspection>('inspect');
    stage = 'dispose'; await Promise.all(generatorsChildren.map(child => child.request('close')));
    await until(async () => (await authority.request<AuthorityInspection>('inspect')).worldCount === 0, settings.startupTimeoutMs, settings.probePollMs, 'all workload rooms dispose');
    finalEmpty = await authority.request<AuthorityInspection>('inspect');
    lifecycle.push({ kind: 'after-full-population-disposal', sample: await authority.request('sample') });
  };
  try { await Promise.race([workflow(), aborted]); }
  catch (error) { failure = error instanceof Error ? error.message : String(error); }
  finally {
    sampling = false; clearTimeout(wall);
    if (sampleTask) await sampleTask;
    teardown = await Promise.all(children.slice().reverse().map(child => child.stop()));
    process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
  }
  const audit = auditGenerators(manifest, generators);
  const acceptance = before && after ? acceptanceAudit(before, after, audit.offeredByRoom) : [];
  const peakOwnedRssBytes = Math.max(0, ...samples.map(sample => sample.totalOwnedRssBytes));
  const memoryGrowth = lifecycle.map(row => ({ kind: row.kind, cycle: row.cycle, memory: row.sample.process.memory,
    liveRooms: row.sample.population.worldCount, authorityMonoMs: row.sample.process.toMonoMs }));
  const firstMemory = memoryGrowth[0]?.memory, lastMemory = memoryGrowth.at(-1)?.memory;
  const processDelta = firstMemory && lastMemory ? Object.fromEntries(Object.keys(firstMemory).map(key => [key,
    lastMemory[key as keyof NodeJS.MemoryUsage] - firstMemory[key as keyof NodeJS.MemoryUsage]])) : null;
  const loadSamples = samples.filter(sample => sample.stage === 'fixed-input-window');
  const populationWindows = loadSamples.map(sample => ({ sequence: sample.sequence, controllerMonoMs: sample.controllerMonoMs,
    authority: (() => { const population = sample.workers.find(worker => worker.process.role === 'authority')?.population;
      return { worldCount: population?.worldCount, connected: population?.connected }; })(),
    generatorSockets: sample.workers.filter(worker => worker.process.role === 'generator').reduce((sum, worker) => sum + Number(worker.population.openSockets), 0) }));
  const metrics = { rawSchedule: audit.problems.length ? 'INVALID' : 'PASS',
    offeredSchedule: audit.problems.length ? 'INVALID' : audit.counts.late + audit.counts.backpressure + audit.counts.sendError ? 'FAIL' : 'PASS',
    exactAcceptance: !acceptance.length || acceptance.some(row => row.accepted === null) ? 'NOT RUN' : acceptance.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL',
    completePopulation: before?.worldCount === manifest.rooms.length && before.connected === manifest.expectedClients ? 'PASS' : 'NOT RUN',
    workloadRoomDisposal: finalEmpty?.worldCount === 0 ? 'PASS' : 'NOT RUN',
    fullSlotTiming: 'NOT RUN', perRoomMemoryAttribution: 'NOT RUN', sameBodyReconnection: 'UNIMPLEMENTED' };
  const result = { status: failure ? 'INCOMPLETE' : 'COMPLETE', failure, elapsedMs: performance.now() - started, audit, acceptance, functional,
    before, after, finalEmpty, preparation, lifecycle, generators, samples, populationWindows, metrics,
    resource: { peakOwnedRssBytes, peakScope: 'Observed sum of separate authority/generator/controller process RSS; overlapping fields such as external/arrayBuffers are not added.',
      emptyAuthorityMemorySamples: memoryGrowth, initializedToFinalProcessDeltaBytes: processDelta,
      perRoomMemory: 'NOT RUN: no exact JS/native/WASM ownership attribution. Post-disposal memory growth is observational; allocator retention, GC timing and reachable leaks are not distinguished.' },
    timing: { status: 'NOT RUN: full-slot deadline qualification', scope: `Existing room summaries retain at most ${TUNING.network.telemetrySamples} recent completed callbacks. Creation/warm-up/drain may overlap the ring. They exclude dropped callback completions and do not expose raw due/start/finish slots. No aggregate room p99 or full fixed-window deadline pass is computed.`,
      roomWindows: after?.rooms.map(room => ({ roomId: room.roomId, execution: room.counters?.tickExecutionMs,
        scheduling: room.counters?.schedulingLatenessMs, combined: room.counters?.schedulingPlusExecutionMs,
        droppedWallMs: room.droppedWallMs, skippedTickSlots: room.skippedTickSlots })) ?? [] },
    reconnect: { status: 'UNIMPLEMENTED', eligibleTrials: 0, successes: 0, successFraction: null, explanation: 'Phase 4 same-body reservation/reconnection is absent. Fresh joins in churn never enter a reconnect denominator.' },
    slowReader: { faults: generators.flatMap(generator => generator.faults.filter(fault => fault.kind === 'real-socket-read-pause')),
      snapshotSkipsObserved: after?.rooms.reduce((sum, room) => sum + Number(room.skippedSnapshots ?? 0), 0) ?? null,
      interpretation: 'A real ws receive pause is applied. Healthy partner progress is checked. If skip count stays zero, the server backpressure threshold was NOT EXERCISED; OS socket buffers may absorb the bounded pause.' },
    teardown: { ownedChildren: teardown, ownedOnly: true, credentials: 'Ephemeral authority exited; no tokens were written to disk.', allWorkloadRoomsAbsentBeforeShutdown: finalEmpty?.worldCount === 0 },
    qualification: 'NOT RUN — future production launch protocol is not satisfied by this local diagnostic.' };
  const number = (value: unknown) => typeof value === 'number' ? value.toFixed(3) : 'unavailable';
  const roomRows = result.timing.roomWindows.map(room => `| ${room.roomId} | ${number((room.execution as { p99?: number })?.p99)} | ${number((room.scheduling as { p99?: number })?.p99)} | ${number((room.combined as { p99?: number })?.p99)} | ${number(room.droppedWallMs)} | ${number(room.skippedTickSlots)} |`).join('\n');
  const memoryRows = memoryGrowth.map(row => `| ${row.kind}${row.cycle === undefined ? '' : ` ${row.cycle}`} | ${number(row.liveRooms)} | ${(row.memory.rss / 1024 / 1024).toFixed(1)} | ${(row.memory.heapUsed / 1024 / 1024).toFixed(1)} | ${(row.memory.external / 1024 / 1024).toFixed(1)} |`).join('\n');
  let markdown = `# BELAY local socket diagnostic\n\n${result.status}${failure ? `: ${failure}` : ''}. **Production qualification: NOT RUN.**\n\n` +
    `${manifest.rooms.length} rooms, ${manifest.expectedClients} real sockets, ${manifest.seconds} seconds of fixed ${manifest.inputHz} Hz inputs; ${manifest.generators} generator processes plus one authority. Source revision ${revision}; exact file hashes and dirty state are in manifest.json.\n\n` +
    `| Diagnostic check | Status |\n|---|---|\n${Object.entries(metrics).map(([name, status]) => `| ${name} | ${status} |`).join('\n')}\n\n` +
    `| Input evidence | Count |\n|---|---:|\n| Scheduled | ${manifest.expectedScheduled} |\n| Offered | ${audit.counts.offered} |\n| Expired generator slots | ${audit.counts.late} |\n| Disconnected slots | ${audit.counts.disconnected} |\n| Buffered/send-error slots | ${audit.counts.backpressure + audit.counts.sendError} |\n| Exact server accepted delta | ${acceptance.every(row => row.accepted !== null) && acceptance.length ? acceptance.reduce((sum, row) => sum + row.accepted!, 0) : 'unavailable'} |\n| Observed individual sequence acknowledgements (lower bound) | ${audit.observedAcknowledged} |\n\n` +
    `Full-window offered lateness p50/p95/p99/max (ms): ${number(audit.offeredLatenessMs.p50)} / ${number(audit.offeredLatenessMs.p95)} / ${number(audit.offeredLatenessMs.p99)} / ${number(audit.offeredLatenessMs.max)}. Raw lossless planes and the deterministic schedule are in JSON; nearest-rank definition is included. Audit: ${audit.problems.length ? audit.problems.join('; ') : 'all scheduled slots reconcile'}.\n\n` +
    `| Room (available completed-callback ring) | Execution p99 ms | Scheduling p99 ms | Paired combined p99 ms | Dropped wall ms | Skipped tick slots |\n|---|---:|---:|---:|---:|---:|\n${roomRows}\n\n${result.timing.scope}\n\n` +
    `Observed owned-process RSS peak: ${(peakOwnedRssBytes / 1024 / 1024).toFixed(1)} MiB. This includes the controller and separate child processes. ${result.resource.perRoomMemory}\n\n` +
    `| Empty authority observation | Live rooms | Process RSS MiB | Heap used MiB | External MiB |\n|---|---:|---:|---:|---:|\n${memoryRows}\n\nThese are natural, unforced-GC process samples; external includes arrayBuffers. They expose growth after disposal without attributing it to room leaks.\n\n` +
    `Lifecycle: ${settings.lifecycleCycles} create/dispose cycles plus full-load disposal; final live room count ${finalEmpty?.worldCount ?? 'unknown'}. ${functional.length} functional checks recorded. Real slow-reader snapshot skips: ${result.slowReader.snapshotSkipsObserved ?? 'unknown'}. ${result.slowReader.interpretation}\n\n` +
    `Same-body reconnect: UNIMPLEMENTED (Phase 4), 0 eligible trials, no success-rate claim. Churn uses a fresh join. All ${teardown.length} owned child exits were observed. Shared-machine contention is uncontrolled; host load/free memory and every sampled process window are in result.json. This is neither a 60-minute production run nor a human gate.\n`;
  let json = JSON.stringify(result) + '\n';
  const manifestText = await readFile(path.join(outputDirectory, 'manifest.json'), 'utf8');
  const checksums = () => [['manifest.json', manifestText], ['result.json', json], ['result.md', markdown]]
    .map(([filename, contents]) => `${createHash('sha256').update(contents).digest('hex')}  ${filename}`).join('\n') + '\n';
  if (evidenceBytes + Buffer.byteLength(json) + Buffer.byteLength(markdown) + Buffer.byteLength(checksums()) > settings.maximumReportBytes) {
    result.status = 'INCOMPLETE'; result.failure = 'Evidence byte cap exceeded; raw planes and sample windows were omitted. This attempt is INVALID.';
    result.metrics.rawSchedule = 'INVALID'; result.audit.problems.push(result.failure);
    // Keep a small failure/teardown receipt inside the cap rather than silently truncate or exceed it.
    json = JSON.stringify({ status: result.status, failure: result.failure, generators: [], omittedRawSlots: manifest.expectedScheduled,
      omittedSampleWindows: samples.length, teardown: result.teardown, qualification: result.qualification }) + '\n';
    markdown = `# BELAY local socket diagnostic\n\nINCOMPLETE. ${result.failure}\n\nThe manifest and owned-child teardown are preserved. All ${teardown.length} owned children exited. No production qualification or timing result can be claimed.\n`;
  }
  await writeEvidence('result.json', json); await writeEvidence('result.md', markdown); await writeEvidence('checksums.txt', checksums());
  return { outputDirectory, result };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--profile=smoke', '--profile=300', '--physics=legacy', '--physics=phase2'].includes(arg))) throw new Error('Usage: npx tsx scripts/local-load-run.ts [--profile=smoke|300] [--physics=legacy|phase2]');
  const manifest = makeManifest(args.includes('--profile=300') ? '300' : 'smoke', args.includes('--physics=phase2') ? 'phase2' : 'legacy');
  await mkdir('reports', { recursive: true });
  const directory = path.resolve('reports', `local-load-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`);
  const { result } = await runLocalLoad(manifest, directory);
  console.log(JSON.stringify({ status: result.status, outputDirectory: directory, failure: result.failure, scheduled: result.audit.expectedScheduled,
    offered: result.audit.counts.offered, accepted: result.acceptance.reduce((sum, row) => sum + (row.accepted ?? 0), 0), teardown: result.teardown }));
  if (result.status !== 'COMPLETE' || result.audit.problems.length) process.exitCode = 1;
}
