# BELAY operations and cost ledger

Current scope is a local/invitation-only Phase 2 grey-box prototype. **No paid resource, hosting account, card, database, object store, leaderboard, voice service, clip upload endpoint, permanent public URL or production server has been provisioned.** The Sites scaffold is local; `.openai/hosting.json` has no remote project registration.

| Resource | Provisioned / purpose | External cost | Stop / teardown |
|---|---|---:|---|
| Local npm packages and build output | Development dependencies; lockfile pinned | $0 | Stop dev first; remove `node_modules`, `dist`, `.vinext`, `.wrangler` if no longer needed |
| Local Colyseus server | Loopback `127.0.0.1:2567`, one persistent four-climber crossing room, operator-selectable from two to six; temporary independent rooms during integration checks | $0 | Ctrl+C in `npm run dev`; child process group stops and memory-only rooms vanish |
| Local Vinext dev frontend | Loopback `127.0.0.1:5173` | $0 | Same dev shutdown |
| Local operator gateway | Loopback `127.0.0.1:8787` | $0 | Same dev shutdown; removes `work/dev-session.json` |
| `.tools/cloudflared` | Official macOS binary pinned/checksum-verified by `setup:tunnel`; public checksum receipt, no runtime credentials; downloading it creates no tunnel | $0 | Stop any owned tunnel first; remove `.tools/` when unused |
| Temporary Quick Tunnel | Only while `npm run playtest:open` runs; forwarding to invitation-protected loopback gateway `:8788`, maximum two hours | $0, no account/card | `npm run playtest:stop` or Ctrl+C; kills cloudflared, closes gateway/sockets, discards per-session signing key, removes invitation files, writes teardown record |
| Browser verification session | Local isolated `agent-browser` session `belay-check` | $0 | `npx --yes agent-browser --session belay-check close` |
| Bot teammates | Local synthetic SDK clients, visibly labeled BOT; finite requested duration | $0 | Ctrl+C in `npm run bot:team`; deadline also releases their seats |
| Load and profiling children | Ephemeral local authorities and synthetic clients, owned by bounded harnesses; no remote resources | $0 | Ctrl+C in the harness; owned-child teardown receipts are saved in its report directory |
| Historical completed offline Phase 2 matrix | Fixed 1,000-trajectory job finished September 8, 2026 at 04:25:36 UTC; four successful worker exits and independent final reconciliation recorded; no benchmark processes remain | $0 external | Already stopped. Preserve original raw evidence and packaged reconstruction receipts; do not restart it as part of consolidation |
| Phase 2 repair benchmark | Candidate `b547985`: stopped 2026-09-08 at 16:15:04 UTC after discovering rope overstretch; 74/1,000 records, including four intentionally interrupted rows. Evidence retained in `reports/phase2-parallel-2026-09-08T16-07-30.630Z-624595fd-adc3-4749-829a-c197e9c4c769/`. All four workers closed; no benchmark remains running | $0 external | Already stopped. Preserve the partial evidence and pre-launch pins; a subsequent campaign must use a fresh directory and pin receipt. No scheduled task. |
| Test reports/screenshots | Local `reports/` and ignored `work/` | $0 | Remove local artifacts when no longer needed; never commit session keys |
| Historical scheduled follow-ups — deleted | User requested immediate consolidation and deletion of schedules. `finish-belay-consolidation` was deleted; `keep-belay-tasks-progressing` and `belay-full-matrix-evidence` were already absent. No BELAY automation definitions remain | Prior runs used the existing Codex account; token/dollar cost not exposed; no external service | No scheduled cleanup remains. Deleting a follow-up does not kill native processes; the completed matrix's owned exits were verified separately |
| Parallel Codex project worktrees | Five project tasks for physics, client verification, bot evidence, load profiling and rescue re-cut; changes reviewed and integrated into the primary checkout | No external service provisioned; existing account usage applies | Keep task history for review; stop owned commands before removing worktrees through Codex |

Local machine electricity and bandwidth are not measured here. Quick Tunnel verification checks reachability/access control, not a service guarantee. No resource is authorized to incur metered spend at this phase. See `reports/phase1-remote.json` when present for the verification/teardown evidence; it contains no invitation secrets.

## Start and normal shutdown

```sh
npm ci
npm run dev
```

Wait for **BELAY local preview ready**, then open <http://127.0.0.1:8787>. Run the tunnel commands in a second terminal only for a scheduled invited test:

```sh
npm run setup:tunnel
npm run playtest:preflight
npm run playtest:open
```

Read `work/playtest-links.json` locally; manually send only the tester link to the invited tester. Never print access tokens into reports, commit them or post them publicly. Local operator access requires no invitation; remote operator access uses the separate operator link. Invite credentials expire and are scoped to a fresh signing key for each tunnel session.

```sh
npm run playtest:stop
```

Stop any separately started bot terminals with Ctrl+C as well. Then Ctrl+C in the dev terminal, or run `npm run dev -- --stop` from the same checkout and wait for its teardown confirmation. Stop commands authenticate a loopback control request; they never signal a PID copied from disk. Owned process guardians stop descendants even after parent loss. Session files are atomic/private, and duplicate starts cannot replace another session's credentials. Preflight distinguishes stale, foreign and legacy records. Follow [playtest operations](docs/playtest-operations.md) for recovery and confirmed teardown; a missing teardown record is not proof of cleanup. Restarting dev rotates its backend signing key.

## Verification commands

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run bench
npm run test:network
```

The Phase 2 commands are `test:phase2-smoke`, `test:phase2-replay`, `test:phase2-stress`, `bench:phase2` and `test:local-load`. The full matrix retains 600-second crossing and 60-second rescue horizons and may take hours; interrupted prefixes are incomplete evidence. Local load defaults to ten rooms and uses process/host memory guards; a guard abort is not a pass. CPU/heap profiles describe allocation churn separately from resident memory.

The guarded **offline four-worker** alternative runs that fixed 1,000-trajectory matrix in disjoint shards; `bench:phase2` remains the sequential entrypoint. For a scheduled offline run, use the native launcher directly from the intended checkout:

```sh
node scripts/phase2-parallel-entry.mjs --run
```

Unlike the local preview's Node minimum, this runner currently requires **Node 26.5.0, libuv 1.52.1, macOS (`darwin`)**, matching `TUNING.phase2Evidence.parallel.availableMemoryRuntime`. It refuses custom Node preloads/loaders, `NODE_OPTIONS` or `NODE_PATH`, and unsupported/unavailable memory telemetry. Do not wrap it in `tsx`. On the supported runtime, `--plan` (or no argument) writes `reports/phase2-parallel-plan.json` with a `preflightRefusal` field and launches no workers; it does not prove a later run will meet the guards.

The current root profile requires at least 3.5 GiB of heuristic available memory initially and 1 GiB while running; raw free memory is recorded separately. It applies a 512 MiB RSS ceiling per worker, a 3 GiB controller/worker aggregate policy, a 24-hour wall-time ceiling and a 256 MiB output envelope. Sampled memory limits can overshoot between observations. A refusal, interruption, source mismatch, missing shard or failed finalization leaves **INCOMPLETE** evidence, not a passed benchmark; early launcher refusal may produce no job report. Each `--run` creates a fresh `reports/phase2-parallel-<timestamp>-<id>/` job, not a resume. Do not start a duplicate or overlap it with human free play or other resource-heavy qualification.

For shutdown, Ctrl+C the launcher and wait for its owned children to exit. Inspect `status.json`, `result.json` when available, per-worker exit receipts and any `watchdog.json`; missing output is not completion. Independent watchdogs bound blocked/orphaned owned processes, and persisted raw journals remain partial evidence after an interrupted job. This command starts no app server or tunnel and incurs no external service cost. Its step timings exclude policy, IO, transport and scheduling; four workers on one shared host do not qualify production capacity or a human gate.

Network checks require the dev server. `bench` does 1,000 deterministic, fixed-duration flat-ground bad-bot trajectories; it is not a run-length or rescue simulation. `test:network` uses real local sockets and ephemeral rooms, validates isolation/auth/input boundaries and writes its scope into the report. Do not run qualification while a human is evaluating feel; machine contention affects timing.

`npm run test:latency` qualifies added stream delay at 30 Hz; it does not conduct the conditional human 30/60 comparison. `npm run test:remote` requires an active temporary tunnel, checks it from this machine, then stops it automatically. The remote check does not count as a second-city participant. `npm run lint` covers the active prototype and its used UI primitive; `npm run lint:all` also covers unused generated shadcn components, which retain upstream scaffold lint findings.

## Authority and operational limits

Each Colyseus room owns its Rapier world, PBD rope, input state and telemetry. Room admission follows the selected two-to-six-climber scene; six is the hard ceiling. Flat two-climber mode preserves the Gate 1 solver. Inputs are bounded and sequenced, and expire after 250 ms without a refresh. Debug mutations and room allocation require operator authorization. The protected gateway rejects unauthenticated HTTP assets/API/WebSocket upgrades and strips incoming privilege headers. It also denies private runtime files and developer inspector routes to invited testers; Vite independently denies private files, including its `/@fs` path. The backend key is not passed to the frontend or tunnel process. This is a temporary test perimeter, not production identity or DDoS infrastructure. The development frontend must never be exposed directly.

Telemetry rings, catch-up work and the accepted-input tape are bounded. Tapes preserve the first 20 minutes after scene reset, then mark truncation; simulation continues. Memory reports explicitly identify shared process RSS/heap, not pretend per-room memory. Ticks include serialization/send scheduling; wire delivery remains asynchronous. No 300-room capacity or reconnection target has been qualified. Same-body reconnect is still Phase 4 work; current disconnects release their seats while the physical bodies remain. Production placement, scaling, observability and paid hosting await the Phase 6 proposal.

## Future costs — not provisioned

Clip uploads stay disabled. Phase 3 downloads only. Before Phase 6 hosting: price request, write/read, retained bytes, bandwidth, transcoding (if any), authentication and quota-coordination operations. Enforce 15 seconds / 2 MiB, three uploads per identity/day, seven-day retention plus one permanent slot, and 256 MiB global capacity including reservations/permanent files. Reconcile byte reservations, automatic retention and the kill switch. Fail closed to download-only if any budget control is unavailable. A storage limit alone does not cap bandwidth/request spending; the proposal must solve that or uploads stay off.

Before any public launch, record the exact provider, region, instance/worker counts, all fixed and metered costs, hard spending controls and teardown commands in this ledger. Complete the 300-room production workload and reconnect gate. Public deployment with Sites is Phase 7 and has not occurred.
