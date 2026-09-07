# Phase 1 adversarial physics diagnostics

FAIL: 15 failed checks. Generated 2026-09-07T21:45:57.277Z.

Reproduce: `npx tsx scripts/physics-stress.ts --baseline`. Phase 1, two locked grey-box Rapier bodies and a PBD rope. Every internal substep inspected, including via an equivalence-asserted 60 Hz held-input replay for 30 Hz scenarios. Exact replay is same-runtime only.

| Family | Hz | Scenario | Peak overlap (m) | Peak segment error (m) | Peak chain excess (m) | Replay | Assertions |
|---|---:|---|---:|---:|---:|---|---|
| balanced | 30 | crossing | 0.019232 | 0.011290 | 0.075235 | PASS | bodyOverlapM |
| balanced | 30 | circling | 0.007993 | 0.015958 | 0.086503 | PASS | bodyOverlapM |
| balanced | 30 | opposing | 0.000000 | 0.014628 | 0.081459 | PASS | PASS |
| balanced | 30 | brace-switches | 0.000000 | 0.007895 | 0.044433 | PASS | PASS |
| balanced | 30 | random | 0.016412 | 0.011265 | 0.056566 | PASS | bodyOverlapM |
| balanced | 30 | long-walk | 0.000000 | 0.002802 | 0.012273 | PASS | PASS |
| balanced | 60 | crossing | 0.017692 | 0.010806 | 0.069543 | PASS | bodyOverlapM |
| balanced | 60 | circling | 0.024610 | 0.011395 | 0.063875 | PASS | bodyOverlapM |
| balanced | 60 | opposing | 0.000000 | 0.014628 | 0.081459 | PASS | PASS |
| balanced | 60 | brace-switches | 0.000000 | 0.008066 | 0.043461 | PASS | PASS |
| balanced | 60 | random | 0.016412 | 0.011265 | 0.056566 | PASS | bodyOverlapM |
| balanced | 60 | long-walk | 0.000000 | 0.002802 | 0.012273 | PASS | PASS |
| short | 30 | crossing | 0.034079 | 0.013507 | 0.058262 | PASS | bodyOverlapM |
| short | 30 | circling | 0.006032 | 0.015112 | 0.075025 | PASS | bodyOverlapM |
| short | 30 | opposing | 0.000000 | 0.011730 | 0.060099 | PASS | PASS |
| short | 30 | brace-switches | 0.000000 | 0.008929 | 0.041968 | PASS | PASS |
| short | 30 | random | 0.012951 | 0.011287 | 0.051800 | PASS | bodyOverlapM |
| short | 30 | long-walk | 0.000000 | 0.005835 | 0.026883 | PASS | PASS |
| short | 60 | crossing | 0.032513 | 0.012272 | 0.064107 | PASS | bodyOverlapM |
| short | 60 | circling | 0.014334 | 0.009525 | 0.051143 | PASS | bodyOverlapM |
| short | 60 | opposing | 0.000000 | 0.011730 | 0.060099 | PASS | PASS |
| short | 60 | brace-switches | 0.000000 | 0.008620 | 0.040482 | PASS | PASS |
| short | 60 | random | 0.012951 | 0.011287 | 0.051800 | PASS | bodyOverlapM |
| short | 60 | long-walk | 0.000000 | 0.005835 | 0.026883 | PASS | PASS |
| loose | 30 | crossing | 0.019282 | 0.011429 | 0.080739 | PASS | bodyOverlapM |
| loose | 30 | circling | 0.000000 | 0.018999 | 0.099597 | PASS | PASS |
| loose | 30 | opposing | 0.000000 | 0.016312 | 0.069601 | PASS | PASS |
| loose | 30 | brace-switches | 0.000000 | 0.010160 | 0.055869 | PASS | PASS |
| loose | 30 | random | 0.000001 | 0.012561 | 0.065647 | PASS | PASS |
| loose | 30 | long-walk | 0.000000 | 0.002931 | 0.005920 | PASS | PASS |
| loose | 60 | crossing | 0.017741 | 0.013378 | 0.075544 | PASS | bodyOverlapM |
| loose | 60 | circling | 0.000083 | 0.021741 | 0.122099 | PASS | segmentErrorM |
| loose | 60 | opposing | 0.000000 | 0.016312 | 0.069601 | PASS | PASS |
| loose | 60 | brace-switches | 0.000000 | 0.009973 | 0.057287 | PASS | PASS |
| loose | 60 | random | 0.000001 | 0.012561 | 0.065647 | PASS | PASS |
| loose | 60 | long-walk | 0.000000 | 0.002931 | 0.005920 | PASS | PASS |

Exact tape replay, cap/truncation/continued stepping, 30/60 Hz held-input equivalence and scheduling-independent fixed steps are asserted. Long walks traverse beyond the original floor extent. Chain excess is bounded by the sum of the existing per-segment error budgets. JSON records the first failing tick and limits for each failed check, all configuration and source hashes.

Glacier metrics: N/A. Rescue metrics: N/A. Production 300-room qualification: NOT TESTED. Human Gate 1: NOT EVALUATED. No human sessions consumed; no feel verdict inferred.
