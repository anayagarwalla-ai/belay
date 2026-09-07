# Phase 1 adversarial physics diagnostics

PASS: 0 failed checks. Generated 2026-09-07T22:12:46.835Z.

Reproduce: `npx tsx scripts/physics-stress.ts`. Phase 1, two locked grey-box Rapier bodies and a PBD rope. Every internal substep inspected, including via an equivalence-asserted 60 Hz held-input replay for 30 Hz scenarios. Exact replay is same-runtime only.

| Family | Hz | Scenario | Peak overlap (m) | Peak segment error (m) | Peak chain excess (m) | Replay | Assertions |
|---|---:|---|---:|---:|---:|---|---|
| balanced | 30 | crossing | 0.000023 | 0.009309 | 0.067366 | PASS | PASS |
| balanced | 30 | circling | 0.000115 | 0.009999 | 0.066669 | PASS | PASS |
| balanced | 30 | opposing | 0.000000 | 0.009865 | 0.067930 | PASS | PASS |
| balanced | 30 | brace-switches | 0.000000 | 0.007895 | 0.044433 | PASS | PASS |
| balanced | 30 | random | 0.000002 | 0.009812 | 0.055913 | PASS | PASS |
| balanced | 30 | long-walk | 0.000000 | 0.002802 | 0.012273 | PASS | PASS |
| balanced | 60 | crossing | 0.000020 | 0.009851 | 0.072187 | PASS | PASS |
| balanced | 60 | circling | 0.000131 | 0.009868 | 0.063100 | PASS | PASS |
| balanced | 60 | opposing | 0.000000 | 0.009865 | 0.067930 | PASS | PASS |
| balanced | 60 | brace-switches | 0.000000 | 0.008066 | 0.043461 | PASS | PASS |
| balanced | 60 | random | 0.000002 | 0.009812 | 0.055913 | PASS | PASS |
| balanced | 60 | long-walk | 0.000000 | 0.002802 | 0.012273 | PASS | PASS |
| short | 30 | crossing | 0.000025 | 0.009708 | 0.050205 | PASS | PASS |
| short | 30 | circling | 0.000170 | 0.009993 | 0.059357 | PASS | PASS |
| short | 30 | opposing | 0.000000 | 0.009867 | 0.055553 | PASS | PASS |
| short | 30 | brace-switches | 0.000000 | 0.008929 | 0.041968 | PASS | PASS |
| short | 30 | random | 0.000001 | 0.009659 | 0.051800 | PASS | PASS |
| short | 30 | long-walk | 0.000000 | 0.005835 | 0.026883 | PASS | PASS |
| short | 60 | crossing | 0.000023 | 0.009861 | 0.051441 | PASS | PASS |
| short | 60 | circling | 0.000184 | 0.009934 | 0.051143 | PASS | PASS |
| short | 60 | opposing | 0.000000 | 0.009867 | 0.055553 | PASS | PASS |
| short | 60 | brace-switches | 0.000000 | 0.008620 | 0.040482 | PASS | PASS |
| short | 60 | random | 0.000001 | 0.009659 | 0.051800 | PASS | PASS |
| short | 60 | long-walk | 0.000000 | 0.005835 | 0.026883 | PASS | PASS |
| loose | 30 | crossing | 0.000007 | 0.009853 | 0.079692 | PASS | PASS |
| loose | 30 | circling | 0.000000 | 0.009987 | 0.067597 | PASS | PASS |
| loose | 30 | opposing | 0.000000 | 0.009976 | 0.057009 | PASS | PASS |
| loose | 30 | brace-switches | 0.000000 | 0.009272 | 0.054983 | PASS | PASS |
| loose | 30 | random | 0.000000 | 0.009933 | 0.062048 | PASS | PASS |
| loose | 30 | long-walk | 0.000000 | 0.002931 | 0.005920 | PASS | PASS |
| loose | 60 | crossing | 0.000004 | 0.009716 | 0.072457 | PASS | PASS |
| loose | 60 | circling | 0.000088 | 0.009994 | 0.079438 | PASS | PASS |
| loose | 60 | opposing | 0.000000 | 0.009976 | 0.057009 | PASS | PASS |
| loose | 60 | brace-switches | 0.000000 | 0.009973 | 0.057287 | PASS | PASS |
| loose | 60 | random | 0.000000 | 0.009933 | 0.062048 | PASS | PASS |
| loose | 60 | long-walk | 0.000000 | 0.002931 | 0.005920 | PASS | PASS |

Exact tape replay, cap/truncation/continued stepping, 30/60 Hz held-input equivalence and scheduling-independent fixed steps are asserted. Long walks traverse beyond the original floor extent. Chain excess is bounded by the sum of the existing per-segment error budgets. JSON records the first failing tick and limits for each failed check, all configuration and source hashes.

Glacier metrics: N/A. Rescue metrics: N/A. Production 300-room qualification: NOT TESTED. Human Gate 1: NOT EVALUATED. No human sessions consumed; no feel verdict inferred.
