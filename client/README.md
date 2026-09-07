# Phase 2 client behavior

`GateClient` owns one connection and viewport. `connection.ts` preserves generation-scoped joins, explicit rejoin, stalled-input release, bounded commands and reports that remain available after disconnect. Scene/topology changes clear interpolation and held input. No client message introduces a verb beyond move and brace.

`presentation.ts` handles topology-safe interpolation, separate material-span slices and bounded camera framing. `terrain-view.ts` reconstructs contact solids from public terrain geometry and projects intermediate displayed bodies out of banks and intact bridges. Exact snapshot endpoints remain authoritative. Wall control hints use the shared contact normal. `prediction.ts` advances only the local body on ordinary supported ground. It sweeps support and body boundaries, checks both neighbors of a middle harness, and never moves a remote body. Ice (including its boundary), wall and airborne motion use authoritative interpolation; this is intentionally conservative until a shared contact predictor is validated. A support change or scene reset clears prior correction offsets.

`viewport.ts` draws monochrome boxes, actual span point ranges, bridge cue deformation, ice stripes and a fixed-camera cutaway. Near crevasse walls and top surfaces intersecting a below-rim body's sight ray become outlines; physical contact geometry is unchanged. Bridges use the authoritative thickness. Thicker black spans reflect the server's catch-highlight field. No spring, catch impulse, recovery result, art, sound, slow motion or recording is produced locally.

HTML status and labels are placed around projected body rectangles, favoring body visibility, then label separation and proximity to the preferred anchor. This prevents vertically stacked fall labels from covering other climbers. `bodiesCoveredByOverlays` exposes any remaining overlap when the viewport is too crowded, while `cutawayTopFaces` counts the outlined top surfaces.

`evidence.ts` separates first cue receipt from first drawing intersecting the camera frustum. The latter is not proof of unobstructed visibility or human attention. Bridge labels can be offset onto a bank without affecting the surface-bound frustum check. A warning that unloads or collapses before drawing, or a fall that recovers/ends unseen, remains undrawn even if a later episode appears. `endedBeforeDraw` records this boundary. Newly received physical-event deltas are accumulated once per epoch, bounded by root tuning, and copied into reports. A received bridge `cue` event supplies its server tick/substep; `serverCueOnset` stays null if that event was not received, including a join during an existing cue. Historical recovered incidents do not become new fall observations on rejoin.

The operator form selects an approved scene, team, seed, family and rate, then sends a single reset command. Server validation owns occupied-seat reduction and every physical result. Incident role times are shown per harness with denominators. The visible “Motion/load proxy” retains the raw `roleActiveSeconds` field: being dragged under load can accrue it without purposeful input, so it cannot establish agency or pass the human rescue stop.

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
