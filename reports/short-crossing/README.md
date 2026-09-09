# Short-crossing re-cut

The user found the earlier game unclear, slow, drab and boring, then chose **“Short, intense crossing first.”** This cut targets 60–90 seconds. It is an engagement experiment, not a human gate pass. The full game's 5–10-minute pacing target is deferred for this experiment.

## What changed

- The crossing ends at 100 m with crevasses at 8, 36 and 68 m. Ordinary expedition walking targets 4.2 m/s with acceleration 9; braced hauling remains 0.22 m/s. The original two-player flat motor is unchanged.
- One click starts an empty local operator room with three labeled BOT partners. Joining an existing human team leaves its world intact. Retry resets the world, waits for the new epoch and reuses the existing bots. Operator tools and evidence remain under Test tools.
- The goal, tail distance, crossed gaps, direction and required rescue action are visible. The previous misleading brace-while-walking hint is replaced with explicit instructions to release Space for full walking speed.
- Snow/ink/orange fields, colored parkas, contours, a hut, walking feet and synthesized rope strain/catch/recovery audio support readability. There are no audio assets or microphone prompts. Muting/hiding/leaving silences audio; one-shot voices are capped at six. Umber and final typography remain review candidates.
- Bots choose the crossing lane from the tail's next uncleared gap. Previously the leader could change lanes while the tail was still on the preceding bridge.

Physics/policy/tuning source was committed as `bdf967a4e4683f86c8dd3190eda604a9c7f7d0ce` before the full benchmark launched. The benchmark owns a frozen source copy. Later client and documentation edits do not change its measured source.

## Preliminary current-source checks — ten trajectories, not 1,000

All rows below use seed 1701, balanced family, 30 Hz, cooperative public-state bots. There is only **one crossing and one focused rescue per team size**. These are smoke checks, not estimates of population success rates. Crossing observation stops at 180 s; focused rescue stops at 60 s.

| Climbers | Crossing outcome / observed seconds | Incidents / recovered | First fall | Focused rescue |
|---:|---|---|---:|---|
| 2 | Complete, 42.97 s | 3 / 3 | 2.85 s | 1/1 recovered, 18.73 s |
| 3 | Still active at 180 s; censored | 1 / 0 | 2.92 s | 1/1 recovered, 13.80 s |
| 4 | Complete, 72.33 s | 3 / 3 | 2.92 s | 1/1 recovered, 12.13 s |
| 5 | Complete, 51.73 s | 4 / 4 | 2.93 s | 1/1 recovered, 10.30 s |
| 6 | Complete, 67.10 s | 4 / 4 | 2.95 s | 1/1 recovered, 10.13 s |

The three-player crossing stalls with two climbers at the far wall. Two- and five-player completion is below the new 60-second lower target. Four-player pacing is promising in this single fixture; that does not establish fun or overall balance.

| Climbers | Worst per-player, per-episode role-idle proxy: crossing | Focused rescue | Isolated crossing-step p95 |
|---:|---:|---:|---:|
| 2 | 92.82% | 5.85% | 1.85 ms |
| 3 | 85.74% | 8.82% | 4.96 ms |
| 4 | 96.84% | 13.83% | 6.65 ms |
| 5 | 100.00% | 7.92% | 8.70 ms |
| 6 | 98.10% | 10.76% | 10.62 ms |

Role-idle is the existing mechanical activity proxy, `idle / (active + idle)`, not a human judgment. A nonzero input alone does not mean a useful role: every smoke bot submitted nonzero inputs during rescue, while the mechanical idle proxy above still fails the 20% requirement in crossings. No rescue-gate pass is claimed. Static helper counterexamples from the prior repair remain relevant.

Across these ten current-source checks, maximum segment excess stays below 5 mm. Reported body overlap, terrain penetration and potential excess are zero. The source data retains energy diagnostics and final body states. This small check does not replace the complete matrix or remove the earlier post-commit energy precision concern.

| Required wider evidence | Status at this review |
|---|---|
| Run-length distribution across 1,000 trajectories | **Pending**; native four-worker campaign running locally |
| Incidents and rescue success by team size across 1,000 | **Pending**; do not extrapolate the ten smoke trajectories |
| Rescue idle across the full schedule | **Pending**; smoke already exposes failures above |
| Server p95, memory per room and reconnect at 300 rooms | **Not measured / not qualified**. Local isolated-step timings above are not server-capacity numbers |
| Laughter, clip appeal and purpose comprehension | User verdict needed. Clip capture is still unbuilt |

## Experiments retained

- `initial-smoke.json`: faster movement with the old per-person lane selection; all five crossings censored. This exposed the lane-coordination defect.
- **`lane-smoke.json`: current selected mechanics and policy**, 0.5 s decision cadence. `smoke-summary.json` is a compact extraction of those ten records.
- `fast-reaction-smoke.json`: rejected 0.25 s bot cadence. Four- and five-person teams wiped. The shorter cadence was reverted; this is not current-source evidence.
- `mechanics.log`, `focused-tests.log`: intermediate failures retained. The original near-bank-only test assertion was replaced with actual casualty recovery; geometric tolerances were not relaxed. `mechanics-final.log`: 46/46 passing under selected tuning.

## Verification

- Full suite after the re-cut: 321 passed, one expected historical failure, and one unexpected `room locked` admission failure in the two-through-six-body local socket diagnostic (`tests-final.log`). Its focused rerun passed all six socket checks; the three mission checks passed alongside them (`rechecks.log`). The intermittent admission failure remains recorded; it is not evidence of production capacity.
- Client mission, connection/retry, renderer lifetime, presentation and bounded audio checks pass in `client-tests-final.log`. Typecheck, lint and build receipts are saved separately.
- Browser UI inspection at 1280×720 confirmed the landing objective, one-click start with three labeled bots, route distance, exposed operator tools, focused rescue loading, leaving/bot cleanup and zero reported browser error logs. The automated browser CLI repeatedly stalled; final visual inspection used the in-app browser controls. Held-key feel, audible mix quality, finish-to-retry with humans and thumbnail appeal remain unverified by a person.
- Startup/preflight readiness now checks the stable `data-belay-entry` marker instead of the retired “Join test rope” button text. Existing operator-input/resize fixtures open Test tools before the nested operator panel.

## Active full matrix

Original directory (local while still writing):

`reports/phase2-parallel-2026-09-09T03-58-40.654Z-93e2e47c-aa9e-46ad-9117-f0d3d397cd8e/`

Source manifest SHA-256: `73afdeb4749e2025544ffad5c75fb8a8cf18a004fedc0c9215895f9162babe34`.
Schedule SHA-256: `20853a8622f5b10b076c2dca4bfe6b6c3544c7c87de873076e826846f66a0e75`.

`matrix-launch-manifest.json` preserves launch pins; `matrix-status-at-review.json` is a timestamped partial status, not live completion evidence. This is 20 seeds × five team sizes × two scenes × five policies; the shorter crossing horizon changes the schedule hash. Four native workers use the existing memory guard. The local preview and tests contend for the same machine; timings cannot qualify 300 rooms. No schedule or remote resource was created.

The preceding launch at `03:58:02.135Z` was rejected by the initial memory guard at 0/1,000. Its original incomplete directory and launcher log remain local. The successful retry used the unchanged memory floor after closing the old preview. Do not delete or reclassify the rejected launch as a completed test. Final consolidation must wait for all worker exits and independent reconciliation; do not aggregate an interrupted prefix as the full matrix.
