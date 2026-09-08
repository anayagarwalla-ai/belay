# Phase 2 client behavior

`GateClient` owns one connection and viewport. `connection.ts` preserves generation-scoped joins, explicit rejoin, stalled-input release, bounded commands and reports that remain available after disconnect. Scene/topology changes clear interpolation and held input. No client message introduces a verb beyond move and brace.

Viewport terrain geometry/materials are disposed on rebuild; removed players release their own materials while shared body/rope geometry stays reusable. Rope meshes form a pool bounded by the largest displayed team. Unmount cancels the frame, disconnects ResizeObserver, removes owned DOM and control listeners, and disposes scene resources and the renderer. The viewport creates no application render targets, textures or asynchronous asset loads. A mocked-GPU lifecycle regression checks rescue/flat/crossing and 6→2→6 team changes with actual Three geometry/material disposal events; it does not measure GPU memory or driver cleanup timing.

Pending measurement and operator actions retain their originating connection identity. After unmount or replacement, their completion cannot update the old view, focus another canvas or start a measurement download. A capture already in progress may finish under its existing network timeout; its late UI/download effects are discarded. Saving after an ordinary disconnect remains available while the view is mounted.

Movement requires a fresh snapshot containing the occupied local seat. Recovery checks elapsed snapshot age even when a socket callback runs before an overdue input timer; it releases controls and clears interpolation across the outage. Form focus, window blur and tab hiding clear held keys, and autorepeat cannot reactivate them without a fresh press. Action errors appear above operator controls so a rejected resize remains visible without scrolling past the evidence panel.

`presentation.ts` handles topology-safe interpolation, separate material-span slices and bounded camera framing. `terrain-view.ts` reconstructs contact solids from public terrain geometry and projects intermediate displayed bodies out of banks and intact bridges. Exact snapshot endpoints remain authoritative. Wall control hints use the shared contact normal. `prediction.ts` advances only the local body on ordinary supported ground. It sweeps support and body boundaries, checks both neighbors of a middle harness, and never moves a remote body. Ice (including its boundary), wall and airborne motion use authoritative interpolation; this is intentionally conservative until a shared contact predictor is validated. A support change or scene reset clears prior correction offsets.

`viewport.ts` draws monochrome boxes, actual span point ranges, bridge cue deformation, ice stripes and a fixed-camera cutaway. Near crevasse walls and top surfaces intersecting a below-rim body's center-to-camera ray become outlines; physical contact geometry is unchanged. Bridges use the authoritative thickness. Thicker black spans reflect adjacency to server catch/climb events, not a verified rope catch or rescuer. No spring, catch impulse, recovery result, art, sound, slow motion or recording is produced locally.

HTML status and labels are placed around projected body rectangles, favoring body visibility, then label separation and proximity to the preferred anchor. This prevents vertically stacked fall labels from covering other climbers. `bodiesCoveredByOverlays` exposes any remaining overlap when the viewport is too crowded, while `cutawayTopFaces` counts the outlined top surfaces.

`evidence.ts` separates first receipt from the first renderer submission qualifying for a geometric frame check: bridge bounds intersect the camera frustum or a player center is inside the projected frame. Hidden collapsed bridge bounds still qualify; opening visibility, occlusion and attention are unknown. `firstDrawnTick` refers to the latest snapshot while displayed bodies may be interpolated/predicted. Bridge-label placement does not affect the frustum check. A warning that unloads or collapses before submission, or a fall that recovers/ends before submission, stays undrawn even if a later episode appears. `endedBeforeDraw` records this boundary. Newly received physical-event deltas are accumulated once per epoch, bounded by root tuning, and copied into reports. `serverCueOnset` is included only when the cue event was received by observation creation, with no later backfill. Historical recovered incidents do not become new fall observations on rejoin.

The operator form selects an approved scene, team, seed, family and rate, then sends a single reset command. Server validation owns occupied-seat reduction and every physical result. Incident role times are shown per harness with denominators. The visible “Motion/load proxy” retains the raw `roleActiveSeconds` field: being dragged under load can accrue it without purposeful input, so it cannot establish agency or pass the human rescue stop.

The span table labels `slackM` as a chord-gap proxy, `tensionN` as a correction-derived proxy in newtons, and `catchHighlight` as a hanging/climb adjacency highlight. Event `spanIds` list adjacent spans, not contributors. `catch` records hanging and can be wall-settled; rescuer, support-loss and causal associations remain unknown. The UI calls `cascades` additional episode falls without claiming one body pulled another off. Raw authority fields are preserved. Export scope descriptions follow the [warning and attribution contract](../docs/design/phase2-warning-attribution-contract.md).

## Checks

```sh
npm test -- --run tests/client-actual-state.test.ts tests/client-presentation.test.ts tests/connection.test.ts
npm run typecheck
npm run lint
npm run build
```

`client-actual-state.test.ts` samples ten-second 30 Hz rescue/crossing traces for 2, 4 and 6 players: initial fall, catch, wall climb, rim recovery and ice-offset falls. It checks public contact reconstruction, displayed terrain clearance, conservative prediction, separate spans, narrow camera framing, faces needing cutaway, warning/collapse event deltas and an asynchronous report spanning an epoch reset. These fixed policies are regression probes; static-helper recovery remains a failed design criterion, not a human rescue pass.

To inspect the real UI/renderer with supplied snapshots on an ephemeral loopback port:

```sh
node --import tsx tests/fixtures/serve-client-preview.ts
```

Open the exact fixture URL printed by that process; it does not use the default dev ports. The fixture is visibly labeled, replaces connection behavior only in its isolated HTML entry, and does not contact a game server, create a public tunnel or simulate physics. Its `window.BELAY_FIXTURE` helpers exercise scene/team resets, support labels, local input focus and disconnect export. `showSnapshot(snapshot)` also accepts locally captured real simulation states; `counters()` exposes renderer counts. Stop that process with Ctrl+C and close its browser session after checking it. Integrated catch/climb/haul feel, real remote latency, server rejection behavior and the human arbitrary-fall/static-role stop still require the coordinator's real-stack checks and the appointed human session.

For input/rejoin checks against the actual SDK, room and physics on ephemeral loopback ports:

```sh
node --import tsx tests/fixtures/serve-client-loopback.ts
```

Open its printed URL in an isolated browser session and join. The fixture entry only observes the connection; it does not replace input, timers, snapshots or transport. Its audit routes can add local partner seats, inspect received inputs and suppress snapshots through controlled transport-pressure injection. With a 1280×633 or 390×844 viewport, evaluate the following scripts in order after joining:

```sh
npx --no-install agent-browser --session belay-input-audit eval --stdin < tests/fixtures/client-input-audit.js
npx --no-install agent-browser --session belay-input-audit eval --stdin < tests/fixtures/client-resize-audit.js
```

The first checks release on focus/blur/hidden events, stale recovery, team resets, repeated rejoin and input rate; it leaves six seats occupied. The second submits the real React form, verifies a visible resize rejection without an epoch change, removes the test partners and verifies a successful retry. Keyboard and lifecycle events in these scripts are injected; transport and authoritative input observations are real. Native tab switching was also checked separately. Close that browser session and stop the fixture with Ctrl+C when done. Neither fixture establishes remote-network performance, human agency or a Phase 3 pass.
