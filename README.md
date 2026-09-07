# BELAY

Phase 2 grey-box prototype: two to six climbers, a constrained rope, seeded snow bridges, falling, catching and physical rescue. **The rescue gate is not passed:** static helpers can still be carried through a successful rescue. The user authorized continuing past Gate 1; human fun and remote feel remain unmeasured.

```sh
npm ci
npm run dev
```

Wait for **BELAY local preview ready**, then open <http://127.0.0.1:8787> and join the test rope. WASD/arrows move relative to the camera; Space braces. The default scene is a four-climber crossing. Operator scene controls select flat ground, crossing or focused rescue; two to six climbers; rope family; seed; and 30/60 Hz authority. Reset preserves occupied seats, so reduce the team only after higher-numbered seats leave.

For synthetic partners, join in the browser first, then run:

```sh
npm run bot:team -- --mode bad --seconds 120
# Or use --mode recovery for scripted rescue partners.
```

Every synthetic seat says BOT. Ctrl+C releases their seats; they also leave at the requested deadline. The team helper rests in the flat scene; `npm run bot -- --mode bad --seconds 60` remains available for a single flat-ground bot. Bots are setup tools and counterexamples, never human playtest evidence. A real partner can join a second browser or use the protected invitation procedure in `PLAYTEST.md`.

- `PLAN.md` — approved phases, hard stops and the two recorded open items.
- `PLAYTEST.md` — scene recipes, human questions and debug API.
- `RUNBOOK.md` — local ports, access control, costs and teardown.
- `WORKSTREAMS.md` — five active tasks, assignments and coordination boundaries.
- `tuning.ts` — gameplay, network and policy constants with rationale.
- `reports/phase2-baseline-findings.md` — measured target misses and static-role counterexamples.
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

The crossing fixture currently takes seconds rather than five to ten minutes, and recovery-policy smoke runs produced no crossing falls. Focused rescues recover too quickly, some static roles succeed, and some recorded rope segments exceed the existing error bound. The reports retain these failures. Art, audio, clips, matchmaking, voice, daily and deployment remain in later phases; Phase 3 is paused at the rescue stop. No paid resources are provisioned.
