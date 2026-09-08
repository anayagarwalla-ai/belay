import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
process.on('SIGTERM', () => {});
const ready = () => process.send({ type: 'ready', index: config.index, records: 0, samples: 0, persistedSamples: 0, recordBytes: 0,
  currentOrdinal: null, currentTick: null, sourceSha256: 'test-source', runtimeSha256: 'test-runtime', failure: null });
if (config.mode === 'finalization' || config.mode === 'blocked-finalization') {
  await import(config.nativeHooksModule);
  const { finalizeParallelEvidence } = await import(config.finalizerModule);
  const { startWatchdog } = await import(config.watchdogModule);
  const folder = path.dirname(process.argv[2]), blocked = config.mode === 'blocked-finalization';
  const fifo = path.join(folder, blocked ? 'status.json.tmp' : 'result.json.tmp');
  await writeFile(path.join(folder, 'status.json'), JSON.stringify({ status: 'INCOMPLETE' }));
  execFileSync('/usr/bin/mkfifo', [fifo]);
  let failure = null;
  const guard = startWatchdog({ ...config.guard, parentPid: process.ppid, deadline: Date.now() + config.lifeMs }, reason => { failure ??= reason; });
  await guard.ready;
  process.on('SIGTERM', () => { failure ??= 'Actual SIGTERM during finalization'; if (!blocked) void readFile(fifo); });
  setTimeout(ready, config.sampleMs);
  await finalizeParallelEvidence(folder, config.report, config.plan, {}, {
    failure: () => failure, abort: reason => { failure ??= reason; },
    releaseGuard: force => guard.release(force), releaseSignals: () => {},
  });
  process.exit(config.report.evidenceStatus === 'COMPLETE' ? 0 : 1);
}
if (config.mode === 'native-physics') {
  await import(config.nativeHooksModule);
  const { initializePhysics } = await import(config.simulationModule);
  const { runTrajectory } = await import(config.harnessModule); await initializePhysics();
  const results = config.specs.map(spec => { const value = runTrajectory(spec, undefined, true);
    return { finalState: value.finalState, tape: value.tape, policyInputsSha256: value.record.policyInputsSha256 }; });
  const compilerChildren = await new Promise((resolve, reject) => {
    const probe = execFile('/bin/ps', ['-axo', 'pid=,ppid=,comm='], { maxBuffer: config.maximumBytes }, (error, stdout) => {
      if (error) return reject(error);
      resolve(stdout.trim().split('\n').map(line => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line))
        .filter(row => row && Number(row[2]) === process.pid && Number(row[1]) !== probe.pid).map(row => row[3]));
    });
  });
  const text = JSON.stringify({ results, compilerChildren });
  if (Buffer.byteLength(text) > config.maximumBytes) throw new Error('Native fixture output bound reached');
  await writeFile(path.join(path.dirname(process.argv[2]), 'native.json'), text); ready();
  await new Promise(() => { setInterval(() => {}, config.sampleMs); });
}
if (config.mode === 'watchdog' || config.mode === 'orphan' || config.mode === 'stalled-sentinel') {
  const { startWatchdog } = await import(config.watchdogModule);
  class StalledSentinelThread extends Worker {
    constructor(source, options) {
      const needle = "const { writeFile } = require('node:fs');";
      if (!source.includes(needle)) throw new Error('Sentinel test injection no longer matches the real worker program');
      // Fault-inject only the filesystem adapter; its callback never completes.
      super(source.replace(needle, 'const writeFile = () => {};'), options);
    }
  }
  const guard = startWatchdog({ ...config.guard, parentPid: process.ppid, deadline: Date.now() + config.lifeMs }, () => {},
    config.mode === 'stalled-sentinel' ? StalledSentinelThread : Worker);
  await guard.ready;
}
if (config.logs) process.stdout.write('x'.repeat(config.logs));
if (config.mode === 'malformed') {
  process.send({ type: 'ready', index: config.index, records: 'not-a-count' });
  setInterval(() => {}, config.sampleMs);
} else {
  process.send({ type: 'ready', index: config.index, records: 0, samples: 0, persistedSamples: 0, recordBytes: 0,
    currentOrdinal: null, currentTick: null, sourceSha256: 'test-source', runtimeSha256: 'test-runtime', failure: null }, () => {
    if (config.mode === 'idle') setInterval(() => {}, config.sampleMs);
    else while (true) { /* Deliberately block main JS; watchdog and parent cleanup must still work. */ }
  });
}
