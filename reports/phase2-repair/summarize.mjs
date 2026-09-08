import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Read-only, independent descriptive aggregates. Run the separate raw-data
// validator first. No simulator import, rerun, outcome filtering or retuning.
const directory = process.argv[2];
assert(directory, 'Usage: node reports/phase2-repair/summarize.mjs FINAL_DIRECTORY');
const bytes = fs.readFileSync(path.join(directory, 'result.json'));
const result = JSON.parse(bytes);
assert.equal(result.evidenceStatus, 'COMPLETE');
assert.equal(result.records.length, 1000);
assert.equal(new Set(result.records.map(r => r.ordinal)).size, 1000);
assert(result.records.every(r => !r.error && r.evidenceComplete));
const q = values => {
  const a = values.toSorted((a, b) => a - b);
  const at = fraction => a.length ? a[Math.ceil(a.length * fraction) - 1] : null;
  return { n: a.length, min: a[0] ?? null, p50: at(.5), p95: at(.95), max: a.at(-1) ?? null };
};
const count = (a, key) => Object.fromEntries([...new Set(a.map(r => r[key]))].sort().map(k => [k, a.filter(r => r[key] === k).length]));
const summarize = rows => {
  const episodes = rows.flatMap(r => r.episodes.map(e => ({ r, e })));
  const fractions = episodes.flatMap(({ e }) => e.roleIdleSeconds.flatMap((idle, i) => {
    const exposure = idle + e.roleActiveSeconds[i];
    return exposure > 0 ? [idle / exposure] : [];
  }));
  const recovered = episodes.filter(({ e }) => e.status === 'recovered');
  return {
    n: rows.length, outcomes: count(rows, 'ending'),
    completedSeconds: q(rows.filter(r => r.ending === 'complete').map(r => r.observedSeconds)),
    terminalSeconds: q(rows.filter(r => ['complete', 'failed'].includes(r.ending)).map(r => r.observedSeconds)),
    incidentCount: q(rows.map(r => r.episodes.length)),
    firstFallSeconds: q(rows.filter(r => r.firstFallSeconds !== null).map(r => r.firstFallSeconds)),
    noObservedFall: rows.filter(r => r.firstFallSeconds === null).length,
    episodes: count(episodes.map(({ e }) => e), 'status'),
    recoveredOverAllStarted: episodes.length ? recovered.length / episodes.length : null,
    successfulRescueSeconds: q(recovered.map(({ r, e }) => (e.recoveredTick - e.fallTick) / r.tickHz)),
    idleFractionProxy: q(fractions), playerEpisodesOver20PercentIdle: fractions.filter(x => x > .2).length,
    staticBraceCounterexamples: rows.reduce((n, r) => n + r.staticCounterexampleEpisodes.length, 0),
    frozenTailCounterexamples: rows.reduce((n, r) => n + r.frozenCounterexampleEpisodes.length, 0),
  };
};
const policies = ['recovery', 'walk', 'bad', 'static-brace', 'frozen-tail'];
const scenes = ['crossing', 'rescue'];
const strata = scenes.flatMap(scene => policies.flatMap(policy => [2, 3, 4, 5, 6].map(playerCount => {
  const rows = result.records.filter(r => r.scene === scene && r.policy === policy && r.playerCount === playerCount);
  assert.equal(rows.length, 20, `Incomplete stratum ${scene}/${policy}/${playerCount}`);
  return { scene, policy, playerCount, ...summarize(rows) };
})));
const maximum = getter => {
  const row = result.records.reduce((a, b) => getter(b) > getter(a) ? b : a);
  return { value: getter(row), ordinal: row.ordinal };
};
const output = {
  schema: 'phase2-repair-descriptive-review-1', resultSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  sourceManifestSha256: result.sourceManifestSha256, scheduleSha256: result.parallel.scheduleSha256,
  scenes: Object.fromEntries(scenes.map(scene => [scene, summarize(result.records.filter(r => r.scene === scene))])),
  byPolicy: scenes.flatMap(scene => policies.map(policy => ({ scene, policy, ...summarize(result.records.filter(r => r.scene === scene && r.policy === policy)) }))),
  strata,
  maxima: {
    segmentM: maximum(r => r.maximumSegmentErrorM), spanM: maximum(r => r.maximumSpanErrorM),
    bodyTerrainM: maximum(r => r.diagnostics.maximumTerrainPenetrationM), bodyOverlapM: maximum(r => r.diagnostics.maximumBodyOverlapM),
    potentialExcessJ: maximum(r => r.diagnostics.maximumPotentialExcessJ),
    unexplainedEnergyGainJ: maximum(r => r.diagnostics.maximumUnexplainedEnergyGainJ),
    explicitKineticCorrectionJ: maximum(r => r.diagnostics.maximumEnergyProjectionJ), speedMps: maximum(r => r.maximumSpeedMps),
  },
  limits: 'Descriptive fixed bot matrix. Policy mixing is not a model of human teams. Censored trajectories stay separate; successful-only durations are not all-start durations. No human, launch or 300-room verdict.',
};
console.log(JSON.stringify(output, null, 2));
