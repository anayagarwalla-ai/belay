# Phase 3: a bounded local video recorder

**Architecture proposal; no recorder, audio, upload path or hosting is implemented here.** Start only after Gate 1 and the Phase 2 human rescue stop have cleared. The [plan](../../PLAN.md), root [tuning.ts](../../tuning.ts) and [configuration convention](README.md#evidence-and-configuration-convention) govern all limits. This is actual captured video with the game's Web Audio mix, not a simulation tape renamed as a clip.

## Contract and arithmetic

| Constraint | Source and interpretation |
|---|---|
| Rolling maximum 15 seconds | `TUNING.clip.seconds`; maximum playable media duration, including any presentation slow motion |
| Landscape 1280×720; portrait equivalent | `clip.width/height`; portrait swaps dimensions to 720×1280, exactly 9:16 |
| 24 fps | `clip.fps`; encoded media timestamps, not the authoritative simulation rate |
| Target 800 kbps video + 48 kbps mono audio | `clip.videoBitsPerSecond/audioBitsPerSecond`; bitrate requests are not hard byte bounds |
| Maximum 2 MiB | `clip.maximumBytes = 2,097,152`; complete container, metadata and tracks together |
| Local download only | `clip.uploadsEnabled = false`; no network sink, remote transcoder, object-store SDK or upload endpoint in Phase 3 |

Derived budget: `(800,000 + 48,000) × 15 / 8 = 1,590,000 bytes`, about 1.516 MiB. That leaves 507,152 bytes below the complete-file cap for container overhead and encoder variation. The cap implies an overall average ceiling of about 1,118,481 bits/s over 15 seconds. These are arithmetic budgets, not measured compression results or bitrate guarantees.

The existing [viewport](../../client/viewport.ts) has a WebGL canvas and HTML labels/edge markers. A canvas capture will not automatically contain that DOM overlay. The existing simulation/input tapes are diagnostic state, and cannot substitute for capturing what was actually rendered, including prediction and interpolation.

## API facts that constrain the design

- WebCodecs provides encoder configuration probes, keyframe requests, output chunks, queue sizes and explicit release of raw frame/audio objects. It does not require a browser to support any particular codec. A successful probe is followed by a real encode/decode test and error handling. [W3C WebCodecs, configurations and VideoEncoder](https://www.w3.org/TR/webcodecs/#videoencoder-interface).
- Encoded chunks still need a media container; muxing is application/library work. Chrome's guide describes output handling, encoder errors and releasing `VideoFrame` resources. [Chrome WebCodecs guide](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs).
- `MediaRecorder` timeslices are minimum collection intervals, with asynchronous event delivery. Individual blobs need not be playable; the full set from a completed recording must be. Its bitrate options are targets. Therefore, discarding old blobs and concatenating the rest is not a sufficient rolling-file implementation. [W3C MediaStream Recording §2.3](https://www.w3.org/TR/mediastream-recording/#mediarecorder-methods).
- Canvas `captureStream()` yields a track with the canvas dimensions. A non-origin-clean canvas throws at capture creation and becomes muted if tainted later. That is a real failure path, not a reason to request screen capture. [W3C capture from DOM elements §4](https://www.w3.org/TR/mediacapture-fromelement/#html-canvas-element-media-capture-extensions).
- Web Audio can expose its mix as an audio `MediaStream` through `MediaStreamAudioDestinationNode`. Its default channel count is stereo, so mono must be configured deliberately. `getOutputTimestamp()` relates audio-device sample time to the performance timeline; it is an estimate, not an exact latency measurement. [W3C Web Audio, destination node](https://www.w3.org/TR/webaudio/#MediaStreamAudioDestinationNode), [audio timestamp](https://www.w3.org/TR/webaudio/#dom-audiocontext-getoutputtimestamp).
- AudioWorklet supports custom processing on the audio rendering thread. The capture tap must not block or perform unbounded work there. [Chrome AudioWorklet introduction](https://developer.chrome.com/blog/audio-worklet/).

The proposal below uses these APIs but does not claim measured browser support, achievable BELAY frame rate or a proven memory ceiling for browser-internal codec allocations.

## Components and ownership

```text
live render-state + recordable overlays ─→ clip compositor ─→ VideoEncoder
                                                           ↓
game sound sources ─→ master mix ─→ speakers          encoded GOP ring
                           └─→ mono recording tap ─→ PCM audio ring
                                                           ↓
fall/catch markers + save key ─→ select interval → encode selected audio
                                                           ↓
                                              mux → validate → local Blob
```

The main thread owns input, the live camera and the clip compositor. A dedicated worker owns video encode output, bounded encoded storage and export jobs when the browser supports that path. It receives copied/transferred rendered frames with a session ID and monotonic media timestamp. The audio worklet sends bounded mono PCM blocks with sample counters; a receiver returns pooled buffers or credits. A stopped session cannot append late results into the next one.

Proposed internal interfaces:

| Component | Contract |
|---|---|
| `CaptureClock` | Maps rendered frames, audio sample counters and event markers onto one media timeline; identifies discontinuities |
| `ClipCompositor` | Produces the selected orientation at the configured dimensions and cadence, including readable rope/figures and recordable overlays |
| `RollingStore` | Retains whole decodable video groups and audio samples within the rolling horizon and app-owned byte budgets; reports earliest/latest common coverage |
| `LocalExporter` | Takes a bounded interval, codec configuration and owned buffers; returns a fully validated local artifact or a typed failure |
| `LocalArtifact` | `{blob, mime, byteLength, playableDuration, width, height, fpsObserved, audioPresent, captureInterval, validationVersion}` |
| `LocalDownload` | Creates/revokes a local object URL and offers download; does not know an upload URL or remote identity |

Proposed library candidate: **Mediabunny**, behind the exporter boundary. Its official guide documents `Output`, in-memory targets, finalization and cancellation, and lists WebM and MP4 read/write support; codec availability still depends on the browser. Pin and audit the actual package version/license during authorized implementation. No dependency is installed by this task. [Mediabunny writing guide](https://mediabunny.dev/guide/writing-media-files), [format/codec support](https://mediabunny.dev/guide/supported-formats-and-codecs).

Adapter plan: feed the retained encoded video through `EncodedVideoPacketSource` with first-packet decoder metadata and decode order preserved; feed the selected PCM through `AudioSampleSource` for export-time encoding. Those are documented source types, but their delay/padding and buffer ownership still require the boundary tests below. [Mediabunny media sources](https://mediabunny.dev/guide/media-sources#encodedvideopacketsource). Reopen final bytes through its input reader and compare `computeDuration()` and packet ranges to the capture manifest; the guide defines computed duration from the maximum track end, distinct from approximate metadata duration. [Mediabunny reading guide](https://mediabunny.dev/guide/reading-media-files#reading-file-metadata).

Using the same library for write and read can share bugs: qualify with a separately implemented media inspector/player and full decode as well. Its implementation must preserve audio delay/padding and emit correct durations/indexes. If the candidate cannot satisfy those tests, replace the adapter; do not write an unreviewed container byte writer or bypass validation.

## Rolling video and audio

Preferred candidate format is WebM with VP8 video and Opus audio if the exact configuration passes runtime checks. MP4 with H.264/AAC is a second candidate only with a tested encoder/mux/decoder chain. Do not use a user-agent-name switch. The initial live path should use a no-reordering codec/configuration, and validate timestamp order; a path that emits reordered frames needs proper decoding/presentation timestamp handling before it is enabled.

Encode the **live composited frames**, requesting keyframes at a root-configured interval. An encoded group begins with an actual output keyframe, not merely a requested one. Preserve its decoder configuration and sample durations. Do not keep raw video frames for the whole horizon. Close `VideoFrame` and `AudioData` objects immediately after their consumer has taken ownership; cap transfer queues and encoder backlog, and include worker-in-flight ownership in accounting.

Let `end` be the latest completed media time common to video and audio. Evict video groups until the first retained group's keyframe is at or after `end - clip.seconds`. Retain all dependencies of the surviving groups. The available clip may be shorter than the maximum by a keyframe interval; never keep an undecodable leading delta frame or hide an older GOP outside the stated rolling budget. Before enough history exists, report the actual shorter duration.

Retain the mono PCM mix in a circular sample buffer for at most `clip.seconds`; encode **only the selected sample interval on export**. This simplifies precise trimming and avoids retaining arbitrary pre-window compressed-audio dependencies. PCM memory is separate from the encoded output limit: required bytes are `ceil(actualSampleRate × clip.seconds) × bytesPerSample`, with channel count fixed to mono. The actual context sample rate must be reported; a requested sample rate is not assumed honored. Muxing must still represent encoder priming and trailing padding correctly.

A newly configured video encoder starts a new rolling epoch and requires a new keyframe. Resize, orientation change, audio suspension, timestamp reversal, page hiding, context loss or incompatible decoder metadata also closes the epoch. Do not splice two epochs into a falsely continuous clip. On resume, rebuild history and show its actual coverage.

Backpressure is bounded: if raw-frame credits or encoder queue allowance run out, drop incoming capture frames and count the gap rather than queueing them indefinitely. Repeated overload invalidates the recording and releases its resources. Keep the game playable. Do not encode a large burst of fabricated catch-up frames after tab suspension. A variable-cadence degraded recording must disclose measured frame cadence and cannot be presented as a passed 24 fps qualification.

## Web Audio mix and clock alignment

All later synthesized game sounds route through the game master bus. Branch after game volume/mute into a mono recording bus so the file reflects the user's sound choice. The speaker branch remains separate to avoid an audible duplicate mix or feedback loop. No microphone, tab audio, remote voice or `getUserMedia()` request is part of this architecture.

The PCM tap must be part of an actively pulled audio graph, with a silent monitor connection if required by the chosen worklet graph; it must not duplicate audible output. Worklet blocks carry their first sample counter and actual frame count, not an assumed fixed callback size. Use bounded transferable-buffer credits rather than requiring `SharedArrayBuffer` and a new cross-origin-isolation deployment setup.

Resume the audio context from the existing user interaction that starts play. If it remains suspended, make recording availability explicit. A user-selected mute is intentional silence; unexpected absence of the game mix is a recording failure, not “audio supported.” Do not silently prompt for a mic to fix it.

Use a monotonic media clock for frames; map audio sample counters to that clock using the audio/performance mapping and measured fixed pipeline offset. Keep both the raw mapping and measured drift. Do not timestamp audio by the time a worklet message arrives. Qualification uses a simultaneous rendered flash and synthesized impulse to measure A/V offset near both ends of the file. Any mapping jump starts a new epoch; large drift does not get hidden by retiming the whole clip.

The approved 300 ms fall slow motion is presentation-only; authority/input continue at their selected rates. Capture the actual displayed presentation and its synchronized sound on the media timeline. Slow-motion playback consumes part of the 15-second budget; never multiply container duration after validation or stretch audio independently. This document does not select the visual implementation or slow-motion speed.

## One key and fall arming

Recorder state is `unavailable | warming | rolling | armed | finalizing | ready | failed`. A confirmed, newly presented fall event arms a marker in the rolling history. A catch can set a suggested endpoint. Arming does not initiate an upload or create an indefinite pre-fall cache; the marker expires when it leaves the rolling horizon. A duplicate/replayed event does not rearm.

The save key snapshots the most recent common interval ending at the last complete frame, capped at `clip.seconds`, and initiates one export job. If an armed fall lies in that interval, include it; otherwise save the actual recent interval and do not label it as the earlier fall. A rescue lasting longer than the horizon cannot include both onset and completion in one continuous clip. Make that limitation visible rather than speeding up, reconstructing or extending history without disclosure.

While finalizing, ignore key autorepeat and coalesce repeated save requests. Reserve the export workspace before pinning any buffers. Use copy-on-write/reference ownership so new rolling data cannot overwrite a frozen selection. The live store and a single bounded export selection share an explicit total app-memory budget; if there is no capacity, finish/discard the existing export before another capture. Release the frozen selection as soon as the validated blob exists.

The key requests a local download. If the browser requires a fresh gesture after asynchronous encoding, reveal a clear “Download clip” action for the ready artifact; do not assume a gesture survives the export. Keep the object URL until download/preview has had a chance to consume it, then revoke it on replacement, dismissal or teardown. No “Copied link” state exists in Phase 3. The wordmark and URL overlay may use only a later approved canonical destination; never burn invitation credentials, a temporary tunnel or an invented public URL into a file.

## Strict export validation

1. Freeze a common interval within the current epoch. Choose a retained keyframe at/after the requested start and choose only complete video samples whose presentation end does not exceed the desired end. Rebase timestamps to zero without changing relative timing. The frame's duration counts, including the last frame.
2. Select matching PCM sample bounds, encode mono audio, and mux all tracks plus necessary metadata. Preserve the selected codec's delay and end padding. For Matroska-derived output, `DiscardPadding` describes material to discard during playback; merely setting a short container duration does not remove extra encoded content. [RFC 9559, DiscardPadding](https://datatracker.ietf.org/doc/html/rfc9559#section-5.1.3.5.7).
3. Parse the finished bytes independently of the writer's claimed metadata. Check dimensions, codec/configuration, timestamp monotonicity, required leading keyframe, complete track intervals, audio trims and seek/index validity. Verify both declared duration and decoded playable range are positive and no greater than `clip.seconds`. For output players that ignore the chosen trimming mechanism, cut to a shorter independently decodable boundary or reject that format.
4. Check `Blob.size <= clip.maximumBytes` **after finalization**. No arbitrary `Blob.slice()` truncation is allowed. If too large, locally decode/re-encode at the next profile in a finite root-configured quality ladder, then remux and validate again. The first profile is the contract's target bitrate; root tuning must contain any proposed lower profiles and a bounded retry count before implementation.
5. If the finite encoding ladder still fails, offer a clearly shorter interval aligned to valid boundaries and revalidate; preserve the marked incident if claiming it is an incident clip. If size, duration, audio or local playback still cannot be validated, return failure and no downloadable “valid” artifact. Every successful path uses the same byte/duration checks.

Successful probe encoding does not waive validation of a real clip. A codec may exceed its target under complex snow/rope motion. Parsing only `HTMLVideoElement.duration` is insufficient: missing duration metadata can produce an unusable value, and small metadata alone can conceal extra samples. A complete decode and seek check are required in the qualification matrix; runtime validates container/sample ranges and first/last decodability using the chosen supported validator. If the runtime cannot establish those bounds, it cannot export through this path.

## Portrait composition

The recorder compositor renders its own fixed oblique camera from the same live render-state, into 720×1280 when portrait is selected. It does not crop a 16:9 screenshot and assume all bodies remain visible. Preserve the approved team/local weighting intent and bounded zoom; measure the bounding region of the current hole, falling/climbing body, relevant bracers and their connecting rope. Prefer translating the composition within its approved bounds over shrinking figures indefinitely. The gameplay camera and authoritative simulation do not move when the clip orientation changes.

If a six-person rope cannot fit with a legible hole and bracers, use truthful edge/tension indicators and a scene/layout recheck; a portrait option is not passed merely because the file has the right ratio. Render required labels/indicators and the small wordmark in the compositor, not just the webpage DOM. Record a clean view without debug counters, invitations or operator panels. Review at 200 px with an outsider who has not been told the story. Typography, palette implementation and the sixth parka colour remain the user's later review decisions.

## Browser and failure matrix

All cells below are **qualification to do**, not measured support. Record exact browser build, OS, GPU, power mode, codec, muxer version and feature-probe/real-test results. Browser brand alone does not select a path. WebKit added WebM/VP8-or-VP9/Opus recording support in Safari 18.4, so the old claim that Safari only records MP4 is not a valid current support rule. That vendor announcement does not prove BELAY's WebCodecs path works. [WebKit Safari 18.4 media updates](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/#media).

| Capability/result | Proposed behavior |
|---|---|
| Desktop Chrome/Edge, Firefox, Safari with complete encode/mux/decode/audio-worklet support | Probe exact WebM and then MP4 candidates; enable the first fully validated path and record the selected result |
| Video encoder works; selected audio encoder, PCM capture or mux trimming does not | Try the other fully validated format; otherwise local recorder unavailable. An optional explicitly silent diagnostic export does not pass the game-audio requirement. |
| Only MediaRecorder is usable | Keep rolling recorder unavailable in this initial architecture. Do not silently substitute a forward-only recording or a corrupt blob ring. A later fallback needs demux/remux of independently finalized segments and its own complete boundary/audio qualification. |
| Neither recording stack works, insecure context, worker/codec errors or resource exhaustion | Explain local recording is unavailable; gameplay remains available. No server fallback or permission prompt. |
| Canvas taint, ended track, missing PCM, nonfinite duration or invalid metadata | Discard candidate with a typed reason; retain no broken downloadable file |
| Hidden/frozen tab, context loss or orientation switch | Stop the current epoch, release resources, then warm fresh history on recovery |
| Browser blocks automatic download | Keep a bounded ready artifact and require the browser's fresh local-download click |
| Mobile browser | Test playback/download of exported files and portrait legibility; no touch gameplay or mobile arrival implementation is implied |

Missing a major desktop browser's complete path is an unresolved compatibility finding for Phase 3 review. The above is a bounded failure strategy, not a universal-browser delivery claim.

## Phase 3 acceptance evidence

The future test suite needs real files and reports for: early save before full history; save exactly at and between frame/GOP boundaries; long-running rolling capture; repeated falls; a marker aging out; both orientations; muted versus unexpectedly silent audio; tab suspension; codec exceptions; missing keyframes; backlog exhaustion; huge output despite requested bitrate; corrupt/truncated container; audio padding crossing the duration cap; cancellation; repeated save; object URL cleanup; local download after gesture expiry. Include high-motion/noisy scenes and low-power devices, not only an idle blank canvas.

For every accepted file retain local hash, byte count, declared and decoded duration, first/last sample times, dimensions, actual fps/gaps, codec and metadata, audio channels/sample rate, flash/impulse offset and drift, decoder/seek results, app-owned peak buffer bytes and capture cost relative to gameplay without recording. Automated tests verify boundaries; a human/outsider assesses rope/figure readability at 200 px and describes what happened before any explanation. No result currently exists.

Required new root keys, without numerical defaults here: GOP cadence, codec candidate configurations, queue/buffer/workspace caps, bounded encoder retry ladder, mux metadata cap, capture failure deadlines, drift/readability qualification tolerances and ready-artifact lifetime. Existing clip limits remain the public structural envelope.

Proposed key names are `clip.recording.keyframeIntervalSeconds`, `codecProfiles`, `maximumQueuedFrames`, `maximumEncodedRingBytes`, `maximumPcmBytes`, `maximumWorkspaceBytes`, `maximumMetadataBytes`, `maximumExportPasses`, `exportTimeoutMs`, `maximumAvDriftMs` and `readyLifetimeSeconds`. All belong beneath `clip.recording` in the root file when implemented, with units/rationale; `maximumWorkspaceBytes` includes rolling, frozen and encoder-transfer ownership. The finite codec profile list supplies retry bitrates, so no exporter contains its own numerical ladder. These names are a schema proposal, not values or a second configuration source.

## Phase 6 transition: a future seam, never an upload path here

Keep `LocalArtifact` independent of transport. Only a later authorized Phase 6 module may accept it for hosting, after the cost proposal and production safeguards are approved. The browser's validation is helpful feedback; a modified client can forge every artifact field, so a hosted service must independently enforce file bytes, duration, container/codec bounds and identity policy in bounded validation work.

The future storage ledger must atomically reserve both daily allowance and bytes before accepting a body. Contract keys already specify three uploads per identity per UTC day, seven-day transient retention, one permanent slot per identity and a global 256 MiB including pending uploads and permanent objects. At maximum file size, the global byte quota fits at most 128 files with no other reservations/usage; that arithmetic is not a promise of 128 available slots. Browser identities are resettable and are not people or abuse-proof accounts.

Proposed hosted transaction flow for later review:

```text
eligible identity + idempotency key
  → atomic daily-attempt debit + worst-case byte reservation
  → bounded private pending object
  → independent validation and actual-byte reconciliation
  → committed transient object / atomic permanent-slot association
  → expiry or explicit replacement → verified deletion → release bytes
```

Retries reuse the original reservation/debit and cannot multiply charges. Pin the UTC day at reservation; crossing midnight does not migrate a debit. Proposal: failed attempts consume their daily admission allowance to avoid free repeated writes; a permanent-slot change does not create extra upload allowance. These policy semantics need review and representation in root tuning before implementation.

Pending reservations must expire, but capacity is released only after storage cleanup is confirmed; an uncertain object remains charged conservatively. Permanent-slot replacement reserves enough space while old and new coexist. If both cannot fit, reject replacement without deleting the old slot unexpectedly. Retention excludes the designated permanent slot from ordinary expiry, but permanent bytes always count globally. Reconcile ledger against inventory with idempotent repair and make discrepancies visible.

Quota/retention unavailability, failed deletion/reconciliation, exceeded capacity, exhausted daily allowance or an unavailable spending control makes hosted admission fail closed. A global kill switch stops new reservations and invalidates outstanding write authority as far as the chosen provider can enforce; account for already in-flight operations in the budget. Local download continues. Until cleanup confidence returns, do not “temporarily” bypass a ledger check.

Storage quota alone does not bound request or egress spend. The later cost proposal must identify a provider-enforced or prepaid envelope for requests, reads, delivery bytes, validation CPU and coordination work, including failure/attack paths and in-flight exposure. An application counter behind a billable ingress endpoint may already be too late. If the provider cannot enforce the proposed cap, hosting remains disabled. No provider, prices, credentials, bucket, public route, voice service or approved cost proposal is created or claimed by this design.
