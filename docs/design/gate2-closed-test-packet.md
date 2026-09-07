# Gate 2: unpublished closed-test packet

**UNPUBLISHED DRAFT. Recruited: zero. Screened: zero. Scheduled: none. Gate 2: NOT PASSED.** This file prepares the user's later invitation and test; it authorizes no post, direct message, credential distribution, tunnel or matchmaking implementation. Gate 1 has not passed. Read the governing [plan](../../PLAN.md) and [playtest instructions](../../PLAYTEST.md).

The approved source is the [itch.io Playtesting board](https://itch.io/board/385447/playtesting). Its current listing includes a “Looking for Playtesters Post Template”; the user should check the board's current posting guidance when they are ready. The board listing establishes a recruitment venue, not available volunteers or consent to contact its users. [Official board listing consulted 2026-09-07](https://itch.io/board/385447/playtesting-).

## Invitation for the user to review and eventually post

All bracketed fields must be completed before posting. Do not include a public game link or a reusable access token. This is a prepared text block, not a sent or scheduled message.

> **BELAY — looking for four first-time browser playtesters and two alternates**
>
> BELAY is an early cooperative glacier game for desktop browsers. You move and brace while connected to other climbers by a physical rope. I want to see how first-time players find their way through a run together and where the game is confusing.
>
> I'm looking for four volunteers who do not already know one another, plus two alternates in case someone cannot attend. Please apply individually; this particular session is for people meeting for the first time, rather than an existing group. No previous climbing-game experience is needed.
>
> **System:** desktop/laptop, keyboard, [browser builds verified for this test]. No install or microphone permission is required. This is an early build; bugs are possible.
>
> **Time:** [date, start/end time and named time zone, with UTC equivalent]. The appointment includes a connection check, an initial run, an optional further run and a short private debrief. Runs currently aim for 5–10 minutes; the appointment window above is the actual time commitment.
>
> **Access:** an individually issued invitation for the appointed closed test. Please do not forward it. Alternates will be told whether they are needed by [specific time and time zone]; they are not being asked to wait indefinitely.
>
> **What I'll collect:** connection/timing measurements, game events and your feedback. The game can save a short local gameplay clip if you choose; saving a file does not publish or upload it. [State exactly whether any separate host observation or recording is planned and how participants can decline it.] The test does not require recording your camera, microphone or desktop.
>
> **To volunteer:** [user-selected private opt-in reply method]. Tell me your available slot/time zone, desktop browser/OS, broad region and whether you have played or watched BELAY or know anyone else applying. Please do not post sensitive information or invite links publicly. I'll privately check the final group's unfamiliarity before confirming places.
>
> This is a volunteer session. You can stop at any time or decline another run; candid feedback is useful. I will not ask you to keep playing to make a test result look better.

Posting readiness requires a later runnable, privately accessible build that has cleared earlier stops, a filled appointment/contact plan and an honest browser support list. The host must not promise a production public queue, hosted clips, voice or mobile controls that do not exist.

## Private screening script

Use participant aliases for the study sheet. Keep contact details and credentials outside Git and outside shared measurement reports. The user performs later communication; the agent does not contact the board or its members.

1. “Have you played BELAY, watched a BELAY session or clip, or read a detailed explanation of how its falls and rescues work? What have you seen?” Record exact prior exposure. Primary recruits should be first-time and unbriefed; prior exposure is disclosed and does not get silently recoded as first-time evidence.
2. “Are you applying with anyone, or do you know another applicant through work, school, friends, family, regular online play or a community group? You needn't describe private relationships; a yes/no and the other person's test alias are enough.” A pre-existing meaningful interaction counts as familiar. Sharing a large board without having interacted is not itself friendship.
3. “Can you use a desktop/laptop keyboard and [verified browser] at [appointment and time zone]? What broad region and connection type will you use?” Record technical fit separately from familiarity. Do not reject a connection merely to hide a real latency problem; record eligibility requirements before seeing game outcomes.
4. “Are you available for a primary place, an alternate place, or either? If an alternate, can we confirm your status by [time]?” Being an alternate is not agreement to join on demand indefinitely.
5. “The final group will use these test aliases: [aliases shared for recognition with participants' agreement]. Do you recognize or already know any of them? Please answer privately.” Do this with primaries and both alternates so each possible substitution is screened.
6. “The session records [exact declared evidence]. Is that acceptable, and are there observations or recordings you decline? You can leave the test at any point.” Record consent scope separately; no optional recording becomes a participation requirement by accident.

Uncertainty about whether two people know each other stays **unconfirmed**, not “unfamiliar.” Replace or reschedule as needed. At arrival, privately reconfirm recognition before play. If a relationship is discovered later, preserve the honest evidence and mark the cohort invalid for Gate 2. If the four turn out to be friends, write **four friends; Gate 2 NOT PASSED**.

## Roster and pairwise check — currently empty

| Alias | Primary/alternate | Opted in | First-time/exposure | Technical fit | Slot confirmed | Recognition check | Evidence consent | Status |
|---|---|---|---|---|---|---|---|---|
| P1 | primary | pending | pending | pending | pending | pending | pending | not recruited |
| P2 | primary | pending | pending | pending | pending | pending | pending | not recruited |
| P3 | primary | pending | pending | pending | pending | pending | pending | not recruited |
| P4 | primary | pending | pending | pending | pending | pending | pending | not recruited |
| A1 | alternate | pending | pending | pending | pending | pending | pending | not recruited |
| A2 | alternate | pending | pending | pending | pending | pending | pending | not recruited |

Every pair among the six needs an unfamiliarity result because any alternate can join any retained primary. Each cell below requires both people's private answers, date and screener. `U` means mutually reported unfamiliar; `F` means familiar; `?` means missing/uncertain. Self-cells and mirrored duplicates are not evidence.

| Pair from ↓ / to → | P1 | P2 | P3 | P4 | A1 | A2 |
|---|---|---|---|---|---|---|
| P1 | — | ? | ? | ? | ? | ? |
| P2 | — | — | ? | ? | ? | ? |
| P3 | — | — | — | ? | ? | ? |
| P4 | — | — | — | — | ? | ? |
| A1 | — | — | — | — | — | ? |
| A2 | — | — | — | — | — | — |

The evaluated cohort contains four actual screened humans. The host, bots and standby alternates do not count as those strangers. The host does not occupy an active seat. If fewer than four arrive, an eligible alternate can replace a no-show **before** the evaluated first run. Otherwise reschedule or label the session setup-only. A mid-run replacement creates a changed cohort and cannot retrospectively complete the original first-three-minute observation.

## Host preparation and access protocol

1. Record build SHA, root tuning/config hash, phase authorizations, resolved browser qualification, scene/seed, host and observer roles, planned appointment and evidence locations. The Gate 1 verdict and Phase 2 rescue check must be actual user/human evidence. Merely having this packet ready does not unlock Phase 4.
2. Verify a protected closed environment only when separately authorized for that appointment. No tunnel is started by this design task. Check anonymous visitors, expired credentials and role-spoofing attempts are rejected; a tester cannot obtain operator controls. The current Phase 1 gateway is not proof of a future four-player identity/reservation implementation.
3. Issue a distinct expiring credential to each confirmed person using the approved future access mechanism. Store only a non-secret credential identifier and expiry in the score sheet. Bind it to a tester capability and the intended test; do not reuse the operator invitation. Revoke unused/replaced credentials. Do not put any credential in a public board reply, clip overlay, screenshot or Git file.
4. Keep alternates outside the game until called. They must not observe the first group's run and then be counted as unexposed substitutes. Tell unused alternates when they are released from standby at the previously agreed time.
5. Check each browser's controls and connectivity individually without teaching rescue tactics or showing a success clip. Log any help. Do not pre-teach “one person should stay back” or “remember to take up slack.” Keep this setup separate from measured product arrival so early loading cannot disappear from the arrival metric.
6. Reconfirm the actual four-person cohort privately at entry. During the measured silent run, the host gives no coordination hints and players use only the in-game communication available in that build. An external group voice/chat channel used to coordinate contaminates silent-coordination evidence. A private technical/emergency contact can remain available; every interruption is logged.

The neutral opening script is: “Thanks for helping. Please enter through the supplied invitation and play as you normally would. The controls are move and brace, and the game shows its available communication controls. I am looking at the game, not testing your skill. You can stop whenever you want. I will stay quiet during play and ask about it afterwards.”

Do not tell participants that they are expected to laugh, succeed, clip something or rescue one another in a particular way. Do not promise that failure is funny. If they ask about a broken connection, help them and timestamp the intervention; don't let a preventable technical problem continue for the sake of a “pure” test.

## Observation sequence

**Arrival:** start timing at the participant's first navigation/activation of their valid invitation in the declared browser state; record whether the application was already loaded. Stop at first accepted movement that visibly controls their body. Report entry-to-action for each player, login/access delay, network delay and any host assistance. The contract is playing under 10 seconds. Do not remove credential screens or loading from the denominator. Requeue timing runs from the player's requeue action to accepted control in the next room, target under 5 seconds; if the build has no requeue, mark it untested.

**First run:** record the first three minutes from the team's first playable moment, and continue through outcome or voluntary exit. Capture important moments without interruption: coordination attempts and responses, avoidable versus misunderstood pulls, help-seeking, recovery, visible self-reported amusement, discomfort and departure. Maintain per-client timestamps. The first three minutes are a specific observation window from the success criterion, not permission to stop recording negative outcomes later in the run.

**Voluntary next action:** at the normal end/requeue point observe what players actually choose. Don't ask them to requeue before recording that choice. A scheduled time commitment, host request or courteous “sure” is not evidence of spontaneous return. If a further run occurs, label learned behavior separately from first exposure.

**Private debrief:** ask participants independently before a group discussion can homogenize their answers. Use neutral questions: “What happened in that run?” “When did you understand what the others were trying to do?” “When were you stuck, and what did you try?” “Was there a moment you enjoyed or disliked?” “What would you choose to do next?” If they exited, “What made you stop?” Preserve their words and the associated incident/timestamp.

**Clip/outsider check:** observe whether someone independently uses the available local clip action. If nobody does, record that before any later diagnostic prompt. Local save, local download and voluntary external sharing are distinct outcomes. For a separately consented local viewing, use an outsider who has not watched the session or been briefed; ask “What happened here?” before explaining BELAY. Record whether the outsider can find/understand the approved destination. Phase 3's lack of hosted clips means a public-link-following funnel is not yet measurable; mark it untested, not successful.

In a silent session the host may be unable to hear laughter. Distinguish observed laughter with declared observation, participant-reported laughter, typed reactions, and no evidence. Do not infer laughter from a successful rescue, an avatar movement, an agent or a bot. No voice/recording infrastructure is built to manufacture this measurement.

## Score sheet — copy for each real session

Session metadata:

| Field | Value |
|---|---|
| Session/date/start/end/time zone | pending |
| Host / observer / evidence consent scope | pending |
| Build SHA / root tuning hash / scene profile / seed | pending |
| Gate 1 and Phase 2 human evidence references | pending |
| Actual cohort aliases / primary substitutions | pending |
| All cohort pairs confirmed unfamiliar | pending |
| Actual browsers/OS/regions/connection types | pending |
| Access creation / expiry / credential IDs, never secrets | pending |
| Host interventions / contamination / interruptions | pending |

Participant outcomes:

| Alias | Entry→control; cached? | RTT/jitter | First-run end/exit and reason | Coordination attempts/responses | Amusement evidence kind/time | Voluntary requeue and latency | Local clip use | Private quote |
|---|---|---|---|---|---|---|---|---|
| P1 | pending | pending | pending | pending | pending | pending | pending | pending |
| P2 | pending | pending | pending | pending | pending | pending | pending | pending |
| P3 | pending | pending | pending | pending | pending | pending | pending | pending |
| P4 | pending | pending | pending | pending | pending | pending | pending | pending |

Event ledger, one row per observed event:

| Event ID / local+server time | Aliases involved | Observed action and response | Available cue/ping | Technical issue? | Host intervention? | Observation vs interpretation | Evidence reference |
|---|---|---|---|---|---|---|---|
| pending | pending | pending | pending | pending | pending | pending | pending |

Decision sheet:

| Question | Evidence required | Current result |
|---|---|---|
| Was the cohort valid? | Four humans, all mutually unfamiliar; exposure and substitutions disclosed | NOT EVALUATED |
| Did silent coordination work? | Actual signals/actions/responses and private explanations; show unrecoverable misunderstandings as well as successful cooperation | NOT EVALUATED |
| Did strangers abandon, or did the queue become hostile rather than funny? | Voluntary exits/reasons, repeated disruptive interaction and participants' accounts; distinguish technical disconnects and consensual comic mistakes | NOT EVALUATED |
| Was amusement spontaneous in the first three minutes? | Event/quote and evidence kind, without a prompt to laugh | NOT EVALUATED |
| Did somebody choose to clip? | Actual local action and whether it was prompted; no inference from a recorder feature existing | NOT EVALUATED |
| Did an unbriefed outsider understand? | First explanation before coaching, readable action/rope, destination behavior actually observable at this phase | NOT EVALUATED |
| Which branches apply? | Separate findings for silent coordination and abandonment/hostility | UNDECIDED |
| User's Gate 2 verdict | Exact words, date and evidence references | NOT PASSED |

No new numerical pass score or participant voting rule is introduced. Report counts and individual outcomes for this small cohort, not a claim of population-level retention. Lack of complaint is not evidence of good coordination. A single closed cohort is limited evidence about a future public queue; preserve that limitation even if its verdict is positive.

## Both approved failure branches, kept separate

| Silent coordination | Abandonment/hostility | Required branch |
|---|---|---|
| Fails | Does not fail in this evidence | **Room voice moves to v1.1.** Record Gate 2 failure; do not implement voice now to rewrite the silent result. |
| Does not fail in this evidence | Fails | **PRIVATE ROPE becomes the primary door; QUICK ROPE becomes secondary.** Do not add moderation systems to rescue the public-first premise. |
| Fails | Fails | Apply **both** changes: voice to v1.1, PRIVATE ROPE primary and QUICK ROPE secondary. |
| Inconclusive / invalid cohort | Any | Preserve findings but no pass; determine the required later evidence with the user. Four friends cannot satisfy this gate. |
| Neither fails in valid evidence | Neither fails in valid evidence | Present all evidence for the user's verdict; there is no automatic pass from the agent. |

Neither branch turns a failed strangers test into a pass. Do not collapse “can't coordinate silently” into “need stronger public moderation,” or treat a private-first change as permission to start voice work. The [plan](../../PLAN.md) already records both branches; this packet does not amend them.

After the appointment, invalidate every issued credential, stop only the owned temporary environment through its documented teardown, verify access no longer works, release alternates, and keep only the declared consented evidence. Do not leave a public tunnel running while waiting for analysis or a verdict. No such environment or contact has been started by this task.
