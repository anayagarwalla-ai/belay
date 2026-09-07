# Phase 6: production qualification at 300 rooms / 1800 clients

**Protocol design, not a test result or authorization to provision.** Nothing in this document starts a harness, public tunnel, paid worker or production service. Gate 1 has not passed. The future cost proposal, phase gates and [RUNBOOK.md](../../RUNBOOK.md) must authorize and describe the actual environment before execution. Public release remains blocked until required production numbers exist and pass.

## Contract and current evidence gap

The [plan](../../PLAN.md) requires 300 simultaneous rooms with six synthetic clients each, a sustained 60-minute run after warm-up, movement/churn/reconnect scenarios, p50/p95/p99 execution and scheduling, attributed room memory plus shared process overhead, and reconnection success. The selected authoritative deadline is exactly `D = 1000 / TUNING.tickHz` milliseconds: approximately 33.3 ms at 30 Hz or 16.7 ms at 60 Hz. Qualification requires p99 scheduling plus execution **below** `D`, and at least 99.5% reconnection within five seconds of connection restoration while the 60-second reservation remains.

Existing [BelayRoom](../../server/BelayRoom.ts) has two seats, immediate seat deletion in `onLeave`, process-wide memory reporting and bounded recent timing samples. [Samples](../../shared/stats.ts) retains only `TUNING.network.telemetrySamples` observations. Existing [Phase 1 evidence](../../reports/phase1-verification.md) is local and explicitly not this production gate. This protocol must not turn the two-seat prototype into a six-body fake benchmark or report a recent ring as an hour's percentiles.

All workload parameters and policy limits belong in root [tuning.ts](../../tuning.ts); see the [configuration convention](README.md#evidence-and-configuration-convention). The already approved load/reconnect gate numbers need named root keys before implementation. Remaining profile values must be fixed and committed **before** a run; unfilled fields make a manifest ineligible. No local numeric overrides, undocumented command flags or post-result changes are permitted.

## What is being qualified

Use the exact candidate production build, runtime, dependency lockfile, routing path, transport, worker placement and observability settings proposed for release. Six bodies and the full shipping scene/input/snapshot path must run in every room. Include any shared matchmaking/presence services that the candidate actually uses; no in-process shortcut replacing a network dependency. Qualify a selected rate independently; success at 30 Hz is not certification at 60 Hz.

Colyseus documents an external Presence implementation for communication across processes. That is relevant if the candidate distributes rooms across processes, but does not select or provision Redis or a hosting provider here. Record the exact presence/driver/topology in the manifest and exercise its real costs and latency. [Colyseus Presence](https://docs.colyseus.io/server/presence).

Load generators run outside the game workers on separately measured machines. They create ordinary authenticated Colyseus clients, parse complete application snapshots and send normal bounded input at `TUNING.network.inputHz`. They must not submit authoritative body positions, directly call simulation functions or join via a private bypass that real clients cannot use. They need no full graphics renderer for server-capacity testing. Run browser canaries separately to check real client arrival/state/input behavior; socket generators do not certify rendering, audio, clip export or human feel.

The word “client” below distinguishes an assigned logical climber from a currently connected transport. During injected outages the logical population remains 1800 but open socket count necessarily dips. Publish both. This is why the suite includes a full-connection endurance run in addition to fault runs; a reconnect storm cannot honestly claim that every socket was continuously connected.

## Freeze the manifest before execution

| Required manifest field | How to fill it and why it matters |
|---|---|
| Experiment identity | Run ID, protocol version, build SHA, lockfile hash, full root tuning export/hash, fixture versions, harness SHA, raw-record schema version |
| Production placement | Provider/region, instance types, CPU architecture/quota, memory limits, Node/V8 versions/flags, worker/process/thread counts, room assignment/routing, autoscaling policy and min/max placement |
| Shared path | TLS/proxy/WebSocket settings, frame/input limits, matchmaker/Presence/driver versions, telemetry sinks, resource limits and any feature flags |
| Workload | Root profile name, seed generator/version, room/client counts, selected tick rate, movement script version, warm-up/ramp durations, churn cadence, fault schedule, repetitions and network impairment profile |
| Generator placement | Hosts/regions, runtime/SDK versions, assigned client ordinals, CPU/memory/NIC limits, timing and packet capture capabilities, clock correlation method |
| Admission and recovery | Identity fixture source, actual reconnect SDK settings, reservation duration, idle/input-expiry settings, bot handover and late-attachment behavior |
| Measurement | Monotonic clocks, percentile algorithm, window definitions, event-loop probe resolution, memory sampling cadence, binary event layout, flush/queue bounds, evidence disk budget |
| Spend and stop controls | Approved cost proposal reference, finite test allowance, provider controls, generator stop authority, evidence destination/retention and teardown runbook |
| Preconditions | Relevant gate references, dependency/API smoke tests, validity checks, required profile values and expected raw-record counts |

The manifest holds a resolved snapshot of root values, not editable runtime tuning. Reproduction requires the same software, profile/seed, logical schedule and comparable declared production resources; operating-system scheduling and actual network latency are measured outcomes, not promised bitwise reproducibility. Keep provider secrets, reconnection tokens and authorization credentials out of the manifest/evidence.

## Deterministic workload construction

Assign each room a stable ordinal and each of its `TUNING.hardCap` seats an ordinal. Derive fixture seeds from the manifest seed and those ordinals through a versioned generator. Use separate derived streams for terrain, legal inputs and fault selection so adding a telemetry call cannot alter the workload. Persist the generated event schedule before connecting clients.

Use a checked-in finite Cartesian fixture schedule rather than random fault frequencies at runtime. For distributed reconnect, enumerate `(roomOrdinal, seatOrdinal, faultMode, repetition)` from the root profile; order it by the profile's versioned seeded permutation. Event `j` is due at `sustainedStart + firstFaultOffset + j × faultSpacing`. A fault's restore time is its applied time plus the root profile's outage duration. Correlated mode groups those same tuples by declared failure domain and restoration batch. The generated schedule must fit the sustained interval and include the intended reservation-boundary strata before execution; otherwise preflight fails. Record planned versus actually applied time for every item. Separate control/expiry fixtures from the eligible success cohort in that schedule, not after inspecting outcomes.

Legal movement cycles through supported travel, opposing pull/brace, slack-to-taut catch, wall rescue, cascades and run-end/requeue fixtures present in the candidate build. The fixture set must cover expensive normal scenes: active contacts and rope constraints, full snapshot/event fan-out, rescue state, disconnect bodies and bounded telemetry. Use mixed phase offsets for normal traffic and a separate synchronized-burst schedule for the worst aligned input/tick workload. Record scene coverage by room and time; an hour of idle bodies is not an active capacity result.

The movement state machine changes direction/brace from its seeded plan and observed authoritative state, submits at the real configured input rate and respects monotonic sequences. Report attempted, accepted, rejected and expired inputs. The harness keeps its **planned** submission schedule even when it falls behind: record generator lateness/missed sends, rather than silently lowering offered load. Avoid coordinated omission, where a slow server induces a slow test and appears healthy.

A slow-reader profile pauses consumption on selected clients to exercise backpressure; an invalid-input profile submits configured bounded malformed/stale/over-rate traffic against disposable test identities. Keep their accepted/rejected traffic separate from normal-client delivery. Do not redefine malformed-load traffic as human behavior or run an unbounded denial-of-service exercise.

Derived planning checks at the contract population:

- At 30 Hz, 300 active rooms schedule 9,000 room ticks/s and 32,400,000 room ticks in the sustained hour; at 60 Hz these double. Audit actual active room lifetimes rather than assuming this total after churn.
- Six-recipient broadcast at 30 Hz gives up to 54,000 snapshot deliveries/s, before extra messages, when every room emits a snapshot each tick. Multiply measured serialized sizes by actual recipients, including protocol/TLS overhead separately; do not use a physics-only timing estimate for bandwidth.
- With the current configured 60 Hz input submission, 1800 continuously sending clients offer 108,000 input messages/s. If the later release changes submission behavior, freeze and test that exact behavior rather than using this arithmetic as a measured traffic count.

These are arithmetic workload checks, not capacity claims. Raw evidence storage must be budgeted as expected records × declared record width plus lifecycle/client/process evidence before allocating the production test.

## Execution sequence and scenario matrix

Every measured scenario uses a clean identified start, the frozen ramp and warm-up, and a **60-minute sustained interval** at the contract logical population. Warm-up is a fixed preregistered duration, reported separately. Do not extend it opportunistically until a bad transient disappears. If readiness/coverage fails, label the attempt invalid and retain its evidence; a corrected rerun gets a new manifest/run ID.

This suite's separate runs are a design proposal to make coverage and concurrency honest. Their total spend, repetitions and resource envelope must fit the later approved cost proposal. If only one short smoke run is affordable, it is a smoke run and cannot pass qualification.

| Scenario | Reproducible actions | What it establishes |
|---|---|---|
| Connected endurance | Ramp to 300 rooms × six live clients. After frozen warm-up, keep all connected and active through the sustained interval, cycling legal movement fixtures. Start ticks/inputs with the declared phase offsets. | Full connected population, ordinary physics/serialization/scheduler/GC cost. Unexpected population loss invalidates the claimed full-population interval; retain the failed attempt. |
| Churn and room lifecycle | Maintain 300 simulated six-body rooms. At root-profile scheduled boundaries, rotate the selected seat through consented leave and normal eligible arrival; separately retire ended rooms and create their replacements through the real matchmaker. Selection rotates through all room/seat ordinals before reuse. | Arrival/cleanup, bot handover, reservations versus voluntary leave, allocation/GC pressure, route/presence churn. Record connected population dips and allocation overlap; do not claim constant sockets. |
| Reconnect: distributed | Use a precomputed rotation covering every seat. Apply the selected outage profile at its scheduled time, restore the path at its scheduled time, and let the shipping client recover. Keep other clients active. | Typical reconnection latency and body continuity while rooms remain loaded. Start every scheduled outage regardless of previous recovery, within the root-configured concurrency bound; deferred starts are recorded as generator failure. |
| Reconnect: correlated | At scheduled boundaries, impair the declared cohort sharing a simulated failure domain, then restore together. Include short blackholes, abrupt transport close and manual client reload cohorts as distinct strata. | Retry bursts, routing/admission bottlenecks and app-level recovery at full logical population. A whole-cohort loss reduces connected sockets and is reported. |
| Backpressure/guardrails | Apply the frozen slow-reader and invalid-input schedules while normal clients keep moving. | Queue bounds and isolation; abusive/slow clients do not produce unbounded room/process state. |

Room retirement/replacement can briefly dip or exceed the target physical world count. Bound and publish overlap and actual counts. Do not keep an extra hidden pool and report its clients as part of the target. During a churn run, a replacement that waits for the game's stable attachment conditions must really wait; do not bypass those mechanics to improve counts.

Boundary checks accompany the sustained runs: reconnect just inside reservation expiry, reconnect after expiry, expired/foreign tokens, repeated retries, duplicate-live-client attempt, abrupt room/worker termination, empty-room disposal and shared-service interruption. Test a process death as a separate resilience result. In-memory world ownership does not imply cross-worker migration or recovery; do not count a fresh replacement world as reconnection to the lost body.

No fault scenario may intentionally destroy data or resources outside the approved test allocation. Stop only owned generator/worker resources, using the later runbook. This protocol does not request any such action now.

## Scheduler deadlines: planned slots, not convenient callback samples

For each room, use the process monotonic clock. Persist its first scheduled due time and each active interval. For planned slot `k`:

```text
due(k)       = scheduleOrigin + k × D
lateness(k)  = max(0, callbackStart(k) - due(k))
execution(k) = sendEnqueueComplete(k) - callbackStart(k)
combined(k)  = lateness(k) + execution(k)
deadlineMiss = sendEnqueueComplete(k) >= due(k) + D
```

Execution includes input sampling/application, internal physics steps, bridge/rescue updates, snapshot construction, real encoding/serialization, per-client fan-out and synchronous send-enqueue work. Instrument those components as spans without summing overlapping work twice. Input receive/parse work or asynchronous serialization outside the callback is separately attributed and still consumes the worker's measured CPU/scheduling budget. A send method returning is not wire delivery; client receive/apply/ack timestamps and send-queue bytes cover that separate path.

If the scheduler performs catch-up, each actual tick keeps its original planned due time. If it drops/rebases slots after `TUNING.maximumCatchupTicks`, emit explicit skipped-slot records and dropped wall time. Never move the due time forward and call that eliminated lateness. Skipped required slots count as deadline misses; represent their completion as absent and their combined latency as unbounded in the deadline-accounted distribution. Also show the completed-tick-only distribution, labelled as such. If inactive/disposed intervals are excluded, their lifecycle records must prove why the slots were not required.

Compute p50/p95/p99 from raw per-slot samples using the documented nearest-rank method. Compute `p99(lateness + execution)` from paired values; **do not add** `p99(lateness)` to `p99(execution)`. Publish execution, scheduling and combined distributions, sample/expected counts, maximum, deadline misses, skipped slots, drop duration and missing evidence. Report full interval, each worker, each room, fixed windows, scenario and worst room/window. Do not average worker or room percentiles, and do not let many healthy rooms conceal a starving one. The gate is assessed for the fleet and each active room's sustained distribution; worse windows remain explicit diagnostic evidence.

Supplement with `monitorEventLoopDelay()` and event-loop utilization, GC pause/CPU data and container CPU throttling. The Node 22 API describes event-loop delay as a timer-based approximation reported in **nanoseconds**; convert units explicitly and freeze probe resolution. It is a process diagnostic, not a replacement for a room's scheduled due-time measurement. [Node 22.13 performance APIs](https://nodejs.org/download/release/v22.13.0/docs/api/perf_hooks.html#perf_hooksmonitoreventloopdelayoptions).

Telemetry must write bounded, sequence-numbered batches outside the tick, with backpressure and lost-record counters. Preallocate/reuse fixed-size records where appropriate; don't stringify giant JSON rows during every physics step. Keep the same declared instrumentation in qualification. A separate observer-overhead comparison may explain cost but cannot erase a failed instrumented run or replace its missing raw evidence.

## Room memory: ownership and marginal cost, with uncertainty

Capture process/container memory over the full run and a separate controlled attribution experiment. A room count plus `RSS / roomCount` is **not** attribution. JS heap, native/WebAssembly allocation, socket buffers, allocator slack, code/runtime and shared services have different ownership.

Node reports RSS, heap and external allocation categories; `arrayBuffers` is included in `external`. With Worker threads, RSS covers the whole process while other fields are local to the reporting thread. Therefore neither summing those overlapping fields nor adding each worker's RSS is valid. [Node 22 process.memoryUsage](https://nodejs.org/docs/latest-v22.x/api/process.html#processmemoryusage).

Maintain a per-room ownership registry for simulation objects, bodies/colliders/rope arrays, inputs, event/tape/telemetry storage, serialized snapshot buffers, seats/reservations and room-owned socket queues. Record element counts, logical lengths, allocated capacities and byte ownership. Count a shared backing buffer once, even if several typed-array views exist. Do not use serialized snapshot length as allocated-memory size. Label estimated JS object overhead rather than pretending property counts give exact heap bytes.

The controlled attribution experiment runs the same candidate binary, runtime and production hardware class, outside the deadline run:

1. Record a fresh initialized empty worker after the frozen warm-up. Include loaded Rapier/runtime/transport/telemetry so the baseline is not a minimal Node process.
2. Add rooms in the frozen root-profile batches, each with six bodies and realistic bounded state. At each occupancy, exercise the same fixture interval and record natural memory high-water marks and steady-state samples. Repeat in fresh processes as prescribed by the committed profile, including a descending occupancy/cleanup sweep.
3. Separately attach/detach real clients while holding worlds constant to estimate transport/seat costs. Compare empty, connected, active/rescuing and reserved-disconnected states. Fill bounded tapes/rings to their real shipping caps; don't measure only newly allocated empty buffers.
4. In diagnostic runs, take heap snapshots and inspect reachability/retaining paths from room registry roots. Assign objects reached only from one room to that room; shared objects go to shared-runtime categories. Fix the parser/version in the evidence. Do not take heap snapshots in the scored deadline interval.
5. Attribute directly tracked external buffers exactly where possible. Rapier worlds can share a module-level WASM allocation arena: separate world objects do not prove separate WASM memories. If allocator ownership is opaque, report measured marginal occupancy slopes and uncertainty as **estimated** native/WASM bytes per room, plus the unattributed residual. Do not call the world serialization size its heap footprint.
6. Reconcile live/retained objects and the marginal estimates against process/container trends without double-counting overlapping metrics. Report allocation growth that remains after disposal, including allocator high-water retention, separately from reachable-object leaks. A flat JS heap does not prove flat RSS.

Heap snapshots block the event loop and can require about twice the live heap memory. Node also notes that snapshots are per isolate and their schema is V8-specific. Plan headroom and collect them only in the controlled diagnostic experiment. [Node 22 V8 heap snapshot API](https://nodejs.org/docs/latest-v22.x/api/v8.html#v8getheapsnapshotoptions).

Required memory output for each room/cohort: exact owned buffer bytes and logical object counts; attributed exclusive JS retained bytes where measured; transport attribution method; estimated native/WASM marginal bytes with sample distribution/confidence; shared runtime/allocator/process overhead; unknown residual; process/container peaks and growth across the sustained run. Report room p50/p95/p99/max by scene and lifecycle state. An estimate's uncertainty must be included in the production resource envelope. Missing native ownership is an explicit finding; it cannot be hidden by allocating all unexplained RSS evenly across rooms.

There is no approved numeric per-room RAM target in the plan. The future production proposal must specify enforceable worker memory/headroom and evidence bounds in root tuning. Qualification needs usable attribution plus a deployment that stays within that declared envelope; this document invents no memory budget or provider capacity.

## Reconnect definition and denominator

The test distinguishes involuntary drop, consented leave/requeue, client reload, server-room loss and token misuse. Only the intended reconnection paths enter their declared reconnect cohort. A fresh join with a new body is not a successful reconnect, even if the socket opens quickly.

Current Colyseus documentation describes automatic retries for a surviving client room object, server seat reservation with `allowReconnection()`, and manual `client.reconnect(reconnectionToken)` after a reload. Tokens refresh after connection and manual reconnect returns a new client Room object, so listeners must be restored. Pin/smoke-test these semantics against the actual `@colyseus/core`/SDK lockfile before the load run. BELAY's custom broadcast snapshots still need application-specific state/ack recovery; schema reconnection examples do not implement that for this code. [Colyseus reconnection](https://docs.colyseus.io/room/reconnection).

For each injected event preserve these timestamps and identities:

| Field | Definition |
|---|---|
| `impairAt` | Injector actually applied the failure, not the planned request time |
| `serverDropAt`, `reservationExpiresAt` | Server-observed involuntary drop and its authoritative body/seat expiry |
| `restoreAt` | Injector actually restored the affected network path, verified with an independent control probe through the same ingress; not the eventual WebSocket-open time |
| `transportOpenAt` | Successful new/recovered transport connection |
| `stateAppliedAt` | Client applied a fresh authoritative state for the same room, epoch, identity and body; server tick advanced through the outage |
| `inputAckAt` | Client received acknowledgement for a fresh post-restore input accepted for that same body |
| `readyAt` | Both fresh state application and fresh input acknowledgement have completed |

Measure `readyAt - restoreAt` on one generator's monotonic timeline, or with an explicitly bounded clock mapping when injector/client processes differ. Do not subtract unsynchronized wall clocks. Record all cross-machine clock correlations/uncertainty for server-to-client diagnosis. The independent restoration probe must not depend on the target body's successful reconnect: room routing/admission failure after path restoration is a reconnect failure, not an excuse to move the clock's start later.

An eligible event is a predeclared, actually restored involuntary-drop/reload trial whose original body reservation is still valid at restoration. Include every such event, even if it never connects, times out, hits a server error, loses its room or needs repeated retries. Success means `readyAt - restoreAt <= five-second contract bound`, before reservation expiry, with same body/rope order and no duplicated seat. Stale-input acknowledgement, a TCP handshake, or a new-room fallback is failure. A near-expiry restoration with less than the full recovery window remains eligible and must recover before expiry; report it as a boundary stratum.

Restoration after the 60-second reservation expires belongs to an expected-expiry rejection test, not the success-rate denominator. An injector that never restores or a generator that dies produces an invalid/censored trial, disclosed with reason and schedule ID; it cannot be quietly removed to improve the score. Excess invalid trials make the planned qualification incomplete. Room/worker death during an otherwise eligible trial is counted as failure and also reported as a resilience limit.

Compute `successes / eligible restored trials`; the contract is at least 99.5%. Report raw numerator/denominator, latency distribution including right-censored failures, timeout/identity/state errors, invalid/expired controls and results by outage mode, region, worker, device path and remaining reservation time. Precommit trial coverage/repetitions and report confidence intervals; a handful of lucky successes does not establish the rate statistically. Do not invent a different statistical pass threshold after seeing the data.

On the server, a dropped climber remains the same limp body on the rope during its reservation; no stale brace/input may remain active beyond the configured expiry. Reconnection must not reset rope length, restore a favorable pose or erase an incident. Test body continuity and first acknowledged input against server event evidence, rather than demanding an identical position while the world is advancing.

## Required raw evidence and analysis

Future evidence bundle (illustrative filenames, no files generated by this task):

| Artifact | Required content |
|---|---|
| `manifest.json` and `tuning.json` | Frozen fields/configuration above, source hashes and exact resource placement |
| `schedule.*` | Deterministically generated client/fault/scene schedule and generator/version/hash |
| `room-slots.*` | Every expected slot's room/worker/epoch, due/start/finish, component timings, recipients, encoded bytes, skipped status and sequence number |
| `room-lifecycle.*` | Creation/disposal, seat/body identity, connections/reservations, world/scene coverage, active interval, worker assignment |
| `process-timeseries.*` | CPU, throttling, event-loop/GC measurements, memory categories, send queues, evidence queue occupancy/loss and process restarts |
| `client-timeseries.*` | Actual active sockets/logical clients, offered/accepted rates, generator delays, receive/apply/ack age, RTT/jitter and reconnect transitions |
| `reconnect-events.*` | Every scheduled/applied fault, restoration/control probe, identity continuity, attempts and success/failure/censor reasons, with secrets removed |
| `memory-attribution/` | Ownership ledger, occupancy/connection sweeps, raw samples, controlled heap artifacts and analysis method, shared/unknown categories |
| `analysis/` | Pinned offline analysis program/notebook, invocation, unit conversions, percentile/CI definitions, raw row counts and missing-record audit |
| `result.md` | Scenario results, full and per-worker/per-room distributions, worst windows, deadline/memory/reconnect verdicts, limitations and links into raw records |
| `checksums.txt`, `teardown.*` | Artifact hashes, owned resource stop/deletion evidence and final ledger/cost reconciliation |

The raw timing stream may use compact binary columnar records, compressed and rotated with an index. It must be reconstructable by the supplied offline parser, not only viewable in a vendor dashboard. Histograms and sampled screenshots alone are insufficient. Preserve evidence of failed/invalid attempts with reasons; retain no access credentials or raw user contact data.

Validation reconciles scheduled versus observed slots, room/client populations, input offers versus acceptance, fault schedule versus trials, raw record sequences, per-worker totals and aggregate distributions. Instrumentation overflow or missing mandatory raw records makes the run unqualified even if a dashboard shows a good p99. Generator CPU/network saturation or missing fixture coverage likewise prevents a capacity claim at the intended offered load.

## Decision and stop conditions

Publish a **PASS / FAIL / INVALID / NOT RUN** result for each scenario and each required metric. A qualified candidate needs the full connected sustained run plus completed declared movement/churn/reconnect/guardrail coverage; valid p99 deadline accounting; at least the contract reconnection rate; usable memory attribution and the declared resource envelope; complete raw evidence; and the applicable cost/gate approvals. No average of these results produces a pass.

Abort and preserve evidence for the declared spend/resource kill switch, uncontrolled state/queue growth, OOM/restart, data-integrity/identity corruption or evidence loss. A performance threshold failure can finish its bounded diagnostic interval if safe and within the approved budget, but stays failed. Do not keep adding workers, changing rates, disabling telemetry or relaxing faults until a passing screenshot appears. A revised candidate requires a new frozen manifest and the affected qualification again.

Required root additions before implementation: approved load counts/duration/deadline/reconnect targets; warm-up and ramp profile; room/client scene/fault schedules and repetitions; retry behavior; generator limits; memory attribution occupancy/repetition profile; measurement window/cadence and raw-buffer/disk bounds; resource/headroom and cost stop envelopes. Values absent today are unresolved implementation inputs, not permission to change the two explicitly open design items in the plan.

Proposed root schema, with no new numerical defaults here:

| Root path | Content/source |
|---|---|
| `load.rooms`, `load.clientsPerRoom`, `load.sustainedSeconds` | Already approved contract counts/duration; assert clients per room equals the global hard cap |
| `load.reconnect.maximumReadyMs`, `load.reconnect.minimumSuccessFraction` | Already approved reconnect target; reservation references `later.reconnectSeconds` |
| `load.rampSeconds`, `load.warmupSeconds`, `load.repetitions` | Frozen experiment values with rationale; part of the future resource/cost envelope |
| `load.scenes`, `load.faults` | Finite versioned fixture tables: mode, outage duration, first offset, spacing, correlated cohort, repetition, seed derivation and expected eligibility |
| `load.generator`, `load.measurement` | Input clock/queue controls, probe resolution, reporting windows, flush cadence and raw-evidence memory/disk caps |
| `load.memoryAttribution` | Occupancy steps, connection cohorts, measurement duration, fresh-process repetitions and capture headroom |
| `load.resources`, `load.stop` | Actual worker resource limits and approved test-spend/teardown controls; unset until the production proposal exists |

Derive the tick deadline from `tickHz` and the internal-step count from `physicsHz / tickHz`; never store rounded 33.3/16.7 ms as an alternate deadline. Export the resolved profile and generated schedule so the later operator needs no ad hoc numbers to reproduce an attempt.

After execution, stop load generators, invalidate test credentials, tear down only resources named in the approved runbook, confirm shared dependencies and temporary capacity are removed or returned to the approved state, and reconcile evidence/spend. This document records **no production measurement, capacity pass, cost approval or provisioned resource**.
