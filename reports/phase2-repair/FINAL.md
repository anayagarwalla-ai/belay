# Completed Phase 2 repair evidence

The repair removes the reproduced rope/contact explosions and automatic static-brace rescues. **Phase 2 has not passed its design gate.** Perfectly scripted helpers recover too consistently, intentionally bad policies rarely recover, larger teams can carry an inactive tail, and some active-policy player episodes exceed the 20% idle proxy. Human fairness, useful roles and fun still require the playtest; Phase 3 has not started.

The fixed matrix completed on September 8, 2026 at 19:27:56 UTC: **1,000/1,000 trajectories, four clean worker exits, zero harness errors or missing evidence, 4,728,413 persisted timing samples**, independently checked against pre-launch source/schedule/runtime pins. Wall time was 8,864.61 s (2 h 27 m 45 s). The measured source was `fdc6ae86b2c76f2255bcbbc2e1df5ab3dffa46c1`, manifest `ca02475baf9778679f764b3dc93e5d9027d93ef47c24fed0c7d2de5cc026a2a9`.

[Independent final receipt](full-validation-v4.json), [descriptive aggregates](full-review-v4.json), [unchanged generated tables](full-result-v4.md), [all original bytes and reconstruction](evidence-package/README.md). The full matrix measures the source before the separately verified performance cleanup; it is not a post-cleanup capacity result.

## Targets and remaining misses

| Measure | Full repaired evidence | Interpretation |
|---|---|---|
| Crossing outcomes | 500 starts: 166 completions, 210 terminal failures, 124 censors at 600 s | All five policies retained; timeouts are not failures or completions |
| Run length, target 5–10 min | Completed-only p50/p95 384.30/418.23 s, n=166. All terminal outcomes p50 104.43 s, n=376. Recovery-policy all-terminal median 383.23 s, n=100 | Successful pacing is in range; the pooled fixed policy mix is not a population pass |
| Incidents, target 3–6/run | All 500 starts: median 1, range 0–4. Recovery policy: median 4, n=100. Every completed crossing has 4 | Early failures miss the target; longer travel alone does not establish fun |
| First incident, target <45 s | Crossing observed-fall p50/p95 4.08/29.85 s, n=492; max 566.18 s; 8 starts have no observed fall. Recovery policy max 4.78 s, n=100 | The maximum and no-fall cases prevent an across-all-policies pass |
| Focused rescue | 500 fixtures: 134 recovered, 258 failed, 108 censored at 60 s | Separate fixtures, not whole glacier runs |
| Rescue success, target 60–75% | Crossing episodes: 665/990 recovered (67.17%), 210 failed, 115 open. Focused fixtures: 134/500 (26.8%). Recovery policy: 372/379 crossing episodes (98.15%); 94/100 focused | Pooling cooperative and deliberately non-cooperative policies to get 67% would manufacture a pass. No difficulty tuning verdict |
| Rescue duration | Successful episode median 13.90 s crossing, 12.53 s focused | Physical recovery takes real seconds; successful-only duration excludes failures/timeouts |
| Every player's rescue idle ≤20% | Recovery policy crossing: 16/1,558 player episodes over 20%, max 27.43%. Focused: 12/400 over 20%, max 43.59% | Criterion is not universally met, even within the cooperative policy |
| Static-role counterexamples | Static-brace focused: 0/100 recovered, 6 failed, 94 censored. Frozen-tail focused: 40/100 recovered, 46 failed, 14 censored | Static bracing no longer auto-rescues. All 40 frozen-tail recoveries are five/six-player cases, with whole-episode holds verified |
| Server p95 / room memory at 300 rooms | Not measured | No public launch or production qualification |

The active-effort counter changed from the historical baseline. It requires input, observed motion/load or slack take-up, a changed loaded input, or a planted catch during a fall. It excludes sustained dragging without input, but a held direction while being pulled can still count. It is not a causal contribution measure. Old and new idle percentages must not be pooled or presented as a like-for-like agency improvement.

## Cooperative policy, by team size

Each row contains 20 independently seeded starts. First-attempt and eventual recovery counts happen to match in these strata. Successful-rescue durations exclude failures. Idle observations include failed episodes.

| Scene | Players | Recovered / episodes | Rate | Successful rescue p50 (s) | Idle p95 / max | Player episodes >20% idle |
|---|---:|---:|---:|---:|---:|---:|
| crossing | 2 | 52/59 | 88.14% | 17.47 | 26.14% / 26.14% | 14/118 |
| crossing | 3 | 80/80 | 100.00% | 14.97 | 5.58% / 8.90% | 0/240 |
| crossing | 4 | 80/80 | 100.00% | 13.70 | 10.59% / 27.43% | 2/320 |
| crossing | 5 | 80/80 | 100.00% | 13.00 | 10.67% / 14.00% | 0/400 |
| crossing | 6 | 80/80 | 100.00% | 12.73 | 12.20% / 14.53% | 0/480 |
| rescue | 2 | 14/20 | 70.00% | 16.20 | 43.59% / 43.59% | 12/40 |
| rescue | 3 | 20/20 | 100.00% | 13.83 | 14.89% / 14.89% | 0/60 |
| rescue | 4 | 20/20 | 100.00% | 12.57 | 17.48% / 17.48% | 0/80 |
| rescue | 5 | 20/20 | 100.00% | 11.27 | 8.94% / 8.94% | 0/100 |
| rescue | 6 | 20/20 | 100.00% | 11.20 | 17.84% / 17.84% | 0/120 |

## Every policy retained

Each row contains 100 starts. Completion means hut/finish boundary for crossing and fixture recovery for focused rescue. The full generated report retains all 50 scene/team/policy strata.

| Scene | Policy | Completed / recovered | Failed | Censored | Successful crossing p50 (s) |
|---|---|---:|---:|---:|---:|
| crossing | recovery | 93 | 7 | 0 | 383.40 |
| crossing | walk | 0 | 79 | 21 | — |
| crossing | bad | 0 | 90 | 10 | — |
| crossing | static-brace | 0 | 7 | 93 | — |
| crossing | frozen-tail | 73 | 27 | 0 | 384.97 |
| rescue | recovery | 94 | 6 | 0 | — |
| rescue | walk | 0 | 100 | 0 | — |
| rescue | bad | 0 | 100 | 0 | — |
| rescue | static-brace | 0 | 6 | 94 | — |
| rescue | frozen-tail | 40 | 46 | 14 | — |

## Mechanical bounds and energy accounting

| Measure | Historical completed baseline | Repaired matrix | Existing acceptance |
|---|---:|---:|---:|
| Maximum material segment excess | 321.09 mm | 15.64 mm, ordinal 723 | ≤20 mm |
| Maximum harness span excess | 393.22 mm | 4.49 mm, ordinal 114 | ≤10 mm |
| Maximum body terrain penetration | See preserved baseline | 0 mm | ≤1 mm |
| Maximum body overlap | See preserved baseline | 0 mm | ≤5 mm |
| Maximum potential-energy excess | About 7.8×10⁹ J | 0 J | ≤0.01 J |
| Maximum explicit kinetic correction | About 1.45×10¹⁹ J | 1,296.34 J, ordinal 774 | Diagnostic dissipation; no acceptance ceiling invented |
| Maximum pre-correction unexplained native energy gain | See preserved baseline | 177.45 J, ordinal 774 | Reported before the coupled energy correction |
| Maximum body speed | 373.7 m/s | 25.07 m/s, ordinal 574 | Includes terminal free fall; not a walking-speed target |

The solver is bounded and dissipative; this is not exact energy conservation. A [read-only audit of ordinal 774](energy-outlier-v4.json) reproduced the full matrix's final state hash and recomputed body plus massive-rope energy after every one of its 4,274 internal steps. Its largest post-commit gain beyond measured motor work was **0.0110103 J**, compared with the solver's 0.010 J allowance: a 0.0010103 J readback/rounding overshoot. Nine internal steps exceeded the nominal allowance by these small amounts. Thus the geometrical and recorded potential bounds pass, but a strict post-commit total-energy bound has not been established. The source and raw audit result are retained; the large numerical correction is not relabeled as physical work. [Audit script](audit-energy-outlier.mjs.txt) uses the pre-cleanup source and saved full-matrix hash.

## Timing and operational limits

Exact raw pooled synchronous step timings: **p50 5.72 ms, p95 15.48 ms, p99 21.64 ms, maximum 1,237.06 ms**, n=4,728,413. The maximum is retained. This excludes scheduling, network, policy and rendering and cannot establish 30 Hz room cadence at 300 rooms. The historical matrix's p95 was 62.05 ms, but source, trajectories and contention changed; this is not a controlled speedup ratio.

The four-worker controller/worker peak sampled RSS was 1,277,591,552 bytes; the lowest heuristic available memory was 2,487,828,480 bytes. These are process totals, not memory per room. Node 26.5.0/libuv 1.52.1 ran on the local M4/16 GiB Mac. The preview and isolated paired probes shared the host. Initial preflight refused; the unchanged memory guard passed after briefly stopping the preview, which was then restored. All benchmark processes exited; no scheduled follow-up or paid resource was created.

The [separate performance cleanup](performance/README.md) removes an unused normal sweep and rejects distant solids before allocating normal arrays. It preserved every compared snapshot field except wall time over 11,498 ticks in two exploratory cases, with observed mean reductions of 14–16%. Its costly six-player p95 still exceeded a 30 Hz tick budget in that probe. The final code checks are in [the integration receipt](integration/receipt.json). This evidence does not clear the human rescue stop, strangers gate or production load gate.
