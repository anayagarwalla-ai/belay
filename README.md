# BELAY

Phase 2 grey-box prototype: two to six climbers, a constrained rope, seeded snow bridges, falling, catching and physical rescue. **The rescue gate is not passed:** the repaired matrix is complete, with remaining balance and participation limits in the repair report; a frozen helper can still be carried through some larger-team rescues. The user authorized continuing past Gate 1; human fun and remote feel remain unmeasured.

Use Node >=22.13.0 and run these commands from the same checkout.

```sh
npm ci
npm run dev
```

Wait for **BELAY local preview ready**, then open <http://127.0.0.1:8787> and join the test rope. WASD/arrows move relative to the camera; Space braces. In crossing/rescue, hold Space and a direction to take slow hauling steps. A fresh dev session starts a four-climber crossing with seed 1701, balanced family and 30 Hz authority. In **Operator scene controls**, choose the scene, team, family, seed and authority, then click **Reset and load scene**; selections alone do not apply. Reset preserves occupied seats and pause state, so reduce the team only after higher-numbered seats leave and click **Resume** if paused.

For synthetic partners, join in the browser first, then run:

```sh
npm run bot:team -- --mode bad --seconds 120
# Or use --mode recovery for scripted rescue partners.
```

Every synthetic seat says BOT. Ctrl+C releases their seats; they also leave at the requested deadline. The team helper uses the current room's settings and rests in the flat scene; `npm run bot -- --mode bad --seconds 60` remains available for a single flat-ground bot. For a focused rescue, follow the paused setup in `PLAYTEST.md` so the fall does not start before partners are ready. Bots are setup tools and counterexamples, never human playtest evidence. A real partner can join a second browser or use the protected invitation procedure in `PLAYTEST.md`.

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

The preserved pre-repair 1,000-trajectory matrix exposed 21-second crossings, static-helper recoveries and excessive rope stretch. The current repair changes the contact solver, energy accounting, hauling/climbing and the fixed crossing fixture; use [the current repair report](reports/phase2-repair/README.md) for its separate verification and remaining limits. The historical measurements remain [unchanged](reports/phase2-verification.md). Art, audio, clips, matchmaking, voice, daily and deployment remain in later phases; Phase 3 is paused at the rescue stop. No paid resources are provisioned.
