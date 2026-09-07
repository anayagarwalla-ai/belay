# Phase 1 bot diagnostics

1000 deterministic 20-second two-bot flat trajectories. Not glacier runs and not a production room load test.

Generated: 2026-09-07T22:13:08.267Z. CPU: Apple M4.

| Family | Trajectories | Median distance per climber (m) | p95 maximum segment violation (m) | Worst span violation (m) | Median taut transitions |
|---|---:|---:|---:|---:|---:|
| balanced | 334 | 32.86 | 0.0100 | 0.0000 | 5 |
| short | 333 | 32.42 | 0.0100 | 0.0000 | 5 |
| loose | 333 | 33.42 | 0.0100 | 0.0000 | 4 |

Isolated simulation tick: p50 0.030 ms; p95 0.038 ms. Excludes network, scheduling and serialization.

| Required later metric | Status |
|---|---|
| Glacier run duration / incidents / first fall | N/A: no runs or hazards in Phase 1 |
| Rescue success / cascade / inactivity | N/A: no rescue in Phase 1 |
| 300-room production tick, memory, reconnect success | NOT TESTED: Phase 6 gate |
| Human fun and latency threshold | NOT EVALUATED: awaiting Gate 1 |

Process memory is shared runtime memory, not a per-room allocation measurement. No human tuning sessions were consumed.
