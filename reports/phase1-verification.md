# Phase 0/1 verification — Gate 1 pending

Measured on this Apple M4 development machine, 2026-09-07. No human tuning sessions have been evaluated. This is an invitation-only prototype, not production qualification.

| Check | Result | Evidence / limit |
|---|---|---|
| Unit tests | 15 passed | Deterministic scenes/tapes, physical drag/brace, cooperative motion, unilateral slack, contact stability, equivalent fixed internal steps, input validation, invitation expiry/tampering, ordered delay and scene-family validation |
| TypeScript | Passed | `npm run typecheck` |
| Active prototype lint | Passed | `npm run lint`; includes the used button primitive |
| Build | Passed | `npm run build`; build output is local only |
| Runtime dependency audit | 0 vulnerabilities reported | `npm audit --omit=dev`; a point-in-time dependency check |
| Real local protocol | 11 checks passed | `phase1-network.json`: separate seats, cap, authoritative stepping, rejected forged/stale inputs, tape, room isolation, operator/tester boundaries, echo, protected HTTP/WS |
| Browser control handlers | Passed | `phase1-browser.json`: two connected bodies (one labelled bot), movement 1.530 m during sampled input, brace on, blur releases, pause/step works |
| Optional browser inspection tool | Passed | Native WebMCP registry lists `read_belay_rope_test` with empty-object schema and read-only annotation; valid call completes, unexpected field fails intentionally |
| Temporary remote access | Passed and torn down | `phase1-remote.json`: authenticated HTML/TLS WebSocket snapshots, tester restriction, Secure/HttpOnly cookie, gateway/process closed, old external endpoint returns 530 |
| Human fun | **NOT EVALUATED** | Only the user can pass Gate 1 |

Build warnings remain for Vinext/Vite migration notices and a client chunk over the bundler's 500 kB advisory threshold. Page-load and 60 fps acceptance have not been certified. The unused generated shadcn catalogue retains scaffold lint findings under `npm run lint:all`; it is not used by this prototype. No errors were emitted by the browser during the control checks.

## Gameplay evidence

The report contains **1,000 fixed 20-second flat-ground bad-bot trajectories**, not 1,000 invented glacier runs. Full configuration, seeded records and timing scope are in `phase1-bots.json`; the table is generated in `phase1-bots.md`.

| Family | Trajectories | Median distance per climber | p95 maximum segment excess | Worst whole-span excess |
|---|---:|---:|---:|---:|
| balanced | 334 | 32.93 m | 0.0160 m | 0 m |
| short | 333 | 32.41 m | 0.0147 m | 0 m |
| loose | 333 | 33.47 m | 0.0191 m | 0 m |

These constraints have a finite iterative-solver tolerance; the table does not claim an exact zero error for every segment. All three configurations retain slack and physically transmit pulls. The separate unit check distinguishes substantial idle-body dragging from a braced anchor. Neither result establishes that it is funny.

| Required game metric | Phase 1 result |
|---|---|
| Run-length distribution across 1,000 runs | N/A: no run termination or hut exists; diagnostic trajectories are fixed at 20 seconds |
| Incidents per run | N/A: no crevasses or incidents exist |
| Rescue success by team size | N/A: only two players and no rescue |
| Time to first incident | N/A: no incident system |
| Idle fraction per player in rescue | N/A: no rescue roles |
| 300-room p95 tick / memory per room / reconnect success | **NOT TESTED**, Phase 6 public-launch gate |

## Network evidence

Local protocol sample: 50 ticks at 30 Hz, including serialization/send work. Execution p50 **0.155 ms**, p95 **0.315 ms**. Scheduling plus execution p95 **1.367 ms**. Shared server-process RSS **189.88 MiB** at that sample; this includes multiple test rooms and shared runtime and is **not per-room memory**. Small local samples cannot establish sustained production capacity.

Separate automated added-delay qualification at 30 Hz (12 echo samples per row, directional jitter setting ±10 ms):

| Added RTT setting | Observed median RTT | Observed p95 RTT |
|---:|---:|---:|
| 30 ms | 30.78 ms | 48.74 ms |
| 60 ms | 56.69 ms | 75.71 ms |
| 100 ms | 103.64 ms | 120.53 ms |
| 150 ms | 152.93 ms | 169.76 ms |
| 250 ms | 250.64 ms | 268.80 ms |

These are ordered-stream impairment checks. Wire loss is unavailable, not zero. This is **not** the conditional human 30/60 Hz comparison; that remains separately budgeted only if six default-rate tuning sessions fail. The external tunnel check originated from this same machine and cannot replace the required genuinely remote participant.

## Handoff

Use `PLAYTEST.md`. The local preview is <http://127.0.0.1:8787> while `npm run dev` runs. No tunnel is left active. Start an expiring invitation session only when the two human testers are ready, then tear it down. Both requested future open items are recorded in `PLAN.md` without acting on them. Phase 2 remains blocked by the user's Gate 1 verdict.
