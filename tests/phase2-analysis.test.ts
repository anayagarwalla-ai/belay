import { describe, expect, it } from 'vitest';
import { FullWindowSamples, outcomeRate, quantiles, summarizeTrajectories, survivalSummary,
  type EpisodeEvidence, type TrajectoryRecord } from '../scripts/phase2-analysis';

describe('Phase 2 full-window evidence', () => {
  it('retains an early tail that a recent-sample ring would discard', () => {
    const samples = new FullWindowSamples(100, 1600);
    samples.add(1000); samples.add(1000);
    for (let i = 0; i < 98; i++) samples.add(1);
    expect(samples.summary()).toMatchObject({ count: 100, p50: 1, p95: 1, p99: 1000, max: 1000 });
    expect(() => samples.add(1)).toThrow(/capacity/);
  });
  it('refuses an undersized storage budget, invalid samples and invalid outcome counts', () => {
    expect(() => new FullWindowSamples(10, 159)).toThrow(/budget/);
    const samples = new FullWindowSamples(1, 16);
    expect(() => samples.add(Number.NaN)).toThrow(/finite/);
    expect(() => samples.add(-1)).toThrow(/nonnegative/);
    expect(() => outcomeRate(1, -1, 0)).toThrow(/counts/);
    expect(quantiles([])).toMatchObject({ count: 0, p50: null, max: null });
  });
  it('keeps zero observations unknown and includes censored outcomes in the conservative denominator', () => {
    expect(outcomeRate(0, 0, 0).conservativeSuccessFraction).toBeNull();
    expect(outcomeRate(1, 1, 2)).toEqual({ started: 4, successes: 1, failures: 1, censored: 2,
      conservativeSuccessFraction: 0.25, resolvedOnlySuccessFraction: 0.5, upperBoundIfAllCensoredSucceed: 0.75 });
  });
  it('does not call all timeouts a median completed run', () => {
    const result = survivalSummary([{ seconds: 60, terminal: false }, { seconds: 60, terminal: false }]);
    expect(result.medianSeconds).toBeNull();
    expect(result.curve).toEqual([{ seconds: 60, atRisk: 2, events: 0, censored: 2, survival: 1 }]);
  });
  it('handles tied events and administrative censoring with the full at-risk count', () => {
    const result = survivalSummary([{ seconds: 10, terminal: true }, { seconds: 10, terminal: false }, { seconds: 20, terminal: true }]);
    expect(result.curve[0].atRisk).toBe(3);
    expect(result.curve[0].survival).toBeCloseTo(2 / 3);
    expect(result.medianSeconds).toBe(20);
  });
  it('separates first-attempt, eventual, cascade, completion and unresolved episode counts', () => {
    const episode = (id: number, status: EpisodeEvidence['status'], firstAttemptSuccess: boolean): EpisodeEvidence => ({
      id, fallTick: 30, playerIds: [0], status, recoveredTick: status === 'recovered' ? 330 : null,
      cascades: firstAttemptSuccess ? 0 : 1, firstAttemptSuccess,
      roleActiveSeconds: [8, 6], roleIdleSeconds: [2, 4], staticHoldSeconds: [0, 7], observedUntilTick: 600,
    });
    const record: TrajectoryRecord = { ordinal: 0, seed: 42, family: 'balanced', scene: 'rescue', playerCount: 2,
      policy: 'static-brace', tickHz: 30, horizonSeconds: 60, observedSeconds: 20, ticks: 600, stepAttempts: 600,
      ending: 'censored', runStatus: 'active', progress: 0, firstFallSeconds: 1,
      episodes: [episode(0, 'recovered', true), episode(1, 'recovered', false), episode(2, 'failed', false), episode(3, 'active', false)],
      inputIdleSeconds: [0, 0], longestUnchangedInputSeconds: [0, 0], rescueObservationSeconds: [20, 20], rescueMotionlessSeconds: [0, 0],
      staticCounterexampleEpisodes: [0, 1], frozenCounterexampleEpisodes: [], maximumSpanErrorM: 0, maximumSegmentErrorM: 0,
      maximumSpeedMps: 0, stepExecutionMs: quantiles([1]), finalStateSha256: 'fixture', policyInputsSha256: 'fixture', error: null, evidenceComplete: true };
    const result = summarizeTrajectories([record]);
    expect(result.eventualRecovery).toMatchObject({ started: 4, successes: 2, failures: 1, censored: 1 });
    expect(result.firstAttemptRecovery).toMatchObject({ successes: 1, failures: 2, censored: 1 });
    expect(result.cascadeCount).toBe(3);
    expect(result.complete).toBe(0);
    expect(result.completedRunSecondsOnly.count).toBe(0);
    expect(result.rescueSecondsSuccessfulOnly).toMatchObject({ count: 2, p50: 10 });
    expect(result.staticBraceRecoveryCounterexamples).toBe(2);
    expect(result.runDurationSurvival.medianSeconds).toBeNull();
    const focused = summarizeTrajectories([{ ...record, ending: 'fixture-recovered' }]);
    expect(focused.fixtureRecovered).toBe(1);
    expect(focused.complete).toBe(0);
    expect(focused.completedRunSecondsOnly.count).toBe(0);
    expect(focused.runOutcome.started).toBe(0);
  });
});
