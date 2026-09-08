# Saved-data explanation of the fixed-feature failure

This note completes the coordinator's requested source/data follow-up on
candidate `99129e6a6e932ba94f955629976e89e61dc44dd0`. It uses only that commit's
[saved inputs, positions and sweep trace](phase2-fixed-feature-feasibility.json)
and [projection source](../scripts/fixed-feature-feasibility.ts). No solver,
test, physics world, replay, variant or additional numerical experiment was
run. Scalar distances and potential differences below are calculations on
already saved positions.

## The feasible lip makes slow progress; it has not stopped changing

The known-feasible taut-lip case retains measurable residual decay through the
last sweep:

| Saved sweep | Maximum segment excess | Maximum reach excess | Largest node movement during the sweep |
| ---: | ---: | ---: | ---: |
| 12 | 0.149884950 m | 0.157009789 m | 0.007253690 m |
| 64 | 0.112275115 m | 0.114943658 m | 0.001118324 m |
| 128 | 0.092619003 m | 0.083697732 m | 0.000681876 m |
| 192 | 0.079244870 m | 0.065279125 m | 0.000469900 m |
| 255 | 0.067634990 m | 0.050073414 m | 0.000351110 m |
| 256 | 0.067481694 m | 0.049885484 m | 0.000349816 m |

The defensible finding is **insufficient convergence within 256 sweeps**, not a
demonstrated exact fixed-point stall. Extrapolating a sweep count for eventual
success from this short trace would not be justified. Small iterate changes
already coexist with an unacceptable material residual, which is why the
all-constraint gate must remain authoritative.

Both harnesses are free variables in this fixture. They began at
`(-1.8,0,0)` and `(1.8,0,0)` and finish the unsuccessful optimization at:

```
left  = (-1.7254664491, 0.0247503821, 0) m
right = ( 1.7253953879, 0.0238042788, 0) m
contacted material node 7 = (0.0194615473, 0.639, 0) m
```

The harness displacements are 0.078535544 m and 0.078310228 m. Their distances
to the contacted node are still 1.849885484 m and 1.813470718 m, while each
half-chain owns 1.8 m of material. The largest violation is edge `(6,7)`, at
0.067481694 m excess; neighboring edge `(7,8)` has 0.016341284 m excess. The
fixed contact itself is satisfied to floating-point noise.

This is not just a poor x coordinate for the contacted particle. Hold the two
**saved final** harness positions fixed temporarily for a geometric lower
bound, and let the contact move anywhere on or above y = h = 0.639. Since both
harnesses lie below that plane, reflection gives the minimum possible routed
distance through it:

```
minimum route = sqrt((xR-xL)² + (zR-zL)² + (2h-yL-yR)²)
              = 3.663329532 m
```

That exceeds 3.6 m of exact material by 0.063329532 m. It even exceeds the sum
of the two 1.8 m reach bounds with their 0.005 m solver allowances by
0.053329532 m. Consequently, rearranging only the light particles at those
final harness positions cannot pass the complete gate. The harnesses must
move further in a continuing coupled solve. They are not pinned by the test.

## Mechanisms visible in the source, and limits on attribution

The source identifies a mechanism consistent with this slow progress. For a
body/particle distance projection, the physical 80/0.2 kg mass metric assigns
the body only `1/401` of the relative distance correction and the particle
`400/401`. The same ratio applies to a redundant harness-to-particle reach
projection. Much of an individual correction therefore rearranges the light
rope before the expensive harness positions move substantially.

The algorithm visits material and reach constraints first, then restores the
prescribed plane sample. All these exact projectors share one working state
and Dykstra correction memory, but there is no exact whole-system solve within
a sweep. Endpoint accommodation and material redistribution must emerge over
repeated visits. Contact can be satisfied at the end of the sweep while the
material/reach constraints are still violated, exactly as the saved result
shows. The final validator catches that conflict.

The deterministic left-to-right constraint order also has a visible finite-
iteration asymmetry: despite symmetric input geometry, the contacted particle
finishes at x ≈ 0.01946 m and the two half-span residuals differ. This is
consistent with order-dependent unfinished iteration, not evidence of a
physical left/right difference. No reversed-order run was performed.

These source properties and the geometric lower bound explain why a near-
stationary particle state is not yet a feasible coupled configuration. They do
**not** isolate the relative contributions of mass conditioning, redundant
constraint order, curvature and correction memory. There was no controlled
comparison or saved per-projector memory trace, so no causal speedup claim or
alternate solver recommendation is made.

The fixed-harness infeasible case is different. Its material/contact
intersection is empty by the independent 0.117 m tolerance-aware contradiction
in the [main rationale](phase2-fixed-feature-feasibility.md). At sweeps 64 and
256, maximum segment excess is approximately 0.788868153 m and 0.788726633 m.
Small sweep movement cannot overcome that inconsistency. No assumption of
asymptotic convergence to a feasible intersection applies there.

## Which fixture assumptions do not transfer to moving gameplay bodies

| Fixture assumption | Consequence for interpretation |
| --- | --- |
| Only the explicit infeasible case pins its two bodies. | That proof depends on fixed kinematic boundary positions. Letting those bodies move removes the proof; fixed bodies cannot stand in for a finite-effort braced player. |
| Taut-lip and floor cases have free harness positions with their physical masses. | The solver can move them geometrically, but it does not integrate their velocities, forces or supports over time. They are free optimization variables, not dynamically qualified trajectories. |
| One plane, contact identity and barycentric/material sample remain fixed. | A real contact may move, release, switch features, or cease to be valid. The lip sample is a prescribed local constraint, not a complete finite obstacle or proof of all-edge 3D clearance. |
| Fixed material segmentation and one middle-body degree of freedom remain explicit. | No material transfers through a harness and no whole-team cable substitutes for the chain. Moving contacts would still have to respect those identities. |
| The objective penalizes positional displacement using physical masses. | Its kg·m² value is not work, kinetic energy or a passive reaction. Neither correction memory nor fixed-boundary enforcement is an observed force. |

The separate taut-lip witness is therefore **geometrically** feasible only. It
raises the two bodies by 0.3 m, increasing their gravitational potential by
470.88 J at the existing mass/gravity settings. Its real internal particles add
another 10.465308 J, for a total potential increase of 481.345308 J relative to
the supplied initial positions. The fixture supplies no pre-step velocities or
active-work budget to pay for that increase. This does not invalidate the
geometric existence proof, but it prevents using the witness as an energy-
admissible rescue motion or accepted runtime state.

Moving physical harnesses would require the existing velocity, gravity and
energy constraints plus consistent contact/rope impulse ownership. The
separately reviewed Rapier observation limitations remain: the default solved
tangential reaction is unavailable through the current JS getter path, and
native impulses precede later custom projection. This position-only prototype
supplies neither missing reaction nor a simultaneous traction certificate.

The committed candidate and its failure stand unchanged. No second algorithm,
larger cap, revised tuning or runtime adoption is proposed by this note.
