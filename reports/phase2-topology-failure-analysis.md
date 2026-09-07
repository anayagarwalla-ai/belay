# Bounded rope-contact investigation: both candidates rejected

The diagnostic runtime is restored to the 900 N baseline. Neither candidate fixes the saved failures defensibly. Exactly two contact/projection candidates were tested; no third candidate, tolerance increase, iteration-cap increase, force retuning, or diagnostic suppression is included. The 450 N profile remains an explicitly compared experiment, not an accepted re-cut.

Core baseline: `f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1`. The experiment began after the evidence/test-only commits `bd8254c` and `dd2ad69`, which did not change that core. Each probe held the same recorded 30 Hz inputs over either one 30 Hz authority tick or two 60 Hz authority ticks. Both nominal wall profiles were evaluated in isolated module copies; no workspace tuning file was changed. Numeric segment/energy results match between authority rates. Geometry checks at 60 Hz also expose crossings hidden between 30 Hz snapshots.

## Identified failure mechanism

The last eight iterations of the failing baseline substeps are retained in `phase2-topology-trace.json`.

- Two players, zero-based physics substep 109: after the length and point-contact projections, iteration 255 has no segment excess above 0.004 m. `routeRope` then moves particle 11 from y=0.009846018478048031 to y=0.03900000000000001 and creates 0.02670579485121427 m excess in its next segment.
- Six players, substep 33: length/contact projection and lip routing cycle against each other. In the last iteration, routing moves particle 45 from z=−0.010549443460211756 to z=0.03900000000000001. Its next segment reaches 0.04483601525525138 m excess. Similar shifts repeat through the saved final iterations.

These failures already exist before the final body commit. Final grounded-body snapping was investigated and ruled out as the cause of these peaks. Both substeps exhaust the unchanged 256-iteration cap. An ordinary 30 Hz snapshot reports only its last substep's iteration count and can obscure an earlier exhausted substep.

## Candidate 1: route before length projection

`phase2-topology-candidate1.patch` moves the existing lip routing to the start of each iteration, before copying prior positions and calculating contact normals. Convergence additionally requires that no swept rope segment intersects terrain; this prevents declaring convergence just because rope lengths improved while a segment cut through a bank. No extra solver iterations or routing passes are added.

The two-player tape improves, but the six-player tape still reaches 0.02860883930770336 m excess and has a swept rope/terrain intersection. This occurs under both wall profiles. All 33 existing focused mechanics tests pass, showing that those controller fixtures do not cover the saved failure. Candidate 1 is rejected.

## Candidate 2: mass-weighted segment contact

`phase2-topology-candidate2.patch` replaces the single-particle jump with a contact projection at the midpoint of the penetrating portion of a segment. Correction is divided between its endpoints by barycentric weights and physical inverse masses. Body displacement is included in `ropeDelta` and the corresponding span's force accumulator; contact projections are counted. Existing motor, gravity, rope/contact work and energy-projection code remain intact. Convergence again requires clear rope geometry, within the same 256-iteration cap.

This reduces some length errors, but the six-player 450 N tape still reaches 0.02168383939902624 m, above the existing 0.02 m ceiling. Intersections remain despite zero measured rope-particle penetration. At 60 Hz the two-player tape has 0.0017882038700068464 m penetration at an interior segment sample; six-player values are 0.0014234021250168413 m at 900 N and 0.001388440681867928 m at 450 N. These are greater than the existing 0.001 m terrain-contact budget, not floating-point contact touches.

All 33 existing focused mechanics tests pass this candidate too. The new `phase2-rope-contact.test.ts` rejects it in both saved team sizes by testing interior segments at every physics step. Candidate 2 is rejected.

## Same-input results and the 450 N comparison

The table shows maximum segment excess and maximum single energy projection over each unchanged input tape. Tape horizons are 2.5 seconds for two players and 2.033333 seconds for six players. An active incident at that horizon is censored, not declared permanently unrecoverable.

| Variant | Wall effort | Players | Segment excess | Maximum energy projection | Incident at tape end |
| --- | ---: | ---: | ---: | ---: | --- |
| Baseline | 900 N | 2 | 0.026706 m | 2939.59 J | Recovered |
| Baseline | 900 N | 6 | 0.044836 m | 1503.67 J | Recovered |
| Baseline | 450 N | 2 | 0.021476 m | 6529.48 J | Active |
| Baseline | 450 N | 6 | 0.044836 m | 2290.46 J | Recovered |
| Candidate 1 | 900 N | 2 | 0.005204 m | 916.46 J | Recovered |
| Candidate 1 | 900 N | 6 | 0.028609 m | 1531.03 J | Recovered |
| Candidate 1 | 450 N | 2 | 0.004973 m | 4359.88 J | Active |
| Candidate 1 | 450 N | 6 | 0.028609 m | 2064.60 J | Recovered |
| Candidate 2 | 900 N | 2 | 0.017635 m | 0 J | Active |
| Candidate 2 | 900 N | 6 | 0.013466 m | 0 J | Active |
| Candidate 2 | 450 N | 2 | 0.017644 m | 0 J | Active |
| Candidate 2 | 450 N | 6 | 0.021684 m | 0 J | Active |

Candidate 2's zero energy projections do not establish conservation or a rescue improvement: contact handling changes the trajectories, all four incidents remain active at the old horizons, and independent geometry/length checks fail. Raw work, force, speed, potential, contact, overlap and energy diagnostics are retained in all result files. No energy measurement is clipped or substituted to obtain a passing result.

The baseline's 450 N energy-correction regression remains unresolved: 2939.59→6529.48 J for two players and 1503.67→2290.46 J for six. The original 900 N baseline also continues to violate the saved 2 cm bounds. Neither is an all-role, mechanical-conservation, human-fun, or Phase 2 completion pass.

## Validation and reproduction

- Candidate 1: 8 targeted profile/team/rate rows; focused mechanics 33/33 pass (48.82 s), but targeted geometry/length acceptance fails.
- Candidate 2: 8 targeted rows; focused mechanics 33/33 pass (41.31 s); the new interior-rope regression fails 2/2 (1.15 s), confirming that the guard detects the candidate's defect.
- Restored baseline: the new interior-rope guards pass; the earlier length regressions remain explicit expected failures at the unchanged 2 cm ceiling. The diagnostic tests do not turn those expected failures into a mechanical pass.

`phase2-topology-manifest.json` records exact engine, patch, result and source hashes. The two patches each apply independently to the baseline; they are not cumulative. Full focused test logs, the new-guard failure log, the restored-baseline test log, the final-iteration trace and all three probe results are retained beside this report.

In a fresh published clone, import the historical baseline bundle first. The published tree includes the experiment files, but API-based publication may not retain the original local commit IDs. From the published checkout root, run:

```sh
git bundle verify reports/phase2-baseline.bundle
git fetch reports/phase2-baseline.bundle refs/heads/codex/evidence-baseline:refs/remotes/phase2-bundle/evidence-baseline
git rev-parse --verify 'f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1^{commit}'
```

Verify that the last command prints the exact baseline ID above. The bundle checksum and verified historical trees are recorded in `reports/phase2-baseline-bundle.json`; no existing local worktree branch is required.

Then create an isolated checkout at that imported baseline, copy this investigation's probe/test files, compact tape fixtures and patches from the published checkout, and run `npx tsx scripts/phase2-topology-probe.ts baseline`. Apply exactly one recorded patch, then run the same script with its `candidate1` or `candidate2` label and run `npx vitest run --config vitest.config.ts tests/phase2-mechanics.test.ts tests/phase2-rope-contact.test.ts`. Restore the core before applying the other patch. Labels do not apply patches automatically. The script's profile variants use disposable module copies and share the same installed Rapier runtime.

The bounded investigation stops with a reproducible failure analysis. Runtime code, force settings, solver limits and acceptance ceilings are unchanged.
