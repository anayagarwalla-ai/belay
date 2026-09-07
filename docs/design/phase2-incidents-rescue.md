# Phase 2: physical incidents with active rescue roles

**Design proposal only.** Gate 1 has not passed. Implement this only after the user's explicit Gate 1 pass; complete the human rescue check before Phase 3. The [plan](../../PLAN.md) and [configuration convention](README.md#evidence-and-configuration-convention) govern this document. No re-cut iteration budget is proposed.

## Existing behavior and the required seam

[BelaySimulation](../../shared/simulation.ts) currently creates exactly two bodies on an effectively endless flat collider. Its rope has one particle span, floor clamps, a redundant endpoint constraint and a scalar correction-derived tension estimate. [motorVelocity](../../shared/movement.ts) currently makes brace target zero horizontal velocity. Those are Phase 1 choices, not a hidden falling implementation. Ground-level position clamps, nonnegative vertical-velocity clamps and airborne brace mass multiplication cannot be carried into a crevasse scene unchanged.

Retain server-owned simulation, bounded move/brace inputs, fixed internal `TUNING.physicsHz` steps, authority selected by `TUNING.tickHz`, no rollback, and one world per room. Extend to ordered harnesses joined by adjacent rope spans. A middle harness is **one body and one solver degree of freedom** shared by both spans, never two independent endpoints with separately applied corrections. A span's material length remains fixed; hauling does not reel in a hidden winch.

This design's central hypothesis is that rescue can come from changing support and rope geometry with the same controls. It is not yet established that this is fun, or that all six positions can stay meaningfully involved. The static-role scenes below are designed to falsify that hypothesis early.

## State model: observation follows physics

Use orthogonal state rather than one giant mutually exclusive enum. Each body has `support = surface | wall | none`, `motion = supported | falling | suspended | climbing`, and a connection flag. The team has an incident episode and a run outcome. These are authoritative, versioned snapshot fields derived from contacts and motion; a client cannot request “caught,” “rescued” or a bridge collapse.

| State/transition | Physical predicate | Consequence |
|---|---|---|
| Supported travel | Valid load-bearing surface contact and body clearance | Existing move behavior; brace uses available support traction |
| Surface → falling | Support disappears or body leaves the supported lip, and downward motion exceeds the root-profile detection tolerance | Emit one fall onset with body, span, surface and tick identifiers; gravity already acts |
| Falling → suspended/caught | A taut rope's upward resultant arrests descent without valid standing support | Emit catch only after the bounded contact/motion confirmation window; apply no separate “catch impulse” |
| Falling/suspended → climbing | Body reaches usable wall contact and directional input produces upward contact-tangent motion with rope support | Climb through contact-limited motion, not position interpolation or a progress meter |
| Suspended/climbing → falling | Loss of wall support or increased slack allows renewed descent | Mark relapse within the same episode; do not spawn an independent run incident |
| Suspended/climbing → supported | Swept body clears the rim and establishes valid standing contact for the root-profile recovery window | Body has recovered; rope load still matters for other casualties |
| Incident → recovered | Every casualty is supported and the team is stable for the confirmation window, with no new linked fall | Close one incident episode and record its attempts/cascades |
| Run → unrecoverable | All bodies cross a level's explicit out-of-world terminal boundary, or a validated scene-specific geometric impossibility is established | End with a recorded reason; a long suspension or everybody being below the rim is not sufficient |

Do not kill a team because a rescue exceeded the target duration. If a hanging stalemate has no mathematically reliable reachability test, leave it recoverable and provide an explicit player restart/end-run action in test tooling. Record a voluntary abandonment separately. A generic rescue timeout would hide a design failure.

Proposed event shape: `{epoch, eventId, tick, substep, kind, incidentId, bodyIds, spanIds, surfaceIds, observations}`. Event IDs are monotonic within an epoch; presentation deduplicates by epoch/ID and state survives missing an event. Debug resets invalidate the prior epoch. Historical events must not retrigger audio, slow motion or recorder arming after reconnection. Input-sequence acceptance and expiry remain server decisions.

## Move and brace in each support condition

| Situation | Move | Brace modifier | Why an action change matters |
|---|---|---|---|
| Safe surface | Accelerate in camera-relative ground direction | Increase contact-limited traction and resist the rope; preserve the familiar stationary catch | Release to take a hauling step, then rebrace at a better stance before the next load transfer |
| Surface near the lip | Reposition along/away from the lip, using the same ground mapping | Resist sliding while a partner changes position | The next stance changes the line angle; remaining planted can obstruct the climber's exit |
| Unsupported in air | No ground motor and no mid-air thrust | No extra anchoring mass or traction without a contact | The faller must approach a reachable wall through rope swing/partner motion; brace alone cannot levitate |
| Usable wall contact | Ground-input direction projected into the wall's local travel frame: toward wall means up, away means down/release, lateral means traverse | Engage a contact-limited planted stance; release/reapply while moving to the next foothold | Climber supplies upward motion only while supported; climber must select footholds and exit direction |
| Crossing the rim | Continue the contact-frame motion, blending back to ground mapping when standing support is valid | Catch a slip but do not snap to a standing pose | Hauler makes room and climber clears the collision geometry together |

Wall control mapping is a proposal to test for surprise: show a small neutral direction cue in the grey-box test, and ask the climber what they expected before explaining it. Do not interpret “move toward wall” as a new button or automatic climb. The contact frame must remain stable at corners; a small surface-normal change must not reverse controls.

Surface traction has a physical upper bound from the support normal impulse and friction. No stamina decay, forced button cycling, timed rescue bonus, mandatory role assignment or invisible immunity is used to manufacture activity. If holding brace throughout is a successful, dominant rescue role, the design fails even if other people move.

## Force and contact flow

Conceptual flow within each fixed internal step:

```text
accepted move/brace + prior solved support
    → bounded contact-relative motor effort + gravity
    → Rapier contact/CCD prediction
    → shared harness/rope constraint solve ↔ terrain contact projection
    → coherent body position and velocity commit
    → support reaction/load accounting
    → queued bridge transitions for next substep
    → fall/catch/recovery events and visual cue state
```

The coupled arrow is an implementation task, not a claim that Rapier exposes a callback inside its contact solver. Proposed adapter: advance Rapier once for the substep, copy predicted bodies into a working array, alternate unilateral rope corrections with conservative body/rope terrain sweeps using the committed terrain geometry, then commit the corrected states once. New bridge topology is applied at a substep boundary. Do not call `world.step()` again per rope iteration, which would advance gravity/time repeatedly.

For adjacent rope nodes, define `C = distance(a,b) - materialLength`. Correct only when `C > 0`; slack never pushes. Accumulate each harness's corrections from all connected spans before committing. Brace-dependent effective inverse mass is contact- and direction-dependent: use the reduced mobility only in supported tangent directions and only while the corresponding traction budget can supply the reaction. Normal separation and unsupported directions retain physical mobility. When demanded support exceeds that budget, release the excess into body slip and repeat the coupled solve. A wall stance cannot create an infinite fixed anchor.

Compute a diagnostic constraint impulse from the accumulated corrections and step size, retaining span direction and sign convention. Do not sum absolute corrections across solver iterations and call it an accurate physical force. The existing `tensionN` is an estimate tied to the solver and effective masses, not a calibrated load cell. Report the estimate, iteration count, contact projection work and residual constraint error together. Use smoothed tension only for display; never delay the physical catch until a UI threshold is crossed.

Track gravity, motor work, body kinetic/potential energy, traction dissipation and rope/contact correction work as a diagnostic budget. A catch must exchange momentum through the rope and supported bodies. Reject energy growth without explainable motor/gravity work, double-applied harness impulses, deep penetration or solver divergence. Contacts added by external PBD correction need explicit reaction accounting; ordinary Rapier contact impulses alone do not include work performed later by that custom correction pass.

Rapier documents contact manifolds and impulse access, and its JavaScript `World.contactPair()` callback identifies flipped manifold orientation. Copy needed scalar/vector observations inside the callback; do not retain transient manifold wrappers. These APIs provide data for a contact adapter, not an already coupled BELAY rope solver. [Rapier advanced collision detection](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/), [World.contactPair](https://rapier.rs/javascript3d/classes/World.html#contactPair), [TempContactManifold.contactImpulse](https://rapier.rs/javascript3d/classes/TempContactManifold.html#contactImpulse).

Rapier CCD uses motion clamping to prevent fast bodies missing contacts. It does not certify arbitrary translations made after the Rapier step. Sweep the proposed correction against lips/walls and check penetration after commit; a post-step teleport cannot be excused by `setCcdEnabled(true)`. [Rapier CCD](https://rapier.rs/docs/user_guides/javascript/rigid_body_ccd/).

Rope particles require terrain collision rather than the current floor clamp. Adjacent spans must follow the lip rather than cut through it. Keep long-range distance constraints only as conservative length inequalities; do not replace the routed rope path with a straight visible line through rock. Start with non-wrapping grey-box lip geometry and explicitly test snags; complex multi-wrap friction is not assumed solved. A scene that requires unimplemented wrapping is ineligible for the human rescue check.

## Hidden bridge load and legibility

Proposal: each generated bridge patch has fixed seeded capacity, compliance and overload memory, plus a visible surface identity. Capacity is chosen at generation, never rerolled because a player enters. The server computes supported downward load from final contact reactions, distributed by contact location. Include reactions introduced by custom rope/contact correction; exclude airborne body mass unless transmitted through actual support. Separate instantaneous landing impact from sustained overload in the root profile. Geometry distributes loads across patches; it must not charge a whole body's weight to every overlapping contact.

Slow approach gives players time to see deformation, seam opening and the relation between crowding and support. Brace gives a steadier view/contact, so hints become clearer; it does **not** make capacity bigger, lower the body's weight or guarantee safety. A bracer can add load while making it easier to read. Grey-box visual displacement/contour changes and directional rope indicators are enough to test this before art/audio.

Keep the diagnostic capacity/load series server-side during play. Send a coarse cue state computed from the same physical bridge state, independent of player blame. Hidden means absent from ordinary presentation; do not claim cryptographic secrecy if a published seed can regenerate capacity. A later anti-cheat decision would need a separate private hazard seed and client-data audit.

Every evaluated fall needs an evidence row: cue began on server; cue first rendered on each affected client; last supported state; each support reaction; bridge failure tick; fall onset; actual RTT/jitter; camera visibility; observed player explanation. Compare time-to-contact with actual cue availability. If the cue reached a client after the fall, “the server warned you” does not make the fall legible.

Expose sequence and participation, not a culprit score. “The bridge failed while these bodies loaded it, then this span caught the fall” is supportable. “Player 3 caused the wipe” is not established by largest load, last footstep, strongest tug or correlation in a tape. A controlled replay with one input changed is a model intervention, useful for debugging sensitivity; it still does not establish moral blame or what a human could perceive under their network conditions. In the player debrief, collect explanations before showing hidden telemetry.

## Active roles for teams of 2–6

Role names below are observer shorthand, not classes or UI assignments. Number players along the actual rope. Mirror the scene and rotate which harness falls; do not reserve “interesting work” for the leader. Moving the far end only matters once slack is managed through its adjacent spans; local movement on slack is not rescue contribution.

| Team | Concrete rescue choreography to test | Static-role counterexample that must be tested |
|---|---|---|
| 2 | P1 catches on a safe patch, releases into an away/lateral hauling step, rebraces as P2 traverses/climbs the wall, then changes line angle to clear the rim. P2 finds contact, moves up, replants and steps out. | If P1 can hold Space for the whole rescue while P2 walks up, that scene fails. Also test an unsupported hanging P2: P1 must be able to change the rope geometry to reach a wall. |
| 3 | With P2 down between banks, P1 and P3 alternate catch and reposition to share load and make room; P2 traverses toward the bank whose exit is clear. Both banks must participate in the transfer. | A permanently planted far-bank body must not be the best policy. Test a same-bank fall too, so only the special straddled case is not mistaken for general success. |
| 4 | P2 falls; P1 moves the upstream line, P3 catches then shifts away from the lip, P4 takes up downstream slack and advances the support position as P3 moves. P2 climbs/traverses. | If P3 alone rescues while P4 remains slack or static, the far-tail role has failed even when the team succeeds. |
| 5 | P3 falls; P2/P4 manage the two lip angles, while P1/P5 alternate taking up slack and moving their respective support chains. P3 chooses the viable wall/exit. | Freeze each tail separately; determine whether that body had a purposeful transition or merely decorative motion. |
| 6 | P3 falls; P2/P4 alternate the immediate catch and haul; P1 changes the upstream support position; P5 then P6 move the downstream support chain and relay load while P4 clears the exit. P3 actively climbs. | Freeze each of P1/P5/P6 and also all remote helpers. If remote helpers are unnecessary passengers or their best action is continuous brace, stop. |

These are hypotheses about suitable terrain and support geometry, not scripted role gates. The terrain generator should produce visible alternative stances and traversal room that make changing line geometry useful. It must not secretly disable recovery until every player presses a key. If ordinary geometries repeatedly admit passive helpers, revise the geometry/physical action model and recheck with humans. Do not make bridges unpredictably collapse simply to force a tail to move.

For each size test head, middle where present, and tail falls, both same-bank and split-bank situations where geometrically possible. Include novices changing roles. Evidence for a choreographed four-player success is not evidence for two- or six-player agency.

## Cascades, attempts and metrics

An **incident episode** starts at the first physical fall before stable team recovery. A **cascade** is an additional body's fall linked to the same unresolved rope/support disturbance; record onset order, added casualties, peak simultaneous unsupported bodies and apparent physical link. Concurrent unrelated bridge failures remain separately identified, with an overlap relation. Do not relabel every extra casualty as an independent incident to improve recovery percentages.

An **attempt** is a continuous catch/haul/climb recovery effort within an episode. First-attempt success requires complete recovery without a casualty relapsing after an established catch/climb or adding a cascading casualty. A relapse or cascade marks the first attempt failed and begins a further effort, without resetting the run or erasing time. Preserve raw transition events so this definition can be reviewed. Cases with no catch before terminal loss are failures, not missing attempts.

| Contract metric | Operational definition and required reporting |
|---|---|
| Normal rescue 10–20 seconds | From first fall onset to confirmed stable team recovery; report complete elapsed duration, its distribution, and unsuccessful/censored episodes separately. Define the preregistered normal-scene set before seeing outcomes. Never exclude slow successes because they missed target. |
| First-attempt recovery 60–75% | First-attempt successes / all started eligible incident episodes. Report numerator/denominator by team size, scene and first exposure. |
| Eventual recovery 88–92% | Episodes recovered before run termination / all started eligible episodes, including cascades and repeated efforts. Technical interruptions are disclosed as censored, with a conservative failure-inclusive sensitivity result. |
| Approximately 60–72% four-incident completion | Measure runs with four prescribed incidents directly. As arithmetic only, `0.88^4 ≈ 0.600` and `0.92^4 ≈ 0.716`; independence is a hypothesis, not a reason to infer run success from episode averages. Shared fatigue/learning/terrain can correlate failures. |
| Incidents 3–6/run; first incident under 45 seconds | Episode counts and run-start-to-first-fall wall/simulation times; show no-incident and prematurely ended runs explicitly. |
| Median run 5–10 minutes | Start-to-shelter/unrecoverable team; keep abandonment and technical interruption visible as competing outcomes, not silent exclusions. |
| Every player's rescue idle fraction ≤20% | For each participant and episode, idle wall time / entire episode wall time while participating. Include connected players with no available useful role; that is a design failure. Also report simulation-time fraction and disconnect time separately. Never use only a team average. |

For idle measurement record three channels: input inactivity, continuous unchanged input, and **functional inactivity**. Functional activity means an action or adjustment is physically contributing to support transfer, usable slack reduction, path/line-angle change, wall ascent or exit clearance. A catch stance briefly held while a partner moves can count; holding it throughout is a static role and fails the stop condition regardless of aggregate idle percentage. Key tapping and movement while mechanically irrelevant count as idle in observer coding. Predefine the measurement window/tolerances in root tuning, retain observations, and report disagreement between telemetry proxies and human coding rather than calling telemetry causal proof.

Each episode record includes tuning/config hash, seed, level version, authority/internal rates, players' familiarity, input tape truncation, network measurements, state transitions, ordered span/contact data, per-player action intervals, user quotes and observer coding. Aggregate confidence intervals and denominators accompany percentages; targets are not observed facts. Deterministic scene checks and scripted policies establish mechanics only.

## Stop-condition scene suite

All scenes begin as grey boxes loaded through future operator tooling. Scene definitions and any thresholds belong in the root configuration/profile; the existing Phase 1 `loadScene()` must continue rejecting them until Phase 2 is authorized. Run bounded deterministic mechanics checks first, then humans without revealing the expected solution.

| Scene | Setup/intervention | Required observation or stop trigger |
|---|---|---|
| Load contrast | Same seeded bridge, one crossing alone, then coincident loading, then slow/brace approach | Capacity is stable; reactions explain the load change; humans can name a prior cue without being shown capacity. “Random hole” explanations trigger the arbitrary-fall stop. |
| Late cue | Same incident across measured RTT conditions and a camera-occluded approach | Log actual rendered warning lead time. Stop if falls become arbitrary to the affected player; do not blame the network user. |
| Slack → catch | Step off with real slack, then taut catch with helper supported/unbraced/braced | Free fall precedes catch, reactions and helper skid change physically, no teleport or impulse applied twice. |
| Air brace | Repeat catch while helper loses support; faller holds brace in open air | No airborne anchor or motor. Invalid support mass/traction blocks the human scene. |
| Lip and corner | Fast catch and oblique haul around the rim | Sweeps prevent PBD tunnelling, rope remains outside terrain and the wall control frame does not flip. |
| Two-person exit | One helper and one climber, both starting on the same bank | Both must change action to finish; continuous-brace helper success triggers the static-role stop. |
| Tail relay | Each team size, rotate the faller and freeze each helper's policy in turn | Every player has a meaningful transition; far-tail slack spectators trigger the same stop. No extra mandatory key press to pass. |
| Cascade catch | Initial catch pulls the next climber off; another stance remains available | Additional fall is a linked cascade; recovery remains possible through changed actions; wipe is not preordained by script. |
| Relapse and reset | Climber loses wall contact after an established catch, then is recovered | One episode, failed first attempt, eventual success, uninterrupted elapsed rescue time. |
| All below rim | Everyone is below the top with reachable wall support, then contrast a terminal-boundary fall | First scene remains recoverable; only the explicit terminal condition ends the second. |
| Human comprehension | Show fall/recovery without debug overlays, ask each participant what changed and what they did | Any arbitrary-fall report or static rescue role requires stopping and re-cutting before Phase 3, followed by a human recheck. |

Numerical root keys still needed: bridge capacity/distribution and overload response; contact/rope tolerances; supported mobility and traction coupling; wall motor/frame transitions; fall/catch/recovery hysteresis; terminal scene boundaries; contribution coding windows; event/incident evidence bounds; scene profiles and the already approved Phase 2 metric targets. No numerical defaults for those are set here.

Implementation order after Gate 1: generalize harness topology and contact adapter; validate falling/CCD/energy; add bridge cues from load; build the two-player rescue; test every added team size and cascade; collect the human stop-condition verdict. **If falls read as arbitrary OR any role is a static hold, stop and re-cut Phase 2. Phase 3 stays blocked; the re-cut budget remains an open user decision.**
