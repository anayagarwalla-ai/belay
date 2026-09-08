# Phase 2 warning and attribution contract

**Diagnostic proposal; no gameplay or presentation changes.** Current events support statements about a bridge's state, a player's detected motion state, and adjacent rope spans. They do not establish which helper caused or arrested a fall. Human warning comprehension, laughter, agency and fairness remain unmeasured; this audit does not advance Phase 3.

## Evidence and one bounded replay

Audited source: `2f3bfa21a35daa38fd2357eccd63f2ebabbddaa6`. The [probe](../../scripts/phase2-warning-attribution-probe.ts) imported that checkout read-only, ran the existing `tests/phase2-mechanics.test.ts` weak-bridge policy once, and recorded public authority snapshots and normalized inputs. Configuration: crossing, seed 2000, two players, balanced family, 30 Hz authority / 60 Hz internal steps, ten simulated seconds / 300 steps. Source hashes before and after match; the working tree was clean. No additional physical cases or browser runs were performed.

The [compressed report](../../reports/phase2-warning-attribution.json.gz) retains the input tape, all 300 sampled frames, event-bracketing frames, tuning, source hashes and final diagnostics. IDs below are zero-based; player ID 0 is the displayed P1.

| Event ID / kind | `(tick, substep)` | Logged coordinate, seconds | `incidentId` | `playerIds` / `spanIds` / `surfaceIds` |
|---|---|---:|---|---|
| 0 / cue | `(82, 0)` | 2.733333 | null | `[] / [] / [0]` |
| 1 / collapse | `(94, 1)` | 3.150000 | null | `[] / [] / [0]` |
| 2 / fall | `(100, 1)` | 3.350000 | 0 | `[0] / [0] / []` |
| 3 / fall | `(115, 0)` | 3.833333 | 0 | `[1] / [0] / []` |
| 4 / lost | `(160, 1)` | 5.350000 | 0 | `[0] / [0] / []` |
| 5 / lost | `(169, 1)` | 5.650000 | 0 | `[1] / [0] / []` |

**No catch occurred.** Logged coordinates use `tick / tickHz + substep / physicsHz`. Cue-to-collapse differs by 25 internal-step indices, or 0.416667 s. This is an event-coordinate difference: cue is emitted after integration and collapse before integration in their respective substeps. An exact within-step timeline needs that phase distinction. First sampled cue and collapse appear at snapshot ticks 83 and 95, a 0.400 s sampling-coordinate difference. Neither is measured client warning lead time.

At collapse, sampled P1 changes from ground support to air while still classified `safe`; the depth-threshold fall is recorded later. P1 lies over bridge 0 and P2 remains on the near bank. This supports a scene-specific explanation of lost bridge support. The fall event itself lacks a supporting-surface or collapse link. P2 subsequently walks forward under the fixture's policy and joins incident 0: `cascades = 1` alone cannot show that P1 pulled P2 off.

The span's sampled `slackM` remains approximately 1.111–1.112 m from first cue through collapse. This is a chord gap, not usable routed slack. It nevertheless directly counters the idea that the bridge cue announces an imminent taut-rope catch. This run ends in terminal loss, not a catch. Final diagnostics exactly match saved `phase2-performance-equivalence.json`, case `load-2-30`; that report retains event kinds and sampled state hashes, not these full event tuples. This is a consistency check, not an additional replay or a claim that differently serialized tape hashes match. This run also records two energy projections, maximum 139.110313 J; proxy forces are not calibrated physical measurements.

The saved `phase2-live-browser-baseline.json` seed-2000 capture instead concerns **six-player rescue, epoch 4**. Its presentation event 7 is a catch for player 3 at `(142, 1)`, with spans `[2, 3]`; it supplies no bridge-warning example. Scene, count, family, rates and source identity must accompany a seed.

## What existing fields mean

The exact current event shape in [protocol](../../shared/protocol.ts) is:

```ts
type PhysicalEvent = {
  id: number; epoch: number; tick: number; substep: number;
  kind: 'cue' | 'fall' | 'catch' | 'climb' | 'relapse' |
        'recovery' | 'collapse' | 'lost' | 'complete';
  incidentId: number | null;
  playerIds: number[]; spanIds: number[]; surfaceIds: number[];
};
```

| Available fields | Honest reading and limit |
|---|---|
| Event `playerIds`, `spanIds` | [The emitter](../../shared/expedition-simulation.ts) assigns every span with an endpoint in `playerIds`. This is adjacency for every event kind, including lost/recovery; a middle player's two spans are included irrespective of load or direction. It is not a list of causes or rescuers. |
| Event `surfaceIds` | Cue/collapse supply bridge IDs. These are not globally namespaced collider IDs. Current fall/catch events supply no surface IDs. |
| Event `incidentId`; incident `id`, `fallTick`, `playerIds`, `status`, `recoveredTick`, `cascades`, `firstAttemptSuccess` | Episode bookkeeping. An additional fall during the active episode increments cascades without establishing a causal rope connection. Cue/collapse inherit any active incident, or null; this is not a bridge-to-casualty causal link. |
| Player `id`, `position`, `velocity`, `support`, `rescueState`, `activeIncidentId`, `brace`, `connected`, `label`, `ackSeq` | Sampled body and connection state. `support` is only ground/wall/air, without surface identity. The input acknowledgement does not record what the player knew or intended. |
| Span `id`, `a`, `b`, `startPoint`, `endPoint`, `length`, `tension`, `tensionN`, `slackM`, `catchHighlight`; `rope.points` | Topology and sampled geometry/proxies. `tensionN` is the maximum endpoint correction magnitude times mass / dt², not a directional endpoint force. `tension` is smoothed. `slackM = max(0, length − endpoint distance)` ignores route shape. Catch **and climb** highlight all adjacent spans. |
| Bridge `id`, `crevasseId`, `minX`, `maxX`, `minZ`, `maxZ`, `cue`, `collapsed` | Public bridge state. Seeded capacity, load ratio, overload memory, warning timer, supporting-player overlap shares and load terms are absent. |
| Incident `roleActiveSeconds`, `roleIdleSeconds`, `staticHoldSeconds`; tape `frames[{tick, inputs[{x,z,brace}]}]` | Activity proxies and normalized accepted movement. Passive dragging can earn active seconds; the saved baseline findings include a zero-input casualty credited 17.9 of 19.8 seconds. No purpose, blame or indispensable contribution follows. |

Bridge cue is derived from the supported-load/capacity ratio: positive above `bridgeCueStartFraction = 0.65`. The load proxy combines body weight, downward arrival velocity / dt and downward rope/contact correction / dt², apportioned across overlapping support areas. Overload memory rises above ratio 1 and recovers below it. Collapse requires `bridgeOverloadSeconds = 0.32` and a continuous `bridgeWarningSeconds = 0.4`, then removes the bridge at the next substep. No load contributor ledger is retained. A sustained positive cue need not collapse: the existing seed-1701 sustained-cue test asserts that counterexample.

Fall means a non-ground body has crossed the 0.2 m depth threshold, not the instant of support loss. Catch means entry into `hanging`: either positive aggregate upward rope correction with final vertical speed at least −0.35 m/s for 0.12 s, **or wall contact with absolute vertical speed at most 0.35 m/s**. The latter needs no confirmed upward rope contribution. Energy correction also changes velocity before incident classification. Even the rope-confirmed predicate does not isolate which span arrested descent.

## Receipt and readability evidence currently available

[Client evidence](../../client/evidence.ts) reports `sceneEpoch`, `truncated`, `physicalEvents`, `scope`, and observations with exactly:

```ts
{
  kind: 'bridge-cue' | 'bridge-collapse' | 'fall'; id: number; epoch: number;
  firstReceivedTick: number; firstReceivedAtMs: number;
  firstDrawnTick: number | null; firstDrawnAtMs: number | null;
  localPlayerId: number; drawnInCameraFrame: boolean; cue: number | null;
  incidentId?: number; playerId?: number; endedBeforeDraw: boolean;
  serverCueOnset: { eventId: number; tick: number; substep: number } | null;
}
```

Receipt/draw milliseconds share a client-local `performance.now()` origin reset by scene epoch. Receipt ticks are sampled snapshot ticks. Server onset is attached only if received when the observation is created; there is no later onset backfill. Observations are keyed once per kind/bridge or incident/player, so a second cue interval or relapse has no distinct draw row. The existing actual-state regression correctly prevents attributing a later visible warning to an earlier unseen interval; it does not measure that later interval independently.

[Viewport](../../client/viewport.ts) marks bridge bounds intersecting the camera frustum and player centers inside the projected frame. It calls `drawn` after issuing the render call. This proves neither unobstructed pixels nor human attention. Collapsed bridge meshes are hidden, but their bounds still qualify for the collapse observation; visibility of the opening itself is not checked. Player meshes can be interpolated/predicted while the recorded `firstDrawnTick` refers to the latest authority snapshot.

[Capture reports](../../client/connection.ts) additionally retain `connection.{roomId,sessionNumber,localPlayerId,connected,status}`, `client.{sceneEpoch,measurementStartedAt,rttMs,jitterSuccessiveRttDifferenceMs,snapshotIntervalMs,receivedSnapshots,missedEchoProbes,packetLoss,lastSnapshotAgeMs,interpolationMs,inputHz}`, `state`, `server`, `presentation`, `view`, and `captureChange.{sessionChanged,sceneChanged,serverSceneMatches}`. Packet loss is explicitly null/unavailable. Server counters may arrive later than the captured client state even with all change flags false. Keep sample ticks separate. Snapshot `serverTime` is not event time or a synchronized client clock.

Server events retain the latest 256; client event evidence retains its first 256 and drops new ones after filling. `diagnostics.eventsTruncated`, `diagnostics.incidentsTruncated`, `presentation.truncated`, and tape `truncated` disclose different losses. Missing records mean unknown, not zero events or an unseen warning.

## Minimal contract for future implementation

The following is a proposed seam, not fields already implemented. Preserve neutral readability now; require the additional receipts before making stronger mechanical claims.

| Requirement | Minimum receipt or behavior |
|---|---|
| Identify state without assigning blame | Display “Bridge 1 flexing/open”, “P1 falling”, or “P4 hanging; adjacent spans highlighted”. Treat existing `spanIds` as `adjacentSpanIds` in explanatory copy. Do not say “P3 caught P4”, “P1 broke the bridge”, or “P2 caused the cascade” from current events. |
| Give each warning interval an identity | Add `cueEpisodeId` tied to its onset event, an end event/reason (unloaded/collapsed), and `sourceCueEventId` on collapse. Type references as bridge IDs. Retain a separate client observation for each episode. Historical onset receipt may annotate history but cannot manufacture an earlier draw. |
| Explain the bridge trigger to an operator | At cue/collapse retain `loadN`, `capacityN`, `overloadSeconds`, `warnedSeconds`, and `contributors[{playerId,overlapShare,weightN,landingTermN,downwardCorrectionTermN,loadN}]`. Label these solver estimates. Trigger-time shares describe that instant; attribution across the accumulated overload window requires a bounded history with explicit gaps. Hidden capacity belongs in diagnostics, not ordinary player readouts. |
| Link support loss conservatively | Add `supportLostAt{tick,substep}`, typed `priorSupportSurfaceIds`, and `supportRemovedByEventId` when a known collapse actually removes that support. Otherwise retain `reason: 'left-support' | 'unknown'` without guessing a player cause. Keep episode membership separate from a verified mechanical link. |
| Explain catch without inventing a rescuer | Add the actual branch taken as `hangingPredicate: 'upward-rope-confirmed' | 'wall-settled'`. For span contribution, capture event-local `beforeVelocity`, `afterVelocity`, support/contact identity, and per-endpoint correction/impulse vectors for each span over the confirmation window. Account separately for gravity, motor, contact and numerical energy correction; retain an unexplained residual and validity flag. Until reconciled, say only that a span contributed an upward solver correction, not that it solely arrested the fall. |
| Distinguish slack-to-load from bridge failure | Preserve event-local routed geometry, fixed span length and constraint activity alongside endpoint impulses. Existing `slackM` is explicitly a chord-gap proxy. A slack-to-load claim needs prior descent with unloaded/inactive rope followed by upward load and reduced descent, with competing wall/motor/numerical effects accounted for. It cannot be inferred from cue/collapse or a highlighted neighbor. |
| Measure warning opportunity per client | Join by room/session, epoch, cue-episode event and affected player. Retain first receipt, first actual render submission, source snapshot/interpolation coordinates, whether the cue is still active, and the visibility criterion used. Add substep emission phase to authority events. Keep occlusion/attention unknown unless separately measured. Pair cue and fall/collapse on the same client clock; cross-clock latency requires measured clock alignment and uncertainty. |

Compute client cue-to-fall lead only for the same warning episode and affected player when both draws are known and the warning precedes the fall. Otherwise report null with a reason such as `not-observed`, `ended-before-draw`, `history-truncated`, or `association-unknown`; never substitute server warning duration. If only receipt is known, call it receipt lead. A late client's first snapshot may already contain a collapsed bridge with a positive frozen cue value: it must not count as a warning seen before collapse. The existing 0.4 s server condition sets no demonstrated human reaction or fairness threshold.

Keep all additions bounded and disclose overflow. Existing root tuning owns evidence limits; this document adds no new numeric tuning. The acceptance examples are the observed load collapse without catch; sustained cue without collapse; a wall-settled catch; a middle-player event listing both neighbors; repeated/late/unseen cue intervals; and an additional same-episode fall with no proven causal edge. These are coverage requirements, not extra runs performed here. An action changing a simulated outcome in a future controlled replay could establish a model intervention effect; it would still not establish moral blame or what a human could perceive and do.

## Receipt and reproduction

The gzip artifact is 33,793 bytes, SHA-256 `557505f6b017af277f7dc8fcd964ea20e3d6b6403488dc6a102e410895e6b15d`. Its losslessly decompressed JSON is 1,297,600 bytes, SHA-256 `82f459b438f46d58cd84fdd2c693d555af43341470d31814524f920bf8dedcbb`. The executed probe SHA-256 is `bb6605a6097e00480592cedf3f753debdb312ffe352f52b51c1160495dd095f8`; the JSON contains the complete audited source hash map. Compression was verified byte-for-byte without replaying physics.

For a separately authorized reproduction, use a checkout matching those source hashes, install its locked dependencies, then run `node --import tsx scripts/phase2-warning-attribution-probe.ts SOURCE_ROOT NEW_OUTPUT_JSON`. The probe runs exactly one case, refuses an existing output file, hashes source before/after, and disposes its simulation. Do not use this task's older evidence-only engine as the audited source. Wall-clock metadata and output paths are not deterministic. Saved report paths cited above refer to the coordinator's integrated evidence checkout. This change adds only this document, the standalone probe and its compressed result; typecheck and probe lint passed, and no physics or browser workers remain.
