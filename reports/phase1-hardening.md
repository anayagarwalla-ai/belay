# Phase 1 hardening checkpoint

2026-09-07, Apple M4 / Node 26.5.0. Phase 1 mechanics and preparation integrated from three parallel Codex project tasks. The user has since authorized Phase 2 by bypassing the Gate 1 implementation stop. Human sessions remain 0/6; no fun, remote-feel, stranger or production verdict is inferred.

| Integrated check | Result | Scope |
|---|---|---|
| Unit/integration suite | 79 tests passed across eight files | Physics, client lifecycle/report races, real room lifecycle, access and local process supervision |
| TypeScript / active lint / production build | Passed | Build remains local; existing Vite/Vinext migration and bundle-size warnings remain |
| Adversarial mechanics | 36 scenarios passed; 540,000 internal steps inspected | Three rope families, both authority rates, exact same-runtime replay, 20-minute walks and bounded tapes |
| Bad-bot diagnostics | 1,000 trajectories, each 20 seconds | Flat ground; not completed glacier runs |
| Real local network | 13 checks passed | Room/input/role boundaries plus authenticated gateway and Vite private-file tests |
| Browser | Join, report download, leave, disconnected report and rejoin passed; no page errors | Real local Chromium, JSON report epoch/session checks; not human feel |
| Local preflight | Passed | Ready room, frontend, authenticated local ownership; no tunnel opened |

## Corrected mechanics

| Defect | Measured baseline maximum | Corrected maximum |
|---|---:|---:|
| Body overlap | 34.079 mm | 0.184 mm |
| Rope segment violation | 21.741 mm | 9.999 mm |
| End-to-end span violation | 0 mm | 0 mm |

Rapier's predictive contact distance now covers one internal step of relative walking motion. The rope performs bounded additional constraint iterations when its usual eight passes leave excess residual. The three families' movement, rope lengths, damping and brace parameters remain unchanged. Detailed raw scenarios and fingerprints: [physics stress](phase1-physics-stress.json), [baseline](phase1-physics-baseline.json), [findings](phase1-physics-findings.md).

| Family | Bot trajectories | Median climber distance | p95 maximum segment violation | Whole-span violation |
|---|---:|---:|---:|---:|
| balanced | 334 | 32.86 m | 0.009993 m | 0 m |
| short | 333 | 32.42 m | 0.009997 m | 0 m |
| loose | 333 | 33.42 m | 0.009996 m | 0 m |

The regenerated [bot report](phase1-bots.json) includes full configuration and all trajectory records. Its isolated simulation timing p50 0.030 ms / p95 0.038 ms describes only the retained 2,048-sample tail and excludes transport/scheduling. Other local tasks were active; these are development diagnostics, not production sizing.

## Corrected client, transport and test perimeter

Joining is cancellable and bounded; old room callbacks cannot overwrite a newer session. No input is accepted before the first game state. Missing/stale snapshots clear held controls and require fresh state and a fresh key press; failed handshakes return control. Phase 1 automatic reconnect is intentionally disabled until the later same-body reservation implementation. Leaving clears live state while preserving closed-session evidence.

Reports freeze their starting scene/session, include the server's own state alongside its counters, and flag changes during collection. Testers can download their own evidence after a disconnect. Server debug requests, reply size and socket backlog are bounded; slow snapshot readers do not accumulate an unlimited queue. Paused stepping samples inputs once for the whole batch, so CPU stalls cannot change that batch's input tape. The impairment stream uses a single ordered delivery queue after a reproduced per-chunk timer-order failure.

An authenticated tester could previously request `work/dev-session.json` through Vite and obtain the backend secret. This was reproduced locally, then blocked both at the gateway and Vite filesystem boundary. Real HTTP checks now reject direct, raw, encoded and `/@fs` credential paths; invited clients also cannot reach Git internals or developer inspector routes. No secret is included in reports. The prior temporary remote tunnel was already closed; this hardening work opened none.

Local scripts now publish readiness only after the room, gateway and frontend work. Atomic private ownership files, an authenticated loopback stop endpoint, descendant process guardians, bounded tunnel parsing/timeouts and a verified installer prevent duplicate-start and teardown races. The 23 operations tests use isolated processes/ephemeral ports and fake tunnels. See [operations](../docs/playtest-operations.md).

The latest local room sample contains 44 ticks: execution p50 0.276 ms / p95 1.093 ms, scheduling plus execution p95 1.986 ms. Process RSS was 170.88 MiB across shared runtime and test rooms; **not memory per room**. Raw sample: [network report](phase1-network.json). No local sample establishes capacity at 300 rooms.

## Required gameplay table

| Requested metric | Phase 1 evidence |
|---|---|
| Run length across 1,000 runs | N/A: diagnostic trajectories have a fixed duration; there is no terminal glacier route |
| Incidents per run / first-incident time | N/A: no hazards in this checkpoint |
| Rescue success by team size / idle time | N/A: rescue implementation is the next authorized work |
| 300-room p95 tick / per-room memory / reconnect success | NOT TESTED; production Phase 6 gate |
| Human fun, outsider comprehension and voluntary clip use | UNMEASURED |

Rescue, recorder, stranger-test and production qualification designs are prepared in [docs/design](../docs/design/README.md). They are proposals, not measured acceptance results or permission to provision services.
