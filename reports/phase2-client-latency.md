# Phase 2 real-stream client latency capture

Eight sequential ten-second windows completed on 2026-09-07 (2026-09-07T23:34:46.942Z to 2026-09-07T23:36:44.491Z). All 4,800 frame rows and all event observations are retained in [the original JSON](phase2-client-latency.json). No stale transition, receipt gap over the configured 1,000 ms threshold, hard reconciliation snap, or unsupported prediction output was observed. These short scripted loopback windows do not qualify human feel or production performance.

**Timing defect found:** four native first-drawn timestamps precede receipt by 0.3–1.2 ms; 327 frame ages are negative (minimum −1.4 ms). The viewport used the requestAnimationFrame timestamp, which can precede a snapshot received before the callback executes. Receipt uses performance.now(). Native draw-delay and frame-age timing therefore cannot be treated as accurate in this capture, including positive values. The independent fixture's receipt-to-renderer-completion measurements sample performance.now() after renderer.render and remain separately reported. Original data is preserved; a subsequent client fix requires separate validation and does not retroactively fix this capture.

## Network and receipt timing

The profiles add 100 or 250 ms round-trip ordered-stream delay with zero configured jitter, using the protected gateway's existing DelayedStream on both directions of every browser/helper WebSocket. HTTP matchmaking/setup is not delayed. Measured RTT includes local scheduling and execution. Packet loss is unavailable from WebSocket and none is simulated; missed echo probes and transport-pressure skips are not wire-loss measures. There were zero missed probes and zero scene-lifetime skipped snapshots in these cases.

RTT has only 19–20 echo samples per case; raw JSON includes p99, but this sample count makes it effectively a tail observation rather than a stable percentile.

| Players / authority Hz / added RTT ms | RTT p50 / p95 / max ms | Echoes | Max receipt gap ms | ACK p50 / p95 / max ms | Receipt → render p95 ms | Snapshots |
| --- | --- | --- | --- | --- | --- | --- |
| 2 / 30 / 100 | 102.4 / 103.0 / 103.9 | 20 | 39.4 | 115.1 / 123.2 / 125.8 | 16.7 | 300 |
| 2 / 30 / 250 | 253.2 / 256.5 / 256.6 | 20 | 69.6 | 265.2 / 272.2 / 302.6 | 15.3 | 300 |
| 2 / 60 / 100 | 102.1 / 103.3 / 103.3 | 19 | 25.7 | 114.7 / 120.9 / 123.9 | 16.3 | 600 |
| 2 / 60 / 250 | 253.4 / 326.4 / 399.8 | 20 | 166.9 | 264.7 / 282.0 / 415.8 | 16.4 | 590 |
| 6 / 30 / 100 | 103.1 / 107.3 / 171.5 | 20 | 87.3 | 121.1 / 128.5 / 206.1 | 12.0 | 300 |
| 6 / 30 / 250 | 254.1 / 351.5 / 359.8 | 20 | 180.8 | 287.4 / 319.8 / 444.0 | 11.4 | 297 |
| 6 / 60 / 100 | 102.7 / 103.7 / 104.1 | 20 | 52.7 | 117.5 / 124.0 / 161.7 | 13.4 | 601 |
| 6 / 60 / 250 | 255.3 / 260.4 / 273.4 | 20 | 123.0 | 266.7 / 274.1 / 370.7 | 3.6 | 598 |

ACK latency measures an actual input submission to a received snapshot explicitly acknowledging that sequence. Coalesced intermediate sequences are omitted, not classified as loss. Receipt → render measures snapshots actually submitted by renderer.render, not monitor presentation or human perception; a superseded snapshot need not be drawn. No dedicated reconciliation-settling duration was instrumented. Capture durations were 10000.8–10009.2 ms.

## Own-body correction observations

Raw reconciliation is the XZ difference between the prior predicted position plus remaining correction and the newly received authoritative own-body position when the production reconciliation branch runs. Applied correction is final displayed output minus the predictor's base position after safe-ground projection. Display versus latest authority compares to the latest *received* position, not contemporaneous server truth; interpolation itself contributes to this difference. These quantities are not interchangeable.

| Players / Hz / added RTT | Reconciliations | Raw p95 / max m | Applied max m | Display − latest max m | Unsupported / hard snaps |
| --- | --- | --- | --- | --- | --- |
| 2 / 30 / 100 | 98 | 0.0498 / 0.0518 | 0.0408 | 0.4084 | 0 / 0 |
| 2 / 30 / 250 | 102 | 0.0187 / 0.0520 | 0.0410 | 0.2817 | 0 / 0 |
| 2 / 60 / 100 | 197 | 0.0042 / 0.0106 | 0.0084 | 0.3325 | 0 / 0 |
| 2 / 60 / 250 | 179 | 0.0293 / 0.0954 | 0.0753 | 0.2820 | 0 / 0 |
| 6 / 30 / 100 | 96 | 0.0367 / 0.2031 | 0.1598 | 0.3513 | 0 / 0 |
| 6 / 30 / 250 | 102 | 0.0146 / 0.0213 | 0.0168 | 0.5770 | 0 / 0 |
| 6 / 60 / 100 | 189 | 0.0041 / 0.0106 | 0.0084 | 0.3546 | 0 / 0 |
| 6 / 60 / 250 | 188 | 0.0250 / 0.0962 | 0.0758 | 0.5935 | 0 / 0 |

Unsupported prediction means output differing from authoritative interpolation while prediction is disabled, or ordinary-ground movement crossing unsupported terrain. It does not audit authoritative physics penetration. The driver is state-reactive, so delay changes trajectories and correction opportunities; lower correction percentiles do not establish better authority rate or better feel. This capture also predates the clock correction.

## First received versus first drawn

Below are native elapsed seconds since each case's measurement reset for the first observation of each kind: **received / drawn**. An asterisk marks an impossible draw-before-receipt pair. Every draw value uses the flawed pre-fix frame timestamp and is retained only as original evidence. The fourth reversed pair is a later six-player/60 Hz/250 ms fall at 6.1642 / 6.1638 s. Exact surface/incident/player IDs, server cue-onset tick/substep, repeat falls, and all physical event first receipts are in JSON.

| Players / Hz / added RTT | First bridge cue received / drawn s | First collapse received / drawn s | First fall received / drawn s |
| --- | --- | --- | --- |
| 2 / 30 / 100 | 2.883 / 2.896 | 3.281 / 3.280 * | 3.479 / 3.480 |
| 2 / 30 / 250 | 3.023 / 3.034 | 3.422 / 3.434 | 3.621 / 3.634 |
| 2 / 60 / 100 | 2.863 / 2.876 | 3.280 / 3.292 | 3.479 / 3.493 |
| 2 / 60 / 250 | 3.163 / 3.179 | 3.581 / 3.595 | 3.782 / 3.795 |
| 6 / 30 / 100 | 2.874 / 2.881 | 3.273 / 3.281 | 3.474 / 3.481 |
| 6 / 30 / 250 | 3.024 / 3.031 | 3.425 / 3.431 | 3.623 / 3.631 |
| 6 / 60 / 100 | 2.868 / 2.878 | 3.284 / 3.295 | 3.484 / 3.494 |
| 6 / 60 / 250 | 3.064 / 3.064 * | 3.482 / 3.481 * | 3.680 / 3.681 |

All cases received cue, collapse, fall, catch and climb events. Catch/climb events have no distinct native first-draw timestamp. Cue/fall observations establish a renderer submission within the camera frame, not attention or unobstructed human visibility. No received observation ended before drawing in these windows.

## Environment, retention and reproducibility

The browser was HeadlessChrome 152, viewport 1280×633 at DPR 1, on an Apple M4 with 10 logical CPUs and Node v26.5.0. The fixture used the real client, Colyseus SDK/room and physics. Test-entry wrappers call each original production method once with its original receiver; private predictor fields are observed without replacing prediction. The authority and proxy listened only on owned ephemeral loopback ports. Heavy project workloads were held by coordination during the eight cases; unrelated desktop activity remains possible. The browser and fixture were stopped after capture. A teardown WebSocket EPIPE was logged after the last case completed; captured browser errors were empty.

The leader approached the first bridge midpoint and braced, then moved toward the entry wall after falling and braced after recovery. Helpers approached the entry rim and braced, acting on their own delayed public snapshots. The leader updates every existing 0.5-second evidence cadence; helpers send at the existing 60 Hz input rate. Every scene used crossing seed 2000. No hidden bridge capacity was used by policy.

Some windows include authority stalls. The 2/60/250, 6/30/250 and 6/60/250 cases have scene-lifetime dropped-wall counters of 166.7, 200.0 and 66.7 ms, respectively. These counters were requested after pausing and include setup plus the post-window interval; they are context, not exact client-window measurements or attribution of particular RTT spikes. No counters have been relabeled as packet loss.

Each case retained 600 frames, below the existing 2,048-row bound; no reported truncation occurred. The validator independently recomputes all five frame-derived summaries, checks matrix completeness, counts, epochs, event IDs, retention and measured source SHA-256 hashes. It reports timing defects explicitly without altering the data.

The measured source parent is df15479e3345b5ba336f4ebad7c8fe1a26e6e87c. Its client code was unchanged for capture; diagnostic tuning and fixture additions were uncommitted and are fully pinned by the JSON sourceFiles hashes. The separate evidence/tools commit contains those exact files. Other newer main-branch server/physics/protocol work is outside this frozen baseline. Raw artifact SHA-256: 0eba4753def41b1c22e3c6c1eced5ea211f40042fe302c3676936b676629b64d.

To reproduce, use the evidence/tools checkout and coordinate a CPU window first:

1. Run `node --import tsx tests/fixtures/serve-client-loopback.ts` and record its emitted loopback URL.
2. Open that URL in isolated agent-browser session `belay-latency-audit`, verify the rendered fixture immediately, and click **Join test rope**. Keep the browser visible to its rendering loop throughout collection.
3. Run `node --import tsx tests/fixtures/run-client-latency.ts work/phase2-client-latency-recapture.json belay-latency-audit`. The collector refuses to overwrite an existing artifact and writes progress after every case.
4. Run `node --import tsx scripts/validate-client-latency.ts work/phase2-client-latency-recapture.json`. After subsequent source changes, pass the evidence/tools commit as a third argument to validate this original report's source manifest.
5. Close only the owned browser session and stop the owned fixture. No endpoint needs to be published.

This evidence does not add rollback, tune physics, resolve the preserved Phase 2 static-role failure, or authorize Phase 3. No human rescue verdict is inferred.

## Follow-up clock correction

The subsequent client-only fix samples performance.now() inside the viewport callback for interpolation, prediction age and elapsed time. Evidence samples that clock again after renderer.render completes. A regression executes the real viewport, geometry, camera, prediction and evidence with only GPU/DOM boundaries mocked: an old frame timestamp of 98.8 ms, receipt at 100 ms, callback at 101 ms and completion at 104 ms previously produced −1.2 ms age and draw timestamps. The corrected values are 1 ms age and 4 ms receipt-to-draw. The test failed before the fix and passes afterward.

Validation: 42 focused renderer, presentation and connection tests passed; typecheck and lint passed. No additional live capture was run. The original JSON bytes and all original timing defects remain preserved. Validate its frozen source manifest after the fix with `node --import tsx scripts/validate-client-latency.ts reports/phase2-client-latency.json refs/remotes/evidence/client-source`.

## Source recovery in a fresh clone

The measured source contains the original timing defects. Its 33 manifest files are preserved in a small, standalone Git bundle; its receipt records SHA-256, byte count and tree identity. Every file was checked against the report in a fresh bare repository. This partial source snapshot supports validation and inspection; it is not a complete application checkout or a new capture.

```sh
git bundle verify reports/phase2-client-source.bundle
git fetch reports/phase2-client-source.bundle refs/heads/codex/evidence-client-source:refs/remotes/evidence/client-source
node --import tsx scripts/validate-client-latency.ts reports/phase2-client-latency.json refs/remotes/evidence/client-source
```
