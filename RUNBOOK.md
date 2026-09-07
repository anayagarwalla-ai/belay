# BELAY operations and cost ledger

Current scope is an invitation-only Phase 1 prototype. **No paid resource, hosting account, card, database, object store, leaderboard, voice service, clip upload endpoint, permanent public URL or production server has been provisioned.** The Sites scaffold is local; `.openai/hosting.json` has no remote project registration.

| Resource | Provisioned / purpose | External cost | Stop / teardown |
|---|---|---:|---|
| Local npm packages and build output | Development dependencies; lockfile pinned | $0 | Stop dev first; remove `node_modules`, `dist`, `.vinext`, `.wrangler` if no longer needed |
| Local Colyseus server | Loopback `127.0.0.1:2567`, one persistent two-player room; temporary independent rooms during integration checks | $0 | Ctrl+C in `npm run dev`; child process group stops and memory-only rooms vanish |
| Local Vinext dev frontend | Loopback `127.0.0.1:5173` | $0 | Same dev shutdown |
| Local operator gateway | Loopback `127.0.0.1:8787` | $0 | Same dev shutdown; removes `work/dev-session.json` |
| `.tools/cloudflared` | Official macOS binary pinned/checksum-verified by `setup:tunnel`; downloading it creates no tunnel | $0 | Remove `.tools/cloudflared` and cached archive when unused |
| Temporary Quick Tunnel | Only while `npm run playtest:open` runs; forwarding to invitation-protected loopback gateway `:8788`, maximum two hours | $0, no account/card | `npm run playtest:stop` or Ctrl+C; kills cloudflared, closes gateway/sockets, discards per-session signing key, removes invitation files, writes teardown record |
| Browser verification session | Local isolated `agent-browser` session `belay-check` | $0 | `npx --yes agent-browser --session belay-check close` |
| Test reports/screenshots | Local `reports/` and ignored `work/` | $0 | Remove local artifacts when no longer needed; never commit session keys |

Local machine electricity and bandwidth are not measured here. Quick Tunnel verification checks reachability/access control, not a service guarantee. No resource is authorized to incur metered spend at this phase. See `reports/phase1-remote.json` when present for the verification/teardown evidence; it contains no invitation secrets.

## Start and normal shutdown

```sh
npm install
npm run dev
```

Open <http://127.0.0.1:8787>. Run the tunnel commands in a second terminal only for a scheduled invited test:

```sh
npm run setup:tunnel
npm run playtest:open
```

Read `work/playtest-links.json` locally; manually send only the tester link to the invited tester. Never print access tokens into reports, commit them or post them publicly. Local operator access requires no invitation; remote operator access uses the separate operator link. Invite credentials expire and are scoped to a fresh signing key for each tunnel session.

```sh
npm run playtest:stop
```

Then Ctrl+C in the dev terminal. The stop command verifies the recorded PID belongs to this project's playtest script before signaling it. If a terminal was force-killed, inspect the project process command/PID before stopping it; do not blindly kill unrelated Node processes. Inspect listeners with `lsof -nP -iTCP:2567 -iTCP:5173 -iTCP:8787 -iTCP:8788 -sTCP:LISTEN`. Remove stale `work/playtest-links.json` and `work/playtest-session.json` only after the owned tunnel and protected gateway have stopped. Restarting the dev process rotates its backend signing key too.

## Verification commands

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run bench
npm run test:network
```

Network checks require the dev server. `bench` does 1,000 deterministic, fixed-duration flat-ground bad-bot trajectories; it is not a run-length or rescue simulation. `test:network` uses real local sockets and ephemeral rooms, validates isolation/auth/input boundaries and writes its scope into the report. Do not run qualification while a human is evaluating feel; machine contention affects timing.

`npm run test:latency` qualifies added stream delay at 30 Hz; it does not conduct the conditional human 30/60 comparison. `npm run test:remote` requires an active temporary tunnel, checks it from this machine, then stops it automatically. The remote check does not count as a second-city participant. `npm run lint` covers the active prototype and its used UI primitive; `npm run lint:all` also covers unused generated shadcn components, which retain upstream scaffold lint findings.

## Authority and operational limits

Each Colyseus room owns its Rapier world, PBD rope, input state and telemetry. Phase 1 hard cap is two; the global design ceiling is six. Inputs are bounded and sequenced, and expire after 250 ms without a refresh. Debug mutations and room allocation require operator authorization. The protected gateway rejects unauthenticated HTTP assets/API/WebSocket upgrades and strips incoming privilege headers. It is a temporary test perimeter, not production identity or DDoS infrastructure. The development frontend must never be exposed directly.

Telemetry rings, catch-up work and the accepted-input tape are bounded. Tapes preserve the first 20 minutes after scene reset, then mark truncation; simulation continues. Memory reports explicitly identify shared process RSS/heap, not pretend per-room memory. Ticks include serialization/send scheduling; wire delivery remains asynchronous. No 300-room capacity or reconnection target has been qualified. Production placement, scaling, observability and paid hosting await the Phase 6 proposal.

## Future costs — not provisioned

Clip uploads stay disabled. Phase 3 downloads only. Before Phase 6 hosting: price request, write/read, retained bytes, bandwidth, transcoding (if any), authentication and quota-coordination operations. Enforce 15 seconds / 2 MiB, three uploads per identity/day, seven-day retention plus one permanent slot, and 256 MiB global capacity including reservations/permanent files. Reconcile byte reservations, automatic retention and the kill switch. Fail closed to download-only if any budget control is unavailable. A storage limit alone does not cap bandwidth/request spending; the proposal must solve that or uploads stay off.

Before any public launch, record the exact provider, region, instance/worker counts, all fixed and metered costs, hard spending controls and teardown commands in this ledger. Complete the 300-room production workload and reconnect gate. Public deployment with Sites is Phase 7 and has not occurred.
