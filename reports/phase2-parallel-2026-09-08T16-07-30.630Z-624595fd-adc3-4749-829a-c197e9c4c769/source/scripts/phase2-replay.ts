import { createHash } from 'node:crypto';
import { TUNING } from '../tuning';
import { initializePhysics } from '../shared/simulation';
import type { Tape } from '../shared/protocol';
import { replayTape, runTrajectory } from './phase2-harness';
import { PHASE2_POLICIES, PHASE2_SCENES, trajectorySchedule } from './phase2-policies';
import { provenance, readBoundedJSON, writeBoundedJSON } from './phase2-report';

await initializePhysics();
const args = process.argv.slice(2);
if (args.length > 1) throw new Error('Usage: phase2-replay.ts [saved-evidence-file]; all numerical profiles are root tuning.');
if (args[0]) {
  const saved = await readBoundedJSON(args[0], TUNING.phase2Evidence.maximumTapeOutputBytes) as { tape: Tape; expectedFinalStateSha256: string };
  const result = replayTape(saved.tape);
  if (result.finalStateSha256 !== saved.expectedFinalStateSha256) throw new Error(`Replay mismatch: ${result.finalStateSha256}`);
  console.log(JSON.stringify({ file: args[0], frames: result.frames, finalStateSha256: result.finalStateSha256, matched: true }));
} else {
  const matrixSize = TUNING.phase2Evidence.teamSizes.length * PHASE2_SCENES.length * PHASE2_POLICIES.length;
  const schedule = trajectorySchedule(matrixSize);
  const results = [], artifacts = [];
  let savedBytes = 0;
  for (const original of schedule) {
    const spec = { ...original, horizonSeconds: Math.min(original.horizonSeconds, TUNING.phase2Evidence.replaySeconds) };
    const recorded = runTrajectory(spec, undefined, true);
    if (!recorded.tape) throw new Error('Recording did not return a tape.');
    let replay: ReturnType<typeof replayTape> | undefined, replayError: string | null = null;
    try { replay = replayTape(recorded.tape); }
    catch (cause) { replayError = cause instanceof Error ? cause.message : String(cause); }
    const matched = replay?.finalStateSha256 === recorded.record.finalStateSha256;
    const result = { spec, ending: recorded.record.ending, frames: recorded.tape.frames.length, matched, replayError,
      originalFinalStateSha256: recorded.record.finalStateSha256, replayFinalStateSha256: replay?.finalStateSha256 ?? null,
      recordedPolicyInputsSha256: recorded.record.policyInputsSha256,
      tapeInputsSha256: createHash('sha256').update(recorded.tape.frames.map(frame => JSON.stringify(frame.inputs) + '\n').join('')).digest('hex'),
      counterPolicy: recorded.record.counterPolicy, episodes: recorded.record.episodes, error: recorded.record.error };
    results.push(result);
    // Preserve focused static/frozen cases first, including unsuccessful ones. No favorable-only selection.
    const useful = spec.scene === 'rescue' && (spec.policy === 'static-brace' || spec.policy === 'frozen-tail');
    if ((!matched || useful) && artifacts.length < TUNING.phase2Evidence.maximumSavedTapes) {
      const remaining = TUNING.phase2Evidence.maximumTapeOutputBytes - savedBytes;
      const data = { spec, tape: recorded.tape, expectedFinalStateSha256: recorded.record.finalStateSha256,
        finalState: recorded.finalState, result, scope: 'Same-build local input replay; no human or production verdict.' };
      const bytes = Buffer.byteLength(JSON.stringify(data, null, 2) + '\n');
      if (bytes <= remaining) {
        const artifact = await writeBoundedJSON(`reports/phase2-tapes/${spec.scene}-${spec.playerCount}-${spec.policy}-${spec.seed}.json`, data, remaining);
        savedBytes += artifact.bytes; artifacts.push(artifact);
      }
    }
  }
  const report = { ...(await provenance()), generatedAt: new Date().toISOString(), scope: 'Bounded same-build local accepted-input replay across every scene/team/policy cell; no determinism claim across devices or versions.',
    results, matched: results.filter(result => result.matched).length, mismatched: results.filter(result => !result.matched).length,
    artifacts, artifactBytes: savedBytes, artifactCap: TUNING.phase2Evidence.maximumTapeOutputBytes };
  await writeBoundedJSON('reports/phase2-replay.json', report);
  console.log(JSON.stringify({ replayCases: results.length, matched: report.matched, mismatched: report.mismatched, artifacts: artifacts.length, savedBytes }));
  if (report.mismatched || results.some(result => result.error)) process.exitCode = 1;
}
