# Local socket diagnostic verification

2026-09-07, Apple arm64 macOS, Node version and source hashes recorded in each manifest. Other Codex tasks remained active. No paid resources, tunnels, main-checkout edits, public service, or 300-room run were used.

Commands verified:

```sh
npx tsc --noEmit
npx oxlint scripts/local-load-*.ts tests/local-load-*.test.ts
npx vitest run --config vitest.config.ts tests/local-load-diagnostic.test.ts
```

All checks passed. The legacy infrastructure test run passed **5/5 tests in 7.12 seconds**, including real-socket operation, bounded profile/raw-data validation, resource-abort isolation, authority IPC-orphan port release, and a hard artifact-cap failure receipt. After Phase 2 integration and separating authority/generator module imports, **6/6 tests passed in 11.12 seconds**, including real two-through-six-body sockets.

| Recorded attempt | Result | Evidence |
|---|---|---|
| Default legacy 10 rooms / 20 sockets / 30 s | INCOMPLETE before input offering: raw host free memory 100,843,520 bytes below root 512 MiB guard; all five children exited 0 | [Raw JSON](local-load-2026-09-07T22-28-56.888Z-7b21ab75-bcfd-4347-a0eb-3773c7095314/result.json), [readable report](local-load-2026-09-07T22-28-56.888Z-7b21ab75-bcfd-4347-a0eb-3773c7095314/result.md) |
| One coordinated default retry after browser/dev shutdown | INCOMPLETE before offering: raw free memory 111,575,040 bytes; all five children exited 0 | [Raw JSON](local-load-2026-09-07T22-35-09.195Z-2d11439d-1f20-479d-ac29-29995f267fba/result.json), [readable report](local-load-2026-09-07T22-35-09.195Z-2d11439d-1f20-479d-ac29-29995f267fba/result.md) |
| Named functional fixture: 2 rooms / 4 sockets / 2 s, two generators | COMPLETE: 480 scheduled, 463 offered and exactly 463 server-accepted, 17 scheduled slots skipped during declared disconnect; zero generator-late/backpressure/send-error slots; zero final rooms | [Raw JSON](local-load-functional-fixture-40d1251f-1c32-45d1-93bb-22e35c93e6b5/result.json), [readable report](local-load-functional-fixture-40d1251f-1c32-45d1-93bb-22e35c93e6b5/result.md) |

The named functional fixture deliberately sets a **one-byte host-free-memory test override** to isolate behavior assertions from unrelated macOS pressure. It does not establish the default profile's safety or performance under its unchanged 512 MiB guard. That fixture's full-window offered-input lateness p99 was **1.328 ms**. Its reported room timing remains the existing overlapping completed-callback ring, not a full-slot deadline measurement.

The functional fixture exercised real SDK auth/cap enforcement, room isolation, connected input expiry and abrupt disconnect cleanup. A real socket read pause allowed its healthy partner to advance. Snapshot skip count was zero: the queue-threshold branch was **NOT EXERCISED**. Churn created a fresh session; same-body reconnect remains **UNIMPLEMENTED**, with no success-rate claim.

Process memory before/after repeated room disposal is retained, with allocator retention versus reachable leaks unresolved. Neither RSS/room division nor per-room attribution is reported. The two default attempts show the conservative raw-free-memory guard stopping as designed; the harness did not silently lower it or adapt the workload.

Phase 2 physics candidate `ad00223526c9f3ba93320bfe284c74f1f30697fd` was integrated in this worktree as `43cc444`. The new [Phase 2 raw fixture](local-load-phase2-fixture-17b0a9e7-0548-43fd-92bc-519ded5b2d3b/result.json) and [readable report](local-load-phase2-fixture-17b0a9e7-0548-43fd-92bc-519ded5b2d3b/result.md) cover five actual rooms with 2, 3, 4, 5 and 6 bodies, 20 real sockets, all three scenes, two generators, and two seconds. This is another named functional fixture with the explicit one-byte free-memory override, not a default safety-profile pass.

| Phase 2 observed metric | Result |
|---|---:|
| Scheduled input slots | 2,400 |
| Offered / exact server accepted | 2,383 / 2,383 |
| Declared disconnect skips | 17 |
| Generator-late / backpressure / send-error slots | 0 / 0 / 0 |
| Full-window offered lateness p99 | 1.188 ms |
| Observed owned-process RSS peak | 597.34 MiB |
| Final live rooms / observed clean child exits | 0 / 3 |
| Existing completed-callback combined p99 range across rooms | 82.22–131.25 ms |
| Skipped tick slots across room lifetime counters | 4 |
| Authority initialized-empty to final-empty RSS delta | +83,394,560 bytes |

The timing rings include ramp/warm-up/drain and cannot isolate the two-second offering interval. Their large p99 values and skipped slots are retained prominently; **no authoritative deadline pass is claimed**. The memory delta is a natural process observation without forced GC, retained-object analysis or native/WASM attribution. Neither delta nor peak proves a reachable leak or room cost. Real read pause again allowed healthy-client progress, but snapshot skip count stayed zero, so the queue-threshold branch remains **NOT EXERCISED**. Offline raw-plane/acceptance re-audit passed.

The 300-room run still awaits a coordinated quiet window and usable resource envelope. No additional default smoke retry was made after the agreed retry. Production qualification, human gates, reconnect targets and full memory attribution are **NOT RUN**.
