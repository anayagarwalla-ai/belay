# Phase 2 frontend arrival and render budget

The existing compiled root route requires **1,355,704 raw asset bytes** across six JavaScript chunks and one CSS file. Local per-file compression estimates are **361,229 bytes with gzip level 6** or **339,231 bytes with Brotli quality 5**. At an ideal sustained 1 Mbps, gzip transfer alone takes **2.890 seconds**, leaving only 0.110 seconds of the 3-second load goal for HTML, connection setup, execution and rendering. Neither the 3-second load goal nor the 10-second entry goal is measured or passed by this audit.

[Machine-readable inventory and import graph](phase2-frontend-budget.json) records exact asset sizes, SHA-256 hashes, emitted imports, current source hashes and formulas. This audit used no new build, server, browser, network fetch or GPU work. Compression processed one asset at a time; the collector finished in under one second locally.

## Existing build and transfer inventory

This is the existing main-checkout output from **2026-09-07 23:28:47 UTC**, build ID **09327f5a-d94a-49b0-b30b-d294c0c6f25e**. The inspected source checkout was **c6c41634073dc0d8459feed03f26b6e81536f99d**. The producing source commit is **unknown**: the files predate the delivered clock fix and cannot be represented as a new build of current HEAD. The GateClient chunk is byte-identical to this worktree's earlier 23:22 build. Current source inspection and emitted bundle inspection are recorded separately.

All sizes below are bytes, summed per distinct URL, with no assumed cross-file compression dictionary. The compression sizes are reproducible local estimates; HTTP content encoding, framing and wire transfer have not been observed.

| Asset | Raw bytes | gzip 6 bytes | Brotli 5 bytes |
| --- | --- | --- | --- |
| GateClient-C9MZ6YPb.js | 773,887 | 210,510 | 197,273 |
| framework-DTZGTDtF.js | 190,109 | 59,048 | 55,894 |
| index-DyQSaK8v.js | 108,730 | 32,073 | 30,431 |
| layout-segment-context-DZmT84Zs.js | 496 | 345 | 301 |
| rolldown-runtime-hePW80VL.js | 716 | 430 | 396 |
| vinext-DdlM9mco.js | 111,711 | 32,931 | 31,355 |
| index.B-AjPmNL.css | 170,055 | 25,892 | 23,581 |
| **Root-route union** | **1,355,704** | **361,229** | **339,231** |

The route union comes from the emitted bootstrap/client-reference/server-resource manifest. It includes the small layout-context chunk that may be conditional; it does not claim a captured request waterfall. Six route JavaScript chunks total **1,185,649 raw / 335,337 gzip / 315,650 Brotli bytes**. There are **zero emitted WASM files, zero font files, and zero CSS font-face or URL references**. The viewport uses system monospace fonts, procedural geometry and no loaded texture assets. Rapier is on the server path and is absent from the inspected browser import graph and emitted asset inventory.

The favicon is ancillary: 712 raw / 342 gzip / 318 Brotli bytes. Two compatibility JavaScript manifests add 235 raw / 181 gzip / 153 Brotli bytes if requested. Build metadata such as _headers, .assetsignore and build manifests is inventoried separately, not assumed to be downloaded by the browser. HTML/RSC response bytes are not in this static asset sum and were not measured.

## Import graph and eager work

The emitted bootstrap contains dynamic client-reference imports, but the root page renders GateClient immediately. That framework boundary does not defer its application dependencies until the user clicks Join.

`app/page → GateClient → viewport → Three.js` is eager. GateClient creates WebGLRenderer in its mount effect, before joining, and draws a four-body preview. The Three renderer is required by that initial preview. Replacing this edge with import() immediately on mount would mainly alter scheduling; it would not remove the work needed for the first rendered view. Moving the preview behind Join would change product behavior and shift the cost into the entry goal, so this audit does not make that change.

`GateClient → connection → @colyseus/sdk` is also eager although new Client is created only inside join(). Deferring SDK loading until Join is a candidate for reducing pre-join execution, but its request/execution time would enter the 10-second budget and would need cancellation/retry verification. The installed SDK entry registers schema and none serializers, and Room also imports SchemaSerializer. A simple deep-import substitution is therefore not evidence that schema code disappears or remains compatible. No serializer/library replacement was made.

`GateClient → OperatorControls / IncidentEvidence` is eager although operator controls require an operator connection and evidence requires snapshots. These are candidate lazy boundaries; their separate compressed savings are **unmeasured** because the existing chunk has no source map or module-size report. Base UI button helpers, class-variance-authority, clsx and tailwind-merge arrive through the shared Button component. Unused scaffold component files are absent from the JavaScript source graph; installed dependencies are not the same as shipped dependencies.

The 170,055-byte stylesheet includes the root's Tailwind and shadcn/tailwind.css imports. The latter contributes globally emitted custom properties/keyframes such as shimmer, while Tailwind's project scanning can discover utility classes in unused scaffold source files. Restricting scan sources and auditing the broad helper stylesheet are candidates for a smaller CSS budget; exact removable bytes require a separate compiled comparison and visual check. Deleting the styling imports or replacing the component library is outside this audit. No eager-load change was justified as a low-risk defect solely by the existing byte totals.

## Bandwidth sensitivity

These are ideal transfer-only calculations using decimal Mbps: `seconds = bytes × 8 / (Mbps × 1,000,000)`. They assume sustained shared link throughput and omit request latency, congestion/ramp-up, headers, HTML/RSC, CPU, GPU, access screens and user actions. Parallel requests share the link; parallelism does not erase these payload bits.

| Assumed sustained Mbps | Raw transfer s | gzip 6 transfer s | Brotli 5 transfer s |
| --- | --- | --- | --- |
| 0.5 | 21.691 | 5.780 | 5.428 |
| 1 | 10.846 | 2.890 | 2.714 |
| 2 | 5.423 | 1.445 | 1.357 |
| 5 | 2.169 | 0.578 | 0.543 |
| 10 | 1.085 | 0.289 | 0.271 |
| 25 | 0.434 | 0.116 | 0.109 |

The next table reserves a declared amount of each goal for all non-asset-transfer work. That reserve is a sensitivity assumption, not a measured latency. Required throughput is a necessary idealized payload condition, not a sufficient success criterion.

| Goal s | Assumed other work s | Minimum raw Mbps | Minimum gzip Mbps | Minimum Brotli Mbps |
| --- | --- | --- | --- | --- |
| 3 | 0 | 3.615 | 0.963 | 0.905 |
| 3 | 1 | 5.423 | 1.445 | 1.357 |
| 3 | 2 | 10.846 | 2.890 | 2.714 |
| 10 | 0 | 1.085 | 0.289 | 0.271 |
| 10 | 1 | 1.205 | 0.321 | 0.302 |
| 10 | 2 | 1.356 | 0.361 | 0.339 |

For example, reserving one second inside the 3-second goal requires at least **1.445 Mbps gzip** or **1.357 Mbps Brotli** just for these route assets. With no compression it requires **5.423 Mbps**. At 0.5 Mbps gzip, asset transfer alone uses 5.780 seconds of the 10-second entry budget, leaving 4.220 seconds for every other step. At 1 Mbps uncompressed, the asset payload alone exceeds ten seconds.

## Arrival and render work still to measure

The protected test path can include an invitation page, POST /access and redirect before the root route. After hydration, the viewport initializes WebGL; the user clicks Join; the client fetches /game/belay/config; SDK joinById performs HTTP matchmaking and a WebSocket connection; identity and the first snapshot establish the occupied seat; input must then reach authority and return as visible control. The Gate 2 packet defines arrival through the first accepted movement visibly controlling the body, including access and assistance. Asset download completion and receipt of a seat are not that endpoint. The client's 10,000 ms timeouts are failure bounds, not proof of a ten-second entry.

The protected gateway currently overwrites proxied responses with Cache-Control: no-store. The production build's generated _headers instead marks content-hashed assets immutable. These are distinct serving paths; warm-cache savings or actual compression cannot be assumed for the current protected test. No live HTTP headers or production CDN behavior were measured here.

The source's pre-join preview creates 24 landmark planes, four body boxes with edge outlines, a ground plane and grid. Once connected, adjacent rope spans require 12–60 segment meshes for 2–6 bodies; geometry/material objects are reused. The renderer uses MeshBasicMaterial and WebGL2 with antialiasing. Pixel ratio is capped at 2, still allowing four times the CSS-pixel area in the backing buffer. Animation is continuous while the browser schedules frames; HUD React updates run at 250 ms. These are static code facts, **not measured draw calls, GPU memory, shader compile time, first-frame time or slow-device performance**.

Cold browser parsing/compilation of the 1.186 MB of JavaScript, style calculation for 170 KB CSS, hydration, WebGL context/shader setup, first useful frame, first accepted control and interruption recovery remain unmeasured. Compression reduces network bytes, not uncompressed parse/execute work. A later isolated browser audit needs navigation/response/resource timings, declared cache/auth state, long tasks, actual rendering milestones and authority-confirmed first input; user invitation handling must remain inside the arrival denominator. No timing capture should compete with the current server benchmark.

## Reproduction

Run `node --import tsx scripts/audit-frontend-budget.ts /path/to/checkout work/frontend-budget-new.json` against existing dist output. It refuses to overwrite a report, parses the emitted manifest and JavaScript imports, traces local runtime source imports from page/layout, and records package boundaries. gzip level 6 and Brotli quality 5 settings are explicit. The source graph is not a module-byte attribution or a claim that every export survived tree shaking. Keep the existing report when a later build changes filenames or sizes.

No art, audio, touch controls, physics change, deployment or Phase 3 work is included.

## Demonstrated cleanup defect and separate fix

GateClient published `window.BELAY` but its unmount cleanup never removed that reference. The debug methods close over the connection, which retains last-session evidence after disposal. This leaves a stale API and a browser-global reference to the disposed connection; no retained-memory byte count or GC timing was measured.

A separate client fix removes the global only if it still equals that mount's API, preserving a newer view's registration. The Window type now reflects that the API can be absent before mounting and after cleanup. Two offline tests execute the actual GateClient mount/cleanup effect, connection and inspection registration, with hook/render boundaries stubbed. They failed before the fix and pass after it, including overlapping mounts and zero remaining HUD timers. All 44 focused client tests, typecheck and lint pass. No compiled-size reduction or post-fix browser timing is claimed; the original asset report is unchanged.
