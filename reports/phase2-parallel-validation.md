# Four-worker offline runner validation

The retained 900 N `phase2-1` mechanics are unchanged from the corrected `f2fb8fd` baseline. This change adds orchestration and accounting; no policy, seed, ordinal or physical horizon changes were made. The async and synchronous paths execute the same trajectory generator, with async yields and disk writes outside measured `simulation.step()` calls.

Validation on 2026-09-07, Node 26.5.0 / libuv 1.52.1 / Darwin:

- Typecheck and lint pass.
- All 73 tests across the six Phase 2 files pass in 40.74 seconds.
- Real physics state and complete input tapes agree between synchronous and async execution for all five team sizes.
- Four distinct fixture processes are created and all owned exits are observed. Log capture remains bounded; forced cleanup works for blocked main JS that cannot handle SIGTERM.
- An independent watchdog stops blocked main JS at its deadline. The actual-parent-death test confirms an incomplete sentinel and no surviving orphan.
- Four real short-trajectory record/timing journals collect to the exact combined raw-sample distribution. Changed source identity, final artifact hashes/counts, truncated/nonfinite/oversized timing files, changed specs and shortened censors cannot qualify as complete evidence.
- Source snapshot hashes and read-only permissions are verified. Failed available-memory preflight starts no workers and leaves an explicit incomplete report.

These fixtures do not replace or count toward the 1,000-trajectory matrix. The plan-only invocation started no workers. Its unchanged schedule hash is `598d0502785b45555c81f8cd54cebabc2fa9802b928d33a5715d7be39b2d2fba`, with shards 0–249, 250–499, 500–749 and 750–999. It reserves at most 9,900,000 timing samples (79,200,000 raw bytes), 198,497,536 bytes of live timing storage including validation/sorting/IO, and 230,260,480 bytes of total artifacts. These fit the respective root 256 MiB bounds.

The first plan-only memory observation was 3,616,325,632 available bytes and 79,314,944 raw-free bytes. The offline 3.5 GiB initial floor correctly refused launch eligibility at that observation. No socket-load eligibility rule was changed. Actual launch must pass its own current preflight; a plan artifact is not permission to bypass a later refusal.

The full-run status and findings belong to the unique invocation directory, not this implementation-validation document. Human rescue/participation, production capacity and Phase 3 remain unevaluated; previously observed static-role and mechanical-bound failures remain disclosed.

## Pre-launch review corrections

The initial `5733024` runner received an independent static review before any worker launched. Three concrete issues were corrected: a stale success status after interruption during final output, incomplete hashing of mutable transpiler dependencies, and uncounted long-lived esbuild service children introduced by TSX.

The guarded entrypoint is now `node scripts/phase2-parallel-entry.mjs --run`. It uses native Node type stripping through frozen `.mjs` entrypoints and an extension resolver, with no external compiler service. Four evidence-class constructor parameter properties became equivalent explicit assignments; shared physical source is unchanged and policy decisions were not retuned. Full states and input tapes from native execution agree with the existing tool-hosted path across 2–6 players in both scenes at the root short fixture horizon. Direct compiler-child observations are empty. Custom Node preloads/loaders and module-path overrides are rejected. Provenance additionally hashes actual transitive TSX/esbuild files and the platform binary for legacy/tool-hosted execution, and a changed nested-file fixture changes its identity.

Finalization keeps signal handling and the independent watchdog active through all awaited report, status, replacement and removal operations. An atomic watchdog latch prevents a queued failure message from being missed at the final completion check; guard release is synchronous only after all filesystem work ends. Interruptions during blocked report/status writes downgrade all receipts, and an actual SIGTERM during a FIFO-blocked report produces exit 1 and consistent incomplete files. A permanently blocked final status write is stopped by the independent deadline. Each report is limited to 32 MiB, reserving both it and an atomic replacement within the unchanged 256 MiB output envelope.

The watchdog arms its forced-stop timer before attempting an asynchronous best-effort sentinel write. It never waits for the sentinel callback. A final fault-injection test replaces only that filesystem adapter with one whose callback never completes; the real watchdog program still kills CPU-blocked main JS. A stalled filesystem can lose the sentinel, but cannot hold its kill timer.

Validation of these corrections: typecheck and lint pass; 46 focused tests across five Phase 2 files passed in 33.67 seconds. After the final asynchronous-sentinel correction, its focused regression passed in 4.43 seconds (one selected test, 25 intentionally skipped). An intervening targeted run was interrupted for the coordinator's CPU window and is not counted as a pass. The independent source reviewer found no remaining actionable issue in the focused pass. No fixture process remains, and these short fixtures still do not count toward the fixed 1,000.
