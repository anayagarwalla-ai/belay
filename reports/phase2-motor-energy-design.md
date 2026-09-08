# Wall motor and energy diagnosis: two independent defects

The saved re-cut counterexamples expose an unbounded wall actuator and a separate rope/contact projection failure. Row 73 contains no wall actuation, yet its worst step displaces the casualty 4.37 m, removes 2.81 MJ of kinetic energy, and leaves 3.56 kJ of excess potential energy. Reducing nominal wall effort cannot fix that case. Row 237 exposes the horizontal velocity reset: its implied actuator force reaches 46.46 kN at the 450 N setting and 23.38 kN on the retained 900 N baseline.

This is a diagnosis and proposed design, not a mechanics patch or acceptance claim. Runtime source, topology, iteration limits, tolerances and current 900 N setting are unchanged. The proposed impulse primitive is used only by diagnostic tests. No new topology candidate was run.

## Reproduction and scope

Row numbers here are **one-based**: row 73 is `rows[72]`, row 237 is `rows[236]` in the original 250-row re-cut matrix. The compact fixture records its SHA-256, exact initial positions, policy, decision cadence, input digests and source diagnostics. Both cases use seed 1701, ice and same-bank helpers. Row 73 has three players, casualty 2, idle casualty and moving helpers. Row 237 has six players, casualty 0 and helpers holding brace.

The probe exports runtime commit `f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1` into disposable directories, changing only the exported nominal wall parameter for the 450 N comparison. Recorded initial positions enter rigid-body descriptors before construction; initial ice geometry is set before the first step. No body is teleported after simulation starts. Policy decisions occur every 0.5 s; inputs are held for 30 physics steps. The horizon is 30 s, ending earlier only for the existing recovery/terminal conditions.

Each observed run is compared with an unobserved control: **5,697 matching intermediate/final snapshot pairs**, excluding only `serverTime`. Both 450 cases exactly match their original matrix input SHA and native maximum energy-removal/potential-excess diagnostics. Reconstructed projection maxima differ from native diagnostics by at most 2.28e−13 J; motor-work deltas differ by at most 3.64e−12 J. These validate observation, not mechanics.

| Case | Nominal effort | Observed ticks | Wall actuator calls | Maximum horizontal actuator force | Maximum kinetic removal | Maximum remaining potential excess, native diagnostic | Ending |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Row 73 | 450 N | 1800 | 0 | No wall actuation | 2,808,519.502 J | 3,561.911252 J | Censored at 30 s |
| Row 73 | 900 N | 1800 | 0 | No wall actuation | 2,808,519.502 J | 3,561.911252 J | Censored at 30 s |
| Row 237 | 450 N | 297 | 363 | 46,461.571 N | 1,355.654 J | 0 J | Failed at 4.95 s |
| Row 237 | 900 N | 1800 | 8211 | 23,381.329 N | 1,355.654 J | 0 J | Censored at 30 s |

Row 73's maximum final segment excess is 0.018807844 m, within the existing 0.02 m ceiling, despite the energy failure. Row 237 reaches 0.090636560 m under both settings. Neither a recovered incident nor a passing segment bound establishes physical validity. Different horizons and state-dependent decisions also prevent treating row 237's profile comparison as a matched-duration performance score.

The raw report retains per-step budgets plus full witnesses for peak wall force, kinetic removal, post-projection energy residual, route displacement and individual constraint displacement. Rapier manifold impulses are queried immediately after its step; these do **not** include later custom rope/contact corrections. The retained peak witnesses have no nonzero sampled manifold impulses. This does not establish zero total contact reaction. Rapier distinguishes potentially contacting pairs, geometric contacts and solver contacts; contact impulse information belongs to the narrow-phase manifold. [Rapier collision-detection documentation](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/)

## Row 73: energy projection cannot repair a position error

At physics tick 366, 6.10 s, both wall settings produce the same failure. The two helpers' ground motors contribute 8.072901976 J; casualty 2's wall input is REST and contributes zero. The substep starts with total body+rope energy −61.088667948 J. The existing 0.01 J tolerance permits a final budget of −53.005765971 J. Negative energies reflect the arbitrary height datum and are valid.

Immediately after Rapier, total energy is −53.817701175 J and the casualty is at y=−1.100182176 m. Subsequent custom projection commits it at y=3.267549992 m, a 4.372695890 m displacement including horizontal movement. Another body moves 0.472816811 m. The maximum body velocity presented to the commit setter is 262.625463 m/s, and maximum rope-particle speed before the energy clamp is 229.835085 m/s.

Before the clamp, body kinetic energy is 2,789,568.452046 J and rope kinetic energy is 18,951.050372 J. Body potential is 3,465.883184 J and rope potential is 43.022302 J. The existing calculation is:

```text
B = E_before + W_motor + tolerance                         [J]
A = B - U_after                                          [J]
K_allowed = max(0, A)                                    [J]
s = sqrt(K_allowed / K_before_clamp)                     [dimensionless]
```

Here A=−3561.911252 J, so s=0. All body velocities and rope Verlet displacement velocities become zero. Positions stay fixed. The actual final total energy is 3508.905492535 J, leaving **3561.911258507 J above B**. The 6.49e−6 J difference from the native potential-excess diagnostic is from double-precision accounting versus committed Rapier body positions. The excess remains even with K=0; a kinetic-only correction cannot satisfy U>B.

The diagnostic `maximumUnexplainedEnergyGainJ` remains zero because it checks the earlier Rapier/prediction stage. The maximum speed counters are updated after velocity scaling. Those measurements do not expose this position jump; the separate potential-excess field does. Row 237's reconstructed final residual is much smaller: 2.54e−4 J at 450 N and 5.83e−5 J at 900 N, with native potential excess zero. Those small rounding differences are retained, not substituted for row 73's material defect.

The largest individual `constrain` call at tick 366 joins rope node 21 to casualty harness node 2 with maximum distance 1.20 m. It starts at distance 7.935491 m and ends at 62.824174 m. Node 21 moves 62.849729 m in x. This call increases its own distance error before later iterations pull the nodes back.

The stored direction is (0.0343161,−0.9956267,−0.0868902). Cached ground/wall normals restrict the 0.2 kg particle's inverse mobility to (5,0,0) kg⁻¹; the 80 kg body's inverse mobility is (0.0125,0.0125,0.0125) kg⁻¹. The direction-weighted denominator is 0.0183879806 kg⁻¹, so the linearized multiplier `(distance−maximum)/denominator` is 366.298572 kg·m. Its particle correction in x is 62.849729 m. The particle is already at y=6.856848 m while its cached normals still include the upward floor normal and bank normal: those normals were computed at the iteration start, before other constraint updates moved it.

This shows an overshooting linearized solve with restricted mobility and stale contact information within an iteration. It does not establish that this one call caused every preceding disturbance. The same substep includes a 0.334167 m lip-routing jump. Simply changing route order or clipping that one correction is not demonstrated to yield a feasible coupled solution. The earlier two rejected topology candidates remain rejected.

## Row 237: horizontal velocity targets bypass force bounds

For mass m=80 kg and timestep h=1/60 s, each motor setter implies:

```text
J_motor = m (v_requested - v_before)                      [N·s]
F_motor = J_motor / h                                    [N]
W_motor = 0.5 m (|v_requested|² - |v_before|²)             [J]
        = v_before · J_motor + |J_motor|² / (2 m)
```

These are actuator changes observed before Rapier and custom projection. They are not an estimate of the wall's passive normal force. Forces act over a timestep, whereas impulses change velocity directly; the intended force limit therefore needs a timestep-scaled impulse limit. [Rapier forces and impulses](https://rapier.rs/docs/user_guides/javascript/rigid_body_forces_and_impulses/)

The current vertical branch limits effort to ±μ·N_nominal, with μ=1.3: 585 N at 450 N and 1170 N at 900 N. Horizontal components are assigned directly from lateral speed and a 0.45 m/s wall-press target. Even a zero→−0.45 m/s press implies 2160 N. Bracing also sets lateral velocity to zero instantly.

At 450 N, tick 203/player 5 enters the motor with velocity (−8.048180,−0.725492,4.927677) m/s and requests (0,−0.603617,−0.45) m/s. This implies normal force −25,812.848 N and lateral force 38,631.262 N, totaling 46,461.571 N horizontally. The vertical component is correctly capped at 585 N. The signed motor work is −3560.587120 J: strong braking still violates a force bound even though it removes energy.

At 900 N, tick 204/player 3 enters with (4.850280,−3.228554,0) m/s and requests (0,−2.984804,−0.45) m/s. Horizontal force is 23,381.329 N, including 2160 N of press and 23,281.343 N lateral braking; vertical force is 1170 N. Signed motor work is −993.488800 J. The retained 900 N runtime therefore shares the defect.

## Proposed formulation and implementation sequence

Use a wall-normal unit vector n and tangent projector P=I−nnᵀ. Keep player effort distinct from passive contact reaction. Start from velocities predicted with known external forces, including gravity once, and express every actuator update as a bounded impulse.

1. **Bound active press.** With outward n, project the requested inward impulse onto `−F_press,max h ≤ J_press·n ≤ 0`. A 900 N press permits 15 N·s, or 0.1875 m/s per 60 Hz step for 80 kg. A 450 N press permits 7.5 N·s, or 0.09375 m/s. Define any active push-away action explicitly with its own signed bound; never reset normal velocity to a fixed target.
2. **Share tangential capacity.** Form `J_t,desired = m P(v_goal − v_predicted)`, including both lateral and vertical demands. Project its vector magnitude onto `min(F_t,motor,max h, μ J_n)`. Here `J_n` is the solved compressive contact impulse, not nominal effort or a geometry-proximity flag. A provisional tangential motor capacity of μ·F_press,max preserves the current nominal 585/1170 N scale for evaluation; it is a design parameter, not a measured contact force or accepted tuning. At 900 N, an 80 kg body's 784.8 N weight consumes part of vertical capacity. Lateral braking and climbing cannot each consume the full vector budget.
3. **Solve reaction and rope together.** Contact obeys nonnegative gap, nonnegative normal impulse, complementarity, and a tangential friction cone. Rope lengths are unilateral upper bounds with tensile multipliers. Share body/harness degrees of freedom and solve the contact/rope multipliers consistently. Passive impact or rope-induced reaction may exceed the player's 900 N effort; do not cap all contact reaction to the motor limit. A previous-frame reaction estimate can be stale at contact transitions. Decide whether Rapier or the custom solve owns wall friction: native collider friction 0.08 and the controller's 1.3 coefficient currently belong to different stages, so silently adding another friction impulse would double count support.
4. **Make nonlinear steps acceptable before commit.** Re-evaluate contact activity after meaningful positional motion. Check an actual coupled constraint residual/merit function when choosing a step, rather than trusting its first-order distance prediction. Use a bounded line search or trust region with rollback for rejected updates. A single constraint correction that expands 7.94 m to 62.82 m should not be accepted. Keep the existing solver cap and length/penetration ceilings visible; failure to find a feasible step must remain a solver failure, not a recovery event.
5. **Enforce the energy condition on positions and velocities.** Evaluate body+rope K+U plus any explicitly introduced elastic energy. Bound it by prior energy plus actual signed actuator work and the existing numerical tolerance. Do not add gravity work again when gravitational potential is included. Track motor work, passive contact dissipation, rope exchange and numerical correction separately. If U alone exceeds the budget, reject or backtrack the positional trial and recompute consistent velocities. If no feasible trial exists within the bounded solve, retain a diagnostic failure/rollback state; zeroing velocities at invalid positions does not resolve it.

For a compliant alternative, XPBD uses accumulated multipliers and timestep-scaled compliance. For a distance constraint, compliance α has units m/N, α/h² has units kg⁻¹, the position multiplier has units kg·m, and multiplier/h² estimates force in N. Its equations 17–18 provide a possible consistent basis for force reporting. A compliance choice must also account for stored elastic energy and allowed stretch. XPBD alone does not resolve stale topology, coupled contact infeasibility or this energy failure; it is not an accepted replacement. [Macklin, Müller and Chentanez, XPBD, equations 17–18](https://mmacklin.com/xpbd.pdf)

The first future implementation should isolate bounded actuator impulses, then address the coupled projection with these fixed counterexamples. Verify force/work units and timestep behavior before expanding rescue sweeps. Preserve the earlier saved two/six-player length and interior-contact guards. Only after force, geometry, energy, replay and CPU checks pass should the all-role/counterfactual matrix and human playtest be re-cut. The current full 1000 evidence run stays on the frozen runtime.

## Diagnostic tests and reproduction commands

`tests/phase2-motor-energy.test.ts` runs the checkout's current runtime through row 73 tick 366 and row 237 tick 204. Five checks pass: fixture/observation integrity, independent work/budget reconstruction, and three analytical force/impulse examples including 30/60 Hz consistency. Four tests are explicit expected failures: potential-budget feasibility, individual constraint-distance reduction, normal motor bound, and shared tangential motor bound. The latter two state proposed actuator requirements; they do not mislabel the nominal parameter as a measured contact reaction. Passing the test runner with expected failures is not a mechanics pass. After a real fix, remove the corresponding `fails` marker and review the broader evidence.

The full probe uses the pinned historical engine so evidence remains reproducible after runtime work resumes. In a fresh published checkout, import its historical bundle first because API publication may preserve trees without preserving original commit IDs:

```sh
git bundle verify reports/phase2-baseline.bundle
git fetch reports/phase2-baseline.bundle refs/heads/codex/evidence-baseline:refs/remotes/evidence/phase2-baseline
git rev-parse --verify 'f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1^{commit}'
npm ci
npx tsx scripts/phase2-motor-energy-probe.ts
npx vitest run --config vitest.config.ts tests/phase2-motor-energy.test.ts
```

The rev-parse result must equal the pinned baseline above. The bundle and its published manifest come from the integrated evidence package; no pre-existing local branch or other task's worktree is required. The probe reconstructs the two cases from the included compact fixture and does not require the 19 MB original matrix. `phase2-motor-energy-manifest.json` records source/fixture/report hashes and validation results. `phase2-motor-energy.json` preserves unrounded observations; this report rounds presentation only.

The raw report is stored as [lossless gzip](phase2-motor-energy.json.gz). The [compression receipt](phase2-motor-energy-compression.json) retains its original SHA-256. `gzip -dc reports/phase2-motor-energy.json.gz` reconstructs the exact raw bytes; the standalone probe still writes ordinary JSON. The current artifact manifest records packaging/link changes, and the original manifest remains alongside it.
