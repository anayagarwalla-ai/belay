# Bounded wall-actuator prototype — unapplied

The pure helper bounds the demonstrated horizontal motor reset and accounts for
signed motor work. It does **not** establish friction-feasible climbing, repair
rope/contact projection, or select a gameplay baseline. The particle-chain
architecture A and the rescue criterion remain the existing contract.

This delivery adds a helper, nine small analytical tests, this rationale, and an
unapplied runtime patch. The isolated branch is
`codex/phase2-wall-actuator-prototype`, based on
`101a9fda470b88db68d088a60604071a27342827`. All current `shared/` files and
`tuning.ts` are byte-identical to the frozen reference
`f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1`. The current runtime version remains
`phase2-1`, with the 900 N setting unchanged. No simulation, physics
initialization, full suite, browser, or server ran for this prototype.

Artifacts:

- [Pure helper](../scripts/wall-actuator-prototype.ts)
- [Analytical tests](../tests/wall-actuator-prototype.test.ts)
- [Unapplied runtime patch](phase2-wall-actuator-runtime.patch)
- [Prior observed motor/energy diagnosis](phase2-motor-energy-design.md)

## Command and accounting

All proposed controller values come from the existing `tuning.ts`: mass 80 kg,
gravity 9.81 m/s², climb/descend speeds 1.6/1.8 m/s, press speed 0.45 m/s,
servo acceleration 5 m/s², active normal effort 900 N, and nominal tangential
multiplier 1.3. No new numeric controller constant is introduced. The 450 N
test overrides a helper configuration solely to evaluate the saved historical
witness; it does not modify tuning or propose a selected operating point.

For an outward horizontal unit wall normal `n`, define lateral unit direction
`t = (n.z, 0, -n.x)` and vertical direction `u = (0, 1, 0)`. The helper accepts
non-unit horizontal normals by normalization, and rejects zero/nonhorizontal
normals and invalid physical inputs. Directional input is normalized to length
at most one. Define `toward = -input·n` and `along = input·t`.

The existing target-speed intent is retained: brace requests zero lateral and
vertical velocity plus inward press; toward input requests climbing and inward
press; away input requests descent and outward movement; along input requests
lateral movement. Unbraced zero input gives **zero motor impulse**, including
zero gravity feedforward. Brace with zero directional axes requests a bounded
stop. Thus an idle unbraced climber remains available for dragging.

For active input, the signed normal command is:

```
Fn = clamp(m (vn_target - vn) / dt, -normalEffortN, +normalEffortN)
Jn_motor = Fn dt
```

Both accelerating and braking normal commands use this bound. In particular,
outward motor braking of inward velocity is an explicit active command, not an
estimated passive collision response. Whether that command can be realized at
a unilateral wall remains a contact-feasibility question.

The lateral/vertical target error is first capped as one two-dimensional servo
acceleration, using `wallAcceleration`. This is an explicit proposed semantic
change from the existing vertical-only acceleration cap. The gravity support
term is then added to vertical motor effort before the joint force cap:

```
e = (vl_target - vl, vy_target - vy)
a = e / |e| * min(|e| / dt, wallAcceleration)   [a = 0 when e = 0]
Ft_requested = m a + (0, m g)
nominalTangentialBudgetN = wallFriction * wallNormalEffortN
Ft = Ft_requested * min(1, nominalTangentialBudgetN / |Ft_requested|)
Jt_motor = Ft dt                             [Ft = 0 when request = 0]
J_motor = n Jn_motor + t Jl_motor + u Jy_motor
v_after_motor = v_before + J_motor / m
```

At the reference settings, the separate limits are `|Fn| ≤ 900 N` and
`sqrt(Fl² + Fy²) ≤ 1170 N`. They are **not** a 900 N total three-dimensional
motor limit. Lateral and vertical commands cannot each independently spend
1170 N. Gravity feedforward is included in the 1170 N budget and in motor work;
gravity itself is advanced later by the existing physics step. The feedforward
means the helper's output velocity is not the final post-gravity velocity.

The proposed impulse's translational work is explicitly signed:

```
W_motor = v_before · J_motor + |J_motor|² / (2m)
        = m/2 (|v_after_motor|² - |v_before|²)
```

The helper also returns normal and tangential work separately; orthogonality
makes their sum equal this total. Negative work represents active braking and
is not clamped away. These values describe only this motor operation. They
exclude gravity, passive contact, rope impulses and subsequent projection.

## Contact information is insufficient

`supportAt` supplies support classification, an AABB wall direction and optional
solid geometry. It does not supply the same-substep compressive reaction needed
to evaluate friction. A body being near a wall does not prove a load-bearing
contact. The helper therefore returns `measuredNormalContactImpulseNs: null`;
the separate assessment returns `unverified` for a missing measurement.

The multiplier `wallFriction` preserves the old **nominal motor budget scale**.
Multiplying it by a commanded 900 N does not measure Coulomb capacity. We reject
claims that the motor's inward press, its outward braking command, the total
velocity residual, or the existing geometric support label provides passive
normal reaction. The terrain collider's existing native friction setting is
also a separate mechanism; this helper does not combine it into one solved
contact model.

If a caller supplies an actual compressive impulse `Jn_contact` for the same
solved contact and substep, the separate assessment can compare
`|Jt_motor| ≤ μ Jn_contact`, assuming that motor traction is transmitted through
friction with that coefficient. A passing result is called
`within-magnitude-bound`; `coupledContactCertified` remains false. Other
tangential contact demand must share the same cone, and motor and rope commands
can change the normal reaction. A magnitude comparison alone therefore cannot
establish complementarity, continued contact, or coupled feasibility. Synthetic
reaction inputs in the tests are analytical examples, not measured evidence.

An earlier-frame reaction or native Rapier contact impulse observed before the
custom rope/contact pass is insufficient to qualify the complete substep. This
prototype does not add the missing coupled solve, and the runtime patch remains
unqualified for that reason.

## Analytical evidence

The tests use isolated calls, not trajectories or timestep loops:

| Fixture | Independent expectation |
| --- | --- |
| Rest velocity, brace, 80 kg, 900 N, 1/60 s | Normal impulse −15 N·s, Δvn −0.1875 m/s, normal work 1.40625 J; gravity-support motor work 1.06929 J; total 2.47554 J. |
| Shared lateral/vertical error `(14,48)` m/s | Error norm 50 gives servo acceleration `(1.4,4.8)` m/s² and requested force `(112,1168.8)` N; both components scale together to norm 1170 N. |
| Same saturated initial state at 1/30 and 1/60 s | Identical force commands, doubled impulse at 1/30 s, and `W30 = 2 W60 + |J60|²/m` for the same initial velocity. |
| Rotated wall normal `(3,0,4)` | Normal/tangent directions are orthogonal; equivalent rotated velocity yields matching force components and work. |
| Zero directional input | Unbraced state is unchanged. Brace brakes `(8,0,4)` m/s to x ≈ 7.91667 and z = 3.8125 m/s before gravity, with negative total motor work. |
| Small normal error / fast inward velocity | Small error reaches the −0.45 m/s target without overshoot; fast inward motion receives at most +900 N active motor braking. |
| Toward/away/along and oversized input | Direction maps to the intended frame; normalized oversized input gives the same command as the corresponding unit input. |
| Saved row 237 / 450 N motor setter state | Normal command −450 N, shared tangential magnitude 585 N, signed work −76.6419083 J; no horizontal reset. |
| Missing/synthetic reaction and invalid inputs | Missing reaction stays unverified; supplied insufficient/sufficient impulses only classify the necessary magnitude bound; invalid physical data is rejected. |

The saved row 237 calculation uses the previously observed state at tick 203,
player 5, with zero directional input and brace, outward normal `(0,0,1)`:

| Quantity | Previous recorded setter | Pure proposed motor |
| --- | ---: | ---: |
| Before velocity `(x,y,z)` m/s | `(-8.048179626, -0.725492418, 4.927676678)` | Same supplied state |
| After motor velocity `(x,y,z)` m/s | `(0, -0.603617418, -0.45)` | `(-7.994958636, -0.615851906, 4.833926678)` |
| Signed normal command N | −25812.848053 | −450 |
| Lateral/vertical command N | `(38631.262207, 585)` | `(255.460756, 526.274455)` |
| Signed motor work J | −3560.587120 | −76.641908 |

These are different commands from the **same supplied one-step state**. The
old total horizontal command was approximately 46.46 kN. There is no claim
about how often that state would occur under changed mechanics, eventual
rescue, stability, feel or performance. The row 73 projection/energy defect is
outside this motor change.

The 30/60 fixtures verify dimensional timestep scaling of saturated commands.
They do not establish complete trajectories' rate invariance. Both current
authority-rate profiles still use the existing 60 Hz internal physics step.

## Integration boundary and checks

The patch would replace only the existing wall motor branch with the pure
helper call, and mark the runtime version `phase2-wall-actuator-prototype-1`.
Its tuning edits change comments/version only, preserving every numeric value.
The temporary import from `scripts/` intentionally uses the exact reviewed
helper; the patch is a review artifact, not a production integration decision.

The existing common kinetic-difference calculation would continue to account
for motor work **once**, immediately before `setLinvel` and `world.step`.
The helper's work field must not also be added there. Native contact and the
later custom projection are outside that measurement boundary. Particle rope
topology, contact projection, bracing in constraints, rescue criteria and the
kinetic budget logic are untouched by the patch.

Validation performed in the isolated worktree:

```
./node_modules/.bin/vitest run --config vitest.config.ts tests/wall-actuator-prototype.test.ts --maxWorkers=1
./node_modules/.bin/oxlint scripts/wall-actuator-prototype.ts tests/wall-actuator-prototype.test.ts
git apply --check reports/phase2-wall-actuator-runtime.patch
git diff --exit-code f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1 -- shared tuning.ts
```

Results: nine tests passed in a 145 ms Vitest run; focused lint passed; patch
check passed; frozen source comparison was empty. There was no runtime patch
application, runtime compilation, physics replay or performance measurement.
No new gameplay baseline or mechanical acceptance claim follows from these
analytical checks.
