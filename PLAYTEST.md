# BELAY playtests

**Gate 1: implementation stop bypassed by user instruction on 2026-09-07. Human sessions evaluated: 0/6; human feel remains unmeasured.**

Phase 2 is now authorized by that instruction. Automated evidence in `reports/` cannot establish whether dragging a partner is funny. The human protocol below remains available; no answers are inferred from the authorization to continue.

## Prepare a real two-person session

1. Run `npm ci` then `npm run dev`. Wait for **BELAY local preview ready**, then open <http://127.0.0.1:8787> on the host. This grants operator controls locally. See [operations](docs/playtest-operations.md) for setup failures and stale sessions.
2. Once per checkout, run `npm run setup:tunnel` to install the checksum-verified official cloudflared binary locally. No account/card.
3. Run `npm run playtest:preflight`; resolve any blocked prerequisites. For the appointed session, run `npm run playtest:open` in a second terminal and wait for **Protected remote endpoint ready**. Copy the **tester** invitation from `work/playtest-links.json` to the invited partner yourself. The operator invitation is only for the host if testing the same remote path. Keep this ignored file private. Use its recorded expiry (at most two hours, or earlier teardown). Do not post it publicly.
4. The partner uses a desktop browser and joins the rope. Use another city/Wi-Fi for a remote verdict; log any hotspot trial. A second local browser or the bot is useful for setup but is not that remote evidence.
5. Both players click Join test rope. WASD/arrows move relative to the camera; hold Space to brace. Click the canvas after using developer tools. Keyboard blur/tab hiding releases movement.
6. Load a family in Operator test controls. Loading resets the flat world and accepted-input tape, preserving the connection. Default authority is 30 Hz. Leave devtools closed during free play. Take ten minutes to tug, drag, circle and then try moving together quickly.
7. Before resetting the scene, both players use **Save session measurements**. The operator report includes server timing; the tester can save their client evidence, including after a dropped connection. Record the answers below, actual RTT and its variability. Reports freeze their starting scene/session and flag any change during collection; do not combine changed scenes into one measurement. Save the tape separately if diagnosing a moment. Tape recording preserves the first 20 minutes after reset, then reports `truncated: true`; reset between sessions.
8. At the end run `npm run playtest:stop` (or Ctrl+C in its terminal). Confirm the teardown message and `work/last-playtest-teardown.json`. The gateway and tunnel close; its invitation signing key is discarded. Stop `npm run dev` with Ctrl+C when done locally.

Do not leave a tunnel running while waiting for a verdict. One temporary session is not a production service. No mic permission, account or name is requested by the prototype.

## Gate 1 questions and exit

1. **Was dragging/tugging each other funny before there was an objective?** Note the incident and whether either person laughed without prompting.
2. **Could you cooperate to walk quickly, and did that feel good?** Record loss of control, delayed tugs, corrections or camera problems separately.
3. Did you feel brace change the pull before you noticed the box pose? This diagnoses physical readability; a pose alone is insufficient.

Both 1 and 2 need the user's pass. Silence is not a pass. Record the user's actual words, not an agent's interpretation of successful bot movement.

| Session | Authority | Family | Players / network | Q1 | Q2 | Evidence / verdict |
|---|---:|---|---|---|---|---|
| 1 | 30 Hz | balanced | pending | pending | pending | not evaluated |
| 2 | 30 Hz | balanced | pending | pending | pending | not evaluated |
| 3 | 30 Hz | short | pending | pending | pending | not evaluated |
| 4 | 30 Hz | short | pending | pending | pending | not evaluated |
| 5 | 30 Hz | loose | pending | pending | pending | not evaluated |
| 6 | 30 Hz | loose | pending | pending | pending | not evaluated |

Two sessions in each family, at most six at 30 Hz. They can stop early on an explicit pass. Automated tuning and network qualification are not human sessions.

If six fail, the tick-rate contingency is separately budgeted: up to three paired 30/60 Hz diagnostic sessions using the failure RTT bracket and its adjacent available brackets from [30, 60, 100, 150, 250] ms. Test both rates with the same family, seed and conditions. At a ladder endpoint, only two brackets exist. Do not sweep five brackets in a human session. Record both answers and both measured rates. If these cannot produce a pass, change the core verb or stop. Do not continue tuning indefinitely.

## Operator API

Available after joining, in the browser console:

```js
BELAY.getState()                         // last authoritative snapshot, cloned
BELAY.counters()                         // client network + physical counters
await BELAY.pause()
await BELAY.loadScene({seed: 1701, family: 'balanced', tickHz: 30})
await BELAY.stepTicks(30)                // paused room only; exact fixed ticks
await BELAY.setSeed(42)                  // resets flat scene, preserves family/rate
await BELAY.resume()
await BELAY.serverCounters()             // execution + scheduling, memory attribution
await BELAY.tape()                       // accepted inputs; debugging, not daily anti-cheat
await BELAY.networkProfile()             // this gateway's applied delay settings
await BELAY.networkProfile({addedRttMs: 60, jitterMs: 10})
await BELAY.networkProfile({addedRttMs: 0, jitterMs: 0})
```

Network profiles add delay to an ordered WebSocket byte stream in both directions. **Added 60 ms is not a measured 60 ms RTT**; subtract the observed baseline when approaching a bracket and record the resulting measurements. Profiles are per gateway: local and tunneled connections may have different profiles. Both clients should use the same protected gateway when a paired comparison needs identical artificial impairment. Changing profiles affects active sockets. WebSocket wire packet loss is unavailable; missed echo probes and RTT variation are reported under their own names. No fabricated loss percentage.

`npm run bot -- --seconds 60 --mode bad --seed 1701` joins an available seat with the visible BOT label. Modes `brace`, `walk`, `idle` support mechanical checks. A bot never counts as a Gate 1 human or Gate 2 stranger.

## Required later stops

- Phase 2 rescue check-in: stop and re-cut if falls feel arbitrary OR any rescue role is a static hold. Do not begin Phase 3 while either holds. The re-cut budget is an open item in `PLAN.md`.
- Phase 3: review Bitter and umber against the locked art constraints, the 200 px thumbnail, outsider clip comprehension and local file output.
- Gate 2: four actual mutually unfamiliar volunteers under access control. Friends cannot pass. Silent-coordination and abandonment/hostility branches are recorded in `PLAN.md` before a matchmaker exists.
- Gate 3: daily worth opening alone; the user's proposed failure branch remains a recorded open item.
- Phase 6: production 300-room load/cost gate before public launch. Local Phase 1 results cannot pass it.
