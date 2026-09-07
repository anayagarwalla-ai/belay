# BELAY

Phase 0/1 prototype: two grey boxes, a physical rope, flat ground. **Phase 2 is now authorized and under development in parallel project tasks.** The user bypassed the Gate 1 stop; human fun and remote-feel evidence remain unmeasured.

```sh
npm ci
npm run dev
```

Wait for **BELAY local preview ready**, then open <http://127.0.0.1:8787>. Click **Join test rope**. WASD/arrows move; Space braces. Join a second browser or follow `PLAYTEST.md` for an invited remote partner. This is not the public game.

- `PLAN.md` — approved phases, hard stops and the two recorded open items.
- `PLAYTEST.md` — ten-minute Gate 1 session, six-session budget, separate tick-rate contingency and debug API.
- `RUNBOOK.md` — local ports, temporary access, cost ledger and teardown.
- `tuning.ts` — all gameplay, network and policy tuning with rationale.
- `reports/` — measured evidence with scope/limitations; no human verdict inferred.
- `docs/playtest-operations.md` — readiness, preflight, safe teardown and stale-session recovery.
- `docs/design/` — prepared proposals for rescue, local clips, stranger testing and production qualification; later gameplay remains gated.

Architecture: Colyseus authoritative fixed-step rooms, Rapier body contacts, custom unilateral PBD rope constraints, Three.js grey-box viewport, local-only client movement prediction and remote interpolation. Daily authority is already decided: server-simulated, best of three; daily gameplay is not built.

```sh
npm test
npm run typecheck
npm run build
npm run bench
npm run test:network   # requires npm run dev
npm run playtest:preflight -- --local
npm run bot -- --seconds 60 --mode bad
```

The three active tasks are implementing Phase 2 physics, its client and its bot/evidence harness. Art, audio, matchmaking, voice, clips, daily and deployment remain in their later phases. No paid resources provisioned.
