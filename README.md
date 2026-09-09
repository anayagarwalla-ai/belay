# BELAY

Short-crossing playtest: two to six climbers, a constrained rope, seeded snow bridges, falling, catching and physical rescue. The user rejected the previous cut as unclear, slow and drab and approved a 60–90-second experiment. **The rescue gate is not passed:** the repaired matrix is complete, with remaining balance and participation limits in the repair report; a frozen helper can still be carried through some larger-team rescues. The user authorized continuing past Gate 1; human fun and remote feel remain unmeasured.

Use Node >=22.13.0 and run these commands from the same checkout.

```sh
npm ci
npm run dev
```

Wait for **BELAY local preview ready**, then open <http://127.0.0.1:8787> and click **START CROSSING**. An otherwise empty operator rope resets into the short crossing and adds three labeled BOT partners before starting. Joining an existing team leaves its run intact. **Get every climber across three crevasses and to the hut.** The route is 100 metres from the lead climber's start, with gaps at 8, 36 and 68 metres. The HUD measures distance from the last climber, so its initial distance is longer.

WASD/arrows move relative to the camera. **S + A together goes toward the hut**, diagonally down-left. **Release Space to walk at full speed.** Hold Space to catch a falling teammate, then hold a direction away from the hole to haul. A hanging player moves into the wall to climb while the team hauls. The HUD changes instructions with the actual rescue state. The terminal result has a **GO AGAIN** button. Sound starts on a click; the top-right toggle mutes it.

**Test tools** contains measurements, bot behavior and operator scene controls. A fresh local session uses four climbers, seed 1701, balanced family and 30 Hz authority. To test another scene, select scene/team/family/seed/rate and click **Reset and load scene**. Selections alone do not apply; resets preserve occupied seats and pause state. Stop bots before reducing the team size, and click **Resume** if paused.

For clumsy partners, stop the cooperative bots, choose **Clumsy**, then **Fill empty seats with bots**. Leaving, hiding the tab, a stale/disconnected connection, or the ten-minute deadline closes browser-owned bot seats. A hidden-tab return requires **Fill empty seats with bots** again. These partners are diagnostic bots, not Solo Daily or evidence that strangers cooperate. The short route is not yet balanced across team sizes; the seed-1701 three-climber bot check stalled. See [short-crossing evidence](reports/short-crossing/README.md).

The terminal helper is also available after joining in the browser:

```sh
npm run bot:team -- --mode bad --seconds 120
# Or use --mode recovery for scripted rescue partners.
```

Every synthetic seat says BOT. Ctrl+C releases terminal bots; they also leave at the requested deadline. The terminal helper uses the current room's settings and rests in the flat scene; `npm run bot -- --mode bad --seconds 60` remains available for a single flat-ground bot. Browser practice bots use the same public-state policies and rest during pause, flat scenes, and terminal results. Saved measurements retain observed bot seat IDs for their measurement window, including bots that have left. A real partner can join a second browser or use the protected invitation procedure in `PLAYTEST.md`.

Save evidence before resetting. Stop bot terminals with Ctrl+C; stop local dev with Ctrl+C in its terminal or `npm run dev -- --stop` from this checkout. Invited-session teardown is in `RUNBOOK.md`.

- `PLAN.md` — approved phases, hard stops and the two recorded open items.
- `PLAYTEST.md` — scene recipes, human questions and debug API.
- `RUNBOOK.md` — local ports, access control, costs and teardown.
- `CONSOLIDATION.md` — consolidated batch, verification and remaining human decisions.
- `WORKSTREAMS.md` — frozen work queue, task handoffs and coordination boundaries.
- `tuning.ts` — gameplay, network and policy constants with rationale.
- `reports/phase2-repair/README.md` — current repairs, saved regressions and new verification.
- `reports/phase2-baseline-findings.md` — preserved historical target misses and static-role counterexamples.
- `reports/local-load-profile-findings.md` — six-body CPU/allocation evidence; no capacity qualification.
- `docs/design/` — prepared rescue, clip, stranger-test and production proposals.

Colyseus owns fixed-step rooms; Rapier handles body contacts alongside a custom PBD rope solver. The client predicts only its own grounded movement and interpolates others. Debugging includes reproducible accepted-input tapes, scene stepping, per-seat event delivery and bounded telemetry. Daily authority is decided: server-simulated, **best of three**; daily gameplay is not built.

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run verify:evidence   # Check stored hashes, lossless artifacts and source bundle.
npm run test:phase2-smoke
npm run test:phase2-replay
npm run test:phase2-stress
npm run bench:phase2       # Full 1,000-trajectory matrix; can take hours on this prototype.
npm run test:local-load    # Guarded local socket workload; not production qualification.
```

`bench:phase2` is the sequential matrix runner. The guarded native four-worker alternative has a separate invocation and pinned runtime; see `RUNBOOK.md` before starting an offline job.

The preserved pre-repair 1,000-trajectory matrix exposed 21-second crossings, static-helper recoveries and excessive rope stretch. The current repair changes the contact solver, energy accounting, hauling/climbing and the fixed crossing fixture; use [the current repair report](reports/phase2-repair/README.md) for its separate verification and remaining limits. The historical measurements remain [unchanged](reports/phase2-verification.md). The user-authorized re-cut adds the locked palette, simple parka silhouettes, goal guidance and synthesized rope/catch audio. Full art approval, clips, matchmaking, voice, daily and deployment remain later work; the rescue stop still applies. No paid resources are provisioned.
