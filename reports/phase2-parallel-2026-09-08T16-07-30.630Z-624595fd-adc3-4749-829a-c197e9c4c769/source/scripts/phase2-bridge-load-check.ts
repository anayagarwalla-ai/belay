import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { TUNING } from '../tuning';
import { REST, type SimulationSnapshot } from '../shared/protocol';
import { BelaySimulation, initializePhysics } from '../shared/simulation';
import { BridgeLoadObserver, type BridgeLoadReceipt } from '../shared/bridge-load-observer';
import { startWatchdog } from './phase2-parallel-watchdog';

const comparable = (simulation: BelaySimulation) => {
  const state = simulation.snapshot(); state.serverTime = 0; return state;
};
function checkReceipt(receipt: BridgeLoadReceipt, state: SimulationSnapshot) {
  assert.equal(receipt.physicsStep, receipt.tick * receipt.physicsHz / receipt.tickHz + receipt.substep);
  assert.equal(receipt.ratio, receipt.loadN / receipt.capacityN);
  let sum = 0;
  for (const row of receipt.contributors) {
    assert.equal(row.bodyLoadN, row.massKg * (row.gravityMps2 + row.arrivalTermMps2 + row.downwardCorrectionTermMps2));
    assert.equal(row.bridgeShareLoadN, row.bodyLoadN * row.overlapAreaM2 / row.totalSupportAreaM2);
    sum += row.bridgeShareLoadN;
    assert.equal(row.accumulatedBridgeLoadN, sum);
    assert(row.overlapFraction > 0 && row.overlapFraction <= 1);
    assert.equal(row.bridgeId, receipt.bridgeId);
  }
  assert.equal(sum, receipt.loadN);
  if (receipt.kind === 'cue') {
    const event = state.events.find(candidate => candidate.id === receipt.cueEventId);
    assert(event && event.kind === 'cue' && event.surfaceIds.includes(receipt.bridgeId));
    assert.equal(event.tick, receipt.tick); assert.equal(event.substep, receipt.substep);
    assert.equal(receipt.phase, 'post-integration-before-warning-update');
    assert.equal(receipt.warnedSeconds, 0); assert.equal(receipt.queuedCollapse, false);
  } else {
    assert.equal(receipt.phase, 'post-integration-after-warning-update');
    assert(receipt.overloadSeconds >= TUNING.phase2.bridgeOverloadSeconds);
    assert(receipt.warnedSeconds >= TUNING.phase2.bridgeWarningSeconds);
    assert.equal(receipt.queuedCollapse, true); assert.equal(receipt.cueEventId, null);
    const collapse = state.events.find(event => event.kind === 'collapse' && event.surfaceIds.includes(receipt.bridgeId));
    assert(collapse);
    assert.equal(collapse.tick * receipt.physicsHz / receipt.tickHz + collapse.substep, receipt.physicsStep + 1);
  }
}
function checkBoundAndCopies(sample: BridgeLoadReceipt) {
  const observer = new BridgeLoadObserver();
  assert.deepEqual(observer.report().records, []);
  const { id: _id, contributors: _contributors, ...decision } = sample;
  for (let index = 0; index <= TUNING.phase2.maximumEvents; index++) {
    observer.beginSubstep();
    for (const contribution of sample.contributors) observer.observeContribution(contribution);
    observer.observeDecision(decision); observer.endSubstep();
  }
  const first = observer.report();
  assert.equal(first.records.length, TUNING.phase2.maximumEvents);
  assert.equal(first.totalRecords, TUNING.phase2.maximumEvents + 1);
  assert.equal(first.truncated, true); assert.equal(first.records[0].id, 1);
  const retainedWeight = first.records[0].contributors[0].weightN;
  first.records[0].contributors[0].weightN = -retainedWeight;
  first.records.length = 0;
  assert.equal(observer.report().records.length, TUNING.phase2.maximumEvents);
  assert.equal(observer.report().records[0].contributors[0].weightN, retainedWeight);
}

/** Exactly two existing fixture policies, sequential off/on pairs; no performance verdict. */
export async function checkBridgeLoadObserver() {
  const limits = TUNING.phase2Evidence.parallel, processLimits = TUNING.localLoad;
  assert(process.execArgv.includes(`--max-old-space-size=${processLimits.generatorHeapMiB}`), 'Use the root worker old-space limit with the native check entrypoint.');
  const directory = await mkdtemp(path.join(tmpdir(), 'belay-bridge-load-check-'));
  const startedAt = new Date().toISOString();
  let failure: string | null = null, peakRssBytes = process.memoryUsage().rss;
  const interrupted = () => { failure ??= 'Observer check interrupted'; };
  process.on('SIGINT', interrupted); process.on('SIGTERM', interrupted);
  const watchdog = startWatchdog({ parentPid: process.ppid, deadline: Date.now() + processLimits.maximumWallMs,
    maximumWallMs: processLimits.maximumWallMs, maximumRssBytes: limits.maximumWorkerRssBytes,
    minimumAvailableBytes: limits.minimumOngoingAvailableBytes, sampleMs: processLimits.sampleMs,
    shutdownGraceMs: processLimits.shutdownGraceMs, heapMiB: limits.watchdogHeapMiB,
    sentinelPath: path.join(directory, 'watchdog.json'), runtime: limits.availableMemoryRuntime }, reason => { failure ??= reason; });
  const results: unknown[] = [];
  try {
    await watchdog.ready;
    if (failure) throw new Error(failure);
    await initializePhysics();
    for (const fixture of [
      { name: 'weak-bridge', seed: TUNING.phase2.mechanicsLoadSeed, tickHz: 30 as const, expectedCollapse: true },
      { name: 'sustained-cue', seed: TUNING.seed, tickHz: 60 as const, expectedCollapse: false },
    ]) {
      const options = { scene: 'crossing' as const, playerCount: TUNING.players, family: 'balanced' as const,
        seed: fixture.seed, tickHz: fixture.tickHz };
      const off = new BelaySimulation(options), observer = new BridgeLoadObserver();
      const on = new BelaySimulation(options, observer);
      try {
        assert.deepEqual(comparable(on), comparable(off));
        assert.deepEqual(observer.report().records, []);
        const gap = off.snapshot().terrain.crevasses[0], hold = { ...REST, brace: true };
        for (let tick = 0; tick < off.tickHz * TUNING.phase2.mechanicsProbeSeconds; tick++) {
          if (failure) throw new Error(failure);
          const incident = off.snapshot().incidents[0];
          const inputs = off.bodies.map((body, id) => fixture.expectedCollapse && incident
            ? id === 0 ? REST : { x: 0, z: 1, brace: false }
            : body.translation().z < (id ? gap.minZ - TUNING.phase2.rescueSafeOffset : (gap.minZ + gap.maxZ) / 2)
              ? { x: 0, z: 1, brace: false } : hold);
          off.step(inputs, true); on.step(inputs, true);
          assert.deepEqual(comparable(on), comparable(off), `${fixture.name} tick ${tick + 1}`);
          if (tick % off.tickHz === 0) { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); await yieldTurn(); }
        }
        assert.deepEqual(on.tape, off.tape);
        assert.equal(on.tape.frames.length, off.tickHz * TUNING.phase2.mechanicsProbeSeconds);
        const final = on.snapshot(), report = observer.report();
        assert.equal(final.terrain.bridges[0].collapsed, fixture.expectedCollapse);
        assert.equal(report.records.filter(row => row.kind === 'cue').length, 1);
        assert.equal(report.records.filter(row => row.kind === 'collapse-queued').length, Number(fixture.expectedCollapse));
        assert.equal(report.truncated, false);
        assert(!JSON.stringify(final).includes('capacity'));
        assert(!JSON.stringify(on.tape).includes('capacity'));
        for (const receipt of report.records) checkReceipt(receipt, final);
        checkBoundAndCopies(report.records[0]); // Pure collector checks, without additional physics.
        results.push({ fixture: fixture.name, options, simulatedSeconds: TUNING.phase2.mechanicsProbeSeconds,
          exactStateComparisons: on.tick + 1, exactTapeFrames: on.tape.frames.length, report });
      } finally { on.dispose(); off.dispose(); }
    }
    if (failure) throw new Error(failure);
    assert(watchdog.release(), 'Independent observer-check guard failed');
    console.log(JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), peakRssBytes,
      scope: 'Two sequential ten-second observer off/on fixtures. Snapshot serverTime normalized only; complete states and tapes otherwise compared exactly. Shared-host overlap, no isolated performance claim.', results }, null, 2));
  } finally {
    process.off('SIGINT', interrupted); process.off('SIGTERM', interrupted);
    await watchdog.disarm();
    await rm(directory, { recursive: true, force: true });
  }
}
