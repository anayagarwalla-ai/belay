# Local Colyseus load diagnostic

This is future test infrastructure built during Phase 2. It does not qualify Phase 6 capacity, production placement, same-body reconnection, room memory attribution, or either human gate. It provisions no service and uses no development session credentials.

Run from this isolated repository (Node and locked dependencies installed):

```sh
npx tsx scripts/local-load-run.ts
npx tsx scripts/local-load-run.ts --physics=phase2
npx vitest run --config vitest.config.ts tests/local-load-diagnostic.test.ts
```

The default is the root-tuned legacy flat 10-room, two-client, 30-second profile. `--physics=phase2` selects a frozen flat/crossing/rescue mixture spanning two through six clients. It verifies actual body count, scene and seat order before offering input, and fails if Phase 2 physics/admission have not been integrated. There are four independent generator child processes and one authority child using the actual `BelayRoom`, Colyseus SDK and WebSocket transport. The authority binds only `127.0.0.1` on an OS-selected ephemeral port. Private authority signing material exists only in that child; generated credentials are delivered over inherited IPC.

The explicit larger profile is:

```sh
npx tsx scripts/local-load-run.ts --profile=300 --physics=phase2
```

This means 300 actual six-body rooms, 1,800 actual SDK sockets and 30 seconds, not the later 60-minute production qualification. Coordinate with other active physics/evidence work before invoking it. Never run it during human feel sessions. Duration, room count, generators, start lead, warm-up, sampling, fault schedule, memory/output caps, late-input limit, and process shutdown policy are all in `TUNING.localLoad`. The controller refuses profiles beyond the configured finite envelope. It does not accept an endpoint or adopt an existing authority.

The freeze records exact source hashes, source revision/dirty state, lockfile and installed versions, root tuning, resolved profile, machine details and the schedule formula. Each generator has its own monotonic input clock. Scheduled slots remain in the denominator when the generator is late, disconnected, or backpressured. Overdue inputs are dropped after the root lateness bound rather than issued as unlimited catch-up bursts. Inputs contain only normal bounded movement/brace/sequence fields. A fixed logical slot retains its sequence schedule after a churn event.

Each report directory contains `manifest.json`, `result.json`, readable `result.md`, and checksums. `result.json` uses compact JSON to leave room for lossless base64 planes: Float64 little-endian generator lateness and Uint8 offer-status/observed-ack arrays, ordered client-major then input round. These cover every scheduled slot in a completed run. If evidence cannot fit the hard artifact cap, the run is marked INCOMPLETE/INVALID and a small explicit omission/teardown receipt is saved within the cap. Generator full-window percentiles are recomputed by nearest rank over available raw observations. Re-audit without sockets:

```sh
npx tsx scripts/local-load-analysis.ts /absolute/path/to/reports/local-load-...
```

`offered` means the SDK send call returned; it is not a wire-delivery claim. Exact server `acceptedInputs` deltas are reconciled room by room after a bounded drain. Individual `ackSeq` values actually observed in snapshots are a separate lower bound, never a substitute for exact acceptance. Process windows retain actual sockets, authoritative populations, CPU, event-loop utilization, loop-delay probe values (nanoseconds converted to milliseconds), GC duration records/omissions, memory, queue bytes, and overlapping room timing-ring summaries. Inspection itself adds recorded observer overhead. Host load and free memory describe contention; they do not isolate other applications' CPU use.

The harness reads the authority's existing private `report()` through a fixture-only cast with coordinator approval. It never patches server timing, solver, admission or transport metrics. Available room timing rings overlap and contain only completed callbacks, with creation/warm-up/drain overlap possible. Skipped tick slots and dropped wall time are shown separately. There are no raw due/start/finish records, so no full-slot or fleet deadline percentile/pass is claimed, even when the bounded ring has a small p99.

A real Node `ws` receive pause covers a slow reader while its partner continues receiving ticks. A short local pause can fit entirely in OS buffers; zero skipped snapshots means the queue-threshold branch was **NOT EXERCISED**, not a backpressure success. Churn terminates a real socket and joins a fresh session after input expiry; it is not same-body reconnection. The latter is explicitly `UNIMPLEMENTED`, with zero eligible trials and no success fraction. Separate real-socket functional checks cover invitation/auth limits, creation authorization, room cap, independent room pause/advance, connected-input expiry, and abrupt-disconnect input/seat cleanup.

Repeated actual create/join/leave/dispose cycles and final whole-population disposal preserve initialized/empty authority process memory samples. Increases after disposal can reflect allocator retention, GC timing or reachable objects; this does not distinguish leaks or attribute memory to individual rooms. RSS is never divided by room count. `external` already includes `arrayBuffers`, and those fields are not added. Summed RSS in the process budget covers distinct controller/authority/generator processes, not overlapping worker-thread RSS.

Resource checks use sampled total owned RSS and raw `os.freemem()`, plus separate child V8 heap caps and lifetime watchdogs. Sampled stops can overshoot between samples, and heap caps do not cap native/WASM memory. On macOS, raw free memory can be much lower than reclaimable memory, so this conservative guard may abort on a busy/cached machine. A resource abort stays **INCOMPLETE** and preserves evidence; no automatic rate reduction or memory-guard weakening occurs.

Shutdown signals only directly forked child handles. No PID files, process-name kill, process-group adoption, public tunnels, paid resources or external messages are used. Child IPC loss independently shuts down authority/generators, with a finite watchdog. Tests prove parent-loss authority port release and that a resource abort leaves an unrelated listening socket intact.

The small named test fixture overrides host-free-memory minimum to one byte only to isolate functional/supervision assertions from unrelated machine pressure. The default root guard remains unchanged. Its profile, override, contention, results and scope can be preserved explicitly:

```sh
BELAY_LOCAL_LOAD_SAVE_FIXTURE=1 npx vitest run --config vitest.config.ts tests/local-load-diagnostic.test.ts
```

Installed primary API evidence is in `node_modules/@colyseus/sdk/src/Connection.ts`, `src/transport/WebSocketTransport.ts`, core `src/MatchMaker.ts`/`src/Server.ts`, and the actual `ws` implementation. SDK WebSocket selection occurs before dynamic import in the generator; read pause/termination uses the real supported Node transport. Runtime package versions are captured in each manifest; the infrastructure does not claim browser, internet, loss/retransmission, production or reconnect behavior from this loopback fixture.
