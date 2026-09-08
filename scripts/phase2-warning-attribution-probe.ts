import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// One existing mechanics fixture, read through public snapshots. No solver hooks.
// Run: node --import tsx scripts/phase2-warning-attribution-probe.ts SOURCE_ROOT OUTPUT_JSON
const [sourceArgument, outputArgument] = process.argv.slice(2);
if (!sourceArgument || !outputArgument || process.argv.length !== 4) {
  throw new Error('Expected SOURCE_ROOT and OUTPUT_JSON; this probe runs exactly one ten-second fixture.');
}
const sourceRoot = resolve(sourceArgument), outputPath = resolve(outputArgument);
const files = ['tuning.ts', 'package-lock.json', 'tests/phase2-mechanics.test.ts',
  'client/evidence.ts', 'client/viewport.ts', 'client/connection.ts',
  ...readdirSync(resolve(sourceRoot, 'shared')).filter(file => file.endsWith('.ts')).map(file => `shared/${file}`)].sort();
if (files.some(file => resolve(sourceRoot, file) === outputPath)) throw new Error('Output must not overwrite a source file.');
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const hashes = () => Object.fromEntries(files.map(file => [file, digest(readFileSync(resolve(sourceRoot, file)))]));
const git = (...args: string[]) => execFileSync('git', ['-C', sourceRoot, ...args], { encoding: 'utf8' }).trim();
const sourceBefore = { head: git('rev-parse', 'HEAD'), status: git('status', '--short'), sha256: hashes() };
const startedAt = new Date().toISOString();
const { BelaySimulation, initializePhysics } = await import(pathToFileURL(resolve(sourceRoot, 'shared/simulation.ts')).href) as typeof import('../shared/simulation');
const { TUNING } = await import(pathToFileURL(resolve(sourceRoot, 'tuning.ts')).href) as {
  TUNING: { physicsHz: number; phase2: { mechanicsLoadSeed: number; mechanicsProbeSeconds: number; rescueSafeOffset: number } };
};
const { REST } = await import(pathToFileURL(resolve(sourceRoot, 'shared/protocol.ts')).href) as typeof import('../shared/protocol');
if (TUNING.phase2.mechanicsLoadSeed !== 2000 || TUNING.phase2.mechanicsProbeSeconds !== 10 || TUNING.physicsHz !== 60) {
  throw new Error('Existing seed-2000, ten-second, 60 Hz internal-step fixture changed; review before running.');
}
const options = { scene: 'crossing' as const, playerCount: 2, seed: TUNING.phase2.mechanicsLoadSeed, tickHz: 30 as const, family: 'balanced' as const };
await initializePhysics();
const simulation = new BelaySimulation(options);
try {
  const publicFrame = () => {
    const snapshot = simulation.snapshot();
    return { tick: snapshot.tick, players: snapshot.players, spans: snapshot.rope.spans, terrain: snapshot.terrain };
  };
  const initial = publicFrame(), gap = initial.terrain.crevasses[0], hold = { ...REST, brace: true };
  const frames: ReturnType<typeof publicFrame>[] = [];
  const transitions: { event: ReturnType<typeof simulation.snapshot>['events'][number];
    before: ReturnType<typeof publicFrame>; after: ReturnType<typeof publicFrame> }[] = [];
  const seen = new Set<number>();
  for (let tick = 0; tick < options.tickHz * TUNING.phase2.mechanicsProbeSeconds; tick++) {
    const before = publicFrame(), incident = simulation.snapshot().incidents[0];
    const inputs = simulation.bodies.map((body, id) => incident
      ? id === 0 ? REST : { x: 0, z: 1, brace: false }
      : body.translation().z < (id ? gap.minZ - TUNING.phase2.rescueSafeOffset : (gap.minZ + gap.maxZ) / 2)
        ? { x: 0, z: 1, brace: false } : hold);
    simulation.step(inputs, true);
    const after = publicFrame(); frames.push(after);
    for (const event of simulation.snapshot().events) if (!seen.has(event.id)) {
      seen.add(event.id); transitions.push({ event, before, after });
    }
  }
  const final = simulation.snapshot();
  const sourceAfter = { head: git('rev-parse', 'HEAD'), status: git('status', '--short'), sha256: hashes() };
  const sourceStable = JSON.stringify(sourceBefore.sha256) === JSON.stringify(sourceAfter.sha256);
  const report = {
    scope: 'Exactly one existing two-player crossing seed-2000 mechanics fixture at 30 authority Hz for ten simulated seconds. Authority snapshots only; no browser, human, private load ledger, event-local impulse, or causal intervention measurements.',
    schemaVersion: 1, startedAt, finishedAt: new Date().toISOString(), nodeVersion: process.version,
    sourceBefore, sourceAfter, sourceStable,
    probeSha256: digest(readFileSync(new URL(import.meta.url))),
    options, physicsHz: TUNING.physicsHz, simulatedSeconds: TUNING.phase2.mechanicsProbeSeconds,
    policySource: 'tests/phase2-mechanics.test.ts: shows a load cue before collapse, then records a linked cascade at %i Hz',
    policyNote: 'Fixture title is reproduced for identification. Same-incident cascade membership does not establish a causal link.',
    timingNote: 'Events carry zero-based authority tick and substep. Before/after frames bracket the entire authority tick, not the individual event substep. Snapshot serverTime is intentionally omitted.',
    tuning: TUNING, initial, frames, transitions,
    tape: simulation.tape, tapeSha256: digest(JSON.stringify(simulation.tape)),
    final: { tick: final.tick, run: final.run, incidents: final.incidents, events: final.events, counters: final.counters, diagnostics: final.diagnostics },
  };
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ outputPath, sourceStable, frames: frames.length, events: final.events, diagnostics: final.diagnostics }, null, 2));
  if (!sourceStable) throw new Error('Relevant source changed during this single run; report saved with sourceStable=false. Do not treat it as a stable-source replay.');
} finally {
  simulation.dispose();
}
