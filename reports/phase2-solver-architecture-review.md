# Solver architecture review: two ways forward, no selection

**A preserves the written particle-chain architecture. B is a reduced cable model that can produce real body-level pulling and catches, but is not an equivalent replacement for the required chain and free-rope dynamics.** Neither approach is implemented or selected by this memo. This review adds no runtime candidate, simulation sweep, tuning change or benchmark. Performance estimates below are analytical and unmeasured.

The frozen reference is `f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1`, retained at 900 N. The [diagnosis](phase2-motor-energy-design.md) separates unbounded wall actuation from an infeasible rope/contact energy correction. The [rejected nonlinear candidate](phase2-nonlinear-rejection.md) reduces row 73's local overshoot, but increases segment excess to 9.42 cm and fails ordinary six-player catch tests. Thus monotonic improvement of one constraint is insufficient; both architectures need an acceptable *coupled* state before commit.

## Requirements that govern this decision

The [approved plan](../PLAN.md#decisions-carried-into-phase-0) explicitly selects unilateral PBD and Rapier body contacts. It also requires physical slack, pulling, catching and hauling. The [Phase 2 design](../docs/design/phase2-incidents-rescue.md#force-and-contact-flow) specifies adjacent rope-node constraints, particle/terrain contact, fixed material between adjacent harnesses and one shared body degree of freedom at a middle harness. Its older Gate 1 authorization language is superseded by the current plan; its mechanics requirements remain relevant. The [implementation contract](../docs/design/phase2-implementation-contract.md) requires adjacent spans and prohibits a spring approximation.

The current balanced configuration supplies 3.6 m per harness interval, 12 segments, 0.2 kg per internal particle and a rope-velocity damping coefficient of 2.5 s⁻¹. Those numerical choices are current implementation parameters, not a proof that every future physically acceptable discretization must use exactly 12 particles. However, discarding the simulated chain or replacing its damping with a different body effect is a substantive model change. Returning zero for a deleted segment-error metric would not demonstrate compliance with the existing 2 cm ceiling.

| Requirement | A: coupled particle PBD/contact | B: massless routed-length constraints |
| --- | --- | --- |
| Real simulated constraint chain | Retains material particles and adjacent inequalities; compatible in structure, correctness still unproved. | Contains real generalized body constraints, but geometric guide points are not dynamic material particles. A PBD implementation of B would still change the constraint model. |
| Fixed material between harnesses | Fixed sum of material segment lengths in each adjacent span. | Feasible only with a separate constant material budget for **each adjacent harness interval**, not one whole-team cable budget. |
| Slack does not push; take-up affects catch timing | Natural unilateral chain behavior. | A routed-length inequality provides genuine mechanical slack before tension engages. It does not specify the shape or motion of unused material. |
| Physical catch/jolt and partner drag | Possible through coupled impulses and supported traction. | Also possible through generalized impulses. A massless cable does not imply a cosmetic catch or inability to pull a body. |
| Free-rope sag, motion, damping and slack contact | Explicit state exists to model these, subject to resolution and contact accuracy. | Missing from the basic state. A curved rendering cannot supply physical inertia, damping or reliable slack-contact history. |
| Lip/corner contact | Needs swept segment contacts and consistent creation/release. | Needs a continuous routed path, contact reactions and topology history; endpoint line-of-sight is insufficient. |
| All-role rescue / human feel | Unmeasured and independent of numerical validity. | Equally unmeasured. Fewer variables do not establish equivalent feel or meaningful participation. |

Under the current written requirements, B cannot be declared a compliant drop-in core. A later decision could explicitly accept a body-effects-only cable abstraction, but this memo neither makes that decision nor silently relaxes the chain/slack/drag requirements.

## A — coupled particle PBD/contact with bounded nonlinear feasibility

**State and material.** Retain each body's physical position/velocity once, internal rope-particle position/velocity, immutable per-segment material lengths, and contact feature identities. Adjacent spans reference the same middle body. With six bodies and the current discretization there are 61 unique nodes and 183 translational coordinates; duplicated drawing endpoints are not extra degrees of freedom. For edge e, enforce `C_e = |x_b − x_a| − l_e ≤ 0`. A slack edge has zero tensile multiplier. Long-range constraints may accelerate convergence only if they are valid consequences of the fixed material chain; they must not redefine it.

**Coupling.** Use one physical mass metric and a consistent set of length, body-contact and rope-contact multipliers in the working state. A rope-interior contact at `(1−t)x_a + t x_b` distributes the normal constraint gradient to both endpoints with those barycentric weights. It must not be replaced by moving one particle to a lip coordinate after the solve. Refresh closest features/gradients when a trial moves away from the configuration that defined them. Brace may restrict supported tangential mobility only while a finite support reaction supplies the withheld impulse; energy still uses the physical body mass. Unsupported brace cannot change that mass or anchor the body.

PBD provides a particle/constraint formulation; XPBD adds accumulated multipliers and compliance with a defined timestep scaling. These are useful foundations, not a guarantee of contact feasibility or energy conservation for BELAY. If compliance is used, its elastic energy and physical stretch must be accounted for; it cannot be chosen merely to hide an existing length failure. [Müller et al., Position Based Dynamics](https://matthias-research.github.io/pages/publications/posBasedDyn.pdf), [Macklin et al., XPBD, equations 17–18](https://mmacklin.com/xpbd.pdf)

**Bounded solve.** Build a trial state from the single physics prediction, solve the coupled active constraints, then check the actual nonlinear state: every material edge, body separation, rope-interior clearance, contact/friction feasibility and energy residual. A bounded line search or trust region may use a scaled aggregate merit function to make progress, but final acceptance must independently satisfy every existing ceiling; a weighted sum must not trade 9 cm of stretch for better energy. Re-evaluate all affected constraints after a trial, not just the edge that proposed it. Keep the existing outer cap as a hard limit during any initial evaluation, with explicit bounds on trials and contact discovery. No assertion of convergence within that budget is made.

**Contact lifetime.** Create segment/terrain contacts from swept geometry, with stable feature IDs and normal orientation. Reuse an active contact only while its geometry remains valid. Release when its unilateral reaction is inactive/separating and the swept geometry is clear; remove friction state consistently. Keep a material particle even when its contact disappears. Geometry changes such as bridge collapse occur at a substep boundary and remove the relevant support without relocating rope particles or changing material length.

**Main risk.** The 400:1 body/particle mass ratio, changing contact features and multiple spans can make the system poorly conditioned. A globally checked step is more expensive than the rejected per-edge check, and it can still fail to find a feasible state within a finite budget. A is a defensible repair direction, not an already validated algorithm.

## B — massless path with geometric contacts and one routed-length constraint per span

**State and material.** Keep the same physical body degrees of freedom. For each adjacent harness interval s, retain an ordered path through at most a declared number of geometric contact nodes, a constant material budget `L_s`, contact feature/order history and any explicitly justified sliding state. Contact nodes are geometric unknowns constrained to obstacle features, not particles with zero mass passed into an inverse-mass formula. There is no free-rope momentum state in basic B.

For a frictionless route with points `q_0 … q_k`, including the two harnesses:

```text
ell_s = sum_j |q_(j+1) - q_j|                    [m]
C_s = ell_s - L_s <= 0                          [m]
slack_s = L_s - ell_s                           [m, when feasible]
T_s >= 0,  T_s (L_s - ell_s) = 0                [N; complementarity]
F_body = -T_s grad_body(ell_s)                  [N]
```

The length derivative must include the effect of the solved path geometry. Holding arbitrary guide points fixed and then moving them outside the solve can give the wrong constraint direction and work. Contact-point unknowns must satisfy geometric feasibility and force balance, or be eliminated through a valid stationary route calculation for the current topology. A middle body receives the sum from its two adjacent spans in one coupled body update.

Related massless-cable work formulates total length across intermediate guide points as a multibody constraint. That establishes a legitimate reduced mechanics model, not equivalence to a dynamic material chain. The proposed B here additionally requires unilateral slack, fixed per-harness material and terrain-specific contact lifetime rules. [Servin and Lacoursière, Massless Cable for Real-time Simulation, section 4.4](https://umit.cs.umu.se/modsimcomplmech/docs/papers/Massless.pdf)

**Contact reactions and friction.** With unit path tangents `t_prev` and `t_next`, a frictionless massless guide receives cable force `T_s(t_next − t_prev)`; the obstacle supplies the opposite reaction. Endpoint forces and all obstacle reactions must balance. This is how a routed cable could load a bridge, rather than assigning arbitrary weight to every touched patch. A single total-length multiplier gives one tension for the frictionless span. A frictional lip can support unequal tensions and stick/slip, requiring additional material-transfer/tension state and a consistent friction solve. It is not supplied by the single scalar constraint. Body/wall friction and rope/lip friction are separate. The initial grey-box design does not require complex multi-wrap friction, but a frictionless approximation must be stated, not disguised as a solved friction model.

**Creation and release.** Discover contacts by sweeping the existing path against radius-expanded geometry. Insert guide nodes in material/path order and preserve the continuous side of an obstacle that the rope already occupies. Recomputing a globally shortest path each frame can jump across an obstacle to a different route and manufacture slack or tension. Releasing a guide requires both valid reaction/separation conditions and a collision-free, continuous replacement path. Mere line-of-sight between neighbors is not sufficient when release would jump path length, erase a winding or discard slack-contact history. Bound the number of nodes, discovery passes and release attempts. On exhaustion or ambiguity, report failure; do not silently drop a guide.

**No hidden winch.** Sliding may redistribute geometric length within a harness interval; its total material `L_s` never changes. No material may transfer through a tied middle harness into the next span. Inserting/removing a guide must conserve that interval's material budget. A changed minimum route length is a changed constraint configuration, not permission to set `L_s` to whatever route now fits. Static geometric rerouting is not external work.

**The slack/drag limitation is real.** `L_s − ell_s > 0` correctly delays body tension. But infinitely many free-rope shapes and velocities have the same harnesses, guides and slack scalar. Some touch a lip; others do not. Some carry lateral momentum; others are stationary. B maps those states to the same state and therefore cannot reproduce their different subsequent rope motion, contact or damping response. That is a state-information limitation, not something a more accurate scalar constraint solve can repair.

Reduced models can still be physically useful: *Cable Joints* uses unilateral joints with material bookkeeping, while drawing loose cable procedurally. Its discussion explicitly distinguishes cable-driven body effects from simulating the cable itself, and its 3D routing uses prescribed cross-section planes. Those assumptions do not establish free 3D slack-rope contact on BELAY's lips. This is supporting evidence for reviewing the simplification, not a third architecture proposed here. [Müller et al., Cable Joints, sections 3.1, 3.4 and 6](https://matthias-research.github.io/pages/publications/cableJoints.pdf)

The current rope damping acts on internal-particle motion. B has no such velocity on which to apply it. A dissipative body/path damper could be defined, but it would be a different model, especially while slack; a global body drag or cosmetic curve must not be described as preserving `ropeDrag`. Pulling a partner across the ground remains possible through tension and ground traction. Thus B satisfies *partner drag* in principle but does not preserve the existing *distributed rope damping* by construction.

## Force, work and contact ownership required by both

For an impulse J applied to a physical body, `delta v = J/m` and its kinetic work is `v_before·J + |J|²/(2m)` joules. Simultaneous impulses need the total velocity change or consistent sequential attribution; summing each impulse's work from the same initial velocity omits cross terms. The average force over a substep h is `J/h` newtons. For a consistent distance-constraint positional multiplier Λ measured in kg·m, the corresponding impulse scale is `Λ/h` N·s and force scale is `Λ/h²` N. These are not licenses to call arbitrary position-correction sums measured physical tension. Keep sign conventions, residuals, body reactions and timestep with the estimate.

A rope catch needs no extra catch impulse: the unilateral solve supplies the body momentum exchange. A rigid inelastic catch can dissipate kinetic energy. Report that impact loss separately from unexplained numerical removal; it cannot excuse a multi-megajoule correction. An impact's impulse can be stable while `delta v/h` grows as h shrinks. BELAY's `joltMps2` is acceleration-like, not jerk in m/s³; test impulse, velocity change and energy in addition to that counter.

The wall actuator defect is independent of A versus B. Every active motor axis needs a force-scaled impulse bound; lateral and vertical wall demands must share the intended tangential budget, with actual contact reaction distinguished from nominal player effort. Neither rope architecture fixes a direct horizontal velocity reset automatically.

Both require an explicit Rapier/custom-solver boundary. Advance physical time once. If Rapier has already applied body-contact impulses, treat the custom solve as an accounted incremental correction, not a second application of those same impulses. Contacts introduced by rope correction need their own reactions. A public contact-manifold query does not insert custom rope constraints into Rapier's native solve. If the incremental adapter cannot maintain a consistent combined normal/friction state, that integration problem must be resolved before either architecture is accepted. [Rapier contact graph and manifold documentation](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/)

Use a common ledger:

```text
E = body K+U + rope K+U (A only) + declared elastic energy
R = E_after - (E_before + W_active + W_moving_boundary - D_declared)
```

Static passive contacts supply no external work. Record impact/friction/damping dissipation and numerical corrections separately. Gravity belongs in U, so do not add gravity work a second time. A moving obstacle's work must follow its actual motion and reaction; a topology edit on static geometry is not a moving energy source. Preserve raw pre/post positions, velocities, energy and signed motor work. Check unexplained gain against the existing tolerance, and expose excessive unexplained loss rather than hiding it as friction.

B's absent rope-energy terms are a change of model, not evidence that numerical energy error improved. In the saved row 73 fault, most of the pre-clamp energy was in the bodies; removing rope mass does not by itself establish a valid body budget.

If final potential energy alone exceeds the available budget, velocity scaling cannot restore feasibility. Reject or backtrack that positional trial. A finite solver may find no admissible state, particularly after contact topology changes. Bound attempts and retain a solver-failure record plus the last valid state; do not extend material, move bodies through terrain, zero velocities at invalid positions, declare recovery or count the run as valid evidence. Retrying an uncommitted substep is local numerical transaction handling, not network rollback of published history. It must not create an indefinite in-game freeze disguised as success.

## Expected cost — no measured performance claim

Let n≤6, S=n−1, m=12 segments/span, N=n+(m−1)S, R=mS, C be active contacts, H be candidate terrain features, K the bounded solver iterations and b the bounded trial count. Let P be B's total geometric guide nodes, capped separately. Collision discovery is additional to constraint iteration.

| Cost component | A | B |
| --- | --- | --- |
| Main state | N particle/body states plus contact/multiplier state; N=61 at six bodies. | Six body states plus P algebraic guide positions/features/history; no free-rope velocities. |
| Constraints | R=60 material edges at six bodies, plus contacts and any justified redundant constraints. Current code actually visits 175 length constraints/pass including redundant ones. | S≤5 total routed-length constraints, plus body contacts and guide-geometry/reaction conditions. |
| Local evaluation | Roughly O(K b (R+C)) for bounded sweeps/residual checks, before collision queries. A coupled linear solve can dominate this. | Route length/gradient evaluation O(S+P) per trial; coupled body/contact work remains. Route discovery and release can dominate. |
| Geometry | Body and segment queries; naive feature scanning scales with (N+R)H. Spatial indexing changes practical cost, not the need to test segment interiors. | Path-edge queries; naive scanning scales with (S+P)H. Exploring alternative 3D routes can branch heavily. A bounded local search does not guarantee finding a feasible route. |
| Memory/cost risk | Conditioning, contacts, nonlinear retries and factorization fill. | Topology churn, slack-state additions, friction/material bookkeeping and search. |

These are evaluation counts, not proven runtime bounds for a completed implementation. A dense coupled solve can cost cubic time in its unknown count; a sparse/block method's fill and convergence depend on the contact graph. The smaller body system in B may be attractive, but its contact-node unknowns are not free and its missing slack physics cannot be omitted from a claim of equivalent cost. No millisecond, p99, room-capacity or memory-budget forecast is justified here. The frozen full 1,000 run qualifies neither future architecture.

## Minimal falsification fixtures for a later authorized implementation

The following are specifications, not new executed tests or sweeps. Start with the state-information check for B before spending implementation effort. Then use the analytical and failure-path fixtures before the saved counterexamples. Every acceptance ceiling and failure must remain visible.

| Fixture | Smallest useful setup and falsifier |
| --- | --- |
| Free-slack state distinction | Same two harnesses, same L and no guides; two collision-free material-chain states have different free-rope shape or velocity. A must retain those states and their damping response. Basic B cannot distinguish them. Decide explicitly whether that lost behavior is permitted; rendering two curves does not resolve the mechanics requirement. |
| Unilateral catch primitive | Test a two-body length-constraint primitive with no internal particles, gravity or contacts: 80 kg per body, L=3.6 m, initial separation 3.5 m, velocities −1/+1 m/s along their line. No tension for 0.05 s; at ideal inelastic catch each receives 80 N·s toward the other, velocities become zero and 80 J is dissipated. This is an analytical solver-unit fixture, **not** a claim that A's massive slack rope has identical take-up transients. Test A's complete chain separately with its material state retained. |
| Shared middle / slack isolation | Three 80 kg bodies, both intervals just taut, outer velocities −1/+1 m/s and middle velocity zero. Symmetric impulses leave the middle's net velocity zero. Repeat with one interval slack and reject an instantaneous direct body-to-body constraint across that slack interval. Distinguish legitimate local rope-inertia forces in A from such a direct coupling. Record both span reactions on the same body DOF. |
| Lip creation/release and material audit | Two bodies sweep a taut span over one radius-expanded lip, reverse, then introduce slack; repeat obliquely in 3D. Check interior clearance, continuous contact order/path, no route jump or persistent false snag, unchanged material, and no static-boundary work. For B, a scalar slack value without an adequate contact-history rule fails this fixture. |
| Guide load and support removal | One taut bend with known incoming/outgoing tangents: verify obstacle load `T(t_next−t_prev)` and endpoint/reaction balance. Remove its supporting bridge at a substep boundary; body state must remain continuous and gravity advance once. If frictional rope contact is claimed, add a single sliding/reversal case and account for unequal tensions and dissipated work. |
| Deliberate infeasibility / exhausted budget | Fixed harnesses with a radius-expanded rectangular obstacle whose shortest permitted planar route is `1+2 sqrt(2)=3.828427 m` but material is 3.6 m; prevent shorter out-of-plane detours. Require a bounded explicit failure, no material extension and no success snapshot. Separately exceed the declared contact-node/discovery budget; dropping a constraint to continue is a failure. |
| Existing four counterexamples | Replay row 73, row 237 and original two/six-player recovery inputs with equal horizons. Require no new length/contact failures and a defensible energy/position budget across all cases, not just a lower row 73 peak. For B, declare which old particle metrics are not representable and provide an approved equivalent material/geometry test; “not applicable” is not a pass. Retain the motor-only force violation independently. |

Before any later core decision, review (1) whether B's loss of dynamic free-rope state is acceptable under the brief, (2) which contact/friction and material-flow assumptions apply, (3) the contact-solver ownership and bounded failure behavior, and (4) falsification results followed by measured CPU/memory and human feel. Until that decision, A and B remain two reviewable directions; the required solver and frozen source are unchanged.
