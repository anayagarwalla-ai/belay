# BELAY — approved implementation contract

Current authorization: implement Phases 0 and 1, then STOP for the user's Gate 1 verdict. No human gate is passed. This file records the approved scope and subsequent corrections; it does not authorize further phases.

## Outcome and core

Success means four strangers laugh in their first three minutes, somebody clips it, and an outsider understands the clip and follows the link. A technically impressive game that nobody plays fails.

Two to six climbers in order on one physical rope cross a glacier. Move is the verb; brace is the modifier. Slack, pulling, catching and hauling are physical. Falls should create recoverable stories with visible responsibility and active rescue roles for everyone. No combat, crafting, inventory, XP or levelling. Runs eventually target 5–10 minutes and end at shelter or an unrecoverable team.

## Decisions carried into Phase 0

- Colyseus owns authoritative rooms: one isolated Room instance and physics world per team, maximum six bodies. It provides room lifecycle, matchmaking and transport without inventing a multiplayer service. Phase 1 permits exactly two. Local Node is the test runtime, not a production hosting decision or capacity claim.
- Fixed 30 Hz authoritative steps; local-body prediction and remote interpolation, no rollback. Identical 60 Hz internal physics substeps support the separately budgeted 60 Hz authority contingency. The client submits bounded movement/brace inputs; never authoritative positions, elapsed time or results.
- Write the unilateral PBD rope solver; use Rapier for body contacts. Brace changes ground traction and effective constraint mass. Keep all tuning and policy limits in `tuning.ts`, with rationale. Export the configuration with evidence.
- At 300 rooms, event-loop scheduling, serialization/fan-out, garbage collection and shared runtime memory can fail before six-body physics does. Measure scheduling delay plus execution, bound input rates, frame sizes, telemetry, catch-up work and room state, and distribute independent Colyseus rooms across provisioned workers at the later cost gate. No shared simulation state. Do not infer production capacity from an isolated physics benchmark.
- Solo daily is **server-simulated**. The server owns the seed, clock, attempt allocation, physics and ranking. It validates ownership, monotonic input sequence, input shape and rate. A modified client cannot submit its own position, finish time or score. No redundant tape re-validation; tapes are debugging evidence. Ordinary Rapier is sufficient; no client deterministic-build performance cost. Automation and new anonymous identities remain limitations, not problems server authority magically solves.
- Daily ranks the **BEST OF THREE attempts per browser identity per UTC day**, not the sum. Finishers precede failures, then faster finish times; failures use progress. Attempt number appears in share text. No account, compulsory name, streak or cumulative progression.
- Fixed oblique camera, per-player target weighted 65% team centroid / 35% own body, bounded zoom, off-screen tension indicators. Later fall composition must keep the hole and bracers readable without terrain occlusion.

## Phase 0 — foundations

Local repository and server skeleton; seeded flat terrain; `window.BELAY.getState()`, `counters()`, `setSeed()`, `loadScene()`, `stepTicks()`; pause/resume, accepted-input tapes and a bad bot. Reports distinguish what exists from unimplemented glacier metrics. Every provisioned resource, cost and teardown goes in `RUNBOOK.md`.

## Phase 1 — kill gate

Two grey boxes, flat ground, one rope. Move and physical brace only. No crevasses, weather, objectives, rescue, art or audio. Ten minutes of two-human play evaluates (1) whether tugging/dragging is already funny and (2) whether cooperating to walk feels good. Ask whether brace was felt before its pose was seen.

Six evaluated sessions at the default 30 Hz: two per distinct parameter family (intermediate/strong brace, short/damped, long/momentum). Log parameters, participants, network conditions, answers and verdict. A genuine remote session uses another city and Wi-Fi, ideally also a hotspot. Access is an expiring protected invitation through a free temporary tunnel, torn down and invalidated after each session. Bot runs, browser automation and local sockets do not count as evaluated human sessions.

If all six fail, before a design verdict, run a **separate budget of up to three paired 30/60 Hz diagnostic sessions**. Use the RTT bracket where failure appeared plus the adjacent available bracket on either side from 30/60/100/150/250 ms. At an endpoint there are only two available brackets. Do not sweep all five in a human session. Hold family, scenario, input submission and rendering settings constant; report actual RTT, jitter, scheduling and both rates. Added delay is not actual RTT or measured wire loss. If no pass on both questions emerges, change the core verb or stop. No indefinite tuning. STOP here until the user passes Gate 1.

## Phase 2 — incidents and rescue, grey boxes

Seeded hidden bridge load, hints clearer at low speed/brace, falling, catching, hauling and climbing through the existing inputs. Every rescue role must actively change its action; a static hold fails. Target normal rescue 10–20 seconds; first-attempt recovery 60–75%, eventual recovery 88–92%, approximately 60–72% four-incident completion. Log cascades separately, incidents 3–6/run, first incident under 45 seconds, median run 5–10 minutes, and per-player rescue idle fraction no more than 20%.

The rescue check-in is a **stop condition**: if falls read as arbitrary OR any rescue role is a static hold, stop and re-cut Phase 2 before Phase 3. Recheck with humans. Do not treat this as a status-only meeting.

## Phase 3 — presentation and local clips

Apply the locked palette: snow `#F4F7F9`, rock/shadow `#2A2F35`, depth `#1B4A7A`, glow `#7FD4E8` exclusively inside crevasses, rope `#E8541F`. Parkas vermilion `#E8541F`, ochre `#F2B441`, forest `#2F6B3A`, slate `#4A5A6B`, oxblood `#8C3B4A`, and a sixth non-purple colour. **Bitter type and umber `#795548` are candidates for the user's Phase 3 review, not settled choices.** Test umber against rock.

Flat fields, silhouette first, inked contour lines, directional hatch weather, fog/overlap depth. No neon, purple/blue gradient skies, external cyan rim light, chrome, lens flares, glassmorphism, sci-fi panels, Inter/Roboto, UI emoji, non-emitter bloom, realistic snow shaders, confetti or three landing feature cards. Four figures and the rope must read at 200 px.

Synthesized Web Audio, rope tension feedback, catch jolt/thump/skid, 300 ms fall slow motion, shelter wind cutoff. Clips ship here as **local downloadable files only**, one key, rolling maximum 15 seconds, fall-armed, portrait option, small wordmark/URL. No upload path. Structural envelope: 720p / portrait equivalent, 24 fps, target 800 kbps video + 48 kbps mono audio, hard 2 MiB output limit. Validate actual duration, compatibility, compression and thumbnail readability during Phase 3. Ask an outsider what happened before explaining the clip.

## Gate 2 recruitment — defined before Phase 4 starts

Recruit four mutually unfamiliar volunteers plus two alternates from the [itch.io Playtesting board](https://itch.io/board/385447/playtesting). The user posts a prepared invitation; no unsolicited messages or posts are sent by the agent. Screen for unfamiliarity and distribute individual expiring access credentials for an appointed closed test. This is a recruitment source, not a claim that recruitment has happened. **Currently zero strangers recruited.** If the participants turn out to be four friends, say so and mark Gate 2 NOT PASSED. Do not build the matchmaker around an imaginary audience.

## Phase 4 — strangers and arrival

Three doors in order: default QUICK ROPE (public target four), PRIVATE ROPE, later SOLO DAILY. Anonymous arrival, no name before first run, playing under 10 seconds, requeue under 5 seconds. A partial team starts with honestly labelled imperfect bots; avoid bot-caused early wipes in the first 60 seconds through bot behavior, not hidden immunity. Latecomers replace a bot with state intact or attach only at stable tension below 0.2 for 0.5 seconds, nobody in a hole and no haul underway. After 30 seconds waiting, offer spectate/requeue. Hard room cap six.

Idle 20 seconds invokes a bot; disconnected climber goes limp and keeps its body on the rope, reserved for 60 seconds. A soft removal requires three human votes in a team of at least four; no persistent bans. Initial public region NA; international private rooms use the nearest available region, showing worst team RTT. Pings/emotes initially; voice offered after the first run, never a permission prompt on arrival.

Gate 2 has two distinct failure branches, already authorized:

1. Silent coordination fails: room voice moves to v1.1.
2. Strangers abandon runs or the public queue becomes hostile rather than funny: **PRIVATE ROPE becomes the primary door and QUICK ROPE becomes secondary. Do not add moderation systems to rescue the public-first premise.**

Apply both branches if both fail. Neither branch turns a failed strangers test into a pass.

## Phase 5 — solo daily

Two climbers, one per hand; shared daily seed/weather, server authority and best of three as above, UTC midnight reset, spoiler-free share text, global daily board. Generate and test routes; only ship routes with 40–70% bot completion. Tune daily as a game worth opening alone. Gate 3 asks the user whether it is.

Only mobile-readable leaderboard/share text belongs here. The full mobile clip-arrival surface accompanies hosted clips in Phase 6, where its purpose exists. No touch gameplay in v1.

## Phase 6 — capacity, costs and hosted clips

Hosted clips require the cost proposal first. Maximum 15 seconds and 2 MiB, aggressive compression, 7-day retention, one permanent save slot per identity, three uploads per identity per UTC day. Hard global storage quota **256 MiB including pending uploads and permanent slots**; atomically reserve capacity and reconcile actual bytes. Quota/retention service failure or exhausted allowance activates a fail-closed upload switch; local download continues. Request/egress spending must also have an enforceable limit—storage quota alone cannot promise a billing cap. No upload implementation or provisioning in Phase 0/1.

Add mobile clip player, share/copy-to-desktop and leaderboard arrival alongside hosting. Accessibility; touch controls only if the feel survives (otherwise cut).

Before any public release: 300 simultaneous rooms × six synthetic clients, 60-minute sustained run after warm-up, movement/churn/reconnect scenarios. Publish p50/p95/p99 execution and scheduling, attributed per-room memory plus process overhead, and reconnect success. Target p99 scheduling plus execution below the selected authoritative tick deadline (33.3 ms at 30, 16.7 ms at 60) and at least 99.5% reconnection within five seconds of connection restoration while the 60-second body reservation remains. Missing/failing numbers block launch. Local measurements are not a substitute.

## Phase 7 — deploy

Deploy the frontend with Sites and give a public link only after gates, cost approval and production load qualification. No Phase 7 deployment is authorized by completion of Phase 1.

## Open items recorded without resolution

- **Gate 3 failure branch:** formalize the user's proposed branch later: if solo daily is not worth opening, cut it and ship without a daily, accepting the loss of the return trigger. Recorded only; not acted on in Phase 0/1.
- **Phase 2 re-cut budget:** no iteration cap is yet specified for the rescue re-cut, unlike Phase 1's six-session tuning cap. Recorded only; no budget invented here.
