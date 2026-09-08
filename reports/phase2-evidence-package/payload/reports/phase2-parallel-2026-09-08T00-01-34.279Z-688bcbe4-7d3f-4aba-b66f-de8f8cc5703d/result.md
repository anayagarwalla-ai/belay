# Phase 2 local bot evidence

Complete fixed matrix: 1000/1000 validated trajectory records. Four local workers; no aggregate claim from missing ordinals.

Evidence status: **COMPLETE**.

Generated 2026-09-08T04:25:36.096Z. Mode: **full**. Source manifest: `3253adc6e3bd7823ef4d9c7b110ffd6903a68f7a63dc1f14603a210ac6050fcb`.

Raw trajectory records and full root configuration: [result.json](result.json).

**Human fun and the human Phase 2 rescue stop: NOT EVALUATED. Production room capacity/reconnect: NOT TESTED.**

## Outcomes and denominators

Observed 1000 trajectories: 500 crossing trajectories; 188 crossing completions; 379 physical terminal failures across both scenes; 280 focused-fixture recoveries; 153 administrative timeouts; 0 errors. 0 records have incomplete evidence. A focused recovery is not a completed glacier run.

| Scene | Players | Policy | Trajectories | Run complete | Fixture recovered | Failed | Censored | Episodes recovered / started | First-attempt / started | Cascades |
|---|---:|---|---:|---:|---:|---:|---:|---|---|---:|
| crossing | 2 | recovery | 20 | 17 | 0 | 1 | 2 | 31 / 34 | 14 / 34 | 7 |
| crossing | 2 | walk | 20 | 17 | 0 | 3 | 0 | 10 / 13 | 0 / 13 | 13 |
| crossing | 2 | bad | 20 | 0 | 0 | 20 | 0 | 2 / 22 | 0 / 22 | 20 |
| crossing | 2 | static-brace | 20 | 14 | 0 | 3 | 3 | 26 / 30 | 23 / 30 | 6 |
| crossing | 2 | frozen-tail | 20 | 8 | 0 | 12 | 0 | 0 / 12 | 0 / 12 | 12 |
| crossing | 3 | recovery | 20 | 13 | 0 | 2 | 5 | 77 / 84 | 32 / 84 | 34 |
| crossing | 3 | walk | 20 | 8 | 0 | 12 | 0 | 1 / 13 | 0 / 13 | 25 |
| crossing | 3 | bad | 20 | 0 | 0 | 20 | 0 | 8 / 28 | 2 / 28 | 45 |
| crossing | 3 | static-brace | 20 | 10 | 0 | 4 | 6 | 27 / 37 | 26 / 37 | 13 |
| crossing | 3 | frozen-tail | 20 | 10 | 0 | 4 | 6 | 18 / 28 | 9 / 28 | 20 |
| crossing | 4 | recovery | 20 | 7 | 0 | 0 | 13 | 556 / 569 | 469 / 569 | 46 |
| crossing | 4 | walk | 20 | 7 | 0 | 13 | 0 | 0 / 13 | 0 / 13 | 39 |
| crossing | 4 | bad | 20 | 1 | 0 | 19 | 0 | 8 / 27 | 1 / 27 | 64 |
| crossing | 4 | static-brace | 20 | 9 | 0 | 0 | 11 | 33 / 44 | 28 / 44 | 15 |
| crossing | 4 | frozen-tail | 20 | 9 | 0 | 4 | 7 | 72 / 83 | 10 / 83 | 55 |
| crossing | 5 | recovery | 20 | 7 | 0 | 0 | 13 | 137 / 150 | 98 / 150 | 48 |
| crossing | 5 | walk | 20 | 8 | 0 | 10 | 2 | 3 / 15 | 0 / 15 | 55 |
| crossing | 5 | bad | 20 | 1 | 0 | 19 | 0 | 10 / 29 | 0 / 29 | 96 |
| crossing | 5 | static-brace | 20 | 7 | 0 | 0 | 13 | 23 / 36 | 22 / 36 | 11 |
| crossing | 5 | frozen-tail | 20 | 7 | 0 | 0 | 13 | 177 / 189 | 110 / 189 | 79 |
| crossing | 6 | recovery | 20 | 7 | 0 | 0 | 13 | 313 / 326 | 240 / 326 | 90 |
| crossing | 6 | walk | 20 | 7 | 0 | 13 | 0 | 0 / 13 | 0 / 13 | 65 |
| crossing | 6 | bad | 20 | 0 | 0 | 20 | 0 | 3 / 23 | 1 / 23 | 107 |
| crossing | 6 | static-brace | 20 | 7 | 0 | 0 | 13 | 33 / 46 | 29 / 46 | 11 |
| crossing | 6 | frozen-tail | 20 | 7 | 0 | 0 | 13 | 20 / 33 | 4 / 33 | 71 |
| rescue | 2 | recovery | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 20 / 20 | 0 |
| rescue | 2 | walk | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 20 |
| rescue | 2 | bad | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 20 |
| rescue | 2 | static-brace | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 20 / 20 | 0 |
| rescue | 2 | frozen-tail | 20 | 0 | 0 | 0 | 20 | 0 / 20 | 0 / 20 | 0 |
| rescue | 3 | recovery | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 20 / 20 | 0 |
| rescue | 3 | walk | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 40 |
| rescue | 3 | bad | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 40 |
| rescue | 3 | static-brace | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 20 / 20 | 0 |
| rescue | 3 | frozen-tail | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 14 / 20 | 0 |
| rescue | 4 | recovery | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 20 / 20 | 0 |
| rescue | 4 | walk | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 60 |
| rescue | 4 | bad | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 60 |
| rescue | 4 | static-brace | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 20 / 20 | 0 |
| rescue | 4 | frozen-tail | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 13 / 20 | 0 |
| rescue | 5 | recovery | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 14 / 20 | 0 |
| rescue | 5 | walk | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 80 |
| rescue | 5 | bad | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 80 |
| rescue | 5 | static-brace | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 20 / 20 | 0 |
| rescue | 5 | frozen-tail | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 20 / 20 | 0 |
| rescue | 6 | recovery | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 20 / 20 | 0 |
| rescue | 6 | walk | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 100 |
| rescue | 6 | bad | 20 | 0 | 0 | 20 | 0 | 0 / 20 | 0 / 20 | 100 |
| rescue | 6 | static-brace | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 20 / 20 | 0 |
| rescue | 6 | frozen-tail | 20 | 0 | 20 | 0 | 0 | 20 / 20 | 20 / 20 | 0 |

Across both deliberately different scenes, eventual episode recovery is 77.93% (1868/2397), with 150 unresolved episodes. First-attempt recovery is 57.53% (1379/2397). These aggregate mixtures are descriptive, not a population or human success rate; use the scene/team/policy strata.

## Timing and missing outcomes

Successful episode duration: p50 3.966666666666667 s, p95 8.3 s, n=1868. Unresolved rescue observations: n=150; their observation limits are not success durations.

Completed crossing duration: median 21.133333333333333 s, n=188. Any terminal crossing outcome: median 20.133333333333333 s, n=367. Descriptive censor-aware time-to-terminal median: 21.833333333333332 s; independent censoring is not established.

First fall among observed falls: median 0.2 s, n=856; 144 trajectories have no observed incident. The raw file retains those exposures and outcomes. Focused rescue starts at a supplied hazard and is not natural first-incident pacing.

19 crossing trajectories happened to contain four incidents; 6 completed. This post-observation selection is not a controlled four-incident completion experiment and does not qualify the plan's completion target.

## Root targets and observed synthetic results

Targets are quoted from this report's root configuration. These scene/policy comparisons pool team sizes only to make misses visible; the strata above retain sizes. They do not qualify human targets or equate a successful-only median with the duration of every attempted rescue. Censored run incident counts may grow beyond the observation window.

| Scene / policy | Metric | Root target | Observation |
|---|---|---|---|
| crossing / recovery | Successful rescue duration | 10–20 s | p50 4.533333333333333 s; n=1114 |
| crossing / recovery | First-attempt episode recovery | 60.00%–75.00% | 73.34%; 853/1163; unresolved=46 |
| crossing / recovery | Eventual episode recovery | 88.00%–92.00% | observed lower bound 95.79%; upper if all unresolved recover 99.74% |
| crossing / recovery | Per-player episode idle proxy | <20.00% | p50 44.48%; p95 83.12%; n=5302 |
| crossing / recovery | Incidents per observed run | 3–6 | p50 2; range 0–126; n=100 |
| crossing / recovery | First fall | <45 s | 64/100 observed before threshold; no observed incident=36 |
| crossing / recovery | Completed run duration | 300–600 s | p50 21.133333333333333 s; n=51; censored=46 |
| rescue / recovery | Successful rescue duration | 10–20 s | p50 1.8666666666666667 s; n=100 |
| rescue / recovery | First-attempt episode recovery | 60.00%–75.00% | 94.00%; 94/100; unresolved=0 |
| rescue / recovery | Eventual episode recovery | 88.00%–92.00% | observed lower bound 100.00%; upper if all unresolved recover 100.00% |
| rescue / recovery | Per-player episode idle proxy | <20.00% | p50 75.22%; p95 100.00%; n=400 |
| crossing / bad | Successful rescue duration | 10–20 s | p50 8.566666666666666 s; n=31 |
| crossing / bad | First-attempt episode recovery | 60.00%–75.00% | 3.10%; 4/129; unresolved=0 |
| crossing / bad | Eventual episode recovery | 88.00%–92.00% | observed lower bound 24.03%; upper if all unresolved recover 24.03% |
| crossing / bad | Per-player episode idle proxy | <20.00% | p50 41.99%; p95 82.32%; n=519 |
| crossing / bad | Incidents per observed run | 3–6 | p50 1; range 1–5; n=100 |
| crossing / bad | First fall | <45 s | 100/100 observed before threshold; no observed incident=0 |
| crossing / bad | Completed run duration | 300–600 s | p50 51.166666666666664 s; n=2; censored=0 |
| rescue / bad | Successful rescue duration | 10–20 s | p50 unknown s; n=0 |
| rescue / bad | First-attempt episode recovery | 60.00%–75.00% | 0.00%; 0/100; unresolved=0 |
| rescue / bad | Eventual episode recovery | 88.00%–92.00% | observed lower bound 0.00%; upper if all unresolved recover 0.00% |
| rescue / bad | Per-player episode idle proxy | <20.00% | p50 47.42%; p95 88.84%; n=400 |

Controlled four-incident completion target 60.00%–72.00%: **NOT EVALUATED** by this naturally observed matrix.

## Static policies and activity proxies

Verified whole-episode recoveries with supported helpers' inputs held at static brace: **100**. Verified whole-episode recoveries with the last harness input frozen to rest: **80**. In the two-player focused fixture the tail is the casualty, so frozen-tail success there means an inactive casualty was recovered, not an inactive helper. The actual held IDs and intervention ticks are in every record. Crossing interventions start after an observed incident; earlier dynamic catch input is not relabelled as static from onset.

These are model counterexamples, not proof of human fun or causal blame. Simulation roleActive/roleIdle/staticHold counters and the harness input-idle, unchanged-input and motionless fractions are explicitly proxies. A held key can be useful and moving can be irrelevant. The human arbitrary-fall/static-role stop still requires a human check; any counterexample must be disclosed before advancing.

## Measurement scope and reproducibility

Worst observed span excess 0.393220158098857 m; segment excess 0.321092774438836 m; terrain penetration 0 m; body overlap 0.050000000000000044 m. The raw records retain each scene/seed/policy and the energy/work diagnostics. These maxima are measurements, not an assertion that the mechanical bounds passed.

Exact nearest-rank quantiles over every raw Float64LE simulation.step timing from all four workers. Sample count=2763309; p50=5.8300829995423555 ms, p95=62.046249999664724 ms, p99=89.46275000087917 ms, max=815.2514170000213 ms. 2763309 persisted samples versus 2763309 validated record step attempts. Counts reconcile for the complete invocation. No recent-sample ring or mean of quantiles is used.

Four independent child processes execute fixed disjoint ordinal shards. Step timing excludes policy, snapshot, async yields, IO, transport and scheduling. Shared-host contention is uncontrolled. Controller and separate worker RSS are sampled; no per-room attribution or production topology is claimed.

The matrix is frozen before execution. It pairs the same seed/family across policies and cycles every team size. Bad-bot idle/brace chances and mistake probability were not adjusted to hit recovery targets. Inputs use visible public terrain/state and do not read hidden bridge capacity. Every timeout stays censored; errors and missing incident/event evidence remain visible.

Run from the repository root with `node scripts/phase2-parallel-entry.mjs --plan` to inspect the plan, or `node scripts/phase2-parallel-entry.mjs --run` to start a new four-worker invocation. Replay and stress remain separate bounded workloads. Historical reports are unchanged.
