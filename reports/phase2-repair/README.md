# Phase 2 repair campaign

This is a new repair of the failed 1,000-run baseline, not a reinterpretation of that baseline. The historical matrix and its lossless package remain unchanged. No human or production gate is passed by these repairs.

## Implemented changes

- Unilateral distance projection uses the exact non-expanding quadratic root under contact mobility constraints. Rope contact bends route within material links; they do not teleport massive particles to lip anchors.
- A coupled potential-energy bound and explicit kinetic correction account for measured motor work. Swept contact clearance no longer lifts every grounded body by four millimetres each step. Corrections remain visible in diagnostics.
- Wall foot effort is bounded below body weight. Active hand pulling becomes available only at a reachable lip. Braced movement is a slow physical haul; static brace supplies no climbing motor.
- Native contact geometry is refreshed after externally committed PBD poses. Native and PBD body contact envelopes match, so a cuboid can restart across a coplanar bridge seam. Below-lip feet retain wall support instead of prematurely disabling the climb motor. Recovery requires sufficient supported foot area.
- Four spaced crevasses and separate seeded alternate snow bridges replace a 21-second crossing fixture and its repeated falls into a blocked route. This is still a fixed grey-box route: longer travel alone is not evidence of fun or continuous attention.
- The public-state bot steers into a bridge lane, preserves rope order after rescue, exits from beneath intact bridges and fans out to remove slack before hauling. It does not read hidden capacities. Counterpolicies still deliberately withhold helper actions.
- Client prediction uses the same braced motor. Contact-bend render samples no longer look like a new team/scene and reset held movement, interpolation or evidence. Wall cues use the authoritative contact envelope.

## Measurement changes and limits

Participation counts directional input accompanied by loaded motion or self-contributed slack take-up, an active climb with directional input and motion, a changed loaded input, or a planted loaded catch while a casualty is falling. Sustained dragging without input and stationary brace after the catch do not accrue active time. The input's causal contribution to loaded motion is not established: holding a direction while being pulled can still count. This is a mechanical proxy, not a human decision, useful-work or fun measurement. It differs from the historical proxy and must not be pooled with it.

The fixed full schedule remains 20 seeds × five team sizes × two scenes × five policies, with 600-second crossing and 60-second focused-rescue observation horizons. Crossing completion, terminal failure and censoring remain separate. Focused rescue fixtures are not full runs. Small development probes were used to locate bugs and are not a replacement for the new complete matrix.

Frozen-tail focused rescues in larger teams can still succeed. An unbraced body has physical mass and friction; this campaign must report that counterexample and the useful-work/idle measurements rather than add a hidden input checklist or a forced failure. Human review must assess whether every participant has a meaningful job.

The remaining expected-failure unit test belongs to an unapplied historical fixed-feature projector. The live engine uses the routed material-link solver described above. Six previous expected failures for live motor/rope defects now pass normally.

## Rejected first repair campaign

The first repaired candidate, `b547985` / `phase2-repair-3`, was stopped after new bridge/bank rope-contact failures appeared. Its [pre-launch pins](launch-pins.json) and [partial raw output](../phase2-parallel-2026-09-08T16-07-30.630Z-624595fd-adc3-4749-829a-c197e9c4c769/result.json) are preserved. It is **INCOMPLETE: 74/1,000 records**, including four rows interrupted by the deliberate stop. All four worker exit receipts are present with code 1. There is no remaining process from that campaign.

| Partial evidence, version 3 | Observation and scope |
|---|---|
| Execution | 453.81 s wall time; 259,435 persisted raw timing samples. Not a completed matrix |
| Crossings | 44 starts: 19 completed, 21 failed, four interrupted. Completed-only median 383.13 s; all 19 completions had four incidents. This early prefix is not representative of the fixed schedule |
| Focused rescues | 30 starts: 19 recovered, 11 failed. These are fixtures, not whole runs |
| Rope defect | Maximum segment excess 88.07 mm, against the unchanged 20 mm bound, at ordinal 274 |
| Local step timing | Partial pooled p50/p95/p99 3.84/10.37/125.74 ms. Shared-host synchronous steps; not server ticks or 300-room capacity |

Version 4 removes unnecessary massless contact bends at bridge/bank seams, slides surviving contacts toward the shortest clear route, and uses the strongest separately proven reach bound across overlapping solids. Its rare difficult corner cascades have a bounded 1,024-iteration ceiling; ordinary steps still stop after the existing 12-iteration minimum when their constraints are satisfied. The 20 mm segment, 10 mm span, 1 mm terrain and 5 mm body-overlap acceptance ceilings remain unchanged. The unapplied historical projector retains its own original 256-sweep budget.

The exact accepted inputs from the three saved failures now replay with these segment excesses:

| Saved ordinal | Original excess | Version 4 excess | Recorded input ticks |
|---|---:|---:|---:|
| 12 | 46.10 mm | 7.19 mm | 250 |
| 264 | 48.00 mm | 6.17 mm | 343 |
| 274 | 88.07 mm | 7.09 mm | 984 |

These are regression tapes, not a new population benchmark. Maximum potential excess is zero in all three. The largest explicit kinetic-energy correction is 55.96 J in ordinal 264; numerical dissipation remains recorded rather than silently relabeled as physical work.

## Current verification

Version 4 passed the separate [200-case early-contact screen](screen-summary.json): four declared seeds, every team size, both scenes and every bot policy, including all three rope families. Both 100-case processes exited successfully. Across 186,784 ticks, maximum segment/span excess was 12.51/4.49 mm; body overlap, body terrain penetration and potential-energy excess were zero. The largest explicit kinetic-energy correction was 71.04 J. Each window was at most 60 seconds; short crossing windows cannot measure full run length. The original screen script is preserved before its subsequent TypeScript-only cast; physics and policies did not change. The old completed 1,000-run matrix remains [the historical findings](../phase2-final-evidence.md).

Client prediction also now selects the correct authority motor in three-to-six-player flat diagnostics. The socket fault fixture records offered but unacknowledged sequences immediately before deliberately terminating a connection. Its functional assertion allows only that recorded uncertainty; the benchmark still reports an exact-acceptance failure whenever offered and accepted counts differ. No load acceptance criterion is weakened.

No upload endpoint, public deployment, voice service, paid resource or scheduled follow-up has been created. The local preview is loopback only. The 300-room production requirement and human rescue stop remain unqualified.

The [combined verification receipt](verification/receipt.json) records **299 passing tests and one unused historical expected failure**, 28 independent validator tests, successful typecheck/lint/build, 75 historical integrity checks, the browser keyboard trace and source hashes. The latest UI-only measurement-description edit was separately rechecked. The complete version-4 distribution is now available in [the final repair findings](FINAL.md); the pre-cleanup verification above remains a separate receipt.

The full version-4 rerun finished at **19:27:56 UTC on September 8** after 8,864.61 seconds. All 1,000 cases, four clean worker exits and 4,728,413 raw timings independently reconciled against the [pre-launch pins](launch-pins-v4.json). See [final findings](FINAL.md), [independent validation](full-validation-v4.json) and the [lossless evidence package](evidence-package/README.md). The measured source is pushed commit `fdc6ae86b2c76f2255bcbbc2e1df5ab3dffa46c1`, before the separate result-preserving performance cleanup. The original live directory is retained locally; Git stores its complete compressed reconstruction. Initial memory preflight refused before launch; stopping the preview briefly allowed the unchanged guard to pass. The restored preview and exploratory probes shared the host, so these timings do not qualify capacity.
