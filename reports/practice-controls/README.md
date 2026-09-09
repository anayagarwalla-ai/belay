# Browser practice teammates

The local operator can now fill empty seats with cooperative or clumsy bots from the game page. Each bot is a normal authenticated SDK client, visibly labeled BOT, using the existing public-state policy. No simulation, terrain, rescue tuning, server admission or benchmark policy code changed. The only tuning addition is the browser helper's ten-minute lifetime.

The helper loads its policy on demand, preserves occupied human seats, bounds joining and lifetime, closes late canceled reservations, and stops its entire owned team on stale or lost connections. Hiding the page, leaving the rope, or pressing Stop also closes those bot sockets. Paused, flat and terminal scenes receive rest inputs. Scene resets rebuild policies for the new epoch. Measurement reports retain observed bot seat IDs for the window even after bots leave.

| Check | Result | Evidence |
|---|---|---|
| Full test suite | 315 passed; 1 pre-existing expected failure; 33 files | `tests.log` |
| TypeScript, lint, build | Pass | `typecheck.log`, `lint.log`, `build.log` |
| Historical evidence integrity | 75 checks passed | `evidence.log` |
| Browser: fill a paused four-person rescue | One human and three labeled, connected bots | `browser.json`, `bots-paused.png` |
| Browser: move + brace, then release | Authority advanced 0 → 75 → 83 ticks; human brace true during hauling, false after release; bot inputs acknowledged and bodies moved | `browser.json`, `hauling.png` |
| Browser: stop, switch behavior, hide tab, leave/rejoin | All three owned bot seats released each time; human seat preserved; clumsy restart reached four connected seats | `browser.json` |
| Browser errors | None reported | `browser-errors.log` |

The first full-suite compatibility failure is retained in `initial-tests.log`; the final suite passes. The existing expected failure concerns the historical fixed-feature solver, not this helper or the live rope engine. Build warnings remain the previously documented upstream warnings.

Unit coverage exercises two/four/six-person capacity, preoccupied seats, cancellation followed by a new session, late arrivals, missing initial state, partial admission failure, stale owner/bot state, socket loss, pause/terminal rest, epoch changes, deadline cleanup, and the mounted page's visibility handler. Browser evidence uses the real gateway, Colyseus room, renderer and controls; it is a local functional check, not load qualification or a rescue success sample.

No new 1,000-run matrix was launched: gameplay code and its tuning are unchanged, so the previous matrix remains bound to its original source commit and hashes. This helper does not resolve the remaining participation/balance findings, the small energy-accounting precision limit, the 300-room production gate, or any human verdict. It is not Solo Daily. Phase 3 remains paused at the human rescue check-in.

The verification browser was closed and the local preview left running with the default four-climber crossing. No bot jobs, scheduled tasks, uploads, tunnel or paid resource were started. Start practice with **Join test rope → Fill empty seats with bots**. For a focused rescue, pause and load the rescue scene before filling seats, then resume.
