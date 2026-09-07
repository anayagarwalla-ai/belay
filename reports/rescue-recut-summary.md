# Rescue re-cut mechanical evidence

Baseline: `ad00223526c9f3ba93320bfe284c74f1f30697fd`. Commands: `npx tsx scripts/rescue-recut-run.ts screen`, `npx tsx scripts/rescue-recut-run.ts matrix`, then `npx tsx scripts/rescue-recut-summary.ts`.

**Phase 2 still fails the static-role requirement; Phase 3 remains blocked.** Subweight wall assistance removes the original all-static-helper example in the observed window, while passive helper recoveries remain. Human feel and agency are unmeasured. These are deterministic policy outcomes, not first-attempt human recovery percentages.

## Fixed screen: 32 trajectories

Recovery duration is first fall to confirmed team recovery, in simulation seconds. Censored means no recovery during 30 seconds from fixture start. Each row contains one trial per policy; no confidence/population inference applies. Contact/rope bounds use the existing 1 mm terrain, 5 mm body, 1 cm span and 2 cm segment ceilings. Energy is reported separately, not certified by that column.

| Variant | Bodies | Pull away | Fan out | Static helpers | Idle casualty | Contact/rope bounds |
|---|---:|---:|---:|---:|---:|---:|
| baseline | 2 | 2.300 | 2.583 | 2.667 | censored | 4/4 |
| baseline | 6 | 2.550 | 1.967 | 2.583 | censored | 4/4 |
| wall-450 | 2 | 2.383 | 2.433 | censored | censored | 4/4 |
| wall-450 | 6 | 2.167 | 2.117 | censored | censored | 4/4 |
| wall-300 | 2 | 2.400 | censored | censored | censored | 3/4 |
| wall-300 | 6 | 2.300 | 2.100 | censored | censored | 4/4 |
| wall-450-stance | 2 | censored | 2.467 | censored | censored | 1/4 |
| wall-450-stance | 6 | 1.767 | 2.267 | censored | censored | 3/4 |

The stance variant is rejected: successful recovery with an excessive rope residual is not a qualified success. Neither its failed straight haul nor its contact-error cases are removed from the report. The wall-450 matrix was selected analytically before outcomes; no additional tuning was performed after this screen.

## Fixed wall-450 role matrix: 250 trajectories

Canonical same-bank middle casualty. Counts are observed recoveries/trials; frozen interventions include REST and continuous brace, each helper separately and all remote helpers together where such helpers exist. The final column counts passive recoveries that also meet the contact/rope bounds.

| Bodies | Surface | Active policies | All helpers static | Idle casualty | Frozen interventions | Passive recoveries within bounds |
|---|---|---:|---:|---:|---:|---:|
| 2 | snow | 2/2 | 0/1 | 0/1 | 0/2 | 0 |
| 2 | ice | 0/2 | 0/1 | 0/1 | 0/2 | 0 |
| 3 | snow | 2/2 | 0/1 | 0/1 | 2/4 | 2 |
| 3 | ice | 0/2 | 0/1 | 0/1 | 0/4 | 0 |
| 4 | snow | 2/2 | 0/1 | 0/1 | 7/8 | 7 |
| 4 | ice | 0/2 | 0/1 | 0/1 | 2/8 | 2 |
| 5 | snow | 2/2 | 0/1 | 0/1 | 9/10 | 8 |
| 5 | ice | 1/2 | 0/1 | 0/1 | 2/10 | 2 |
| 6 | snow | 2/2 | 0/1 | 0/1 | 12/12 | 10 |
| 6 | ice | 1/2 | 0/1 | 0/1 | 6/12 | 6 |

Head/middle/tail placement coverage, combining snow and ice (near-lip includes the canonical matrix above). The raw spec's `bank: 'split'` names the centered-casualty fixture family: only interior casualties have helpers on both banks. Endpoint casualties in that family have helpers on one bank and start at the hole center; they are not evidence for a split-bank endpoint rescue. Every row retains exact initial positions.

| Bodies | Placement family | Active policies | All helpers static | Idle casualty |
|---|---|---:|---:|---:|
| 2 | near-lip | 2/6 | 0/4 | 0/4 |
| 2 | centered | 1/4 | 0/4 | 0/4 |
| 3 | near-lip | 3/8 | 0/6 | 0/6 |
| 3 | centered | 2/6 | 0/6 | 0/6 |
| 4 | near-lip | 4/8 | 0/6 | 1/6 |
| 4 | centered | 3/6 | 0/6 | 1/6 |
| 5 | near-lip | 5/8 | 0/6 | 0/6 |
| 5 | centered | 2/6 | 0/6 | 2/6 |
| 6 | near-lip | 5/8 | 0/6 | 1/6 |
| 6 | centered | 2/6 | 0/6 | 2/6 |

## Constructive static-role counterexamples

- Matrix row 38: 3 bodies, helpers on the near bank, snow, casualty P2; P3 continuously braces from tick 0 through confirmed recovery (2.400 s). Held-input verification: true. Accepted-input SHA-256: `928a599195dab3daabca3dedf4e1a5a49802a73cbb3467eeae4a8b6a2a72313f`.
- Matrix row 82: 4 bodies, helpers on the near bank, snow, casualty P3; P1 continuously braces from tick 0 through confirmed recovery (2.750 s). Held-input verification: true. Accepted-input SHA-256: `fd1ae409f48c222043bad608eaf8c38abf0fa2eb13d9c149383acad91a0d0317`.
- Matrix row 136: 5 bodies, helpers on the near bank, snow, casualty P3; P1 continuously braces from tick 0 through confirmed recovery (2.117 s). Held-input verification: true. Accepted-input SHA-256: `4ebe7802639cc9849c5d256ea4ccca978089ca187829dee7c090dab543f34ce5`.
- Matrix row 194: 6 bodies, helpers on the near bank, snow, casualty P4; P1 continuously braces from tick 0 through confirmed recovery (2.317 s). Held-input verification: true. Accepted-input SHA-256: `09513c478437e04acc03bfe995c5777fd0f707247dfed11333a36d3ea1550090`.

All remote helpers held together:

- Matrix row 88: 4 bodies, casualty P3; remote P1 continuously brace from tick 0; recovery 2.750 s, maximum segment residual 0.004998 m.
- Matrix row 144: 5 bodies, casualty P3; remote P1/P5 continuously brace from tick 0; recovery 2.200 s, maximum segment residual 0.004992 m.
- Matrix row 204: 6 bodies, casualty P4; remote P1/P2/P6 continuously brace from tick 0; recovery 2.183 s, maximum segment residual 0.004991 m.

Idle-casualty recoveries within contact/rope bounds:

- Matrix row 100: 4 bodies, helpers on the near bank, snow, casualty P4 starts at z=0.700 m and holds exact REST from tick 0; recovery 2.733 s. Accepted-input SHA-256: `4531103c651b4b9675e7f73aae8b190b827b5f08c6078beb40c78561853a0d70`.
- Matrix row 103: 4 bodies, helpers on the near bank, snow, casualty P4 starts at z=1.400 m and holds exact REST from tick 0; recovery 2.800 s. Accepted-input SHA-256: `ac5f9dc2a357120422360e97e536fd81d7fe0ff9c7cfe12efd289b718137351c`.
- Matrix row 159: 5 bodies, helpers on the near bank, snow, casualty P5 starts at z=1.400 m and holds exact REST from tick 0; recovery 2.583 s. Accepted-input SHA-256: `1aaa6a7f8dc429469bf9e3d31231efdfc9f3278e953ca9eb46052d2469b46246`.
- Matrix row 188: 5 bodies, helpers on the near bank, ice, casualty P5 starts at z=1.400 m and holds exact REST from tick 0; recovery 4.550 s. Accepted-input SHA-256: `f738a59de629a3fcf6c220f62146362d7efb5b5fc5dd07d2f6390e79821dc32f`.
- Matrix row 216: 6 bodies, helpers on the near bank, snow, casualty P6 starts at z=0.700 m and holds exact REST from tick 0; recovery 3.967 s. Accepted-input SHA-256: `80ee6d341c1805efaf4e73df65c80c05109b1b89f860e5bd299babe13bb10092`.
- Matrix row 219: 6 bodies, helpers on the near bank, snow, casualty P6 starts at z=1.400 m and holds exact REST from tick 0; recovery 2.883 s. Accepted-input SHA-256: `15de6fe210e57592575aa92d50e38b6977f07850b425c8ca036912e346fdc3df`.
- Matrix row 250: 6 bodies, helpers on the near bank, ice, casualty P6 starts at z=1.400 m and holds exact REST from tick 0; recovery 4.683 s. Accepted-input SHA-256: `217137c72f52ab4f65f1c2437d37ff787a1b8f66950b4039115c427162244120`.

There are 44 observed passive recoveries within contact/rope bounds across the full matrix. A frozen player's body may move under rope load; that is not an action change by the player. Loaded-time and motion are observational proxies, not proof of useful voluntary action. Freezing inputs leaves the body on the rope: it tests whether voluntary action changes are necessary, not whether that body’s mass or static support is necessary. No role gate masks these outcomes.

## Actual force, motion and numerical limits

Wall-450 uses a 585 N vertical wall-motor cap versus 784.8 N weight, leaving a minimum 199.8 N upward rope resultant for steady ascent. Wall-300 leaves 394.8 N. An idle casualty needs approximately the full 784.8 N from the rope. These are motor/geometry bounds in the current model, not calibrated human force measurements. Ground effort limits are 800 N on snow and 240 N on ice; nominal brace budgets are 1255.68 N and 376.704 N before consumed braking effort. The ice fixtures change ground traction, not wall material.

For the wall-450 matrix:

- Recovered rescue duration: 2.033–4.917 s; 0/76 recovered scripted trials land in the 10–20 s target. Human normal-rescue timing remains unmeasured.
- Observed wall vertical motor maximum: 585.000 N. Motor-work reconstruction error maximum: 2.037e-10 J.
- Correction-derived scalar tension maximum: 1259212.473 N; this is not a calibrated force sensor or the upward component. Sampled endpoint tangents use the routed particle path, never the straight harness chord.
- Maximum instantaneous horizontal motor force: 46461.571 N. The baseline wall press/lateral velocity assignment can exceed the nominal wall normal-effort parameter. That parameter bounds vertical tangential effort; it does not equal measured contact normal force. This limits any claim of Coulomb-consistent wall traction.
- Maximum net residual vertical force magnitude: 33412.423 N. Residual = observed momentum change minus gravity and reconstructed motor; it includes Rapier contacts, rope/contact projection and kinetic-energy correction, so it is not separately attributable tension.
- Maximum single-step kinetic-energy projection: 2808519.502 J; maximum unresolved potential-energy excess: 3561.911 J; pre-projection unexplained-energy diagnostic: 134.475 J. No energy-conservation proof is claimed.
- Maximum terrain penetration: 0.000000 m; body overlap: 0.000000 m; span residual: 0.003233 m; segment residual: 0.230510 m.
- The retained `solverIterations` diagnostic is the last substep count, not the lifetime maximum; do not use it to claim that an earlier residual converged.

91/282 trajectories across screen plus matrix exceed an existing contact/rope ceiling or report an error. Exact failures:

- Screen row 18: `{"variant":"wall-300","n":2,"casualty":1,"bank":"same","surface":"snow","policy":"fan-out"}`; ending censored, segment 0.021902 m, span 0.000000 m, overlap 0.000000 m, penetration 0.000000 m.
- Screen row 25: `{"variant":"wall-450-stance","n":2,"casualty":1,"bank":"same","surface":"snow","policy":"pull-away"}`; ending censored, segment 0.021960 m, span 0.000000 m, overlap 0.000000 m, penetration 0.000000 m.
- Screen row 26: `{"variant":"wall-450-stance","n":2,"casualty":1,"bank":"same","surface":"snow","policy":"fan-out"}`; ending recovered, segment 0.061718 m, span 0.000000 m, overlap 0.000000 m, penetration 0.000000 m.
- Screen row 28: `{"variant":"wall-450-stance","n":2,"casualty":1,"bank":"same","surface":"snow","policy":"idle-casualty"}`; ending censored, segment 0.025972 m, span 0.000000 m, overlap 0.000000 m, penetration 0.000000 m.
- Screen row 32: `{"variant":"wall-450-stance","n":6,"casualty":3,"bank":"same","surface":"snow","policy":"idle-casualty"}`; ending censored, segment 0.108691 m, span 0.000197 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 7: `{"variant":"wall-450","n":2,"casualty":0,"bank":"same","surface":"snow","policy":"pull-away"}`; ending terminal, segment 0.031788 m, span 0.000969 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 8: `{"variant":"wall-450","n":2,"casualty":0,"bank":"same","surface":"snow","policy":"static-helpers"}`; ending terminal, segment 0.031788 m, span 0.000969 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 9: `{"variant":"wall-450","n":2,"casualty":0,"bank":"same","surface":"snow","policy":"idle-casualty"}`; ending terminal, segment 0.031788 m, span 0.000969 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 17: `{"variant":"wall-450","n":2,"casualty":1,"bank":"same","surface":"ice","policy":"fan-out"}`; ending censored, segment 0.025284 m, span 0.000000 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 19: `{"variant":"wall-450","n":2,"casualty":1,"bank":"same","surface":"ice","policy":"idle-casualty"}`; ending censored, segment 0.020064 m, span 0.000000 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 22: `{"variant":"wall-450","n":2,"casualty":0,"bank":"same","surface":"ice","policy":"pull-away"}`; ending terminal, segment 0.090240 m, span 0.000664 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 23: `{"variant":"wall-450","n":2,"casualty":0,"bank":"same","surface":"ice","policy":"static-helpers"}`; ending terminal, segment 0.090240 m, span 0.000664 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 24: `{"variant":"wall-450","n":2,"casualty":0,"bank":"same","surface":"ice","policy":"idle-casualty"}`; ending terminal, segment 0.090240 m, span 0.000664 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 25: `{"variant":"wall-450","n":2,"casualty":0,"bank":"split","surface":"ice","policy":"pull-away"}`; ending terminal, segment 0.024025 m, span 0.000586 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 26: `{"variant":"wall-450","n":2,"casualty":0,"bank":"split","surface":"ice","policy":"static-helpers"}`; ending terminal, segment 0.024025 m, span 0.000586 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 27: `{"variant":"wall-450","n":2,"casualty":0,"bank":"split","surface":"ice","policy":"idle-casualty"}`; ending terminal, segment 0.024025 m, span 0.000586 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 30: `{"variant":"wall-450","n":2,"casualty":1,"bank":"split","surface":"ice","policy":"idle-casualty"}`; ending censored, segment 0.022894 m, span 0.001150 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 39: `{"variant":"wall-450","n":3,"casualty":0,"bank":"same","surface":"snow","policy":"pull-away"}`; ending censored, segment 0.101756 m, span 0.000972 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 40: `{"variant":"wall-450","n":3,"casualty":0,"bank":"same","surface":"snow","policy":"static-helpers"}`; ending censored, segment 0.031894 m, span 0.000972 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 41: `{"variant":"wall-450","n":3,"casualty":0,"bank":"same","surface":"snow","policy":"idle-casualty"}`; ending terminal, segment 0.089121 m, span 0.000972 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 42: `{"variant":"wall-450","n":3,"casualty":0,"bank":"split","surface":"snow","policy":"pull-away"}`; ending censored, segment 0.194067 m, span 0.001413 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 55: `{"variant":"wall-450","n":3,"casualty":1,"bank":"same","surface":"ice","policy":"fan-out"}`; ending censored, segment 0.021843 m, span 0.000000 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 56: `{"variant":"wall-450","n":3,"casualty":1,"bank":"same","surface":"ice","policy":"static-helpers"}`; ending censored, segment 0.038580 m, span 0.000000 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 57: `{"variant":"wall-450","n":3,"casualty":1,"bank":"same","surface":"ice","policy":"idle-casualty"}`; ending censored, segment 0.036964 m, span 0.000000 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 58: `{"variant":"wall-450","n":3,"casualty":1,"bank":"same","surface":"ice","policy":"frozen-helper","frozenId":0,"frozenBrace":false}`; ending terminal, segment 0.075473 m, span 0.001659 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 59: `{"variant":"wall-450","n":3,"casualty":1,"bank":"same","surface":"ice","policy":"frozen-helper","frozenId":0,"frozenBrace":true}`; ending censored, segment 0.038279 m, span 0.000000 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 62: `{"variant":"wall-450","n":3,"casualty":0,"bank":"same","surface":"ice","policy":"pull-away"}`; ending terminal, segment 0.089605 m, span 0.000833 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 63: `{"variant":"wall-450","n":3,"casualty":0,"bank":"same","surface":"ice","policy":"static-helpers"}`; ending terminal, segment 0.089605 m, span 0.000955 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 64: `{"variant":"wall-450","n":3,"casualty":0,"bank":"same","surface":"ice","policy":"idle-casualty"}`; ending terminal, segment 0.089605 m, span 0.001117 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 65: `{"variant":"wall-450","n":3,"casualty":0,"bank":"split","surface":"ice","policy":"pull-away"}`; ending terminal, segment 0.023949 m, span 0.000745 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 66: `{"variant":"wall-450","n":3,"casualty":0,"bank":"split","surface":"ice","policy":"static-helpers"}`; ending terminal, segment 0.023949 m, span 0.000827 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 67: `{"variant":"wall-450","n":3,"casualty":0,"bank":"split","surface":"ice","policy":"idle-casualty"}`; ending terminal, segment 0.023949 m, span 0.001398 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 68: `{"variant":"wall-450","n":3,"casualty":1,"bank":"split","surface":"ice","policy":"pull-away"}`; ending censored, segment 0.028536 m, span 0.000000 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 84: `{"variant":"wall-450","n":4,"casualty":2,"bank":"same","surface":"snow","policy":"frozen-helper","frozenId":1,"frozenBrace":true}`; ending censored, segment 0.023440 m, span 0.000000 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 89: `{"variant":"wall-450","n":4,"casualty":0,"bank":"same","surface":"snow","policy":"pull-away"}`; ending censored, segment 0.113385 m, span 0.000937 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 90: `{"variant":"wall-450","n":4,"casualty":0,"bank":"same","surface":"snow","policy":"static-helpers"}`; ending censored, segment 0.090987 m, span 0.000937 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 91: `{"variant":"wall-450","n":4,"casualty":0,"bank":"same","surface":"snow","policy":"idle-casualty"}`; ending terminal, segment 0.122646 m, span 0.001657 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 92: `{"variant":"wall-450","n":4,"casualty":0,"bank":"split","surface":"snow","policy":"pull-away"}`; ending censored, segment 0.130774 m, span 0.001386 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 93: `{"variant":"wall-450","n":4,"casualty":0,"bank":"split","surface":"snow","policy":"static-helpers"}`; ending censored, segment 0.026515 m, span 0.001663 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 94: `{"variant":"wall-450","n":4,"casualty":0,"bank":"split","surface":"snow","policy":"idle-casualty"}`; ending censored, segment 0.104134 m, span 0.001386 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 110: `{"variant":"wall-450","n":4,"casualty":2,"bank":"same","surface":"ice","policy":"frozen-helper","frozenId":1,"frozenBrace":false}`; ending censored, segment 0.092754 m, span 0.000000 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 111: `{"variant":"wall-450","n":4,"casualty":2,"bank":"same","surface":"ice","policy":"frozen-helper","frozenId":1,"frozenBrace":true}`; ending censored, segment 0.080549 m, span 0.000000 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 116: `{"variant":"wall-450","n":4,"casualty":0,"bank":"same","surface":"ice","policy":"pull-away"}`; ending terminal, segment 0.095422 m, span 0.000856 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 117: `{"variant":"wall-450","n":4,"casualty":0,"bank":"same","surface":"ice","policy":"static-helpers"}`; ending terminal, segment 0.030535 m, span 0.000871 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 118: `{"variant":"wall-450","n":4,"casualty":0,"bank":"same","surface":"ice","policy":"idle-casualty"}`; ending terminal, segment 0.077365 m, span 0.001611 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 121: `{"variant":"wall-450","n":4,"casualty":0,"bank":"split","surface":"ice","policy":"idle-casualty"}`; ending terminal, segment 0.023055 m, span 0.001516 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 124: `{"variant":"wall-450","n":4,"casualty":2,"bank":"split","surface":"ice","policy":"idle-casualty"}`; ending censored, segment 0.022398 m, span 0.000032 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 137: `{"variant":"wall-450","n":5,"casualty":2,"bank":"same","surface":"snow","policy":"frozen-helper","frozenId":1,"frozenBrace":false}`; ending recovered, segment 0.054985 m, span 0.000019 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 138: `{"variant":"wall-450","n":5,"casualty":2,"bank":"same","surface":"snow","policy":"frozen-helper","frozenId":1,"frozenBrace":true}`; ending censored, segment 0.195862 m, span 0.000339 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 145: `{"variant":"wall-450","n":5,"casualty":0,"bank":"same","surface":"snow","policy":"pull-away"}`; ending censored, segment 0.143967 m, span 0.001319 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 146: `{"variant":"wall-450","n":5,"casualty":0,"bank":"same","surface":"snow","policy":"static-helpers"}`; ending censored, segment 0.027185 m, span 0.001626 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 147: `{"variant":"wall-450","n":5,"casualty":0,"bank":"same","surface":"snow","policy":"idle-casualty"}`; ending censored, segment 0.070399 m, span 0.001319 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 148: `{"variant":"wall-450","n":5,"casualty":0,"bank":"split","surface":"snow","policy":"pull-away"}`; ending censored, segment 0.208958 m, span 0.001438 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 150: `{"variant":"wall-450","n":5,"casualty":0,"bank":"split","surface":"snow","policy":"idle-casualty"}`; ending censored, segment 0.104554 m, span 0.001438 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 164: `{"variant":"wall-450","n":5,"casualty":2,"bank":"same","surface":"ice","policy":"frozen-helper","frozenId":0,"frozenBrace":false}`; ending censored, segment 0.225588 m, span 0.000172 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 167: `{"variant":"wall-450","n":5,"casualty":2,"bank":"same","surface":"ice","policy":"frozen-helper","frozenId":1,"frozenBrace":true}`; ending censored, segment 0.021938 m, span 0.000000 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 168: `{"variant":"wall-450","n":5,"casualty":2,"bank":"same","surface":"ice","policy":"frozen-helper","frozenId":3,"frozenBrace":false}`; ending censored, segment 0.067787 m, span 0.000116 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 174: `{"variant":"wall-450","n":5,"casualty":0,"bank":"same","surface":"ice","policy":"pull-away"}`; ending terminal, segment 0.120229 m, span 0.000882 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 175: `{"variant":"wall-450","n":5,"casualty":0,"bank":"same","surface":"ice","policy":"static-helpers"}`; ending terminal, segment 0.085965 m, span 0.001340 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 176: `{"variant":"wall-450","n":5,"casualty":0,"bank":"same","surface":"ice","policy":"idle-casualty"}`; ending terminal, segment 0.087847 m, span 0.001550 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 177: `{"variant":"wall-450","n":5,"casualty":0,"bank":"split","surface":"ice","policy":"pull-away"}`; ending terminal, segment 0.024223 m, span 0.000934 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 178: `{"variant":"wall-450","n":5,"casualty":0,"bank":"split","surface":"ice","policy":"static-helpers"}`; ending terminal, segment 0.046288 m, span 0.001419 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 179: `{"variant":"wall-450","n":5,"casualty":0,"bank":"split","surface":"ice","policy":"idle-casualty"}`; ending terminal, segment 0.122513 m, span 0.001401 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 180: `{"variant":"wall-450","n":5,"casualty":2,"bank":"split","surface":"ice","policy":"pull-away"}`; ending censored, segment 0.029536 m, span 0.001387 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 181: `{"variant":"wall-450","n":5,"casualty":2,"bank":"split","surface":"ice","policy":"static-helpers"}`; ending censored, segment 0.029536 m, span 0.001768 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 182: `{"variant":"wall-450","n":5,"casualty":2,"bank":"split","surface":"ice","policy":"idle-casualty"}`; ending censored, segment 0.030480 m, span 0.000932 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 197: `{"variant":"wall-450","n":6,"casualty":3,"bank":"same","surface":"snow","policy":"frozen-helper","frozenId":2,"frozenBrace":false}`; ending recovered, segment 0.036743 m, span 0.000027 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 198: `{"variant":"wall-450","n":6,"casualty":3,"bank":"same","surface":"snow","policy":"frozen-helper","frozenId":2,"frozenBrace":true}`; ending recovered, segment 0.033535 m, span 0.000160 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 205: `{"variant":"wall-450","n":6,"casualty":0,"bank":"same","surface":"snow","policy":"pull-away"}`; ending censored, segment 0.227622 m, span 0.000880 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 206: `{"variant":"wall-450","n":6,"casualty":0,"bank":"same","surface":"snow","policy":"static-helpers"}`; ending censored, segment 0.030601 m, span 0.001184 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 207: `{"variant":"wall-450","n":6,"casualty":0,"bank":"same","surface":"snow","policy":"idle-casualty"}`; ending censored, segment 0.153069 m, span 0.000880 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 208: `{"variant":"wall-450","n":6,"casualty":0,"bank":"split","surface":"snow","policy":"pull-away"}`; ending censored, segment 0.230510 m, span 0.001404 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 209: `{"variant":"wall-450","n":6,"casualty":0,"bank":"split","surface":"snow","policy":"static-helpers"}`; ending censored, segment 0.026230 m, span 0.001421 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 210: `{"variant":"wall-450","n":6,"casualty":0,"bank":"split","surface":"snow","policy":"idle-casualty"}`; ending censored, segment 0.110095 m, span 0.001626 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 211: `{"variant":"wall-450","n":6,"casualty":3,"bank":"split","surface":"snow","policy":"pull-away"}`; ending censored, segment 0.026955 m, span 0.000528 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 212: `{"variant":"wall-450","n":6,"casualty":3,"bank":"split","surface":"snow","policy":"static-helpers"}`; ending censored, segment 0.026955 m, span 0.000735 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 213: `{"variant":"wall-450","n":6,"casualty":3,"bank":"split","surface":"snow","policy":"idle-casualty"}`; ending censored, segment 0.026955 m, span 0.000528 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 214: `{"variant":"wall-450","n":6,"casualty":5,"bank":"same","surface":"snow","policy":"pull-away"}`; ending recovered, segment 0.020636 m, span 0.000000 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 223: `{"variant":"wall-450","n":6,"casualty":3,"bank":"same","surface":"ice","policy":"idle-casualty"}`; ending censored, segment 0.089644 m, span 0.000019 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 229: `{"variant":"wall-450","n":6,"casualty":3,"bank":"same","surface":"ice","policy":"frozen-helper","frozenId":2,"frozenBrace":true}`; ending censored, segment 0.033910 m, span 0.000187 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 230: `{"variant":"wall-450","n":6,"casualty":3,"bank":"same","surface":"ice","policy":"frozen-helper","frozenId":4,"frozenBrace":false}`; ending censored, segment 0.082096 m, span 0.000104 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 235: `{"variant":"wall-450","n":6,"casualty":3,"bank":"same","surface":"ice","policy":"frozen-remote","frozenBrace":true}`; ending censored, segment 0.028270 m, span 0.000000 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 236: `{"variant":"wall-450","n":6,"casualty":0,"bank":"same","surface":"ice","policy":"pull-away"}`; ending terminal, segment 0.168322 m, span 0.003233 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 237: `{"variant":"wall-450","n":6,"casualty":0,"bank":"same","surface":"ice","policy":"static-helpers"}`; ending terminal, segment 0.090637 m, span 0.001463 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 238: `{"variant":"wall-450","n":6,"casualty":0,"bank":"same","surface":"ice","policy":"idle-casualty"}`; ending terminal, segment 0.103179 m, span 0.001137 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 239: `{"variant":"wall-450","n":6,"casualty":0,"bank":"split","surface":"ice","policy":"pull-away"}`; ending terminal, segment 0.159360 m, span 0.001563 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 241: `{"variant":"wall-450","n":6,"casualty":0,"bank":"split","surface":"ice","policy":"idle-casualty"}`; ending terminal, segment 0.034109 m, span 0.001000 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 242: `{"variant":"wall-450","n":6,"casualty":3,"bank":"split","surface":"ice","policy":"pull-away"}`; ending censored, segment 0.025573 m, span 0.001068 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 243: `{"variant":"wall-450","n":6,"casualty":3,"bank":"split","surface":"ice","policy":"static-helpers"}`; ending censored, segment 0.025573 m, span 0.001503 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 244: `{"variant":"wall-450","n":6,"casualty":3,"bank":"split","surface":"ice","policy":"idle-casualty"}`; ending censored, segment 0.029488 m, span 0.000819 m, overlap 0.000000 m, penetration 0.000000 m.
- Matrix row 247: `{"variant":"wall-450","n":6,"casualty":5,"bank":"same","surface":"ice","policy":"idle-casualty"}`; ending terminal, segment 0.209464 m, span 0.001646 m, overlap 0.000000 m, penetration 0.000000 m.

## Exit geometry and limp-body conflict

The sampled rope tangents, final body locations and wall/ground occupancy retain rim stalls explicitly. Censored idle-casualty rescues mean these particular policies did not clear the body, not that limp-body recovery is impossible. At the rim the routed rope's upward component can shrink while the box still needs vertical clearance. Changing the helpers' initial stance alone did not reliably solve this and sometimes exceeded rope tolerances.

A disconnected limp body is not an active participant and should not itself be scored as a connected player’s functional inactivity. Its recoverability nevertheless implies recoverability of an identical physical state with zero input from a connected casualty. The idle-casualty examples make that possibility concrete: casualty action changes are not mechanically necessary in those fixtures. Useful opportunities to participate are a separate criterion. Similarly, adjacent haulers can perform enough work while remote helpers remain static or slack. Reduced wall effort improves the self-climbing envelope; it does not pass the every-role requirement.

Raw sources: [screen JSON](rescue-recut-screen.json.gz), [matrix JSON](rescue-recut-matrix.json.gz), and [preregistered design note](../docs/design/phase2-recut-experiments.md). Each row retains fixture geometry, exact input digest, outcomes/events, per-role motion/contact/motor aggregates, full solver/energy diagnostics and one-second sampled rope/body state. Full root tuning and source baseline are exported. No human sessions, remote trials, art, deployment or Phase 3 work occurred.
