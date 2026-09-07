# Phase 2 rescue re-cut: bounded mechanical experiment

**Coordinator decision: retain the existing 900 N diagnostic baseline; reject selection of the 450 N variant.** This handoff contains evidence plus an unapplied source patch. See [isolated reproduction and pinned source hashes](../../reports/rescue-recut-reproduce.md). Active engine/tuning changes remain on the separate experimental branch and are not applied by this evidence-only commit.

Baseline: `ad00223526c9f3ba93320bfe284c74f1f30697fd`, owned by the physics task. This isolated branch owns only the re-cut. No Phase 3 authorization or human verdict follows from this experiment.

## Preregistered budget and hypotheses

One baseline and three variants, fixed before running: (A) 450 N wall normal effort, (B) 300 N wall normal effort, (C) 450 N with helpers initially closer to the lip and the rope chain more extended. Friction stays 1.3. No stamina, mandatory button changes, chance adjustment, hidden role gate, rope reeling or force scaling by team size. The contact/rope solver remains the baseline. Numerical fixture and observation settings live in root `tuning.ts`.

A/B isolate motor capacity. C probes visible stance geometry: 0.45 m safe-bank offset and 3.2 m lateral spacing instead of 0.8/1.6 m. With a 0.55 m body, the near-bank sole still has 0.175 m clearance from the lip; fixed 3.6 m spans remain actual rope lengths. Spacing approaches rope length without changing force by team size. This may make the entire chain load-bearing; it may instead permit frozen tails or obstruct exit. Both are reportable failures.

Use a small initial screen, then a fixed matrix across 2–6 bodies, head/middle/tail casualties, same/split banks where feasible, snow/ice support, active cooperative policies, all-static helpers, each frozen helper, all remote helpers frozen and completely idle casualty. Hold interventions from simulation start; verify accepted inputs. Stop observations at confirmed recovery, terminal loss or the fixed horizon; horizon expiry is censoring, never an artificial death. Report all variants, including no-rescue cases. A failed scripted policy does not prove mechanical impossibility; a successful passive policy is a constructive counterexample.

## Force and geometry envelope derived from this implementation

Body weight is 80 kg × 9.81 m/s² = 784.8 N. Baseline wall capacity is 900 N × 1.3 = 1170 N, 1.491 body weights. Baseline wall target acceleration is capped at 5 m/s², so the upward command requests up to 1184.8 N before clipping: 1170 N allows 4.815 m/s² net ascent even without upward rope load.

A/C wall capacity is 585 N (0.7454 body weights), requiring at least 199.8 N upward rope resultant for quasi-static ascent. B capacity is 390 N (0.4969 body weights), requiring 394.8 N. A completely idle wall casualty receives no wall motor and requires approximately 784.8 N upward rope force. For elevation h, the minimum gravitational work is 784.8h joules; sustained A/C wall assistance can at most supply 585h joules in the vertical direction, leaving at least 199.8h joules to hauling (before losses). These are necessary force/work bounds, not predicted rescue rates.

At a single taut casualty-side segment angle θ above horizontal, upward support is T sin θ. Thus A/C require T ≥ 199.8/sin θ N and B require T ≥ 394.8/sin θ N. The routed path, including the lip, controls θ; straight harness-to-harness angle is not a valid proxy once rope contacts terrain. At the final rim clearance the vertical component can vanish; an exit can stall even when deep-wall ascent succeeds. Helpers must create clearance and route geometry through ordinary movement.

The ground motor requests at most 80×10 = 800 N on snow and 240 N in the ice profile. Balanced stationary brace has nominal 1.6×784.8 = 1255.68 N horizontal traction before traction consumed by velocity cancellation; on ice it is 376.704 N. The solver's normal/contact response, rope projection, Rapier friction and numerical energy projection mean these are implementation effort budgets, not calibrated real-world force measurements. Ground motor effort currently uses gravity-based scale rather than measured solved normal load; no claim of a fully Coulomb-consistent human model is justified.

## Necessary versus helpful; disconnected-body conflict

Reducing wall effort can remove unassisted steady ascent. It cannot make every chain member logically necessary for every rescue. If adjacent helpers can deliver the required work and remote spans remain slack, far tails are redundant. Bracing can be a useful static support even when it fails the contract's activity requirement.

Later disconnected bodies remain limp on the rope for 60 seconds. If the same physical system permits hauling one out, a connected casualty with identical zero input can also be recovered. Universal mandatory casualty activity is therefore incompatible with limp-body recovery absent a change in task scope or an explicit exception; this experiment must expose that conflict rather than gate recovery on connection or input history.

## Evidence status

The final evidence set is complete: 32 screen cases and 250 matrix cases. See [the decision](../../reports/rescue-recut-decision.md) and [detailed results](../../reports/rescue-recut-summary.md). Static-helper and zero-input-casualty counterexamples remain; the candidate does not pass Phase 2. Human comprehension, remote feel, fun, functional-idle coding, first-exposure success rates and run completion remain unmeasured.

## Policy verification correction

The first policy implementation classified a helper as being on the far bank as soon as its center crossed the near lip. A body can still stand on the near bank with partial overhang; the policy could therefore reverse its intended away-from-lip move. This was a harness bug, not a physical variant. The corrected policy uses the nearest bank (the gap midpoint boundary) and a regression exercises partial overhang. The original 32-row screen is preserved as `reports/rescue-recut-preflight-screen.json`; the interrupted matrix's completed summary rows remain in `reports/rescue-recut-preflight-matrix.log`. That interrupted matrix did not checkpoint full state; this is an evidence limitation, not a completed run. Corrected runs checkpoint each full row and repeat the same preregistered parameter sets and horizons. No new tuning family was added.

The catch policy makes its first move at the first 0.5-second decision boundary after the 0.75-second initial brace interval, which is 1.0 second. All passive interventions begin at tick zero. The split-bank fixture uses 1.6 m spacing for every variant because its diagonal cross-gap spans must fit the existing fixed rope; the wide-spacing variant applies to the same-bank scene.

## Execution and reproducibility

The corrected screen has 32 cases; the fixed role matrix has 250 cases. Cases use 60 Hz authority with the same 60 Hz internal solver so the harness can reconstruct every applied motor substep exactly; no 60 Hz remote-feel or default-authority recommendation follows. Policies decide at 0.5-second boundaries. Existing rate-pair mechanics tests and the separate 30 Hz three-player static-helper regression cover rate consistency; the matrix is not presented as a 30 Hz network experiment.

After the first completed matrix prefix, the remaining cases were partitioned across four independent Node processes by canonical index modulo four. Each process owns its simulation and mutable offline profile; no state is shared. Completed prefix rows were reused, not retuned or dropped. Worker reports must have identical configuration hashes and merge into exactly one row per canonical spec. Scheduling differences do not support any latency or production-capacity claim. The only configuration changes across that scheduling boundary are version metadata, the default wall effort (every matrix case explicitly overrides it to 450 N), and the offline worker-count limit; physical case parameters and policy revision are unchanged.

The rejected core tuning candidate is commit `54eec098d3e90abf5cd9c3b59a5927c0c3c48c89`; it can be reviewed independently of the experiment harness. It deliberately keeps a passing regression that reproduces a three-player static-helper recovery. This is not a candidate that passes Phase 2's role check.

## Actual bank occupancy

The raw spec field `bank: 'split'` selects the centered-casualty fixture family. Only interior casualties have helpers on both banks. With a head or tail casualty, all helpers are on one bank and the casualty starts at the hole center; these are centered endpoint-fall variants, not claimed split-bank endpoint rescues. Across a 2.8 m gap with 0.8 m safe offsets, a direct bank-to-bank helper span would need 4.4 m even before lateral separation, exceeding the fixed 3.6 m rope. The report therefore identifies actual helper bank occupancy and retains full starting coordinates. No impossible taut setup is used to manufacture a necessary helper.

The preserved preflight matrix has 60 completed summary rows. The corrected 32-case screen has identical accepted-input hashes and outcomes to its preflight screen. The corrected matrix reuses 46 fully checkpointed prefix rows when partitioned; the final dataset contains exactly 250 distinct canonical specs, with no preflight rows pooled into that denominator.

## Final validation

TypeScript typecheck and repository lint pass. The relevant mechanics/legacy-flat/evidence suite passed 35 checks; the subsequently added three-player static-helper regression passed its targeted run (36 distinct relevant checks in total). The completed worker merge verified identical worker configuration hashes and exactly 250 unique canonical specs. These regression passes do not turn the 86 matrix contact/rope failures, severe energy diagnostics or 44 passive recoveries within contact/rope bounds into a Phase 2 pass.

Final matrix outcomes: 76 recovered, 133 censored, 41 terminal, no harness errors. None of the 76 recovered policies met the 10–20-second target (range 2.033–4.917 seconds). The three-player ice/tail/idle-casualty case at matrix row 73 had 2.809 MJ of maximum single-step kinetic-energy removal and 3561.911 J unresolved potential excess despite a segment residual under 2 cm. Numerical correction magnitude therefore remains a separate qualification failure.
