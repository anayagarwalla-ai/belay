/** Full-window diagnostics for local Phase 2 trajectories. No tuning or physics defaults. */
export type Quantiles = {
  count: number; min: number | null; p50: number | null; p95: number | null;
  p99: number | null; max: number | null; mean: number | null;
};

export class FullWindowSamples {
  private readonly values: Float64Array;
  count = 0;
  private total = 0;

  constructor(readonly capacity: number, maximumBytes: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('Sample capacity must be a positive integer.');
    // The original buffer and a complete sorting copy coexist. Fail before allocation.
    if (!Number.isSafeInteger(maximumBytes) || capacity * Float64Array.BYTES_PER_ELEMENT * 2 > maximumBytes) {
      throw new Error('Full-window sample storage and sorting exceed the root memory budget.');
    }
    this.values = new Float64Array(capacity);
  }

  add(value: number) {
    if (!Number.isFinite(value) || value < 0) throw new Error('A timing sample must be finite and nonnegative.');
    if (this.count === this.capacity) throw new Error('Full-window sample capacity exceeded; evidence must not silently wrap.');
    this.values[this.count++] = value;
    this.total += value;
  }

  summary(): Quantiles {
    if (!this.count) return emptyQuantiles();
    const sorted = this.values.slice(0, this.count).sort();
    const q = (fraction: number) => sorted[Math.max(0, Math.ceil(this.count * fraction) - 1)];
    return { count: this.count, min: sorted[0], p50: q(0.5), p95: q(0.95), p99: q(0.99),
      max: sorted[this.count - 1], mean: this.total / this.count };
  }
}

const emptyQuantiles = (): Quantiles => ({ count: 0, min: null, p50: null, p95: null, p99: null, max: null, mean: null });
export function quantiles(values: readonly number[]): Quantiles {
  if (!values.length) return emptyQuantiles();
  const samples = new FullWindowSamples(values.length, values.length * Float64Array.BYTES_PER_ELEMENT * 2);
  values.forEach(value => samples.add(value));
  return samples.summary();
}

export type EpisodeEvidence = {
  id: number; fallTick: number; playerIds: number[]; status: 'active' | 'recovered' | 'failed';
  recoveredTick: number | null; cascades: number; firstAttemptSuccess: boolean;
  roleActiveSeconds: number[]; roleIdleSeconds: number[]; staticHoldSeconds: number[];
  observedUntilTick: number;
};
export type PolicyName = 'recovery' | 'walk' | 'bad' | 'static-brace' | 'frozen-tail';
export type TrajectoryRecord = {
  ordinal: number; seed: number; family: string; scene: 'crossing' | 'rescue'; playerCount: number;
  policy: PolicyName; tickHz: number; horizonSeconds: number; observedSeconds: number;
  ticks: number; stepAttempts: number; ending: 'complete' | 'failed' | 'fixture-recovered' | 'censored' | 'error';
  runStatus: 'testing' | 'active' | 'complete' | 'failed'; progress: number;
  firstFallSeconds: number | null; episodes: EpisodeEvidence[];
  inputIdleSeconds: number[]; longestUnchangedInputSeconds: number[];
  rescueObservationSeconds: number[]; rescueMotionlessSeconds: number[];
  staticCounterexampleEpisodes: number[]; frozenCounterexampleEpisodes: number[];
  maximumSpanErrorM: number; maximumSegmentErrorM: number; maximumSpeedMps: number;
  stepExecutionMs: Quantiles; finalStateSha256: string; policyInputsSha256: string;
  error: string | null; evidenceComplete: boolean;
};

export function outcomeRate(successes: number, failures: number, censored: number) {
  for (const count of [successes, failures, censored]) {
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Outcome counts must be nonnegative integers.');
  }
  const started = successes + failures + censored;
  return { started, successes, failures, censored,
    conservativeSuccessFraction: started ? successes / started : null,
    resolvedOnlySuccessFraction: successes + failures ? successes / (successes + failures) : null,
    upperBoundIfAllCensoredSucceed: started ? (successes + censored) / started : null };
}

/** Administrative censoring is not completion. This descriptive KM estimate assumes
 * independent censoring; errors are excluded and counted by the caller. */
export function survivalSummary(observations: readonly { seconds: number; terminal: boolean }[]) {
  const groups = new Map<number, { terminal: number; censored: number }>();
  for (const row of observations) {
    if (!Number.isFinite(row.seconds) || row.seconds < 0) throw new Error('Invalid survival observation.');
    const group = groups.get(row.seconds) ?? { terminal: 0, censored: 0 };
    if (row.terminal) group.terminal++; else group.censored++;
    groups.set(row.seconds, group);
  }
  let atRisk = observations.length, survival = 1;
  let medianSeconds: number | null = null;
  const curve = [...groups.entries()].sort(([a], [b]) => a - b).map(([seconds, group]) => {
    const before = atRisk;
    if (group.terminal) survival *= 1 - group.terminal / before;
    if (medianSeconds === null && survival <= 0.5) medianSeconds = seconds;
    atRisk -= group.terminal + group.censored;
    return { seconds, atRisk: before, events: group.terminal, censored: group.censored, survival };
  });
  return { observations: observations.length, medianSeconds,
    method: 'Kaplan–Meier time to any terminal run outcome; administrative censoring is not an event; independence is unproven.', curve };
}

export function summarizeTrajectories(records: readonly TrajectoryRecord[]) {
  const episodes = records.flatMap(record => record.episodes.map(episode => ({ record, episode })));
  const recovered = episodes.filter(({ episode }) => episode.status === 'recovered');
  const failed = episodes.filter(({ episode }) => episode.status === 'failed');
  const active = episodes.filter(({ episode }) => episode.status === 'active');
  const first = recovered.filter(({ episode }) => episode.firstAttemptSuccess);
  const crossing = records.filter(record => record.scene === 'crossing');
  const completed = crossing.filter(record => record.ending === 'complete');
  const terminal = crossing.filter(record => record.ending === 'complete' || record.ending === 'failed');
  const censor = records.filter(record => record.ending === 'censored');
  const errors = records.filter(record => record.ending === 'error');
  const idleFractions = episodes.flatMap(({ episode }) => episode.roleIdleSeconds.map((idle, index) => {
    const exposure = idle + episode.roleActiveSeconds[index];
    return exposure > 0 ? idle / exposure : null;
  })).filter((fraction): fraction is number => fraction !== null);
  const observedFour = records.filter(record => record.scene === 'crossing' && record.episodes.length === 4);
  return {
    trajectories: records.length, crossingTrajectories: crossing.length, complete: completed.length,
    failed: records.filter(record => record.ending === 'failed').length,
    fixtureRecovered: records.filter(record => record.ending === 'fixture-recovered').length,
    censored: censor.length, errors: errors.length,
    incompleteEvidence: records.filter(record => !record.evidenceComplete).length,
    runOutcome: outcomeRate(completed.length, terminal.length - completed.length,
      crossing.filter(record => record.ending === 'censored' || record.ending === 'error').length),
    incidentCountPerTrajectory: quantiles(records.map(record => record.episodes.length)),
    trajectoriesWithoutIncident: records.filter(record => record.firstFallSeconds === null).length,
    firstFallSecondsObservedOnly: quantiles(records.map(record => record.firstFallSeconds).filter((value): value is number => value !== null)),
    eventualRecovery: outcomeRate(recovered.length, failed.length, active.length),
    firstAttemptRecovery: outcomeRate(first.length, recovered.length - first.length + failed.length, active.length),
    rescueSecondsSuccessfulOnly: quantiles(recovered.map(({ record, episode }) => {
      if (episode.recoveredTick === null || episode.recoveredTick < episode.fallTick) throw new Error('Recovered episode lacks a valid end tick.');
      return (episode.recoveredTick - episode.fallTick) / record.tickHz;
    })),
    unresolvedRescueObservationSeconds: quantiles(active.map(({ record, episode }) => (episode.observedUntilTick - episode.fallTick) / record.tickHz)),
    failedIncidentCount: failed.length,
    cascadingEpisodes: episodes.filter(({ episode }) => episode.cascades > 0).length,
    cascadeCount: episodes.reduce((sum, { episode }) => sum + episode.cascades, 0),
    completedRunSecondsOnly: quantiles(completed.map(record => record.observedSeconds)),
    anyTerminalRunSecondsOnly: quantiles(terminal.map(record => record.observedSeconds)),
    observedExposureSecondsIncludingCensoring: quantiles(records.map(record => record.observedSeconds)),
    runDurationSurvival: survivalSummary(crossing.filter(record => record.ending !== 'error')
      .map(record => ({ seconds: record.observedSeconds, terminal: record.ending !== 'censored' }))),
    fourIncidentSelection: { observedTrajectories: observedFour.length,
      completed: observedFour.filter(record => record.ending === 'complete').length,
      status: 'Descriptive selection by observed incident count, not a controlled four-incident completion experiment.' },
    perPlayerSimulationIdleFractionProxy: quantiles(idleFractions),
    staticBraceRecoveryCounterexamples: records.reduce((sum, record) => sum + record.staticCounterexampleEpisodes.length, 0),
    frozenTailRecoveryCounterexamples: records.reduce((sum, record) => sum + record.frozenCounterexampleEpisodes.length, 0),
    executedTicks: records.reduce((sum, record) => sum + record.ticks, 0),
    stepAttempts: records.reduce((sum, record) => sum + record.stepAttempts, 0),
  };
}
