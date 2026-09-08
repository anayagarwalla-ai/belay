# Colyseus snapshot encoding audit and static-state proposal

The six-body, event-empty crossing sample is **5,553 encoded Colyseus bytes**, compared with its 8,690-byte JSON estimate. Moving public static geometry/configuration into a versioned baseline reduces its recurring message to **4,590 bytes (17.34%)**, with a 1,172-byte static message. The corresponding rescue sample saves **6.70%**. All 27 sampled snapshots passed encoder, SDK-decoder, and static/dynamic reconstruction assertions. Savings vary by scene and event batch; this is not a universal reduction factor for the previous JSON counter.

This audit measures bytes from the installed `WebSocketClient.send('snapshot', message)` encoder and decodes them through the installed browser SDK. It also assembles unmasked, uncompressed binary frames with the installed `ws` frame encoder. It opens no network sockets. These are exact encoded-message and assembled-frame sizes, not observed TLS traffic, provider-billed egress, latency, host capacity, or a 300-room qualification.

## Method and evidence

Executed once on 2026-09-07, after the client latency window released the machine, using [the bounded audit script](../scripts/local-load-wire-audit.ts). Production protocol, existing cost models, runtime defaults, and load guards are unchanged. Frozen source revision: `8e9fb2636fe8503f0b2e83eadeb1b6d78c4a13bb`; the manifest additionally hashes the then-untracked executed script and relevant source/library files. Shared simulation, room, tuning and lockfile content matched root `main` at `29bbd82e14a42561ed30c00c00e5591373aaa72f` when inspected before execution.

Evidence: [measurements with original snapshots and exact encoded bytes](local-load-wire-dd814722-16ad-425b-b571-baf3704f2c50/measurements.json), [source/package manifest](local-load-wire-dd814722-16ad-425b-b571-baf3704f2c50/manifest.json), [checksums](local-load-wire-dd814722-16ad-425b-b571-baf3704f2c50/checksums.json), and [teardown receipt](local-load-wire-dd814722-16ad-425b-b571-baf3704f2c50/teardown.json). Runtime: Node 26.5.0 arm64, core 0.18.11, SDK and ws-transport 0.18.2, schema 5.0.27, msgpackr 2.1.0, ws 8.21.0.

The declared fixtures use seed 2000, the balanced family, 30 Hz, and 2/4/6 physical bodies. Each body count has an initial flat snapshot, initial crossing/rescue snapshots, 180 crossing ticks with every body walking +z, and 150 rescue ticks with the middle body resting for 60 ticks then walking -z while helpers brace. This is nine sequential worlds and 990 physics ticks, with no endpoint or concurrent socket workload. Seat labels, connected flags, and input acknowledgements are synthetic delivery metadata; physical state and event batches come from the real simulation.

Each moving fixture records an event-empty final snapshot for an up-to-date reader, the same physical state with the retained backlog for a reader behind since epoch start, and the first largest actual one-step event batch within the fixed horizon. A retained backlog is not a measured per-tick event frequency or a newly joined client's payload. No event counts are fabricated. Initial states and finite horizons are samples, not extrema or a gameplay-success benchmark.

The harness checks the current sender's bytes against `getMessageBytes.raw`, decodes through `Room.onMessageCallback`, and verifies that decoding and reassembling the candidate static/dynamic messages yields the same state as decoding the current snapshot. It asserts that candidate static content stays constant at every sampled physics tick. It independently exercises WebSocket payload-length boundaries 125/126/65535/65536. Manifests record source/library hashes, package versions, the declared workload, process limits, and a teardown receipt.

## Measured bytes

All counts below are bytes **per recipient per snapshot**. Flat rows are stationary initial snapshots; crossing and rescue rows are final event-empty states at ticks 180 and 150. Every current Colyseus message has a 10-byte protocol/type prefix. Every actual frame in this dataset has a four-byte WebSocket header. TLS numbers below use the separate 22-byte illustration described in the next section; no TLS session was opened.

| Scene / bodies | JSON estimate | MessagePack payload | Colyseus message | Assembled WS frame | TLS example |
|---|---:|---:|---:|---:|---:|
| Flat / 2 | 2,528 | 1,789 | 1,799 | 1,803 | 1,825 |
| Flat / 4 | 4,887 | 3,223 | 3,233 | 3,237 | 3,259 |
| Flat / 6 | 7,192 | 4,623 | 4,633 | 4,637 | 4,659 |
| Crossing / 2 | 3,903 | 2,800 | 2,810 | 2,814 | 2,836 |
| Crossing / 4 | 6,299 | 4,190 | 4,200 | 4,204 | 4,226 |
| Crossing / 6 | 8,690 | 5,543 | 5,553 | 5,557 | 5,579 |
| Rescue / 2 | 3,447 | 2,235 | 2,245 | 2,249 | 2,271 |
| Rescue / 4 | 6,380 | 3,839 | 3,849 | 3,853 | 3,875 |
| Rescue / 6 | 9,270 | 5,409 | 5,419 | 5,423 | 5,445 |

JSON is 1.39–1.71 times the Colyseus size in these nine selected rows. Decimal float strings, integer-versus-float representation, geometry, and current diagnostics all affect the ratio. The previous browser baseline's mean JSON estimate cannot be converted to exact encoded traffic with any one of these ratios: it is a different population of snapshots.

The following backlog rows use the **same final physical state** as the corresponding event-empty row. The incremental bytes are therefore event-batch contributions, not changes in positions or diagnostics. The largest one-step column reports the first largest batch actually found within each declared horizon. At 2/4 bodies it contained one event, not a multi-event burst; at six bodies, crossing produced catch + relapse and rescue produced catch + climb in a single step.

| Scene / bodies | Retained backlog events | Colyseus with backlog | Backlog added bytes | Largest one-step events | One-step event bytes added |
|---|---:|---:|---:|---:|---:|
| Crossing / 2 | 7 | 3,413 | 603 | 1 | 83 |
| Crossing / 4 | 9 | 4,977 | 777 | 1 | 83 |
| Crossing / 6 | 11 | 6,505 | 952 | 2 | 176 |
| Rescue / 2 | 17 | 3,721 | 1,476 | 1 | 85 |
| Rescue / 4 | 7 | 4,462 | 613 | 1 | 86 |
| Rescue / 6 | 10 | 6,295 | 876 | 2 | 174 |

The actual six-body one-step burst messages are 5,703 bytes crossing and 5,587 bytes rescue. Initial crossing/rescue states, exact event IDs/kinds/ticks, complete candidate sizes and all 27 snapshots are retained in the raw measurements. None of these short traces exercises the 256-event retention limit or proves a worst-case message size.

## Actual encoding path

At the audited source revision, `server/BelayRoom.ts:123` builds complete snapshots and filters events by each seat's cursor. The send at line 141 is a custom Colyseus room message. It is not Colyseus schema-patch replication. The current `snapshotJsonBytesTotal` counter at lines 139–150 counts UTF-8 JSON estimates for actual recipients and does not measure this encoder's output.

The installed `@colyseus/ws-transport` `WebSocketClient.ts:40–54` calls `getMessageBytes.raw(ROOM_DATA, type, message)` and passes the resulting buffer to `ws.send` with `binary: true`. `@colyseus/core/src/Protocol.ts:13–15,155–179` configures MessagePack with `useRecords: false`, prefixes the protocol byte and encoded message type, and returns a fresh buffer. Repeated object keys and unchanged values are encoded in full. The SDK `src/Room.ts` decodes the type followed by the MessagePack payload before dispatching the handler.

The transport defaults `perMessageDeflate` to false (`WebSocketTransport.ts:99–100`), and `server/main.ts:10` does not override it. Its 4096-byte `maxPayload` setting limits incoming payloads; it is not an outbound-snapshot size ceiling. The frame calculation uses one FIN binary server frame, no masking and no compression. For sampled messages between 126 and 65535 bytes, this adds four bytes. Other network components could change fragmentation or compression; none were exercised. [RFC 6455 §5.2](https://www.rfc-editor.org/rfc/rfc6455#section-5.2)

TLS is a separately labeled illustration: 5-byte record header + 1-byte inner content type + an assumed 16-byte AEAD tag, with at most 16384 application bytes per independent record, no padding, and no handshake. The example adds 22 bytes per such record. It does not measure actual record packing, TCP/IP headers, acknowledgements, retransmission, intermediaries, or provider accounting. [RFC 8446 §5.2](https://www.rfc-editor.org/rfc/rfc8446#section-5.2)

## Offline static/dynamic candidate

This is a byte experiment, not a protocol implementation. The candidate sends `snapshotStatic` with `{wireVersion, epoch, staticRevision, content}` and complete `snapshotDynamic` messages with `{wireVersion, epoch, staticRevision, state}`. Both envelopes and their longer type names are included in measured sizes. The candidate keeps all public information; it does not quantize coordinates or remove diagnostics.

| Sent when static content changes or a reader needs it | Remains in every dynamic snapshot |
|---|---|
| Simulation version, seed, family, tick rate, scene, physical player count | Tick, server time, paused flag, complete player state including connected/label/ackSeq |
| Terrain bounds, finish position, crevasse and ice geometry, bridge geometry and IDs | Every bridge's ID, cue, and collapsed flag |
| Rope total configured length; span IDs, endpoints, point indices and configured lengths | Rope points, current tension/slack, and each span's ID/tension/slack/catch highlight |
| Epoch and static revision binding in both envelopes | Complete incidents, run state, counters, diagnostics, and reader-filtered events |

The public terrain is cloned into every current expedition snapshot (`shared/expedition-simulation.ts:472`). Its geometry is immutable for the current scene/epoch, but bridge cue and collapse state change during play and must stay dynamic. Hidden bridge-capacity data is not present in the public snapshot and must not be added to the static packet. Sending the public layout is safer than assuming every future client can regenerate precisely the same geometry from a seed. A change in topology/configuration requires a new static revision, even if this finite audit never exercises it.

Player labels and connectivity remain dynamic because humans/bots can replace occupants without changing the physical roster. Retaining complete dynamic snapshots lets a reader recover after dropped snapshot slots without reconstructing a chain of per-tick deltas. Independent field-removal ablations quantify terrain, rope points, and counters/diagnostics; their reductions must not be summed, because removing multiple fields also changes shared container encoding.

The candidate sizes below include both envelopes and type prefixes: 16 bytes for `snapshotStatic`, 17 for `snapshotDynamic`. These are Colyseus bytes, excluding their WebSocket/TLS framing. Each row uses the same event-empty state as the first table.

| Scene / bodies | Current full message | Static once | Dynamic each delivery | Recurring saving | First static + dynamic |
|---|---:|---:|---:|---:|---:|
| Flat / 2 | 1,799 | 308 | 1,644 | 155 (8.62%) | 1,952 |
| Flat / 4 | 3,233 | 410 | 2,990 | 243 (7.52%) | 3,400 |
| Flat / 6 | 4,633 | 504 | 4,310 | 323 (6.97%) | 4,814 |
| Crossing / 2 | 2,810 | 976 | 2,015 | 795 (28.29%) | 2,991 |
| Crossing / 4 | 4,200 | 1,078 | 3,317 | 883 (21.02%) | 4,395 |
| Crossing / 6 | 5,553 | 1,172 | 4,590 | 963 (17.34%) | 5,762 |
| Rescue / 2 | 2,245 | 348 | 2,050 | 195 (8.69%) | 2,398 |
| Rescue / 4 | 3,849 | 450 | 3,566 | 283 (7.35%) | 4,016 |
| Rescue / 6 | 5,419 | 544 | 5,056 | 363 (6.70%) | 5,600 |

Ignoring readiness acknowledgements and retries, every sampled row becomes strictly smaller cumulatively on the second comparable dynamic delivery: `staticBytes + n × dynamicBytes < n × currentBytes`. The first exchange is 153–209 bytes larger than one current snapshot, plus an additional WebSocket header if sent as two frames. The six-body backlog variants save the same absolute 963/363 bytes but lower percentages, 14.80% crossing and 5.77% rescue, because events remain dynamic.

Removing the **entire** terrain field, solely as an ablation, removes 815 bytes from the final crossing samples and 125 from rescue (87 from flat). It would also remove mutable bridge state and is not the proposed implementation. Removing rope points independently removes 1,830 bytes from six-body crossing and 2,350 from six-body rescue; removing counters/diagnostics removes 724 and 716. These large dynamic fields explain why static/config extraction alone gives a modest reduction for rescue. There is no measured claim about whether reducing rope resolution or diagnostics is acceptable to the product; neither is changed here.

## Join, reset, and late-reader requirements before implementation

1. **Bind state to the correct room incarnation.** Negotiate the wire version. Bind static content and dynamic messages to room incarnation, epoch and static revision, optionally with a content digest. An epoch counter alone can repeat after a process restart. Never reuse cached static data merely because a seed matches.
2. **Establish static readiness.** Deliver static content before applying the matching dynamic baseline. Require an application readiness acknowledgement, or a bounded missing-static request/buffer mechanism with equivalent correctness. A successful server enqueue is not proof that the client installed the static state. Keep at most the latest complete dynamic state while waiting; do not build an unbounded queue.
3. **Preserve join semantics.** A new reader receives static content plus the current dynamic baseline, and adopts the current event cursor. Current `onJoin` starts at the latest retained event ID (`BelayRoom.ts:63–64`), suppressing historic transient effects; the proposal should preserve that behavior. Seat identity remains separate. Avoid claiming that the audit's late-reader backlog describes a new join.
4. **Reset atomically.** Current scene/seed resets replace the simulation, increment epoch and clear seat event cursors (`BelayRoom.ts:191–204`). On the client, install matching static/current dynamic state together, reset interpolation and event deduplication, and discard old-epoch packets. A delayed response for an older epoch/revision must never overwrite newer state. Configuration and rope-topology changes invalidate the static baseline.
5. **Resume late readers safely.** A reader that already holds matching static content can apply the latest complete dynamic snapshot after missed ticks. A reader missing that content requests a bounded resynchronization. Any reconnect must revalidate room incarnation/epoch/revision; an unknown or recreated room needs a fresh baseline rather than pretend continuity. This is a requirement for a future protocol, not evidence that reconnect resume exists today.
6. **Keep event delivery semantics explicit.** Events are independently sequenced by epoch and ID. Current seats advance their cursor after enqueue, and backpressure skips preserve the prior cursor (`BelayRoom.ts:131–142`); that is not application-level receipt. The simulation retains at most 256 events and marks truncation. A reader older than the retained prefix needs an explicit event-gap indication and current-state resync policy, not fabricated history or unbounded replay. Stable bridge collapse state still arrives in dynamic state even if its transient event has fallen out of history.

The initial static-plus-dynamic exchange can cost more than one current full snapshot. Amortization counts in the measurements exclude readiness acknowledgements, static requests/retries, and actual reset/join frequency. They assume the same sampled dynamic shape persists over the compared deliveries. They are a conditional byte comparison, not a complete traffic model.

The measured draft envelope omits a room-incarnation token, static digest, readiness acknowledgement and explicit event-gap fields. Those correctness requirements are described above but their eventual field names/widths and traffic are not measured. In particular, treating the measured draft as a deployable protocol would overstate what this audit establishes.

## Validation and resource receipt

`npx tsc --noEmit`, `npx oxlint scripts/local-load-wire-audit.ts`, and `git diff --check` passed before the one execution. The audit finished all 990 declared ticks and 27 sampled snapshots, with every reconstruction/static-constancy/frame-boundary assertion passing. Owned child PID 20671 exited with code 0 and no stderr. Manifest start to teardown was 5.673 seconds; this duration is a receipt, not a performance benchmark. Maximum end-of-fixture RSS was 290,750,464 bytes; periodic RSS assertions used the existing 3 GiB cap. The 1 GiB V8 heap, 180-second lifetime, forced-shutdown grace and 64 MiB report cap stayed intact. This direct encoder fixture does not run the socket harness or bypass/qualify its separate 512 MiB free-memory eligibility guard.

Raw evidence totals 744,689 bytes across four files. Checksums cover the three raw evidence files; the checksum index itself is not self-hashed. A read-only verification checked all three evidence hashes, all 25 source/library hashes, all 81 stored current/static/dynamic encoded messages, the JSON byte counts, candidate size arithmetic and the 27-row/990-tick totals. Original snapshot and exact Colyseus buffers are included so encoded byte observations can be reviewed without another simulation run. PID 20671 was also absent at the final process check; all owned audit processes are stopped.

## Scope and next decision

No protocol changes or cost-model edits are included. For a concrete arithmetic anchor only, **if** a fleet delivered 54,000 snapshots/second and **every** message had the six-body event-empty crossing sample's size, the current Colyseus stream would be `5,553 × 54,000 × 8 = 2.398896` decimal Gbit/s. The draft recurring dynamic stream would be 1.982880 Gbit/s, excluding static exchanges and all framing. These are hypothetical traffic products, not an observed sustained rate or a capacity result.

Applying these byte observations to a fleet would additionally require a time/scene/event/reader distribution, delivered snapshot rate including skipped slots, connection/rejoin frequency, static-cache behavior, input traffic, and actual network/TLS accounting. Multiplying a single sample by 300 rooms is only a conditional arithmetic scenario. This audit supplies no evidence that a host can run that fleet or that a quoted provider price buys sufficient capacity. Review the static/dynamic correctness requirements before authorizing a protocol change, then measure the implemented stream before using it in a hosting budget.
