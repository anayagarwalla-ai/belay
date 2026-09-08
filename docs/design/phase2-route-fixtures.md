# Two hand-authored Phase 2 route fixtures

**Preparation only. Prefer A for the first route review; consider B only if A's decisions are useful.** These are two finite grey-box layouts, not a procedural generator or a passed pacing proposal. They preserve move/brace, ordinary gravity/contact, fixed adjacent rope lengths and the existing mechanical, participation and human rescue stop. No new simulation runs, weather, art or Phase 3 work were performed.

## What needs to change

The [measured smoke baseline](../../reports/phase2-smoke.md) contains five seed-1701 crossing runs, one at each team size 2–6: **zero incidents in all five, median completion 20.33 s, range 18.7–21.93 s**. The route is 55 m forward from the leading spawn, with four aligned, 2.8 m gaps and 2.2 m bridges. At 3.1 m/s, `(55 + 2.5 × (players − 1)) / 3.1` gives nominal tail-clearance travel of 18.55–21.77 s, consistent with simple transit dominating those runs. This is not a human walking-rate measurement.

The [seed-2000 warning replay](phase2-warning-attribution-contract.md) instead produced bridge collapse, two falls and terminal loss, without a catch. Lower capacity alone would trade the zero-incident result for an inadequately recoverable failure. The [rescue arrangement memo](phase2-rescue-arrangements.md) also retains static-helper and idle-casualty counterexamples. Neither a longer route nor more falls repairs that participation failure.

The proposed change is **six visible spacing/route decisions separated by real travel**, with a land detour available after a bridge fails. All actual episode counts, including zero, remain eligible evidence. Skilled incident-free traversal is allowed; the game must not manufacture a fall to meet a quota.

## Shared module and physical constraints

All dimensions below are proposed fixture specifications, not new executable defaults. A later implementation must put its complete frozen profile in root `tuning.ts`. Use the balanced 3.6 m spans first, 80 kg bodies of width/depth 0.55 m, initial spacing 2.5 m, ordinary snow, existing bridge load calculation, 0.32 s overload memory and 0.4 s continuous warning requirement. Preserve the 900 N diagnostic wall profile and existing energy/contact limits; neither is certified by this design. Other rope families require separate reachability checks.

Use world `(x,z)` with ground at `y=0`. The walkable main bank is the union of **2.4 m-wide rectangular strips** along the listed orthogonal centerline, with overlapping square elbows. All other in-bounds space is an actual visible void, 12 m deep; no invisible navigation walls. Initial apron: `x∈[-3,3], z∈[-16,0]`, with players at `(0,-2.5×id)`. After the finish, retain a 30 m solid apron wide enough for all six. Ordinary solid ground has the same support physics everywhere.

At each station `(xᵢ,zᵢ)`, define local `u=x−xᵢ`, `v=z−zᵢ`:

| Part | Concrete geometry and decision |
|---|---|
| Gap and bridge | Remove the main strip across `u∈[-1.2,1.2], v∈[0,2.8]`; replace its center with a **1.6 m-wide** bridge, `u∈[-0.8,0.8]`, thickness 0.25 m. Its centered-body lateral clearance is 0.525 m per side. No gap is lengthened to demand more rope. |
| Approach | The last 90° centerline turn is 4 m before the near lip. The leader can reach the bridge while the line is still negotiating the bend. Players can spread or redirect on solid support before committing; there is no minimum dwell or speed gate. |
| Land detour | A **1.6 m-wide solid path** follows `(0,-2.4) → (σ·2.8,-2.4) → (σ·2.8,5.2) → (0,5.2)`, with square elbows; `σ=sign(xᵢ)`. It adds 5.6 m of reference travel. Its continuous ground and solid sides distinguish it from a bridge; it is not a secretly protected bridge. It remains available after collapse without spawning or resetting anything. |
| Reach and clearance | The direct/detour centerlines are 2.8 m apart. At equal height with 1.6 m longitudinal offset, their chord is 3.225 m, within a balanced span; at 2.5 m offset it is 3.754 m, beyond that span. Mixed routes therefore require real spacing changes. This chord calculation does **not** certify routed rope clearance or a safe split. |

Do not add slopes or multi-wrap rescue geometry to these fixtures. A fallen body must reach existing walls and exit through ordinary contact/rope mechanics, or the fixture is ineligible. A land detour preserves onward travel after a broken bridge; it does not prove that an already hanging casualty can recover. At an elbow the rope may cut across the void and pull a neighbor: verify the entire routed configuration, not just each walking centerline. Safe escape and readable warnings are prerequisites to human interpretation.

Freeze capacities by reusing the four existing seed-1701 bridge module values, in order **C, A, B, D, B, C** for stations 1–6. Values below are arithmetic from the current seeded generator, not new physical measurements:

| Module | Capacity / body weight | Capacity, N |
|---|---:|---:|
| A | 1.392412 | 1092.765 |
| B | 1.211119 | 950.486 |
| C | 1.179568 | 925.725 |
| D | 1.247988 | 979.421 |

Each exceeds one body's static weight. A centered, unloaded solo crossing can therefore remain below overload; overlapping people, landing and rope forces can change that. Capacities never reroll on entry, change by team size, or weaken after a successful passage. Exact capacity stays in operator diagnostics. A positive flex cue can occur below failure load; it is not a countdown. Bracing on an overloaded bridge does not suspend collapse, and slowing while bunched can increase exposure. Reposition on the bank, maintain sufficient moving separation, or choose the land route; none requires compulsory waiting.

A deliberately simplified check explains why bends/spacing are worth trying before weaker bridges. Ignoring dynamics, for two centered 0.55 m footprints moving at constant speed, partial-overlap load above a capacity `C` body weights lasts approximately `[2.8 − spacing + 0.55×(3−2C)] / speed`. At 3.1 m/s the four modules give **0.135–0.211 s at 2.5 m spacing**, versus **0.425–0.501 s at 1.6 m spacing**. The latter crosses the 0.32 s overload condition, subject also to warning duration. This is a static overlap calculation, not a solver prediction: rope corrections, prior overload, turning, additional bodies and uneven support can invalidate it. It gives a falsifiable bunching hypothesis without requiring unavoidable solo failures.

## A — compact alternating approaches

Reference centerline: start `(0,0)`; advance to `(0,8)`, turn to `(4,8)`, then alternate between `x=+4` and `x=−4` at `z=32,56,80,104,128`; finish at `(-4,156)`. All inter-turn segments are axis-aligned. Station near-lip coordinates are explicitly:

| Station | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| `(x,z)` | `(4,12)` | `(-4,36)` | `(4,60)` | `(-4,84)` | `(4,108)` | `(-4,132)` |

Keep A entirely snow. The 8 m lateral crossings change who is inside/outside the turn without changing harness order. Near neighbors must follow the bend and avoid compressing onto one support; more distant players can prevent compression propagating forward. These are available coordination problems, not proof that every player must act during a rescue. No player is assigned a compulsory action or role marker.

The direct reference route is **200 m**; taking all six land detours adds 33.6 m. Adjacent gap edges are 21.2 m apart in z, with a lateral bend between them, giving space for an 18 m maximum-length six-player balanced chain to clear one station before the next. Recovery is still physical, never a checkpoint reset: continuing while someone hangs can produce one extended episode instead of several incidents.

This is the preferred diagnostic route because six nearby decisions can expose legibility and failure modes before investing in a long run. It is not selected as a five-minute course. Stop or shorten the review if the same defect is already established; retain the incomplete run as such.

## B — longer approaches with traction choices

Use the same six modules and capacities. Start `(0,0)`, turn at `(0,8) → (6,8)`, then alternate `x=+6/−6` at `z=60,112,164,216,268`; finish at `(-6,300)`.

| Station | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| `(x,z)` | `(6,12)` | `(-6,64)` | `(6,116)` | `(-6,168)` | `(6,220)` | `(-6,272)` |

At stations 2, 4 and 6 only, add the existing ice material on the near bank at local `u∈[0.2,1.2], v∈[-3.2,0]`. A 1.4 m-wide snow strip remains beside it; the detour remains snow. Ice uses the existing 0.3 traction multiplier, without new weather or a hidden force rule. A helper can choose snow before loading or be pulled onto ice, exposing a physical footing decision. Reject it if the grey-box material boundary is not readable.

The direct reference route is **366 m**; all detours make 399.6 m. The 12 m cross-route segments and longer banks provide room to restore spacing and discuss a route while moving. This does not justify long idle stretches. If B's additional duration is mostly featureless held-forward transit, reject B rather than add obstacles, wait gates or longer static rescues to fill the clock. A and B differ in geometry and ice coverage; they are not a controlled single-variable comparison.

## Pacing hypotheses, not measured rates

Reference lengths exclude small supported corner cuts, detours, slips and retreat. For a six-player train, adding its **initial** 12.5 m length gives the following movement-only illustrations; actual stretch and completion geometry must be measured. 3.1 m/s is nominal free-walk speed, not a hard lower bound on duration. The slower rates are assumptions, not imposed caps or measured human behavior.

| Assumed average movement speed | A: 212.5 m including initial train | B: 378.5 m including initial train |
|---|---:|---:|
| 3.1 m/s | 68.55 s | 122.10 s |
| 1.5 m/s | 141.67 s | 252.33 s |
| 0.8 m/s | 265.63 s | 473.13 s |

Four hypothetical 10–20 s rescues add 40–80 s **only if those eligible episodes occur and the movement estimate excludes their time**. B at 1.5 m/s would then illustrate 292–332 s; at 0.8 m/s, 513–553 s. These sums do not establish a 5–10 minute median. The measured focused-rescue median is only 1.87 s: adding four such episodes to nominal B travel gives about 130 s. Extending the map without changing meaningful decisions would leave the pacing problem unresolved.

First direct hazard approach is 16 m in A, 18 m in B: about 5.2/5.8 s at nominal walk or 20/22.5 s at an assumed 0.8 m/s, before hesitation or an actual fall. This provides an early opportunity for an incident under 45 s; it cannot guarantee one. Record no-incident runs explicitly, including players who choose the detour or maintain separation.

Six modules provide **six opportunities**, not six episodes. Conditional on reaching all six and at most one separate episode per station, averaging 3–6 incidents would require an average station incidence of 0.5–1; that is an arithmetic requirement, not an estimated probability. Early terminal loss reduces exposure; unresolved incidents merge station exposure; cascades are not additional episodes. The existing target is unchanged. Report first exposure and learned runs separately without excluding either from the declared population. If competent traversal stays incident-free and human mistakes are rare, these fixtures do not establish the target—do not compensate with guaranteed collapses.

## Falsification checks for the later review

1. **Geometry and mechanics first.** Walk the route with a competent geometry-following policy, not blindly held `+z`; that would deliberately walk off a bend. Check full-team clearance, bridge and detour reach, all casualty positions, corner contacts, rope/terrain tolerances and energy accounting. Any unavoidable wipe, new solver exploit or inability to recover behind a broken bridge rejects that module before a human feel claim. This memo authorizes no new run budget.
2. **Is spacing actually a choice?** Compare continuous spaced traversal, naturally bunched traversal and the land route using the same frozen capacities. Preserve a feasible no-fall policy. If changing spacing does not change measured supported load/exposure, or a single static body fails despite an adequate capacity with no explained dynamic load, reject the hypothesis. Do not tune capacity after each outcome to force a target rate.
3. **Keep participation strict.** Apply the existing whole-episode static-helper, frozen-remote and idle-casualty counterexamples. Useful travel between incidents does not excuse a static rescue role. Any successful unchanged rescue role still fails the user's stop; none of these layouts claims to solve it.
4. **Observe warning and explanation.** Use the [warning attribution contract](phase2-warning-attribution-contract.md) to distinguish authority onset, client receipt and actual camera-frame draw for each episode. Before explaining, ask each player what happened before the fall and what action mattered. A nearby highlighted span is not a culprit. Arbitrary-feeling falls stop Phase 2; missing warning evidence cannot be recast as player error.
5. **Report the whole route.** Preserve incident-free, failed and unfinished runs, first-fall latency, distinct episodes/cascades, station reach counts, detour choices, travel/decision/rescue time and each player's participation. If 5–10 minutes comes from confused waiting, empty traversal or prolonged static suspension, the pacing hypothesis fails even when total time lands inside the range. Do not infer four-incident completion from episode recovery fractions.

Source review used coordinator checkout `c5b0dfefaf192a3f6a762259d7cf823d3419522a`, its `shared/terrain.ts` and `tuning.ts`, the saved smoke/baseline findings and the single earlier warning replay. Only coordinate, load-overlap and travel arithmetic was calculated for this memo. Current terrain construction assumes full-width z gaps and aligned bridges; these layouts need an explicit hand-authored rectangular-support fixture seam shared by authority and presentation. They are not a tuning-only patch or new generation system. No implementation is included, and human laughter/fairness remain unmeasured.
