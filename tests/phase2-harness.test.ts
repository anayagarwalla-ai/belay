import { beforeAll, describe, expect, it } from 'vitest';
import { TUNING } from '../tuning';
import { initializePhysics } from '../shared/simulation';
import { replayTape, runTrajectory } from '../scripts/phase2-harness';
import { trajectorySchedule } from '../scripts/phase2-policies';

beforeAll(initializePhysics);

describe('Phase 2 evidence against the real shared world', () => {
  it.each(TUNING.phase2Evidence.teamSizes)('replays bounded focused rescue at %i bodies and reconciles incident evidence', playerCount => {
    const spec = { ...trajectorySchedule(1)[0], playerCount, scene: 'rescue' as const,
      horizonSeconds: TUNING.phase2Evidence.replaySeconds };
    const original = runTrajectory(spec, undefined, true);
    expect(original.record.error).toBeNull();
    expect(original.record.evidenceComplete).toBe(true);
    expect(original.record.episodes.length).toBe(original.record.diagnostics.incidentsStarted);
    expect(original.record.stepAttempts).toBe(original.record.stepExecutionMs.count);
    expect(original.record.ending).not.toBe('error');
    expect(original.tape?.scene).toBe('rescue');
    expect(original.tape?.playerCount).toBe(playerCount);
    const replay = replayTape(original.tape!);
    expect(replay.finalStateSha256).toBe(original.record.finalStateSha256);
    expect(replay.finalState).toEqual(original.finalState);
  });

  it.each(['static-brace', 'frozen-tail'] as const)('records unchanged %s intervention without requiring the policy to succeed', policy => {
    const spec = { ...trajectorySchedule(1)[0], playerCount: TUNING.hardCap, scene: 'rescue' as const,
      policy, horizonSeconds: TUNING.phase2Evidence.replaySeconds };
    const result = runTrajectory(spec, undefined, true);
    expect(result.record.error).toBeNull();
    expect(result.record.counterPolicy.armedTick).toBe(0);
    expect(result.record.counterPolicy.heldPlayerIds.length).toBeGreaterThan(0);
    for (const id of result.record.counterPolicy.heldPlayerIds) {
      expect(result.tape!.frames.every(frame => frame.inputs[id].x === 0 && frame.inputs[id].z === 0 && frame.inputs[id].brace === (policy === 'static-brace'))).toBe(true);
    }
    const counterexamples = policy === 'static-brace' ? result.record.staticCounterexampleEpisodes : result.record.frozenCounterexampleEpisodes;
    for (const id of counterexamples) expect(result.record.episodes.find(episode => episode.id === id)?.status).toBe('recovered');
    if (result.record.observedSeconds >= spec.horizonSeconds && result.record.runStatus === 'active') expect(result.record.ending).toBe('censored');
  });

  it('rejects truncated, stale-version and reordered tapes instead of calling partial replay a pass', () => {
    const spec = { ...trajectorySchedule(1)[0], scene: 'rescue' as const, horizonSeconds: TUNING.phase2Evidence.lifecycleSeconds };
    const { tape } = runTrajectory(spec, undefined, true);
    expect(tape).toBeDefined();
    expect(() => replayTape({ ...tape!, truncated: true })).toThrow(/truncated/);
    expect(() => replayTape({ ...tape!, version: 'unmatched-version' })).toThrow(/version/);
    const outOfOrder = structuredClone(tape!); outOfOrder.frames[0].tick++;
    expect(() => replayTape(outOfOrder)).toThrow(/sequence/);
  });
});
