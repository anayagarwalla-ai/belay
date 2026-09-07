# Phase 2 integration checkpoint

This is a playable local grey-box diagnostic build, **not a passed rescue gate or launch candidate**. Gate 1's implementation stop was bypassed by the user; no human fun verdict is inferred. Static helpers can succeed unchanged, crossing pacing misses the brief, and recorded rope/contact cases exceed the existing mechanical limits. Phase 3 has not started.

## Integrated checks

| Check | Observed result | Limit |
|---|---|---|
| Complete integration suite | 198 passed; 2 explicit expected failures; 20 files | The two expected failures preserve the unchanged 2 cm rope-segment ceiling; they are unresolved defects |
| Typecheck / lint / production build | Passed | Build retains upstream Vite/plugin warnings and a large-client-chunk warning; no three-second arrival or 60 fps qualification |
| Local network / access regression | 13 passed | Real sockets on the two-climber flat scene; separate tests cover six-climber admission, scene resets and per-seat events |
| Actual six-connection browser capture | Six bodies, five spans, 60 rope segments; zero body/HTML overlaps; consistent scene/session during capture | One browser with scripted brace plus five labeled SDK bots; no humans |
| Actual-state client traces | 12 traces across 2/4/6-body rescue, crossing and ice; zero observed interpolated terrain penetration / stale warning backfills | Ten-second traces, not arbitrary-state completeness |
| Same-build replay | 50/50 exact comparisons | Preserves defects as well as valid behavior; not cross-platform determinism |
| World lifecycle / tape bound | 25 create/step/free cases; real 36,000-frame saturation | Not production room-memory attribution |
| 1,000-trajectory matrix | Incomplete baseline prefix preserved; bounded parallel runner in preparation | No full-run percentiles or acceptance claim from a prefix |
| 300-room server qualification | Not performed | Local guarded probes cannot establish production capacity, costs or reconnect success |

The suite result was recorded before the later report-only/build-experiment handoffs; final source validation is reported with its own checkpoint when those land. [Local network evidence](phase2-network.json) includes real RTT samples and server timing, explicitly scoped to its small regression fixture. [Browser capture](phase2-live-browser-baseline.json) includes source hashes, client/server state, actual first-received/drawn observations and the declared synthetic controls. The narrow and desktop screenshots are local ignored review artifacts.

## Required gameplay table — current baseline

These ten smoke trajectories are diagnostic strata, **not the required 1,000-run distribution**. [Raw smoke and method](phase2-smoke.md), [baseline findings](phase2-baseline-findings.md), [replays and static controls](phase2-replay.json), and [incomplete prefix](phase2-paused-prefix.json) retain denominators and censoring.

| Metric | Brief target | Observation |
|---|---|---|
| Run duration | Median 5–10 min | Five crossing completions: median 20.33 s, range 18.7–21.93 s |
| Incidents per run | 3–6 | Zero in all five recovery-policy crossing runs |
| Rescue success by team size | 60–75% | Focused fixture: 1/1 recovered at each size 2–6; inadequate sample and too easy |
| First incident | Under 45 s | None in the five crossings; focused fixture begins at a supplied hole and cannot qualify route pacing |
| Rescue idle time per player | At most 20% | Motion/load proxy median idle 78.12%, p95 100%, n=20; passive dragging can be credited as active |
| Successful rescue duration | 10–20 s in approved plan | Focused episode median 1.87 s, n=5 |
| Server p95 / memory per room at 300 rooms | Tick deadline and attributed memory | Not tested |

The separate fixed-policy replay found static-brace helper recovery at every team size 2–6, plus frozen-tail recovery in sizes 3–6. These are concrete failures of the participation premise, not evidence that bots found fun. The two supplied recovery tapes exceed the existing 2 cm segment bound (2.67 cm and 4.48 cm); finite positions and zero body penetration do not erase those rope failures or large energy corrections.

## Engineering decisions

The proposed allocation cache matched 1,136 exact snapshots across 42 fixtures but made rescue and crossing slower in every paired timing run; it was rejected. The compiled-runtime experiment improved its rescue fixture and slowed crossing in three of four pairs; default runtime remains unchanged. Both experiments and source patches are preserved, with host contention disclosed.

The local load runner has finite owned children, bounded offered inputs, teardown receipts and memory guards. Its default runs and later one-room attempt hit the conservative raw-free-memory guard; none is relabeled as a pass. The macOS available-memory proposal is observational only and does not weaken that policy.

No paid service, upload endpoint, public game deployment, voice service or stranger recruitment has occurred. Daily remains an unimplemented, server-simulated **best-of-three** design. The two requested open items in PLAN.md remain open.
