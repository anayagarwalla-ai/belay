# Phase 2 local bot evidence

Incomplete invocation: 74/1000 validated trajectory records; Operator interrupted the offline benchmark.

Evidence status: **INCOMPLETE**.

Generated 2026-09-08T16:15:04.477Z. Mode: **full**. Source manifest: `a5012a8adb0733360687013c5fe0f3b9b1a602eb393e491a3f5c1e9889d6d059`.

Raw trajectory records and full root configuration: [result.json](result.json).

**Human fun and the human Phase 2 rescue stop: NOT EVALUATED. Production room capacity/reconnect: NOT TESTED.**

## Outcomes and denominators

Observed 74 trajectories: 44 crossing trajectories; 19 crossing completions; 32 physical terminal failures across both scenes; 19 focused-fixture recoveries; 0 administrative timeouts; 4 errors. 4 records have incomplete evidence. A focused recovery is not a completed glacier run.

| Scene | Players | Policy | Trajectories | Run complete | Fixture recovered | Failed | Censored | Episodes recovered / started | First-attempt / started | Cascades |
|---|---:|---|---:|---:|---:|---:|---:|---|---|---:|
| crossing | 2 | recovery | 4 | 3 | 0 | 1 | 0 | 12 / 13 | 12 / 13 | 1 |
| crossing | 2 | walk | 4 | 0 | 0 | 4 | 0 | 0 / 4 | 0 / 4 | 4 |
| crossing | 2 | bad | 1 | 0 | 0 | 1 | 0 | 0 / 1 | 0 / 1 | 1 |
| crossing | 2 | static-brace | 1 | 0 | 0 | 0 | 0 | 0 / 1 | 0 / 1 | 0 |
| crossing | 3 | recovery | 4 | 4 | 0 | 0 | 0 | 16 / 16 | 16 / 16 | 0 |
| crossing | 3 | walk | 4 | 0 | 0 | 4 | 0 | 0 / 4 | 0 / 4 | 8 |
| crossing | 3 | bad | 1 | 0 | 0 | 1 | 0 | 0 / 1 | 0 / 1 | 2 |
| crossing | 4 | recovery | 4 | 4 | 0 | 0 | 0 | 16 / 16 | 16 / 16 | 0 |
| crossing | 4 | walk | 4 | 0 | 0 | 3 | 0 | 0 / 4 | 0 / 4 | 10 |
| crossing | 4 | bad | 1 | 0 | 0 | 1 | 0 | 0 / 1 | 0 / 1 | 3 |
| crossing | 5 | recovery | 4 | 4 | 0 | 0 | 0 | 16 / 16 | 16 / 16 | 0 |
| crossing | 5 | walk | 3 | 0 | 0 | 3 | 0 | 0 / 3 | 0 / 3 | 12 |
| crossing | 5 | bad | 1 | 0 | 0 | 1 | 0 | 0 / 1 | 0 / 1 | 4 |
| crossing | 6 | recovery | 4 | 4 | 0 | 0 | 0 | 16 / 16 | 16 / 16 | 0 |
| crossing | 6 | walk | 3 | 0 | 0 | 1 | 0 | 0 / 3 | 0 / 3 | 7 |
| crossing | 6 | bad | 1 | 0 | 0 | 1 | 0 | 0 / 1 | 0 / 1 | 5 |
| rescue | 2 | recovery | 4 | 0 | 3 | 1 | 0 | 3 / 4 | 3 / 4 | 1 |
| rescue | 2 | walk | 1 | 0 | 0 | 1 | 0 | 0 / 1 | 0 / 1 | 1 |
| rescue | 2 | bad | 1 | 0 | 0 | 1 | 0 | 0 / 1 | 0 / 1 | 1 |
| rescue | 3 | recovery | 4 | 0 | 4 | 0 | 0 | 4 / 4 | 4 / 4 | 0 |
| rescue | 3 | walk | 1 | 0 | 0 | 1 | 0 | 0 / 1 | 0 / 1 | 2 |
| rescue | 3 | bad | 1 | 0 | 0 | 1 | 0 | 0 / 1 | 0 / 1 | 2 |
| rescue | 4 | recovery | 4 | 0 | 4 | 0 | 0 | 4 / 4 | 4 / 4 | 0 |
| rescue | 4 | walk | 1 | 0 | 0 | 1 | 0 | 0 / 1 | 0 / 1 | 3 |
| rescue | 4 | bad | 1 | 0 | 0 | 1 | 0 | 0 / 1 | 0 / 1 | 3 |
| rescue | 5 | recovery | 4 | 0 | 4 | 0 | 0 | 4 / 4 | 4 / 4 | 0 |
| rescue | 5 | walk | 1 | 0 | 0 | 1 | 0 | 0 / 1 | 0 / 1 | 4 |
| rescue | 5 | bad | 1 | 0 | 0 | 1 | 0 | 0 / 1 | 0 / 1 | 4 |
| rescue | 6 | recovery | 4 | 0 | 4 | 0 | 0 | 4 / 4 | 4 / 4 | 0 |
| rescue | 6 | walk | 1 | 0 | 0 | 1 | 0 | 0 / 1 | 0 / 1 | 5 |
| rescue | 6 | bad | 1 | 0 | 0 | 1 | 0 | 0 / 1 | 0 / 1 | 5 |

Across both deliberately different scenes, eventual episode recovery is 72.52% (95/131), with 4 unresolved episodes. First-attempt recovery is 72.52% (95/131). These aggregate mixtures are descriptive, not a population or human success rate; use the scene/team/policy strata.

## Timing and missing outcomes

Successful episode duration: p50 13.566666666666666 s, p95 21.8 s, n=95. Unresolved rescue observations: n=4; their observation limits are not success durations.

Completed crossing duration: median 383.1333333333333 s, n=19. Any terminal crossing outcome: median 32.8 s, n=40. Descriptive censor-aware time-to-terminal median: 32.8 s; independent censoring is not established.

First fall among observed falls: median 3.8833333333333333 s, n=74; 0 trajectories have no observed incident. The raw file retains those exposures and outcomes. Focused rescue starts at a supplied hazard and is not natural first-incident pacing.

19 crossing trajectories happened to contain four incidents; 19 completed. This post-observation selection is not a controlled four-incident completion experiment and does not qualify the plan's completion target.

## Root targets and observed synthetic results

Targets are quoted from this report's root configuration. These scene/policy comparisons pool team sizes only to make misses visible; the strata above retain sizes. They do not qualify human targets or equate a successful-only median with the duration of every attempted rescue. Censored run incident counts may grow beyond the observation window.

| Scene / policy | Metric | Root target | Observation |
|---|---|---|---|
| crossing / recovery | Successful rescue duration | 10–20 s | p50 13.566666666666666 s; n=76 |
| crossing / recovery | First-attempt episode recovery | 60.00%–75.00% | 98.70%; 76/77; unresolved=0 |
| crossing / recovery | Eventual episode recovery | 88.00%–92.00% | observed lower bound 98.70%; upper if all unresolved recover 98.70% |
| crossing / recovery | Per-player episode idle proxy | <20.00% | p50 2.70%; p95 11.39%; n=314 |
| crossing / recovery | Incidents per observed run | 3–6 | p50 4; range 1–4; n=20 |
| crossing / recovery | First fall | <45 s | 20/20 observed before threshold; no observed incident=0 |
| crossing / recovery | Completed run duration | 300–600 s | p50 383.1333333333333 s; n=19; censored=0 |
| rescue / recovery | Successful rescue duration | 10–20 s | p50 12.566666666666666 s; n=19 |
| rescue / recovery | First-attempt episode recovery | 60.00%–75.00% | 95.00%; 19/20; unresolved=0 |
| rescue / recovery | Eventual episode recovery | 88.00%–92.00% | observed lower bound 95.00%; upper if all unresolved recover 95.00% |
| rescue / recovery | Per-player episode idle proxy | <20.00% | p50 5.79%; p95 15.11%; n=80 |
| crossing / bad | Successful rescue duration | 10–20 s | p50 unknown s; n=0 |
| crossing / bad | First-attempt episode recovery | 60.00%–75.00% | 0.00%; 0/5; unresolved=0 |
| crossing / bad | Eventual episode recovery | 88.00%–92.00% | observed lower bound 0.00%; upper if all unresolved recover 0.00% |
| crossing / bad | Per-player episode idle proxy | <20.00% | p50 43.99%; p95 80.33%; n=20 |
| crossing / bad | Incidents per observed run | 3–6 | p50 1; range 1–1; n=5 |
| crossing / bad | First fall | <45 s | 5/5 observed before threshold; no observed incident=0 |
| crossing / bad | Completed run duration | 300–600 s | p50 unknown s; n=0; censored=0 |
| rescue / bad | Successful rescue duration | 10–20 s | p50 unknown s; n=0 |
| rescue / bad | First-attempt episode recovery | 60.00%–75.00% | 0.00%; 0/5; unresolved=0 |
| rescue / bad | Eventual episode recovery | 88.00%–92.00% | observed lower bound 0.00%; upper if all unresolved recover 0.00% |
| rescue / bad | Per-player episode idle proxy | <20.00% | p50 36.48%; p95 66.13%; n=20 |

Controlled four-incident completion target 60.00%–72.00%: **NOT EVALUATED** by this naturally observed matrix.

## Static policies and activity proxies

Verified whole-episode recoveries with supported helpers' inputs held at static brace: **0**. Verified whole-episode recoveries with the last harness input frozen to rest: **0**. In the two-player focused fixture the tail is the casualty, so frozen-tail success there means an inactive casualty was recovered, not an inactive helper. The actual held IDs and intervention ticks are in every record. Crossing interventions start after an observed incident; earlier dynamic catch input is not relabelled as static from onset.

These are model counterexamples, not proof of human fun or causal blame. Simulation roleActive/roleIdle/staticHold counters and the harness input-idle, unchanged-input and motionless fractions are explicitly proxies. A held key can be useful and moving can be irrelevant. The human arbitrary-fall/static-role stop still requires a human check; any counterexample must be disclosed before advancing.

## Measurement scope and reproducibility

Worst observed span excess 0.004831776973913016 m; segment excess 0.08806988560579876 m; terrain penetration 0 m; body overlap 0 m. The raw records retain each scene/seed/policy and the energy/work diagnostics. These maxima are measurements, not an assertion that the mechanical bounds passed.

Exact nearest-rank quantiles over validated persisted raw timing prefixes only; interrupted/unflushed attempts may be absent. Sample count=259435; p50=3.842833000002429 ms, p95=10.36891600000672 ms, p99=125.73600000003353 ms, max=262.0769999999902 ms. 259435 persisted samples versus 259435 validated record step attempts. No full-window completeness claim; missing, corrupt or unflushed tails remain unknown. No recent-sample ring or mean of quantiles is used.

Four independent child processes execute fixed disjoint ordinal shards. Step timing excludes policy, snapshot, async yields, IO, transport and scheduling. Shared-host contention is uncontrolled. Controller and separate worker RSS are sampled; no per-room attribution or production topology is claimed.

The matrix is frozen before execution. It pairs the same seed/family across policies and cycles every team size. Bad-bot idle/brace chances and mistake probability were not adjusted to hit recovery targets. Inputs use visible public terrain/state and do not read hidden bridge capacity. Every timeout stays censored; errors and missing incident/event evidence remain visible.

Run from the repository root with `node scripts/phase2-parallel-entry.mjs --plan` to inspect the plan, or `node scripts/phase2-parallel-entry.mjs --run` to start a new four-worker invocation. Replay and stress remain separate bounded workloads. Historical reports are unchanged.
