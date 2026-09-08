# Phase 2 local bot evidence

Complete fixed matrix: 1000/1000 validated trajectory records. Four local workers; no aggregate claim from missing ordinals.

Evidence status: **COMPLETE**.

Generated 2026-09-08T19:27:56.432Z. Mode: **full**. Source manifest: `ca02475baf9778679f764b3dc93e5d9027d93ef47c24fed0c7d2de5cc026a2a9`.

Raw trajectory records and full root configuration: [result.json](result.json).

**Human fun and the human Phase 2 rescue stop: NOT EVALUATED. Production room capacity/reconnect: NOT TESTED.**

## Outcomes and denominators

Observed 1000 trajectories: 500 crossing trajectories; 166 crossing completions; 468 physical terminal failures across both scenes; 134 focused-fixture recoveries; 232 administrative timeouts; 0 errors. 0 records have incomplete evidence. A focused recovery is not a completed glacier run.

| Scene | Players | Policy | Trajectories | Run complete | Fixture recovered | Failed | Censored | Episodes recovered / started | First-attempt / started | Cascades |
|---|---:|---|---:|---:|---:|---:|---:|---|---|---:|
| crossing | 2 | recovery | 20 | 13 | 0 | 7 | 0 | 52 / 59 | 52 / 59 | 7 |
| crossing | 2 | walk | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 20 |
| crossing | 2 | bad | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 20 |
| crossing | 2 | static-brace | 20 | 0 | 0 | 7 | 13 | 0 / 20 | 0 / 20 | 7 |
| crossing | 2 | frozen-tail | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 20 |
| crossing | 3 | recovery | 20 | 20 | 0 | 0 | 0 | 80 / 80 | 80 / 80 | 0 |
| crossing | 3 | walk | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 40 |
| crossing | 3 | bad | 20 | 0 | 0 | 19 | 1 | 0 / 19 | 0 / 19 | 38 |
| crossing | 3 | static-brace | 20 | 0 | 0 | 0 | 20 | 0 / 20 | 0 / 20 | 0 |
| crossing | 3 | frozen-tail | 20 | 13 | 0 | 7 | 0 | 52 / 59 | 52 / 59 | 14 |
| crossing | 4 | recovery | 20 | 20 | 0 | 0 | 0 | 80 / 80 | 80 / 80 | 0 |
| crossing | 4 | walk | 20 | 0 | 0 | 13 | 7 | 0 / 20 | 0 / 20 | 46 |
| crossing | 4 | bad | 20 | 0 | 0 | 18 | 2 | 0 / 18 | 0 / 18 | 54 |
| crossing | 4 | static-brace | 20 | 0 | 0 | 0 | 20 | 0 / 20 | 0 / 20 | 0 |
| crossing | 4 | frozen-tail | 20 | 20 | 0 | 0 | 0 | 80 / 80 | 80 / 80 | 0 |
| crossing | 5 | recovery | 20 | 20 | 0 | 0 | 0 | 80 / 80 | 80 / 80 | 0 |
| crossing | 5 | walk | 20 | 0 | 0 | 13 | 7 | 0 / 20 | 0 / 20 | 59 |
| crossing | 5 | bad | 20 | 0 | 0 | 16 | 4 | 1 / 17 | 0 / 17 | 64 |
| crossing | 5 | static-brace | 20 | 0 | 0 | 0 | 20 | 0 / 20 | 0 / 20 | 0 |
| crossing | 5 | frozen-tail | 20 | 20 | 0 | 0 | 0 | 80 / 80 | 80 / 80 | 0 |
| crossing | 6 | recovery | 20 | 20 | 0 | 0 | 0 | 80 / 80 | 80 / 80 | 0 |
| crossing | 6 | walk | 20 | 0 | 0 | 13 | 7 | 0 / 20 | 0 / 20 | 72 |
| crossing | 6 | bad | 20 | 0 | 0 | 17 | 3 | 0 / 18 | 0 / 18 | 87 |
| crossing | 6 | static-brace | 20 | 0 | 0 | 0 | 20 | 0 / 20 | 0 / 20 | 0 |
| crossing | 6 | frozen-tail | 20 | 20 | 0 | 0 | 0 | 80 / 80 | 80 / 80 | 0 |
| rescue | 2 | recovery | 20 | 0 | 14 | 6 | 0 | 14 / 20 | 14 / 20 | 6 |
| rescue | 2 | walk | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 20 |
| rescue | 2 | bad | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 20 |
| rescue | 2 | static-brace | 20 | 0 | 0 | 6 | 14 | 0 / 20 | 0 / 20 | 6 |
| rescue | 2 | frozen-tail | 20 | 0 | 0 | 6 | 14 | 0 / 20 | 0 / 20 | 6 |
| rescue | 3 | recovery | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 20 / 20 | 0 |
| rescue | 3 | walk | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 40 |
| rescue | 3 | bad | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 40 |
| rescue | 3 | static-brace | 20 | 0 | 0 | 0 | 20 | 0 / 20 | 0 / 20 | 0 |
| rescue | 3 | frozen-tail | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 40 |
| rescue | 4 | recovery | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 20 / 20 | 0 |
| rescue | 4 | walk | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 60 |
| rescue | 4 | bad | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 60 |
| rescue | 4 | static-brace | 20 | 0 | 0 | 0 | 20 | 0 / 20 | 0 / 20 | 0 |
| rescue | 4 | frozen-tail | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 60 |
| rescue | 5 | recovery | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 20 / 20 | 0 |
| rescue | 5 | walk | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 80 |
| rescue | 5 | bad | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 80 |
| rescue | 5 | static-brace | 20 | 0 | 0 | 0 | 20 | 0 / 20 | 0 / 20 | 0 |
| rescue | 5 | frozen-tail | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 20 / 20 | 0 |
| rescue | 6 | recovery | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 20 / 20 | 0 |
| rescue | 6 | walk | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 100 |
| rescue | 6 | bad | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 100 |
| rescue | 6 | static-brace | 20 | 0 | 0 | 0 | 20 | 0 / 20 | 0 / 20 | 0 |
| rescue | 6 | frozen-tail | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 20 / 20 | 0 |

Across both deliberately different scenes, eventual episode recovery is 53.62% (799/1490), with 223 unresolved episodes. First-attempt recovery is 53.56% (798/1490). These aggregate mixtures are descriptive, not a population or human success rate; use the scene/team/policy strata.

## Timing and missing outcomes

Successful episode duration: p50 13.733333333333333 s, p95 22.633333333333333 s, n=799. Unresolved rescue observations: n=223; their observation limits are not success durations.

Completed crossing duration: median 384.3 s, n=166. Any terminal crossing outcome: median 104.43333333333334 s, n=376. Descriptive censor-aware time-to-terminal median: 380.5 s; independent censoring is not established.

First fall among observed falls: median 0.2 s, n=992; 8 trajectories have no observed incident. The raw file retains those exposures and outcomes. Focused rescue starts at a supplied hazard and is not natural first-incident pacing.

166 crossing trajectories happened to contain four incidents; 166 completed. This post-observation selection is not a controlled four-incident completion experiment and does not qualify the plan's completion target.

## Root targets and observed synthetic results

Targets are quoted from this report's root configuration. These scene/policy comparisons pool team sizes only to make misses visible; the strata above retain sizes. They do not qualify human targets or equate a successful-only median with the duration of every attempted rescue. Censored run incident counts may grow beyond the observation window.

| Scene / policy | Metric | Root target | Observation |
|---|---|---|---|
| crossing / recovery | Successful rescue duration | 10–20 s | p50 13.9 s; n=372 |
| crossing / recovery | First-attempt episode recovery | 60.00%–75.00% | 98.15%; 372/379; unresolved=0 |
| crossing / recovery | Eventual episode recovery | 88.00%–92.00% | observed lower bound 98.15%; upper if all unresolved recover 98.15% |
| crossing / recovery | Per-player episode idle proxy | <20.00% | p50 2.70%; p95 11.35%; n=1558 |
| crossing / recovery | Incidents per observed run | 3–6 | p50 4; range 1–4; n=100 |
| crossing / recovery | First fall | <45 s | 100/100 observed before threshold; no observed incident=0 |
| crossing / recovery | Completed run duration | 300–600 s | p50 383.4 s; n=93; censored=0 |
| rescue / recovery | Successful rescue duration | 10–20 s | p50 12.566666666666666 s; n=94 |
| rescue / recovery | First-attempt episode recovery | 60.00%–75.00% | 94.00%; 94/100; unresolved=0 |
| rescue / recovery | Eventual episode recovery | 88.00%–92.00% | observed lower bound 94.00%; upper if all unresolved recover 94.00% |
| rescue / recovery | Per-player episode idle proxy | <20.00% | p50 5.77%; p95 17.48%; n=400 |
| crossing / bad | Successful rescue duration | 10–20 s | p50 7.633333333333334 s; n=1 |
| crossing / bad | First-attempt episode recovery | 60.00%–75.00% | 0.00%; 0/92; unresolved=1 |
| crossing / bad | Eventual episode recovery | 88.00%–92.00% | observed lower bound 1.09%; upper if all unresolved recover 2.17% |
| crossing / bad | Per-player episode idle proxy | <20.00% | p50 51.59%; p95 94.04%; n=362 |
| crossing / bad | Incidents per observed run | 3–6 | p50 1; range 0–1; n=100 |
| crossing / bad | First fall | <45 s | 85/100 observed before threshold; no observed incident=8 |
| crossing / bad | Completed run duration | 300–600 s | p50 unknown s; n=0; censored=10 |
| rescue / bad | Successful rescue duration | 10–20 s | p50 unknown s; n=0 |
| rescue / bad | First-attempt episode recovery | 60.00%–75.00% | 0.00%; 0/100; unresolved=0 |
| rescue / bad | Eventual episode recovery | 88.00%–92.00% | observed lower bound 0.00%; upper if all unresolved recover 0.00% |
| rescue / bad | Per-player episode idle proxy | <20.00% | p50 35.00%; p95 80.82%; n=400 |

Controlled four-incident completion target 60.00%–72.00%: **NOT EVALUATED** by this naturally observed matrix.

## Static policies and activity proxies

Verified whole-episode recoveries with supported helpers' inputs held at static brace: **0**. Verified whole-episode recoveries with the last harness input frozen to rest: **40**. In the two-player focused fixture the tail is the casualty, so frozen-tail success there means an inactive casualty was recovered, not an inactive helper. The actual held IDs and intervention ticks are in every record. Crossing interventions start after an observed incident; earlier dynamic catch input is not relabelled as static from onset.

These are model counterexamples, not proof of human fun or causal blame. Simulation roleActive/roleIdle/staticHold counters and the harness input-idle, unchanged-input and motionless fractions are explicitly proxies. A held key can be useful and moving can be irrelevant. The human arbitrary-fall/static-role stop still requires a human check; any counterexample must be disclosed before advancing.

## Measurement scope and reproducibility

Worst observed span excess 0.004488418051675325 m; segment excess 0.01563850482180812 m; terrain penetration 0 m; body overlap 0 m. The raw records retain each scene/seed/policy and the energy/work diagnostics. These maxima are measurements, not an assertion that the mechanical bounds passed.

Exact nearest-rank quantiles over every raw Float64LE simulation.step timing from all four workers. Sample count=4728413; p50=5.719166999682784 ms, p95=15.477291999850422 ms, p99=21.640583000145853 ms, max=1237.0617499994114 ms. 4728413 persisted samples versus 4728413 validated record step attempts. Counts reconcile for the complete invocation. No recent-sample ring or mean of quantiles is used.

Four independent child processes execute fixed disjoint ordinal shards. Step timing excludes policy, snapshot, async yields, IO, transport and scheduling. Shared-host contention is uncontrolled. Controller and separate worker RSS are sampled; no per-room attribution or production topology is claimed.

The matrix is frozen before execution. It pairs the same seed/family across policies and cycles every team size. Bad-bot idle/brace chances and mistake probability were not adjusted to hit recovery targets. Inputs use visible public terrain/state and do not read hidden bridge capacity. Every timeout stays censored; errors and missing incident/event evidence remain visible.

Run from the repository root with `node scripts/phase2-parallel-entry.mjs --plan` to inspect the plan, or `node scripts/phase2-parallel-entry.mjs --run` to start a new four-worker invocation. Replay and stress remain separate bounded workloads. Historical reports are unchanged.
