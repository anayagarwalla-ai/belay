# Fixed-feature coupled particle feasibility — bounded candidate falsified

**The candidate does not solve the known-feasible taut lip fixture within the
existing 256-sweep budget.** It returns a bounded failure with 0.0674816941 m
material-segment excess, above the unchanged 0.02 m physical ceiling. A separate
feasible position witness passes every specified geometric constraint, so this
is a failure to find acceptable geometry within the budget, not proof that the
fixture is impossible. The candidate remains an isolated mathematical artifact;
no runtime selection follows from the simpler fixtures that pass.

The branch is `codex/phase2-fixed-contact-feasibility`, based on the artifact-only
wall-actuator commit `72dcffe7aebdb2ca9e6811bca0c0250880d6a2e8`. Current `shared/`
and `tuning.ts` still match frozen reference
`f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1`. The runtime remains `phase2-1` at the
900 N wall setting. The wall-actuator patch remains unapplied. Architecture A,
the existing particle material, iteration budgets and rescue criterion are
unchanged. No Rapier initialization, time-stepped physics, replay sweep, full
suite, browser, server or benchmark ran for this task.

Artifacts:

- [Pure solver and all-constraint validator](../scripts/fixed-feature-feasibility.ts)
- [Six fixed analytical inputs and independent witnesses](../scripts/fixed-feature-fixtures.ts)
- [Focused falsification tests](../tests/fixed-feature-feasibility.test.ts)
- [Reproducible algebraic report writer](../scripts/phase2-fixed-feature-probe.ts)
- [Raw inputs, witnesses, residuals, sweep traces and source hashes](phase2-fixed-feature-feasibility.json)
- [Unapplied tuning annotation/version patch](phase2-fixed-feature-tuning.patch)

## One candidate and its exact scope

The optimization variables are the supplied predicted positions of every body
and material particle. A two-body chain has 13 unique nodes; a three-body chain
has 25. Every body has physical mass 80 kg, every internal particle 0.2 kg, and
each adjacent harness interval retains 12 material segments with 3.6 m total in
the balanced family. Adjacent spans reference the same middle-body index. The
helper rejects changed masses, material lengths and material-node identities.
It neither deletes slack particles nor redistributes material across harnesses.

The candidate uses **mass-weighted Dykstra projections** on the intersection of
the following fixed convex sets:

1. Each actual material edge obeys `|x_b - x_a| ≤ l_e`.
2. The existing redundant span and harness-to-particle reach bounds obey the
   corresponding sums of immutable material lengths. These change iteration
   behavior but not the exact feasible material set.
3. A prescribed planar contact sample obeys
   `n · Σ_i α_i x_i ≥ offset + clearance`, where `n` is a unit normal and the
   fixed nonnegative barycentric weights sum to one.
4. In the infeasible fixture only, explicit fixed-body boundary constraints set
   the two harness positions. Their masses remain physical; they are not brace
   multipliers, hidden anchors in gameplay, or measured contact reactions.

Dykstra's correction memory couples repeated exact projections to the common
mass-metric objective `½ Σ_i m_i |x_i - x_predicted_i|²`. The method converges
asymptotically for a nonempty intersection of closed convex sets under its
assumptions; that is no guarantee within 256 sweeps. Small changes between
iterates alone can be misleading. This prototype therefore tests actual
constraints, not just iterate change or a local linearized correction.
[Birgin and Raydan, Dykstra's algorithm and robust stopping criteria, §§2.1–2.2](https://www.ime.usp.br/~egbirgin/publications/brsurveydy.pdf)

For an edge with distance `d > l`, the **exact** local mass-metric projection is:

```
n = (x_b - x_a) / d
lambda = (d - l) / (1/m_a + 1/m_b)
x_a' = x_a + (lambda/m_a) n
x_b' = x_b - (lambda/m_b) n
```

A slack edge is unchanged. This uses complete physical inverse masses, without
zeroing individual axes and then extrapolating along a restricted direction.
For a plane deficit `r > 0`, its exact projection is:

```
D = Σ_i alpha_i² / m_i
lambda = r / D
x_i' = x_i + (lambda alpha_i / m_i) n
```

The squared barycentric weights in the denominator matter. A contact at one
quarter body / three quarters particle with masses 80/0.2 kg is not a uniform
endpoint displacement. The test derives its denominator as `3601/1280` and
checks each correction independently.

For each constraint C, store its own position-space correction `p_C`, initially
zero, and repeat:

```
y = x + p_C
x_new = exact_mass_metric_projection_C(y)
p_C = y - x_new
```

Only the one or two referenced nodes need correction storage. All constraints
operate on the same working positions. This is an iterative coupled convex
optimization candidate, not a simultaneous exact solution of every constraint
in one sweep. Other edges may get worse during an internal projection. The
whole working state is checked at the end of every sweep before it can be
returned as a geometrically feasible candidate.

The mass-metric objective has units **kg·m²**, not joules. Correction memories are
position-space optimization variables. They are not reported as tension,
force, impulse or passive reaction. The solver returns
`massMetricOptimalityCertified: false`: reaching the residual ceiling does not
prove convergence to the exact closest point in the intersection.

## Acceptance and bounded failure

Every sweep recomputes each actual nonlinear endpoint distance, each prescribed
plane sample and each fixed-body position error. No cached gradient, summed
merit score, or improved single edge can substitute for this check. The helper
also vetoes body AABB overlap above the existing ceiling. Body separation is
not one of its convex projections; resolving a failed overlap veto would need
additional contact work outside this prototype.

All limits come directly from existing `tuning.ts` values:

| Limit | Value and use |
| --- | --- |
| Minimum / maximum sweeps | 12 / 256, unchanged from Phase 2. Each visit uses one closed-form projection; there is no nested iterative solve, retry or unbounded line search. |
| Solver length target | 0.005 m, applied to every material, span and redundant reach residual. |
| Material-segment / span physical ceilings | 0.02 / 0.01 m, still checked separately. Passing the stricter solver target does not replace those metrics. |
| Contact-clearance error | 0.001 m, using the existing floor/terrain ceiling against the supplied expanded feature. |
| Fixed-body error | 0.001 m, using the same existing contact ceiling for the explicit fixture boundaries. |
| Body overlap | 0.005 m, checked as an acceptance veto. |

Plane clearances in the floor fixtures use the existing 0.035 m rope radius,
0.004 m collision skin and 0.42 m harness height. Testing violation relative to
the expanded plane is stricter than allowing the same depth into the original
unexpanded solid. No physical ceiling or new numerical solver constant was
introduced. The unapplied tuning patch changes only an experiment version and
a comment identifying reused limits. All explicit test coordinates are fixture
inputs, not new gameplay tuning.

The result exposes `acceptedPositions` only if the complete geometric gate
passes after at least 12 sweeps. Otherwise it returns `bounded-failure` with
`acceptedPositions: null`, a reason and the last working state marked as
diagnostic. It does not call ordinary exhaustion proof of infeasibility. Inputs
are copied and unchanged; a failed working state is not a published snapshot,
rollback policy, indefinite freeze, recovery event or accepted engine state.

For C compiled constraints, there are at most `256 C` projector visits and
257 complete residual evaluations, including the initial one. Fixed contact
samples are bounded by one sample per material node and one per material edge;
fixed-body constraints are bounded by the existing body count. There is no
contact discovery loop. Actual work counts are retained below and in every
raw result. These bounds are not a p99, room-capacity or timing qualification.

## Falsification results

| Fixture | Result | Sweeps / projector visits | Final material excess | Final reach excess |
| --- | --- | ---: | ---: | ---: |
| Slack chain | Geometric gate passes; original state exactly unchanged | 12 / 720 | 0 m | 0 m |
| Neighboring-edge regression | Geometric gate passes | 12 / 720 | 2.78e−16 m | 2.22e−16 m |
| Two-body floor | Geometric gate passes | 12 / 720 | 0.000143246 m | 0 m |
| Three-body floor | Geometric gate passes | 12 / 1,428 | 0.001527244 m | 0 m |
| Taut prescribed lip, independently known feasible | **Budget exhausted; no accepted state** | 256 / 9,216 | **0.067481694 m** | **0.049885484 m** |
| Explicitly infeasible prescribed lip | **Budget exhausted; no accepted state** | 256 / 9,728 | **0.788726633 m** | **0.758802501 m** |

Final span excess and body overlap are zero in all six fixtures. Final contact
error is zero in the four simple fixtures and within floating-point noise in
the lip fixtures; the fixed harnesses in the infeasible fixture are exact.
Those small contact residuals do not compensate for failed material lengths.

**The targeted neighboring-edge defect is explicit.** Three consecutive
material nodes initially have x coordinates `(0, 0.3, 0.9)` with 0.3 m edge
limits. Projecting the overstretched second edge moves them to
`(0, 0.45, 0.75)`: that edge becomes valid, but its neighbor now has 0.15 m
excess. The complete validator rejects that local trial. The coupled candidate
subsequently finds a valid state in this small chain. A separate test moves a
horizontal 0.3 m edge endpoint vertically by 0.3 m: the initial gradient sees
zero first-order change, but the actual residual is
`sqrt(0.3² + 0.3²) - 0.3`, so acceptance is rejected.

**The feasible taut lip falsifies this candidate at the current budget.** Its
initial bodies are at `(-1.8,0,0)` and `(1.8,0,0)`, with eleven material
particles along the taut 3.6 m span. The middle material particle must remain
above the supplied expanded feature at y = 0.639 m. A separate witness puts the
bodies at `(-1.65,0.3,0)` and `(1.65,0.3,0)` and distributes six equal material
edges along each straight arm to `(0,0.639,0)`. Each arm is shorter than 1.8 m;
every individual material/reach limit and the specified contact passes. This
witness is validated independently and is never fed to the solver as a restart.

After 256 sweeps from the original state, the solver's largest last-sweep node
movement is only 0.000349816 m, yet material excess remains 0.067481694 m. Thus
an iterate-change threshold could give a misleading success. The actual
all-constraint gate rejects it. No larger cap, alternate initialization,
mass-ratio retuning or second candidate was tried to force a pass. This failure
does not identify a unique cause or prove that another coupled method would
fail; it is sufficient to withhold runtime selection of this one.

**The infeasible fixture has a separate geometric proof.** The bodies are fixed
at `(-1.5,0,0)` and `(1.5,0,0)`. The middle material node has the prescribed
expanded contact y ≥ 2.039 m, but each anchored half-chain has only six 0.3 m
material edges. Even allowing 0.02 m excess per edge plus 0.001 m each for
contact and fixed-body error, required vertical rise exceeds available length:

```
required rise = 2.039 - 0.001 - 0.001 = 2.037 m
allowed half-chain length = 1.8 + 6 * 0.02 = 1.920 m
contradiction margin = 0.117 m
```

Vertical rise cannot exceed polyline length. This already proves infeasibility
without relying on the solver's failure or restricting out-of-plane motion.
Length-only and contact/pin-only requirements are individually satisfiable;
their combination is not. The solver still retains its generic bounded-failure
status; the independent proof is a property of this fixture, not a general
infeasibility certificate produced by the algorithm.

## What remains outside this result

The floor fixtures prescribe one infinite half-space. For this geometry,
clear endpoints imply clearance throughout each straight material edge;
midpoint samples are explicit redundant checks. The lip fixtures prescribe a
half-space at **one identified material particle** as a local fixed feature.
They do not represent an infinite plane constraining every body below it, or
prove clearance against a complete finite lip mesh. Neither case discovers,
creates, slides, releases or switches contact features. There is no claimed
equivalence to full 3D terrain, swept contact, route topology or body-contact
coupling.

Positions and physical masses suffice to test this geometric problem; they do
not qualify velocities, gravity advancement, catches, jolt, partner dragging,
friction, energy balance or rescue. No reconstructed positional multiplier is
called a measured reaction. The result therefore keeps
`dynamicsEnergyFrictionQualified: false`, including for a geometrically feasible
candidate. Existing energy ceilings are neither exercised nor changed.

The coordinator's separately supplied contact-adapter review (`d9deb7f`,
`reports/phase2-rapier-contact-adapter-contract.md`) additionally establishes
that the installed default Rapier solver does not expose usable current solved
tangential impulse through its JS tangent getters. A zero or stale getter must
remain unavailable evidence, and the later custom rope/contact corrections
are outside the earlier native contact observation. This pure prototype does
not close either ownership gap or create a current traction budget.

## Reproduction and checks

Run only the small algebraic fixtures and focused tests:

```
./node_modules/.bin/tsx scripts/phase2-fixed-feature-probe.ts
./node_modules/.bin/vitest run --config vitest.config.ts tests/fixed-feature-feasibility.test.ts --maxWorkers=1
./node_modules/.bin/oxlint scripts/fixed-feature-feasibility.ts scripts/fixed-feature-fixtures.ts scripts/phase2-fixed-feature-probe.ts tests/fixed-feature-feasibility.test.ts
git apply --check reports/phase2-fixed-feature-tuning.patch
git diff --exit-code f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1 -- shared tuning.ts
```

Focused test result: **12 passed, 1 expected failure**, in a 207 ms Vitest run.
The expected failure is the requirement that the known-feasible taut lip reach
the existing ceilings within 256 sweeps. It is retained as an unresolved
mechanics requirement, not counted as a mechanics acceptance pass. Focused
lint passed, the tuning patch passed check-only application, and the frozen
source comparison was empty. Source hashes and complete unaccepted traces are
included in the raw report. No new runtime patch or gameplay baseline is
delivered by this candidate.
