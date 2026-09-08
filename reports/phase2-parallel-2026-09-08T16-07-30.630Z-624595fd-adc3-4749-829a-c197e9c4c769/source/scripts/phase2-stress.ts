import { performance } from 'node:perf_hooks';
import { TUNING } from '../tuning';
import { BelaySimulation, initializePhysics } from '../shared/simulation';
import { REST } from '../shared/protocol';
import { stateHash } from './phase2-harness';
import { PHASE2_SCENES } from './phase2-policies';
import { provenance, writeBoundedJSON } from './phase2-report';

if (process.argv.length > 2) throw new Error('phase2-stress.ts takes no numerical overrides; use root tuning.');
await initializePhysics();
const source = await provenance();
const before = process.memoryUsage(), started = performance.now();
const lifecycle = [], initialHashes = new Map<string, string>();
for (let index = 0; index < TUNING.phase2Evidence.lifecycleRuns; index++) {
  const playerCount = TUNING.phase2Evidence.teamSizes[index % TUNING.phase2Evidence.teamSizes.length];
  const scene = PHASE2_SCENES[Math.floor(index / TUNING.phase2Evidence.teamSizes.length) % PHASE2_SCENES.length];
  const simulation = new BelaySimulation({ scene, playerCount, seed: TUNING.seed });
  const key = `${scene}/${playerCount}`, hash = stateHash(simulation.snapshot());
  const identicalInitialState = !initialHashes.has(key) || initialHashes.get(key) === hash;
  initialHashes.set(key, hash);
  let explicitDisposeCompleted = false;
  try {
    for (let tick = 0; tick < Math.ceil(TUNING.phase2Evidence.lifecycleSeconds * simulation.tickHz); tick++) {
      simulation.step(Array.from({ length: playerCount }, () => ({ ...REST })));
    }
    const snapshot = simulation.snapshot();
    const entry = { index, scene, playerCount, seed: TUNING.seed, identicalInitialState, initialStateSha256: hash,
      ticks: snapshot.tick, bodyCount: snapshot.players.length, ropePoints: snapshot.rope.points.length, spans: snapshot.rope.spans.length,
      incidentsRetained: snapshot.incidents.length, eventsRetained: snapshot.events.length,
      incidentRingWithinBound: snapshot.incidents.length <= TUNING.phase2.maximumIncidents,
      eventRingWithinBound: snapshot.events.length <= TUNING.phase2.maximumEvents,
      memoryBeforeDispose: process.memoryUsage(), explicitDisposeCompleted: false, memoryAfterDispose: process.memoryUsage() };
    simulation.dispose(); explicitDisposeCompleted = true;
    entry.explicitDisposeCompleted = true; entry.memoryAfterDispose = process.memoryUsage(); lifecycle.push(entry);
  } finally { if (!explicitDisposeCompleted) simulation.dispose(); }
}

// Fill the existing first-window tape bound with a real Phase 2 world that stays safely
// planted. This is a retention/lifecycle check, not an incident or rescue success.
const retention = new BelaySimulation({ scene: 'crossing', playerCount: TUNING.phase2Evidence.teamSizes[0], seed: TUNING.seed });
const cap = Math.floor(TUNING.network.maximumTapeSeconds * retention.tickHz);
let tapeRetention;
try {
  const inputs = retention.bodies.map(() => ({ ...REST, brace: true }));
  for (let tick = 0; tick <= cap; tick++) retention.step(inputs, true);
  tapeRetention = { elapsedSeconds: retention.tick / retention.tickHz, steps: retention.tick,
    configuredFrameCap: cap, frames: retention.tape.frames.length, truncated: retention.tape.truncated,
    firstTick: retention.tape.frames[0]?.tick, lastTick: retention.tape.frames.at(-1)?.tick,
    boundHeld: retention.tape.frames.length === cap && retention.tape.truncated && retention.tape.frames[0]?.tick === 0 && retention.tape.frames.at(-1)?.tick === cap - 1,
    runStatus: retention.snapshot().run.status,
    scope: 'First-window input-tape saturation only; no completed run and no event/incident-ring saturation claim.' };
} finally { retention.dispose(); }

const report = { ...source, generatedAt: new Date().toISOString(), scope: 'Sequential local create/step/free and bounded tape-retention checks. Process memory is shared runtime/allocator/harness memory, not per-room attribution or a leak proof.',
  wallSeconds: (performance.now() - started) / 1000, processMemoryBefore: before, processMemoryAfter: process.memoryUsage(),
  lifecycle, tapeRetention, forcedGC: false, simultaneousRooms: 1,
  production300RoomQualification: 'NOT TESTED', reconnection: 'NOT TESTED', humanAgency: 'NOT EVALUATED' };
await writeBoundedJSON('reports/phase2-stress.json', report);
const failed = lifecycle.some(entry => !entry.identicalInitialState || !entry.explicitDisposeCompleted || !entry.incidentRingWithinBound || !entry.eventRingWithinBound) || !tapeRetention.boundHeld;
console.log(JSON.stringify({ lifecycleCases: lifecycle.length, tapeRetention, wallSeconds: report.wallSeconds, failed }));
if (failed) process.exitCode = 1;
