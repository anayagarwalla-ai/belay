# Phase 2 integration checkpoint

This is a playable local grey-box diagnostic build, **not a passed rescue gate or launch candidate**. Gate 1's implementation stop was bypassed by the user; no human fun verdict is inferred. Static helpers can succeed unchanged, crossing pacing misses the brief, and recorded rope/contact cases exceed the existing mechanical limits. Phase 3 has not started.

## Integrated checks

| Check | Observed result | Limit |
|---|---|---|
| Final integration suite | 263 passed; 7 explicit expected failures; 28 files | Two preserve the unchanged 2 cm rope-segment ceiling; four preserve projection, energy and actuator defects; one preserves the known-feasible fixed-feature lip failure. All seven remain unresolved |
| Final typecheck / lint | Passed | Latest combined source; no gameplay or performance acceptance implied |
| Production build | Latest client handoff build passed; no additional build during final consolidation | Build retains upstream Vite/plugin warnings and a large-client-chunk warning; no three-second arrival or 60 fps qualification |
| Local network / access regression | 13 passed | Real sockets on the two-climber flat scene; separate tests cover six-climber admission, scene resets and per-seat events |
| Actual six-connection browser capture | Six bodies, five spans, 60 rope segments; zero body/HTML overlaps; consistent scene/session during capture | One browser with scripted brace plus five labeled SDK bots; no humans |
| Actual-state client traces | 12 traces across 2/4/6-body rescue, crossing and ice; zero observed interpolated terrain penetration / stale warning backfills | Ten-second traces, not arbitrary-state completeness |
| Same-build replay | 50/50 exact comparisons | Preserves defects as well as valid behavior; not cross-platform determinism |
| World lifecycle / tape bound | 25 create/step/free cases; real 36,000-frame saturation | Not production room-memory attribution |
| 1,000-trajectory matrix | COMPLETE; 1,000/1,000 records and 2,763,309 raw step samples; four clean worker exits; independent final validator passed | 500 crossing trajectories and 500 focused rescue fixtures. Gameplay failures and all 153 censors remain; this is not a human or production pass |
| 300-room server qualification | Not performed | Local guarded probes cannot establish production capacity, costs or reconnect success |

The final suite passed against code commit `ba186efc9a738ba16a382f7ac3bcb8d30b180048` on 2026-09-08: 40.57 seconds for tests, 2.06 seconds for typecheck and 0.74 seconds for lint. The [execution receipt and logs](phase2-final-integration/receipt.json) preserve the exact commands. These checks supersede the earlier 211-pass/six-expected-failure checkpoint. Documentation and evidence packaging do not change gameplay source. Historical source-pinned network, browser and build results remain scoped to their original observations.

[Local network evidence](phase2-network.json) includes real RTT samples and server timing, explicitly scoped to its small regression fixture. [Browser capture](phase2-live-browser-baseline.json) includes source hashes, client/server state, actual first-received/drawn observations and the declared synthetic controls. The narrow and desktop screenshots are local ignored review artifacts.

## Required gameplay table — current baseline

The final fixed matrix contains **1,000 trajectories: 500 crossings and 500 focused rescues**, spread across two to six players and five fixed bot policies. The [independent final receipt](phase2-independent-final-validation.json) reconciles every raw journal row and timing sample. [Final findings](phase2-final-evidence.md) retain all policy/team strata, physical extremes and observation limits; the [lossless package](phase2-evidence-package/README.md) preserves every original file. Root independently verified its 78 checksums and all 71 original file bytes/modes. Crossing outcomes are 188 completed, 179 failed and 133 censored at 600 seconds. Focused rescues are 280 recovered, 200 failed and 20 censored at 60 seconds. These fixtures do not represent a human player population; keep their scenes, policies and denominators separate.

| Metric | Brief target | Observation |
|---|---|---|
| Run duration | Median 5–10 min | Completed crossings median 21.13 s, n=188; time to either terminal outcome has descriptive censor-aware median 21.83 s across 500 starts, including 133 censors. Independent censoring is unproven |
| Incidents per run | 3–6 | Across 500 crossings: median 1, p95 9, range 0–126. Recovery policy alone: median 2 across 100 starts |
| Rescue success by team size | 60–75% | Recovery-policy focused fixtures eventually recover 20/20 at every size 2–6; first-attempt values are 100%, 100%, 100%, 70%, 100%. Crossing strata below differ sharply |
| First incident | Under 45 s | 356/500 crossings have a fall, all before 45 s (observed-only median 9.72 s); 144 have none. Recovery policy: 64/100 before 45 s, 36 with no observed fall |
| Rescue idle time per player | At most 20% | Recovery-policy crossing proxy: median 44.48%, p95 83.12%, n=5,302 player-episodes. Focused proxy: median 75.22%, p95 100%, n=400. These proxies can credit passive dragging as activity |
| Successful rescue duration | 10–20 s in approved plan | Recovery-policy focused median 1.87 s, n=100; crossing median 4.53 s, n=1,114 recovered episodes. Unresolved rescues are not treated as successful durations |
| Server p95 / memory per room at 300 rooms | Tick deadline and attributed memory | Not tested. Separately, local isolated-step p95 is 62.05 ms; sampled peak aggregate owned-process RSS is 1.21 GiB. Neither is a 300-room server or per-room measure |

Recovery-policy crossing episode recovery by team size is shown below. Each size has 20 crossing trajectories; repeated episodes within a trajectory are not independent trials. The numerator is observed recoveries over all started episodes, including unresolved episodes in the denominator.

| Players | First attempt / started | Eventual / started | Unresolved episodes |
|---|---:|---:|---:|
| 2 | 14/34 (41.18%) | 31/34 (91.18%) | 2 |
| 3 | 32/84 (38.10%) | 77/84 (91.67%) | 5 |
| 4 | 469/569 (82.43%) | 556/569 (97.72%) | 13 |
| 5 | 98/150 (65.33%) | 137/150 (91.33%) | 13 |
| 6 | 240/326 (73.62%) | 313/326 (96.01%) | 13 |

The full matrix retains **100 whole-episode recoveries with helpers holding static brace and 80 with the tail frozen at rest**. Those counterexamples fail the participation requirement. Worst observed segment excess is 0.3211 m against the existing 0.02 m bound, span excess is 0.3932 m, terrain penetration is 0 m, and body overlap is 0.05 m. Zero terrain penetration does not erase the rope and energy defects. Human arbitrary-fall and fun verdicts remain unevaluated.

The original job ran 00:01:34–04:25:36 UTC on September 8. Brief client/build/check overlaps were recorded earlier. The user requested the local game around 03:25 UTC and reported a brief laptop lid closure before 03:46 UTC; both remaining workers were observed advancing after that closure. These shared-host and sleep qualifications remain attached to its timings. No repeat benchmark was launched.

The historical [ten-run smoke](phase2-smoke.md), [baseline findings](phase2-baseline-findings.md), [replays and static controls](phase2-replay.json), and [incomplete prefix](phase2-paused-prefix.json) remain unchanged. The separate fixed-policy replay already found static-brace helper recovery at every team size 2–6, plus frozen-tail recovery in sizes 3–6. Two supplied recovery tapes exceed the existing 2 cm segment bound (2.67 cm and 4.48 cm).

## Engineering decisions

The proposed allocation cache matched 1,136 exact snapshots across 42 fixtures but made rescue and crossing slower in every paired timing run; it was rejected. The compiled-runtime experiment improved its rescue fixture and slowed crossing in three of four pairs; default runtime remains unchanged. Both experiments and source patches are preserved, with host contention disclosed.

The local load runner has finite owned children, bounded offered inputs, teardown receipts and memory guards. Its default runs and later one-room attempt hit the conservative raw-free-memory guard; none is relabeled as a pass. The macOS available-memory proposal is observational only and does not weaken that policy.

No paid service, upload endpoint, public game deployment, voice service or stranger recruitment has occurred. Daily remains an unimplemented, server-simulated **best-of-three** design. The two requested open items in PLAN.md remain open.

The 250-case experimental re-cut is complete: 76 recoveries, 133 censored and 41 terminal outcomes, with 44 passive recoveries within its contact/rope limits. It remains rejected, with serious energy/geometry failures retained in [the decision](rescue-recut-decision.md). Three alternative rescue arrangements and the current-price hosting proposal are preparatory documents in `docs/design/`; neither changes the game or provisions a service.

A later independent diagnosis preserves four additional expected-failure witnesses: a nonlinear projection that expands its own distance error, unresolved position-level energy excess, and proposed normal/tangential wall-actuator bounds. [Diagnosis and exact observations](phase2-motor-energy-design.md) distinguish these faults; the runtime is unchanged. Their separate targeted result is five passing checks and four explicit expected failures; typecheck/lint and 74 artifact checks also pass. These are separate from the earlier complete-suite checkpoint above.

The eight-case [client latency capture](phase2-client-latency.md) preserved 4,800 frames and exposed negative snapshot ages and draw-before-receipt times. The renderer clock is fixed and regression-tested; a new live timing capture has not been run. The [frontend byte audit](phase2-frontend-budget.md) estimates 361,229 gzip bytes across the initial dependency set of an earlier build: about 2.89 seconds of ideal transfer at 1 Mbps before other work. It does not qualify load time.

The isolated nonlinear projection candidate was rejected after new segment-limit failures; its [counterexamples](phase2-nonlinear-rejection.md) and [architecture review](phase2-solver-architecture-review.md) preserve the reasons. Current gameplay and the full benchmark source remain unchanged.

The later native parallel runner is integrated with independent review of finalization, mutable compiler dependencies, descendant ownership and the filesystem-independent hard-stop path. Its focused validation records 46 passing checks plus one separately selected stalled-sentinel regression; the interrupted attempt is excluded. Root typecheck/lint pass after integration. The actual four-worker matrix began at 2026-09-08 00:01:34 UTC; 30 record receipts were observed at 00:02:35 UTC. That bounded startup observation supplies no full-run percentile or acceptance claim. Source and run identifiers are in [WORKSTREAMS.md](../WORKSTREAMS.md).

The opt-in bridge-load observer passed independent source/receipt review. Its two short off/on fixtures compared 902 complete sampled states (only serverTime normalized) and 900 accepted tape frames exactly, with ordinary output unchanged; this is not broader trajectory coverage. Root full-project typecheck and lint passed after integration at 2026-09-08 00:25:47–00:25:53 UTC, resolving the earlier whole-project check that exhausted the observer task's 256 MiB heap cap. The two core equations and original accumulation order are unchanged; the active full matrix still uses its separate frozen pre-observer source.

The final client handoff includes one successful production build of the explicit Tailwind scanner. Its CSS is 20,560 raw bytes and 4,733 gzip bytes; all 99 previously emitted active classes remain. The [preserved comparison](phase2-tailwind-build-validation/README.md) distinguishes historical source uncertainty, 18 justified initialization omissions and unverified DOM/cascade/visual behavior. The [fixed-feature particle candidate](phase2-fixed-feature-feasibility.md) adds 12 passing analytical tests and one expected failure, with independent review; the known-feasible lip does not converge within the existing cap. Neither result advances a human gate.
