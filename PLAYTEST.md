# BELAY playtests

**Gate 1: implementation stop bypassed by user instruction on 2026-09-07. Human sessions evaluated: 0/6; human feel remains unmeasured.**

Phase 2 is now authorized by that instruction. Automated evidence in `reports/` cannot establish whether dragging a partner is funny. The human protocol below remains available; no answers are inferred from the authorization to continue.

## Prepare a real two-person session

1. Run `npm ci` then `npm run dev`. Wait for **BELAY local preview ready**, then open <http://127.0.0.1:8787> on the host. This grants operator controls locally. See [operations](docs/playtest-operations.md) for setup failures and stale sessions.
2. Once per checkout, run `npm run setup:tunnel` to install the checksum-verified official cloudflared binary locally. No account/card.
3. Run `npm run playtest:preflight`; resolve any blocked prerequisites. For the appointed session, run `npm run playtest:open` in a second terminal and wait for **Protected remote endpoint ready**. Copy the **tester** invitation from `work/playtest-links.json` to the invited partner yourself. The operator invitation is only for the host if testing the same remote path. Keep this ignored file private. Use its recorded expiry (at most two hours, or earlier teardown). Do not post it publicly.
4. The partner uses a desktop browser and joins the rope. Use another city/Wi-Fi for a remote verdict; log any hotspot trial. A second local browser or the bot is useful for setup but is not that remote evidence.
5. Both players click Join test rope. WASD/arrows move relative to the camera; hold Space to brace. Click the canvas after using developer tools. Keyboard blur/tab hiding releases movement.
6. In **Operator scene controls**, select **flat**, **2 climbers**, the family, the recorded seed and **30 Hz** authority, then click **Reset and load scene**. Loading resets the world and accepted-input tape while preserving connections and pause state; click **Resume** if paused. Leave devtools closed during free play. Take ten minutes to tug, drag, circle and then try moving together quickly.
7. Before resetting the scene, both players use **Save measurements**, which downloads `belay-phase2-<timestamp>.json` even for a flat scene. The operator report includes server timing; the tester can save their client evidence, including after a dropped connection. Record the answers below, actual RTT and its variability. Reports freeze their starting scene/session and flag any change during collection; do not combine changed scenes into one measurement. The download does not include the accepted-input tape; save that separately using the operator example below if diagnosing a moment. Tape recording preserves the first 20 minutes after reset, then reports `truncated: true`; reset between sessions.
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
await BELAY.loadScene({scene: 'flat', playerCount: 2, seed: 1701, family: 'balanced', tickHz: 30})
await BELAY.stepTicks(30)                // paused room only; exact fixed ticks
await BELAY.setSeed(42)                  // resets current scene, preserves team/family/rate
await BELAY.resume()
await BELAY.serverCounters()             // execution + scheduling, memory attribution
await BELAY.tape()                       // accepted inputs; debugging, not daily anti-cheat
await BELAY.networkProfile()             // this gateway's applied delay settings
await BELAY.networkProfile({addedRttMs: 60, jitterMs: 10})
await BELAY.networkProfile({addedRttMs: 0, jitterMs: 0})
```

To download the tape before resetting, pause the room and run this in the operator console:

```js
await BELAY.pause()
const tapeUrl = URL.createObjectURL(new Blob([JSON.stringify(await BELAY.tape(), null, 2)], {type: 'application/json'}))
const tapeLink = Object.assign(document.createElement('a'), {href: tapeUrl, download: 'belay-tape.json'})
tapeLink.click()
URL.revokeObjectURL(tapeUrl)
```

Network profiles add delay to an ordered WebSocket byte stream in both directions. **Added 60 ms is not a measured 60 ms RTT**; subtract the observed baseline when approaching a bracket and record the resulting measurements. Profiles are per gateway: local and tunneled connections may have different profiles. Both clients should use the same protected gateway when a paired comparison needs identical artificial impairment. Changing profiles affects active sockets. WebSocket wire packet loss is unavailable; missed echo probes and RTT variation are reported under their own names. No fabricated loss percentage.

`npm run bot -- --seconds 60 --mode bad --seed 1701` joins one available seat with the visible BOT label. Its `--seed` selects random bot behavior, not the room's terrain seed. Modes `brace`, `walk`, `idle` support flat-ground checks; this bot's `walk` moves along world −X, not through the crossing route. Set room geometry and seed in Operator scene controls. `bot:team` accepts only `--mode` and `--seconds` and reads scene/team/seed/family/rate from the current room. A bot never counts as a Gate 1 human or Gate 2 stranger.

## Phase 2 check-in preparation

**Current outcome: the Phase 2 human stop remains unqualified.** The repaired grey-box rescue is available for diagnosis, but Phase 3 has not started. Falls have not received a human fairness/readability verdict, and a frozen helper can still be carried through some larger-team rescues. See [the current repair report](reports/phase2-repair/README.md) and the preserved `reports/phase2-baseline-findings.md`; successful bot recovery is not a pass.

1. Start and join the local preview, save any existing evidence, then click **Pause**. In **Operator scene controls**, select **rescue**, the team size, seed, family and authority, then **Reset and load scene**. The room stays paused while partners join. This fixture starts a climber at a hole; its immediate fall after resuming is not evidence of natural route pacing.
2. Invite real partners using the protected procedure above. For setup only, `npm run bot:team -- --mode recovery --seconds 120` fills the remaining seats with labeled synthetic climbers. `bad`, `walk`, `static-brace` and `frozen-tail` are also available. Check the connected count and BOT labels, then click **Resume** when ready. Stop bots before reducing the team size; restart the helper after increasing the team if the new seats need bots.
3. On snow, move along or away from the lip to change the rope angle. Hold Space to anchor; keep Space held and add a direction to haul slowly. Spread along the rope to take up slack before pulling. In the hole, move toward the wall to use your feet while helpers lift; when the lip is within reach, that effort can pull you over. If an intact bridge roofs the climber in, move along the wall toward a clear opening first. On ice a bracer can slide. The client shows the relevant wall direction and a cutaway when needed.
4. Use **Save measurements** before resetting. Record whether the warning was visible before collapse, who felt the catch, whether a casualty could act, and whether each helper needed to change action. Receipt/camera-frame timestamps do not prove human attention, and highlighted adjacent spans do not identify a rescuer or culprit. The current active-effort proxy excludes sustained dragging without input and stationary brace after a catch. Holding a direction while being pulled can still count; it cannot establish useful work or human agency.
5. Use **crossing** for the fixed 950 m route with four spaced hazards, and **flat / 2 climbers** to revisit Gate 1. The crossing is a grey-box pacing fixture; longer travel does not establish that it is fun. The historical 18.7–21.93 second smoke runs describe the replaced short fixture. Inspect an affected rope segment and the saved state/tape when a catch looks wrong. After **Finish boundary reached** or **Run ended · terminal boundary**, save evidence and use **Reset and load scene** for another run; **Resume** does not restart a completed or failed run.

Stop and re-cut if any fall reads as arbitrary or any rescue role is a static hold. A human answer has not been inferred from the instruction to bypass Gate 1. The Phase 2 re-cut budget remains an open item.

## Required later stops

- Phase 2 rescue check-in: stop and re-cut if falls feel arbitrary OR any rescue role is a static hold. Do not begin Phase 3 while either holds. The re-cut budget is an open item in `PLAN.md`.
- Phase 3: review Bitter and umber against the locked art constraints, the 200 px thumbnail, outsider clip comprehension and local file output.
- Gate 2: four actual mutually unfamiliar volunteers under access control. Friends cannot pass. Silent-coordination and abandonment/hostility branches are recorded in `PLAN.md` before a matchmaker exists.
- Gate 3: daily worth opening alone; the user's proposed failure branch remains a recorded open item.
- Phase 6: production 300-room load/cost gate before public launch. Local Phase 1 results cannot pass it.
