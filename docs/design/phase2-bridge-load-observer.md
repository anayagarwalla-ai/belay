# Opt-in bridge-load observer

**Unselected diagnostic implementation, pending review.** This implements the bridge-trigger portion of the [warning attribution proposal](phase2-warning-attribution-contract.md). Gameplay, tuning, ordinary events, snapshots, tapes and public capacity visibility remain unchanged. Human comprehension, agency, fairness and laughter remain unmeasured; existing gates and Phase 3 status are unchanged.

## Entry point and retention

An offline caller explicitly creates a [BridgeLoadObserver](../../shared/bridge-load-observer.ts) and passes it as the second constructor argument:

```ts
const observer = new BridgeLoadObserver();
const simulation = new BelaySimulation(options, observer);
// Step the simulation using the caller's existing inputs.
const receipt = observer.report();
```

Without that argument, no observer, contribution collection or receipt is created. The two-player flat engine has no bridge observer hooks. There are no UI controls, server routes or public-schema additions. Hidden capacity is copied only into the explicitly requested offline receipt.

Use one observer per simulation lifecycle. The caller owns source/tuning identity, scene options and any room/session/epoch association; the collector does not invent those associations or reset itself for another simulation. Receipt IDs start at zero and increase for its lifetime. It retains the latest `TUNING.phase2.maximumEvents` records (currently 256), reporting `maximumRecords`, lifetime `totalRecords` and `truncated`. Overflow removes the oldest receipt. `report()` returns deep copies. Transient contributions clear at each substep boundary; only decision-time contributions remain in retained receipts.

## Recorded calculation and timing

Each receipt supplies `kind`, `tick`, internal `substep`, absolute zero-based `physicsStep`, both rates, emission `phase`, `bridgeId`, nullable `cueEventId`, `loadN`, `capacityN`, `ratio`, `cue`, `overloadSeconds`, `warnedSeconds` and `queuedCollapse`. Indices describe actual decision execution; they are not client receipt or render times.

The original support selection, overlap-area reduction, body-load expression and bridge accumulation order are preserved in [updateBridges](../../shared/expedition-simulation.ts). The observer copies operands and the stored sum **after** each original accumulation. Its separate breakdown never feeds the solver:

- Body load is `mass * (gravity + arrivalTerm + downwardCorrectionTerm)`, with nonnegative downward arrival velocity / dt and nonnegative downward rope/normal correction / dt² supplying the two additional acceleration terms.
- Each contribution retains player and supporting-solid IDs, bridge overlap area, total support area (including non-bridge supports), overlap fraction, mass/gravity/dt, original vertical velocity and correction operands, whole-body load and accumulated bridge load.
- `weightN`, `arrivalN` and `downwardCorrectionN` describe the whole-body terms. `bridgeShareLoadN` apportions their combined body load using the original left-to-right `bodyLoadN * overlapAreaM2 / totalSupportAreaM2` operation. Rows retain solver iteration order; per-player totals require summing that player's rows. Independently summed component terms can differ by floating-point rounding.

`cue` records the positive-cue transition immediately after the existing cue event, before the warning timer updates. Its `cueEventId` identifies that existing event. `collapse-queued` records the queue insertion after the warning timer updates and has no physical event ID. Actual bridge removal and its collapse event occur before integration on the next internal step. There is no cue-end, support-loss or catch receipt.

These are numerical estimates from the existing equation. Contributions describe those instants; no continuous overload history is retained. Causal blame is unknown. The receipt cannot establish a culprit, warning visibility, a rescuer, or a causal link from bridge collapse to a later fall.

## Bounded validation

The [native check](../../scripts/phase2-bridge-load-check-entry.mjs) ran once against parent `77f7f6ad53614578a5267d05588739001764a559` plus this implementation. Exactly two ten-second crossing fixtures used two players and the balanced family, each comparing observer off/on:

| Fixture | Seed / authority rate | Exact snapshots¹ / tape frames | Receipts |
|---|---|---:|---|
| Weak bridge | 2000 / 30 Hz | 301 / 300 | Cue `(82,0)`; queue `(94,0)`; actual collapse verified at `(94,1)` |
| Sustained cue | 1701 / 60 Hz | 601 / 600 | Cue `(168,0)`; no collapse within ten seconds |

¹ Initial state plus every authority tick; only `serverTime` normalized. Complete accepted tapes matched. Contribution reconstruction, stored running sums, phases, cue event identity and queue-to-collapse ordering passed. Pure collector checks also verified empty initialization, overflow disclosure and deep-copy isolation, without more physics. The weak-bridge queue recorded 792.2443 N against 711.1426 N capacity, 0.35 s overload and 0.416667 s warning; its one contributor row identifies player 0's load at that step, without causal blame.

The [saved result](../../reports/phase2-bridge-load-observer-check.json) records 2026-09-08 00:17:53.241–00:17:55.359 UTC and peak sampled RSS 259,670,016 bytes. Its 6,442 bytes have SHA-256 `f61dbd6161b47627edccd1ff3dc4bd660307446b1d1717a4cd2b89cca1f938a7`. The evidence task approved the shared-host window; this is no isolated performance measurement. All four simulation worlds were disposed, and the owned process/watchdog exited. The frozen matrix was not edited.

Targeted lint and scoped strict TypeScript checks passed. Whole-project TypeScript exhausted its 256 MiB heap; no full-suite pass is claimed. Other seeds, player counts and policies remain unchecked. Reproduction, after coordinating resources separately, uses `node --max-old-space-size=256 scripts/phase2-bridge-load-check-entry.mjs`; the script uses existing tuning limits and the pinned native runtime/watchdog. No servers or browsers were run.
