# BELAY

Phase 0/1 prototype: two grey boxes, a physical rope, flat ground. **Waiting for the user's Gate 1 verdict.**

```sh
npm install
npm run dev
```

Open <http://127.0.0.1:8787>. Click **Join test rope**. WASD/arrows move; Space braces. Join a second browser or follow `PLAYTEST.md` for an invited remote partner. This is not the public game.

- `PLAN.md` — approved phases, hard stops and the two recorded open items.
- `PLAYTEST.md` — ten-minute Gate 1 session, six-session budget, separate tick-rate contingency and debug API.
- `RUNBOOK.md` — local ports, temporary access, cost ledger and teardown.
- `tuning.ts` — all gameplay, network and policy tuning with rationale.
- `reports/` — measured evidence with scope/limitations; no human verdict inferred.

Architecture: Colyseus authoritative fixed-step rooms, Rapier body contacts, custom unilateral PBD rope constraints, Three.js grey-box viewport, local-only client movement prediction and remote interpolation. Daily authority is already decided: server-simulated, best of three; daily gameplay is not built.

```sh
npm test
npm run typecheck
npm run build
npm run bench
npm run test:network   # requires npm run dev
npm run bot -- --seconds 60 --mode bad
```

No crevasses, rescue, art, audio, matchmaking, voice, clips, daily or deployment before their approved phases. No paid resources provisioned.
