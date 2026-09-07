# Phase 2 baseline findings

**The synthetic baseline does not meet the intended Phase 2 pacing or participation targets. The human arbitrary-fall/static-role stop has not been evaluated, and the required 1,000-trajectory result remains pending.**

All baseline artifacts use simulation phase2-1, authority 30 Hz/internal 60 Hz and source manifest `b10299e84a69fc2a7829d96f78c31342e9d2b1adfaa121cbfd5b917eed2ffb24`. The full root configuration and per-file hashes are exported in each JSON artifact.

## Cross-size smoke

[Smoke records](phase2-smoke.json) and [full tables](phase2-smoke.md): ten fixed seed-1701 balanced-family trajectories, one per scene/team size. All five crossing teams (2–6 players) completed with zero incidents; all five focused fixtures recovered on their first attempt. There were no errors, censored trajectories or missing evidence in this smoke. It took 19.16 seconds of wall time and observed 3375 authority-step attempts.

| Metric | Root target | Observed smoke |
|---|---|---|
| Crossing incidents | 3–6 per run | 0 in every crossing (5 completed runs) |
| Crossing first fall | Before 45 s | No observed fall in any crossing; each finished in 18.70–21.93 s |
| Completed crossing duration | Median 300–600 s | Median 20.33 s; n=5 |
| Successful rescue duration | 10–20 s | Median 1.87 s; range 1.67–2.27 s; n=5 |
| First-attempt recovery | 60.0%–75.0% | 5/5 focused episodes, 100% |
| Eventual recovery | 88.0%–92.0% | 5/5 focused episodes, 100% |
| Per-player episode idle proxy | At most 20.0% | Median 78.1%; p95 100.0% across 20 player/episode observations |
| Controlled four-incident completion | Prespecified experiment | Not evaluated; no crossing smoke incident occurred |

Focused fixtures begin with a prescribed unsupported climber. Their 0.2-second first fall cannot qualify natural crossing pacing. These fixed policy/seed outcomes are descriptive and are not estimates of human or population probabilities; binomial confidence intervals would not remove the purposeful-selection and dependence limitations. The complete raw denominators and censor bounds are retained.

## Incomplete full-matrix prefix

The coordinator paused the owned full-run process while a performance-only candidate is investigated. [The preserved prefix](phase2-paused-prefix.json) contains 24/1000 completed trajectory records, all on the original fixed horizons. The in-progress next trajectory is absent; it is not relabelled as a completed run or a timeout. This ordered prefix contains 11 crossing completions, 8 physical failures and 5 focused recoveries, with 0 errors and 0 horizon censors. It is **INCOMPLETE** and does not represent the full scene/team/policy/seed matrix.

Per-trajectory timing quantiles remain attached to those records. No aggregate timing distribution is synthesized by averaging quantiles. The full 1,000 requirement and 600-second crossing / 60-second rescue observation limits remain unchanged. A simple extrapolation of the first completed cells suggested about an hour; future long hangs can increase it. No production capacity conclusion follows.

The old process was subsequently terminated after preserving this prefix; no paused worker remains. A full matrix must run on the selected final physical source.

[Separate baseline cost probes](phase2-baseline-cost.json) observed three selected cases for 20 simulation seconds each: five-player bad crossing took 14.10 s wall time, six-player bad crossing 17.76 s, and the two-player frozen casualty 4.75 s. All were unresolved at that diagnostic horizon; this does not establish a 600-second hang. If the six-player rate persisted for a full 600-second censor, one such trajectory would cost about 8.88 minutes and all 20 matching matrix cells about 2.96 hours. That is a conditional cost scenario, not a measured runtime or rigorous upper bound. The selected final physical source still needs its own cost estimate.

## Mechanical limitations

In the focused recovery smoke, maximum rope-segment excess ranged from 2.67 to 4.77 cm, exceeding the existing 2 cm diagnostic ceiling. The largest per-step kinetic-energy projection was 2,939.59 J. These measurements were reported to the physics owner; passing regression tests does not turn them into a bound pass.

One preserved bad-policy case (ordinal 23, seed 1701, balanced, crossing, five players, 30 Hz) failed at tick 601 with four cascades. It recorded 10.97 cm maximum segment excess, 14.12 m/s maximum body speed, a 652,497.07 J maximum energy projection, and 2,288.75 J maximum potential excess. Terrain penetration and body overlap were zero for that case. The approximate contact/rope energy correction must remain visible; a zero post-projection unexplained-energy counter is not energy-conservation certification.

## Replay and static roles

[Replay evidence](phase2-replay.json) contains 50 cases: 50 exact same-build state matches and 0 mismatches. Bounded tapes preserve the focused static-brace and frozen-tail cases, including failures/timeouts.

All five static-brace focused fixtures recovered while every designated helper held unchanged brace throughout the episode. Four frozen-tail fixtures (teams of 3–6) also recovered with the tail's input unchanged at rest. These are direct model counterexamples to the required active role changes. The two-player frozen casualty remained unresolved at the 20-second replay horizon and is censored, not a terminal failure.

| Focused policy | Players | Ending | Recovered episodes | Held player IDs | Recovered episode IDs with verified whole-episode hold |
|---|---:|---|---:|---|---|
| static-brace | 2 | fixture-recovered | 1 | 0 | 0 |
| static-brace | 3 | fixture-recovered | 1 | 0, 2 | 0 |
| static-brace | 4 | fixture-recovered | 1 | 0, 1, 3 | 0 |
| static-brace | 5 | fixture-recovered | 1 | 0, 1, 3, 4 | 0 |
| static-brace | 6 | fixture-recovered | 1 | 0, 1, 2, 4, 5 | 0 |
| frozen-tail | 2 | censored | 0 | 1 | none |
| frozen-tail | 3 | fixture-recovered | 1 | 2 | 0 |
| frozen-tail | 4 | fixture-recovered | 1 | 3 | 0 |
| frozen-tail | 5 | fixture-recovered | 1 | 4 | 0 |
| frozen-tail | 6 | fixture-recovered | 1 | 5 | 0 |

An unchanged input is audited from the episode start, not inferred from motion or a button-count proxy. Crossing counterpolicies activate after incident observation, so a prior dynamic catch is not relabelled as whole-episode static support. At two players the frozen tail is the casualty. Human useful participation and perceived arbitrariness still require observation.

The two-player frozen casualty supplied zero movement and no brace for all 600 tape frames, yet the simulation credited 17.9 active seconds out of 19.8 seconds of episode exposure. Passive loaded motion can therefore score as active in this proxy. It cannot certify useful player contribution.

Three additional diagnostic reproductions are saved separately from the 50-cell suite: [two-player recovery](phase2-tapes/rescue-2-recovery-1701.json), [six-player recovery](phase2-tapes/rescue-6-recovery-1701.json), and [four-player bad crossing](phase2-tapes/crossing-4-bad-1701.json). Each matches its original smoke/prefix final state and an independent replay. The four-player crossing completes at tick 1535 but records a 1,706,022.00 J maximum energy projection. It was selected for the largest projection in the incomplete prefix, not as a representative case. All 13 saved tapes total 1,453,237 bytes, within the root 20-file/32-MiB bounds. Reproductions are not counted as extra full-matrix trials.

## Bounded lifecycle and measurement limits

[Lifecycle/retention evidence](phase2-stress.json) passed 25 sequential create/step/free cases across both scenes and all sizes, with repeated initial-state hashes matching. A separate real world retained the first 36000 frames, marked truncation on authority tick 36001, and preserved first/last retained ticks 0/35999. Tape saturation is not a completed glacier run.

The stress invocation took 91.07 s. Process RSS before/after was 97124352/126205952 bytes, including runtime, allocator, harness and retained tape. Native reclamation, leak freedom and per-room attribution were not established; GC was not forced. Event/incident rings stayed bounded in these cases but were not saturated.

Validation: all 54 Phase 2 tests passed, including actual-world replay for teams 2–6, bridge cue/collapse and completion mechanics, evidence arithmetic and bounded file failure paths. Typecheck, scoped lint and diff checks passed. Other local tasks consumed CPU during measurements. These are local synchronous step timings, excluding policy/snapshot/transport/scheduler costs, and are not production-room or reconnect qualification. Human fun and the Phase 2 human stop remain unevaluated.
