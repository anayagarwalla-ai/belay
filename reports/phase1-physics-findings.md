# Phase 1 physics findings

Gate 1 remains NOT EVALUATED. Human sessions consumed: zero. Glacier and rescue metrics: N/A. Production 300-room qualification: NOT TESTED.

## Demonstrated defects and correction

Baseline gameplay was commit d194cb674bc6def4b20c6f9d5e953246a03d680c, with only the diagnostic configuration and harness added. All six family/rate combinations use seed 1701. The baseline harness exits 1 with 15 failed checks; the current targeted regression tests produce 11 failures and 7 passes against that baseline. Both failures were reproduced before gameplay edits.

| Bound | Baseline maximum | Corrected maximum | Assertion budget |
|---|---:|---:|---:|
| Body overlap | 34.079 mm | 0.184 mm | 5 mm |
| Segment stretch | 21.741 mm | 9.999 mm | 20 mm |
| Whole endpoint span stretch | 0.000 mm | 0.000 mm | 10 mm |

- Short-family crossing at 60 Hz overlaps by 32.513 mm at zero-based tick 28. Instrumentation immediately after Rapier, before PBD correction, measured 32.554 mm. Rapier’s default 2 mm predictive contact range misses the approach. The corrected range is 0.12 m, covering two 3.1 m/s walkers closing over a 1/60-second step (0.103 m) without enlarging the colliders or changing friction.
- Loose-family circling with brace switches exceeds the existing 20 mm segment bound at zero-based tick 916 at 60 Hz (21.741 mm). The usual eight projection passes now continue only when a segment residual exceeds 10 mm, with a hard maximum of 32 passes. Movement acceleration, speed, coast deceleration, masses, family rope lengths, brace strengths and damping are unchanged. The simulation version advances to phase1-2 because physical results change.

## Reproduction and evidence

Run from the project root after npm ci:

```sh
npm run typecheck
npm run lint
npm test -- --reporter=dot
npx tsx scripts/physics-stress.ts
npm run bench
```

The corrected suite passes all 33 tests. The stress harness passes all 36 trajectories across balanced/short/loose and 30/60 Hz, inspecting 540,000 internal physics steps. It checks rotating crossings, circling with brace changes, opposing inputs, tick-by-tick brace changes, seeded mixed controls and cooperative walks. Each long walk lasts 1,200 seconds and finishes over 3.7 km from the starting origin. Tape frames fill the 36,000/72,000 caps, preserve the prefix, mark truncation on overflow, and allow simulation to continue. All 36 trajectories replay exactly in the same runtime.

For 30 Hz scenarios, an additional 60 Hz replay holds each accepted input for two steps, checks intermediate body/rope bounds and asserts equal physical results. Event-loop yields and artificial clock advances separately verify that fixed steps are independent of wall time. These are mechanical tests only; they do not consume or satisfy the conditional human 30/60 Hz diagnostic budget.

The baseline and corrected JSON reports contain first failing tick/substep, numerical bounds, seed, all tuning, family definitions, runtime and source/package-lock hashes. The --baseline flag changes only the report filename; it does not rewind the implementation. To reproduce historical failures, run these scripts/tests against the baseline commit’s simulation and tuning with the diagnostic-only TUNING.physicsDiagnostics section added. Preserve the checked-in baseline report when testing corrected code.

The required bot report was regenerated for exactly 1000 trajectories of 20 seconds at the default 30 Hz, using seeds 1701–2700. Source/config fingerprints were verified against the final files.

## Limits and integration

No failed physics assertions remain in the tested scope. Replay equality applies to this Rapier/runtime build; cross-platform deterministic replay is not claimed. The solver has a bounded work ceiling and these tests do not prove bounds for arbitrary injected states or later terrain/obstacles. The tested long-distance horizon is 20 minutes.

The existing bot benchmark uses a 2,048-sample timing ring. Its isolated simulation timing percentiles describe that retained tail, not the entire 1,000-trajectory population; they exclude room scheduling, networking and serialization. Shared process memory is not attributed per room. No production capacity conclusion follows.

Only shared/simulation.ts, root tuning.ts, physics tests and physical diagnostic scripts/reports changed. shared/movement.ts required no correction. No connection/server networking, dev/tunnel tooling, art, audio or later gameplay was edited. No tunnel, service, paid resource, deployment, recruitment, push or PR was created. Integrating other tuning changes alters the recorded configuration fingerprint; regenerate reports after integration if they are presented as evidence for the combined revision.
