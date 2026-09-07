# Phase 2 local bot evidence

10 fixed-profile local synthetic trajectories across teams 2–6, crossing/focused rescue and the declared policy matrix. Bounded observation is not completed-run evidence.

Generated 2026-09-07T22:42:29.695Z. Mode: **smoke**. Source manifest: `b10299e84a69fc2a7829d96f78c31342e9d2b1adfaa121cbfd5b917eed2ffb24`.

Raw trajectory records and full root configuration: [phase2-smoke.json](phase2-smoke.json).

**Human fun and the human Phase 2 rescue stop: NOT EVALUATED. Production room capacity/reconnect: NOT TESTED.**

## Outcomes and denominators

Observed 10 trajectories: 5 crossing trajectories; 5 crossing completions; 0 physical terminal failures across both scenes; 5 focused-fixture recoveries; 0 administrative timeouts; 0 errors. 0 records have incomplete evidence. A focused recovery is not a completed glacier run.

| Scene | Players | Policy | Trajectories | Run complete | Fixture recovered | Failed | Censored | Episodes recovered / started | First-attempt / started | Cascades |
|---|---:|---|---:|---:|---:|---:|---:|---|---|---:|
| crossing | 2 | recovery | 1 | 1 | 0 | 0 | 0 | 0 / 0 | 0 / 0 | 0 |
| crossing | 3 | recovery | 1 | 1 | 0 | 0 | 0 | 0 / 0 | 0 / 0 | 0 |
| crossing | 4 | recovery | 1 | 1 | 0 | 0 | 0 | 0 / 0 | 0 / 0 | 0 |
| crossing | 5 | recovery | 1 | 1 | 0 | 0 | 0 | 0 / 0 | 0 / 0 | 0 |
| crossing | 6 | recovery | 1 | 1 | 0 | 0 | 0 | 0 / 0 | 0 / 0 | 0 |
| rescue | 2 | recovery | 1 | 0 | 1 | 0 | 0 | 1 / 1 | 1 / 1 | 0 |
| rescue | 3 | recovery | 1 | 0 | 1 | 0 | 0 | 1 / 1 | 1 / 1 | 0 |
| rescue | 4 | recovery | 1 | 0 | 1 | 0 | 0 | 1 / 1 | 1 / 1 | 0 |
| rescue | 5 | recovery | 1 | 0 | 1 | 0 | 0 | 1 / 1 | 1 / 1 | 0 |
| rescue | 6 | recovery | 1 | 0 | 1 | 0 | 0 | 1 / 1 | 1 / 1 | 0 |

Across both deliberately different scenes, eventual episode recovery is 100.00% (5/5), with 0 unresolved episodes. First-attempt recovery is 100.00% (5/5). These aggregate mixtures are descriptive, not a population or human success rate; use the scene/team/policy strata.

## Timing and missing outcomes

Successful episode duration: p50 1.8666666666666667 s, p95 2.2666666666666666 s, n=5. Unresolved rescue observations: n=0; their observation limits are not success durations.

Completed crossing duration: median 20.333333333333332 s, n=5. Any terminal crossing outcome: median 20.333333333333332 s, n=5. Descriptive censor-aware time-to-terminal median: 20.333333333333332 s; independent censoring is not established.

First fall among observed falls: median 0.2 s, n=5; 5 trajectories have no observed incident. The raw file retains those exposures and outcomes. Focused rescue starts at a supplied hazard and is not natural first-incident pacing.

0 crossing trajectories happened to contain four incidents; 0 completed. This post-observation selection is not a controlled four-incident completion experiment and does not qualify the plan's completion target.

## Root targets and observed synthetic results

Targets are quoted from this report's root configuration. These scene/policy comparisons pool team sizes only to make misses visible; the strata above retain sizes. They do not qualify human targets or equate a successful-only median with the duration of every attempted rescue. Censored run incident counts may grow beyond the observation window.

| Scene / policy | Metric | Root target | Observation |
|---|---|---|---|
| crossing / recovery | Successful rescue duration | 10–20 s | p50 unknown s; n=0 |
| crossing / recovery | First-attempt episode recovery | 60.00%–75.00% | unknown; 0/0; unresolved=0 |
| crossing / recovery | Eventual episode recovery | 88.00%–92.00% | observed lower bound unknown; upper if all unresolved recover unknown |
| crossing / recovery | Per-player episode idle proxy | <20.00% | p50 unknown; p95 unknown; n=0 |
| crossing / recovery | Incidents per observed run | 3–6 | p50 0; range 0–0; n=5 |
| crossing / recovery | First fall | <45 s | 0/5 observed before threshold; no observed incident=5 |
| crossing / recovery | Completed run duration | 300–600 s | p50 20.333333333333332 s; n=5; censored=0 |
| rescue / recovery | Successful rescue duration | 10–20 s | p50 1.8666666666666667 s; n=5 |
| rescue / recovery | First-attempt episode recovery | 60.00%–75.00% | 100.00%; 5/5; unresolved=0 |
| rescue / recovery | Eventual episode recovery | 88.00%–92.00% | observed lower bound 100.00%; upper if all unresolved recover 100.00% |
| rescue / recovery | Per-player episode idle proxy | <20.00% | p50 78.12%; p95 100.00%; n=20 |

Controlled four-incident completion target 60.00%–72.00%: **NOT EVALUATED** by this naturally observed matrix.

## Static policies and activity proxies

Verified whole-episode recoveries with supported helpers' inputs held at static brace: **0**. Verified whole-episode recoveries with the last harness input frozen to rest: **0**. In the two-player focused fixture the tail is the casualty, so frozen-tail success there means an inactive casualty was recovered, not an inactive helper. The actual held IDs and intervention ticks are in every record. Crossing interventions start after an observed incident; earlier dynamic catch input is not relabelled as static from onset.

These are model counterexamples, not proof of human fun or causal blame. Simulation roleActive/roleIdle/staticHold counters and the harness input-idle, unchanged-input and motionless fractions are explicitly proxies. A held key can be useful and moving can be irrelevant. The human arbitrary-fall/static-role stop still requires a human check; any counterexample must be disclosed before advancing.

## Measurement scope and reproducibility

Worst observed span excess 0 m; segment excess 0.047659162126571175 m; terrain penetration 0 m; body overlap 0 m. The raw records retain each scene/seed/policy and the energy/work diagnostics. These maxima are measurements, not an assertion that the mechanical bounds passed.

Exact nearest-rank quantiles of every synchronous simulation.step attempt in this invocation, excluding policy, snapshot collection, network and scheduling. Recording is disabled in benchmark trajectories. Other local tasks may consume CPU; this invocation is not an isolated capacity measurement. Full-window count=3375; p50=5.338874999999462 ms, p95=10.407250000000204 ms, p99=15.08612499999981 ms, max=50.97504099999969 ms. Raw counts reconcile to 3375 step attempts and 3375 completed authority ticks. No recent-sample ring or mean of quantiles is used.

Worlds run sequentially in one local process. processMemoryBefore/After includes runtime, the full timing buffer and report ownership; it is not per-room memory attribution. There is no transport, scheduler deadline, production worker topology or reconnect workload in this result.

The matrix is frozen before execution. It pairs the same seed/family across policies and cycles every team size. Bad-bot idle/brace chances and mistake probability were not adjusted to hit recovery targets. Inputs use visible public terrain/state and do not read hidden bridge capacity. Every timeout stays censored; errors and missing incident/event evidence remain visible.

Run from the repository root with `npx tsx scripts/phase2-bench.ts --smoke` or `npx tsx scripts/phase2-bench.ts`. Run `npx tsx scripts/phase2-replay.ts` and `npx tsx scripts/phase2-stress.ts` for their separate bounded results. Historical Phase 1 reports are unchanged.
