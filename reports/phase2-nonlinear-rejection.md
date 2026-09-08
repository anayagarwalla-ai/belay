# Rejected: one nonlinear length-projection candidate

The candidate suppresses the catastrophic local overshoot in row 73, but creates a new length violation and worsens the six-player recovery tape at the retained 900 N setting. It is **rejected**. No second candidate, force retuning, topology rewrite, tolerance increase or solver-cap increase was attempted. The experimental mechanics are preserved separately; the physics delivery returns to the frozen baseline.

In row 73, maximum body correction falls from 4.372696 m to 0.128103 m and maximum kinetic-energy removal falls from 2,808,519.502 J to 1,386.261 J. Potential excess falls from 3,561.911 J to 10.568 J, so it remains unresolved. Maximum segment excess rises from **0.018808 m to 0.094190 m**, crossing the existing 0.02 m ceiling where the baseline passed. In the six-player tape at 900 N, energy removal rises from **1,503.673 J to 5,020.418 J**, and segment excess rises from 0.044836 m to 0.072259 m. These are mechanical regressions despite the improvement in the original catastrophic fault.

## Exactly one candidate

The independent patch is `phase2-nonlinear-candidate.patch`, based on runtime `f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1`, with experiment version `phase2-nonlinear-projection-1`. It is distinct from the two earlier rejected lip-routing candidates and does not include either patch.

The change recomputes each active constraint endpoint's terrain normals from its current position, instead of using normals cached before all constraints in an iteration. Grounded brace mobility also checks current support. This prevents a particle already far above the bank from remaining artificially blocked by a stale floor normal.

The existing mobility-weighted correction then undergoes a bounded nonlinear distance check before any position, traction or force accumulator is changed. Let `u = q − p`, `w = (mobilityA + mobilityB) ⊙ direction` and `λ` be the existing position multiplier. The trial distance is `|u − λw|`. If it exceeds the original endpoint distance or is nonfinite, λ is halved. At most nine trials are evaluated (the original step plus eight reductions); failure rejects that constraint update. The accepted λ is used consistently for positions, rope displacement, traction demand and existing force/normal-load accumulators. The outer 256-iteration cap is unchanged.

Material rope lengths, the 0.02 m segment ceiling, other existing acceptance ceilings, wall motor, gravity, energy budget, kinetic scaling, work diagnostics and lip routing are unchanged. Only the experiment's version string changes in tuning. This local distance condition does not claim global feasibility for all rope/contact constraints or an energy-conserving positional solve.

## Same-input comparisons

The harness generates baseline input sequences for rows 73 and 237, then gives both engines those identical inputs over identical fixed horizons. It does not stop the candidate early when an incident recovers. The original two/six-player tapes retain every saved 30 Hz frame, each held for two 60 Hz physics steps. All cases use the saved seed, team, geometry and positions. Both nominal wall profiles are evaluated in disposable module copies; the runtime experiment itself retains 900 N.

Rows 73/237 are one-based matrix rows. Row 73 runs 1,800 physics ticks under both profiles. Row 237 runs 1,800 ticks at 900 N and the original 297-tick terminal horizon at 450 N. The original two/six-player tapes run 150/122 physics ticks respectively. Incident status at a tape horizon is not a permanent recoverability judgment.

| Case | Nominal effort | Segment excess, baseline → candidate | Maximum kinetic removal, baseline → candidate | Incident at horizon, baseline → candidate |
| --- | ---: | ---: | ---: | --- |
| Row 73 | 900 N | 0.018808 → **0.094190 m** | 2,808,519.502 → 1,386.261 J | Active → Active |
| Row 237 | 900 N | 0.090637 → 0.029664 m | 1,355.654 → 1,346.199 J | Active → Active |
| Original two-player tape | 900 N | 0.026706 → 0.004984 m | 2,939.592 → 58.632 J | Recovered → Recovered |
| Original six-player tape | 900 N | 0.044836 → **0.072259 m** | 1,503.673 → **5,020.418 J** | Recovered → Recovered |
| Row 73 | 450 N | 0.018808 → **0.094190 m** | 2,808,519.502 → 1,386.261 J | Active → Active |
| Row 237 | 450 N | 0.090637 → 0.029664 m | 1,355.654 → 1,346.199 J | Failed → Active |
| Original two-player tape | 450 N | 0.021476 → **0.087411 m** | 6,529.480 → 6,038.434 J | Active → Active |
| Original six-player tape | 450 N | 0.044836 → 0.015800 m | 2,290.460 → 19.417 J | Recovered → Active |

The two-player 450 N case also worsens materially in segment excess; its maximum body correction rises from 0.179797 m to 0.204472 m. The six-player 450 N case's lower correction occurs on a trajectory that remains active at the old recovery horizon. It is not a recovery improvement claim. Row 237 still exceeds 0.02 m under both settings despite improving relative to its already-failing baseline.

## What the observations establish

Every observed/control pair matches at every saved physics snapshot, excluding only `serverTime`: **12,482 matching snapshot pairs** across 16 engine/case/profile rows. The 450 N matrix cases reproduce the original input SHA and native peak energy diagnostics exactly. The original tape results reproduce the earlier baseline segment and energy measurements. All raw inputs are reproducible from the included compact fixtures and baseline, with per-case digests in the result file.

The largest increase in an individual constraint's own endpoint distance falls from 54.888683 m to 5.55e−17 m in row 73. No candidate active constraint call increases distance by more than 1e−9 m in any saved case. That 1e−9 m is an instrumentation comparison for floating-point noise, not a changed length or contact tolerance. Row 73's raw pre-budget body-speed peak falls from 262.625463 m/s to 5.836135 m/s. These measurements support that the intended local overshoot mechanism was addressed.

Independent snapshot checks find **zero body penetration, rope-node penetration and rope-interior penetration** for both engines in all 16 rows. The interior check samples the midpoint of each rope segment's intersection interval with radius-expanded terrain at every 60 Hz physics step, including between the old 30 Hz tape frames. Native body-overlap maxima are also zero. Thus contact penetration is not the rejection reason; increased rope stretch and worse energy/position correction in other cases are.

The full report keeps the original signed motor/work diagnostics, native energy removals and potential excess, all final states, actual before/after constraint witnesses, peak body corrections and peak energy witnesses. The old observer's baseline-only multiplier reconstruction is omitted from both engines' exported witnesses; actual measured endpoint changes are used instead. No energy measurement is clipped or suppressed. Per-case execution times include instrumentation and are not a production CPU benchmark or resource-isolation claim.

The focused mechanics/contact command finishes with **33 passes and two failures out of 35 tests** (51.83 s). Both failures are the ordinary six-player catch case, at 30 and 60 Hz: segment excess is 0.023330588935695895 m against the unchanged 0.02 m ceiling. The two original-tape interior-contact tests pass. Typecheck and focused lint pass. Broader performance, all-role participation and human-fun qualification were not claimed for this rejected candidate. The current full 1,000 evidence source stays frozen at the original 900 N runtime.

## Reproduction

The manifest records the experimental commit, exact patch and engine hashes, fixtures, report and test logs. The candidate is preserved at `1a48e2aff79006c9710d7710f57aeb5a96fc9028` on `codex/phase2-nonlinear-projection`; the regular physics branch carries the rejection evidence without its runtime changes. An initially started focused test was stopped for the coordinated client latency window; the recorded 51.83 s result is the complete subsequent run. All owned simulation/test processes stopped after this bounded comparison so the evidence task could retry its resource check.

In a fresh published checkout, import the bundled baseline because tree-based publication may not retain historical commit IDs:

```sh
git bundle verify reports/phase2-baseline.bundle
git fetch reports/phase2-baseline.bundle refs/heads/codex/evidence-baseline:refs/remotes/evidence/phase2-baseline
git rev-parse --verify 'f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1^{commit}'
```

In an isolated checkout containing the published scripts, tests and fixtures, verify that `shared` and `tuning.ts` match that baseline, then apply exactly the recorded candidate patch:

```sh
git diff --exit-code f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1 -- shared tuning.ts
git apply reports/phase2-nonlinear-candidate.patch
npm ci
npx tsx scripts/phase2-nonlinear-probe.ts
npx vitest run --config vitest.config.ts tests/phase2-mechanics.test.ts tests/phase2-rope-contact.test.ts
```

The probe exports both historical and current engines into disposable directories and refuses to run without the exact experiment version. The patch includes the version change; labels do not silently change mechanics. No other task's local worktree is required. The bounded task stops with this single rejected candidate; no revised projection or additional routing attempt is included.
