# Final Phase 2 evidence handoff

The fixed matrix completed at **2026-09-08T04:25:36.133Z**: **1,000/1,000 records**, four clean worker exits, no missing ordinals, zero errors and zero incomplete-evidence rows. The coordinator ran the existing independent validator with 256 MiB old-space: exit 0, VALIDATED_FINAL_MATRIX, complete=true. Its exact [receipt](phase2-evidence-package/provenance/independent-final-validation.json) is retained. This establishes evidence completeness within the validator's documented scope. Physical bounds are violated; human rescue/fun gates and production capacity remain unevaluated.

The [lossless package](phase2-evidence-package/README.md) preserves every original file from the final invocation and both zero-worker preflight refusals. The original local directories are unchanged. See the [manifest](phase2-evidence-package/manifest.json) for original/stored hashes, byte counts and modes, and the [launch log](phase2-parallel-launches.md) for host overlap and attempt history. The original generated [50-cell table](phase2-evidence-package/payload/reports/phase2-parallel-2026-09-08T00-01-34.279Z-688bcbe4-7d3f-4aba-b66f-de8f8cc5703d/result.md) remains byte-exact; the interpretations below qualify its timing wording.

## Schedule, provenance and denominators

Twenty paired-seed repetitions × five player counts (2–6) × two scenes × five fixed policies = 1,000. Each scene/player/policy cell contains 20 attempts. Authority remains 30 Hz, with 600-second crossing and 60-second focused-rescue horizons. Source revision: d175701190964a926e968c25f250b2988edf223f; source manifest: 3253adc6e3bd7823ef4d9c7b110ffd6903a68f7a63dc1f14603a210ac6050fcb; runtime signature: 6a090feeb9b10a0da6515d99844c284468b271f2cc47ed5ecd7daf2310d19a24; schedule: 598d0502785b45555c81f8cd54cebabc2fa9802b928d33a5715d7be39b2d2fba. Shared mechanics remain the corrected f2fb8fd / 900 N / phase2-1 baseline; no rejected variant was integrated.

| Scene | Attempts | Crossing complete | Fixture recovered | Physical failed | Censored |
| --- | --- | --- | --- | --- | --- |
| crossing | 500 | 188 | 0 | 179 | 133 |
| rescue | 500 | 0 | 280 | 200 | 20 |

Crossing completion is 188/500 (37.6%); 179/500 physically fail and 133/500 reach the 600-second censor. Focused recovery is 280/500 (56%); 200/500 physically fail and 20/500 reach the 60-second censor. A censor is an unfinished observation, and a focused recovery is not a completed crossing. These scripted mixtures are descriptive rather than human or population success rates. The two refusal attempts contribute zero workers, records and timing samples and are never pooled into these denominators.

| Players | Attempts (all 5 policies) | Complete | Failed | Censored |
| --- | --- | --- | --- | --- |
| 2 | 100 | 56 | 39 | 5 |
| 3 | 100 | 41 | 42 | 17 |
| 4 | 100 | 33 | 36 | 31 |
| 5 | 100 | 30 | 29 | 41 |
| 6 | 100 | 28 | 33 | 39 |

## Recovery policy during crossing

Each row has 20 crossing attempts using the recovery policy. Episode denominators include every started episode, including unresolved ones; repeated rescues in one long run contribute multiple episodes. High episode recovery does not imply crossing completion.

| Players | Complete / 20 runs | Failed / censored runs | Recovered / started episodes | First attempt / started | Unresolved episodes |
| --- | --- | --- | --- | --- | --- |
| 2 | 17/20 | 1 / 2 | 31/34 | 14/34 | 2 |
| 3 | 13/20 | 2 / 5 | 77/84 | 32/84 | 5 |
| 4 | 7/20 | 0 / 13 | 556/569 | 469/569 | 13 |
| 5 | 7/20 | 0 / 13 | 137/150 | 98/150 | 13 |
| 6 | 7/20 | 0 / 13 | 313/326 | 240/326 | 13 |

Across both scenes and all five policies, 1,868/2,397 started episodes recovered (77.93%), 379 failed and 150 remained unresolved. First-attempt recovery was 1,379/2,397 (57.53%). The independent validator reconciles count statistics; it does not establish that these bot-policy mixtures meet human design targets.

## Focused rescue, 2–6 players

Each policy cell below is **recovered / failed / censored**, out of 20 attempts. Every focused attempt has one episode. Recovery-policy first attempts are shown separately from eventual recovery.

| Players | Recovery R/F/C | Walk R/F/C | Bad R/F/C | Static brace R/F/C | Frozen tail R/F/C | Recovery first attempt / 20 |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 20/0/0 | 0/20/0 | 0/20/0 | 20/0/0 | 0/0/20 | 20/20 |
| 3 | 20/0/0 | 0/20/0 | 0/20/0 | 20/0/0 | 20/0/0 | 20/20 |
| 4 | 20/0/0 | 0/20/0 | 0/20/0 | 20/0/0 | 20/0/0 | 20/20 |
| 5 | 20/0/0 | 0/20/0 | 0/20/0 | 20/0/0 | 20/0/0 | 14/20 |
| 6 | 20/0/0 | 0/20/0 | 0/20/0 | 20/0/0 | 20/0/0 | 20/20 |

Static brace recovers 100/100 focused fixtures with supported helpers held at unchanged brace input. Frozen tail recovers 80/80 fixtures at 3–6 players despite one helper held at rest; all 20 two-player frozen-tail fixtures remain censored at 60 seconds. In two-player focused fixtures the tail is the casualty, so these censors do not establish an inactive helper recovery. Whole-episode counterexamples recorded by the harness total 100 static-brace and 80 frozen-tail recoveries. Crossing interventions begin only after an incident is observed; earlier dynamic input is not relabelled static.

## Idle and unchanged-input counterexamples

The following existing per-player episode idle summaries cover the recovery policy. They measure simulation role counters; the number of player-episode observations is not the number of players or independent runs. The <20% idle target is not met by the medians. These summaries are copied from the finalized collector output; non-count KPI recomputation is outside the independent validator's scope.

| Scene / recovery policy | Players | Player-episode observations | Idle proxy p50 | Idle proxy p95 | Successful rescue p50 (s) | Recovered episodes |
| --- | --- | --- | --- | --- | --- | --- |
| crossing | 2 | 68 | 35.71% | 89.34% | 3.23 | 31 |
| crossing | 3 | 252 | 45.32% | 90.45% | 4.40 | 77 |
| crossing | 4 | 2276 | 46.56% | 82.20% | 4.00 | 556 |
| crossing | 5 | 750 | 47.30% | 87.75% | 4.60 | 137 |
| crossing | 6 | 1956 | 39.85% | 82.58% | 4.80 | 313 |
| rescue | 2 | 40 | 21.74% | 86.78% | 2.27 | 20 |
| rescue | 3 | 60 | 66.67% | 89.40% | 2.10 | 20 |
| rescue | 4 | 80 | 74.26% | 100.00% | 1.67 | 20 |
| rescue | 5 | 100 | 75.22% | 100.00% | 1.87 | 20 |
| rescue | 6 | 120 | 83.04% | 100.00% | 1.80 | 20 |

Concrete retained examples (seed 1701): ordinal 35, two-player static-brace rescue, recovers at 2.9 seconds while helper 0 has unchanged input throughout the 2.7-second observed rescue window and is motionless for 2.6 seconds. Ordinal 46, three-player frozen-tail rescue, recovers at 2.4667 seconds while helper 2 has rest/unchanged input for its entire 2.2667-second rescue window. Ordinal 45, two-player frozen casualty, is censored after 1,800 ticks / 60 seconds; casualty 1 has rest/unchanged input for the entire 59.8-second incident observation, yet roleActive records 56.7833 seconds because passive motion can satisfy that proxy. Simulation activity, input changes and motion cannot establish human agency, fun or causal responsibility.

## Physical and gameplay limits

| Metric | Maximum | Frozen reference | Ordinal | Seed | Players / policy / scene |
| --- | --- | --- | --- | --- | --- |
| Span excess (m) | 0.393220158098857 | 0.01 m | 424 | 1709 | 6 / bad / crossing |
| Segment excess (m) | 0.321092774438836 | 0.02 m | 552 | 1712 | 4 / recovery / crossing |
| Body overlap (m) | 0.050000000000000044 | 0.005 m | 424 | 1709 | 6 / bad / crossing |
| Energy projection (J) | 14536247012000457000 | Repair diagnostic | 424 | 1709 | 6 / bad / crossing |
| Potential excess (J) | 7806040185.196628 | Diagnostic | 363 | 1708 | 5 / walk / crossing |
| Unexplained energy gain (J) | 560.2604879127528 | 0.01 J energy tolerance | 374 | 1708 | 6 / bad / crossing |

Energy projection records numerical energy repair; it is not the unexplained-gain field. Its approximately 1.45e19 J extreme, potential excess and the separately nonzero unexplained-gain maximum preclude a conservation claim. Maximum speed is 373.70822035441034 m/s (ordinal 424). Zero reported terrain penetration does not cancel span, segment, overlap or energy violations. These are already-recorded diagnostics; no new simulation or solver investigation was run for this handoff.

Successful rescue duration across all policies/scenes has p50 3.9667 seconds (n=1,868); this excludes failures and unresolved observations. Completed crossing duration has p50 21.1333 seconds (n=188), below the 300–600-second target; it excludes 179 failed and 133 censored crossings. The naturally selected 19 crossings with exactly four observed incidents include six completions; this is not the controlled four-incident completion experiment. The human arbitrary-fall/static-role stop remains unevaluated. No Phase 3 or production qualification follows from this evidence.

## Timing, resources and host overlap

Exactly **2,763,309** raw Float64LE samples = **22,106,472 bytes**, equal to all step attempts with zero unattributed tail. Independent nearest-rank quantiles over the full combined raw stream: p50 5.83 ms, p95 62.05 ms, p99 89.46 ms, max 815.25 ms; mean 16.31 ms. Worker quantiles were not averaged. The 79,200,000-byte maximum was a reservation, not a required observed length.

These are elapsed simulation.step calls on a shared host. Explicit outer policy/snapshot/IO/transport work is excluded, but OS preemption and contention within a call are included. The original generated wording that scheduling is excluded must be read with this qualification. Wall duration is 15841.71 seconds, approximately 4 h 24 min. User-requested local development/browser overlap began approximately 03:25 UTC. The user reported a brief laptop lid closure before 03:46 UTC, followed by observed advancing counters; exact sleep duration/state was not measured, and no time was subtracted or samples discarded. Earlier observer fixtures, client build, root typecheck/lint and their reported intervals remain in the launch log. No isolated CPU, latency-SLA or room-capacity inference is supported.

Collector resource history reports 15816 guard samples, 264 retained minute samples, peak owned RSS 1299742720 bytes, minimum available 2265907200 bytes and minimum raw-free 17645568 bytes. These are sampled host/process observations with possible between-sample overshoot, not per-room attribution; the independent validator does not recompute resource history. The original resource journal is packaged losslessly.

## Validation and disposition

The independent validator checks all 1,000 scheduled records, four clean close receipts and absent recorded PIDs, original path/host pins, frozen-source files and read-only modes, journal/report identity, raw counts/hashes/finite values and exact per-record/global nearest-rank timing statistics. It compares published runtime signatures without rehashing installed binaries. It does not replay physics, verify absent state/input hash preimages, audit resource history, recompute non-count KPIs/survival curves/Markdown semantics, or certify physics, human gates or performance. The canonical receipt was created by the coordinator; this task did not rerun that validation.

This task checked the receipt's artifact hashes against the original files, reconciled all 50 outcome-count cells, and verified each packaged file by decompression and original hash/mode reconstruction. Earlier runner validation remains in [phase2-parallel-validation.md](phase2-parallel-validation.md): initial 73 tests; corrected focused 46 tests; final stalled-sentinel regression; typecheck/lint and independent focused source review. None was rerun during consolidation.

All four workers have final COMPLETE/exit receipts and code-0 close records; controller status is COMPLETE/finished. The coordinator's validator confirmed recorded process identities absent. The historical exec session is no longer available. This evidence task owns no remaining simulation/test/browser/dev workload and did not adopt or signal historical PIDs. The coordinator reported deletion of the BELAY scheduled definitions at the user's request, and the evidence heartbeat definition is absent on disk. No schedule was recreated. This final bounded handoff leaves the task idle; root owns final consolidation, validation and push.
