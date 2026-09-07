# Gate 1 playtest operations

This is local preparation for an invited, two-person Phase 1 session. Gate 1 has **not passed**. Tooling checks and synthetic clients are not human sessions. No paid resources, public deployment, art/audio, recruitment or later gameplay are authorized here.

## Prepare and check

Use this checkout’s terminals; session ownership is scoped to its canonical directory. Node >=22.13.0 is required. Process supervision supports POSIX hosts; the pinned tunnel installer currently supports macOS arm64 and x64.

```sh
npm ci
npm run dev
```

Wait for **BELAY local preview ready** before opening the loopback preview at `http://127.0.0.1:8787`. The ready message means the authoritative room exists, the gateway can obtain an operator room token, and the frontend returned the Phase 1 join UI. First compilation can take time. Port conflicts, child exits or startup timeouts close this run’s children and gateway; the command never silently chooses another port or stops a different checkout.

In a second terminal:

```sh
npm run setup:tunnel
npm run playtest:preflight
```

Setup downloads only the pinned official archive, verifies its checksum, checks its version and installs it in `.tools/` with a binary-checksum receipt. It needs no account or card and opens no tunnel. A valid existing installation needs no download. Failed downloads/checks leave the previous binary intact until a verified replacement is ready. The command bounds download duration and size and cleans its staging directory on handled failures.

Preflight prints `PASS`/`BLOCKED` checks and concrete next commands. It checks dependencies, writable session storage, authenticated ownership of the local dev session, room/frontend readiness, the installed tunnel checksum, and availability of the protected port. It never opens a tunnel, prints invitations/keys, or signals a process. Without an owned dev session, it checks port availability by binding briefly; it sends no HTTP requests to whoever already occupies those ports. A block is exit code 1; all checks passing is exit code 0.

For a local two-browser setup check without cloudflared:

```sh
npm run playtest:preflight -- --local
```

A pass establishes local prerequisites. It does not prove another city can connect, measure internet quality, reserve either player seat, or evaluate feel. Keep qualification/bot runs separate from human free play, close their seats, and follow `PLAYTEST.md` for the actual ten-minute session and verdict record.

## Open an appointed invited session

```sh
npm run playtest:open
```

This requires this checkout’s ready dev owner and a verified tunnel installation. It starts only the protected gateway on loopback `:8788`, then a temporary Quick Tunnel to that gateway. The tunnel must advertise a URL, register a connection, serve the invitation form and reject an unauthenticated API request; authenticated local checks must also reach the frontend and tester room configuration before invitations are published. Startup has a timeout. A URL announcement alone is insufficient.

When **Protected remote endpoint ready** appears, read `work/playtest-links.json` privately. Manually share only `tester` with the appointed partner. `operator` is for the host if testing the same remote path. Never paste either credential into logs, reports, screenshots, source control, or public posts. Preflight and startup do not print either token. Use the recorded `expiresAt`: the two-hour lifetime starts when session startup begins, so startup time does not extend exposure. Raw cloudflared logs are parsed in a bounded buffer and are not printed.

Only one local dev owner and one remote owner can hold this checkout’s session records. Concurrent starts fail without replacing the existing key, invitation file or control endpoint. A different checkout cannot reuse its session file. The remote owner watches the dev owner and shuts down if it exits, changes or stops being ready.

## Stop and verify

```sh
npm run playtest:stop
```

Or Ctrl+C in the playtest terminal. The stop command authenticates a local control request; it never sends a signal to a PID copied from disk. It waits for the session record to disappear after cleanup, then reports confirmation. Repeating stop with no session is harmless.

Normal teardown removes invitations, stops the owned tunnel process group, closes gateway sockets, and writes `work/last-playtest-teardown.json` before releasing the session record. Check the `openedAt`/`closedAt` and `exitCode` for this run. The signing key lives only in the playtest process and disappears on exit. Expiry triggers the same cleanup. Failed tunnel startup also leaves no invitations or protected listener and records its nonzero exit code.

If child cleanup or writing its teardown report fails, resource cleanup still runs, the command exits nonzero, and metadata is retained for preflight instead of claiming confirmed teardown. A report with `cleanupConfirmed: false` requires attention; a missing report is not confirmation.

Then Ctrl+C in the dev terminal, or from this checkout:

```sh
npm run dev -- --stop
```

Normal dev shutdown first closes its associated remote session, then its own authority/frontend process groups and gateway. A guardian stays with each child group; it handles graceful stop, escalates within a bounded grace period, and also notices IPC disconnect if the parent is force-killed. Only descendants in the owned process group are targeted. Do not kill unrelated Node processes or the coordinator’s server to free a port.

## Stale files and older versions

After a force-kill, private records can remain even though the owner and its watched children are gone. Preflight identifies a stale owner using both PID and process start time. Remove only the stale record for the relevant kind with the normal stop command above, then rerun preflight. Stale remote cleanup removes leftover invitations but **does not fabricate a teardown report**; an older report does not prove that interrupted run completed cleanly. The next preflight checks the protected port before another session starts.

If an owner PID is live but its control endpoint cannot authenticate, the tools fail safely and do not signal it. Use that run’s original terminal to stop it. If a port belongs to another checkout, finish that checkout’s work there or wait; do not adopt it based on a health response.

Old `{pid, secret}` records from the previous scripts have no authenticated ownership data and are deliberately refused. Stop the old dev/playtest runs using their original terminals first. Inspect the known listeners if the terminal has gone:

```sh
lsof -nP -iTCP:2567 -iTCP:5173 -iTCP:8787 -iTCP:8788 -sTCP:LISTEN
```

Only after the previous session’s processes are confirmed stopped, remove this checkout’s old `work/dev-session.json`, `work/playtest-session.json` and `work/playtest-links.json`, then start fresh. No PID-only automatic migration is attempted. Rerun `setup:tunnel` once for a pre-existing binary that lacks the new checksum receipt. Old `.tools/cloudflared-*.tgz` archives are no longer required by this installer.

## Verification and limits

```sh
npm run test:operations
npm run typecheck
npm run lint
npm test
```

Operations tests use temporary directories, child-process fixtures and ephemeral loopback ports. They cover concurrent/duplicate starts, ownership checks, stale/reused PIDs, permissions, occupied ports, delayed readiness, child failure, process-group cleanup (including parent SIGKILL during startup), split tunnel output, startup failure/timeouts, publication-versus-stop races, expiry, dev-owner loss, report-write failure and failed installer downloads/checksums. No test opens a public tunnel or joins the coordinator’s server.

The runtime’s startup, shutdown, polling, download and log bounds live in the single root `tuning.ts`, under `TUNING.tools.operations`, with rationale. Test-only overrides use small fixture deadlines and ephemeral ports. This tooling does not change physics parameters, Gate 1’s six-session budget, the conditional diagnostic budget, or the free/no-card access assumption.

`README.md`, `RUNBOOK.md` and `PLAYTEST.md` link to this operations reference. The primary checkout also denies private-file requests at the gateway and Vite; runtime credentials must remain under `work/`.
