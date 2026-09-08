# BELAY parallel work queue

The user requested continued useful work across the existing project tasks. Reuse these tasks, give each a concrete independent assignment, review its handoff and integrate validated changes in the primary checkout. Do not keep tasks busy by duplicating checks or inventing features.

| Task | Task ID | Current assignment |
|---|---|---|
| BELAY physics and contact diagnostics | `01a07dca-c2f1-7a90-b5b2-857030e6aca1` | Architecture review integrated; prototype a bounded wall-actuator helper and analytical tests, leaving runtime patch unapplied |
| BELAY client reliability | `01a07dca-c2f1-7a90-b5b2-859c68a13db8` | Timing, disposal and attribution fixes integrated; inspect viewport GPU/DOM resource ownership with small lifecycle fixtures |
| BELAY simulation evidence | `01a07dca-c2f1-7a90-b5b2-855fb9ed02b9` | The reviewed native four-worker runner is executing the fixed 1,000 trajectories; retain final reconciliation and teardown evidence |
| BELAY load and hosting costs | `01a07df3-f9b1-7490-a101-68c8b49f5d8b` | Review runner fixes, record qualification gaps, and independently inspect the first actual matrix records |
| BELAY playtest preparation | `01a07e01-945f-7b10-ae41-ef0e579e11d3` | Verify and correct existing local playtest instructions against source; the separate server input audit was stopped by automatic review |

The coordinator handles integration, integrity checks, real-build verification and the authorized GitHub pushes. A thread heartbeat checks this queue every 15 minutes for at most 16 runs, ending earlier when the current bounded queue is exhausted or a meaningful next step requires the user's playtest/design decision. Its identifier and teardown are in RUNBOOK.md.

The simulation job must freeze imported files before starting. Its fixed ordinals, seeds, policies and 600/60-second horizons cannot be changed to improve results. Raw timing samples, partial records, process/heap limits and cleanup receipts must survive failures. The new offline job uses a version-identified available-memory heuristic plus conservative floors and hard RSS limits; this is distinct from the unchanged conservative raw-free guard used by earlier socket-load experiments. Neither is a production capacity pass.

Once a task finishes, first inspect its concrete results and any unresolved failure. Prefer a bounded follow-up that resolves that failure or advances the current queue. Keep expensive CPU work coordinated; design, source research, artifact auditing and input analysis can continue while simulation runs. Do not rerun equivalent suites without a change or unresolved concern. Stop assigning work when nothing useful remains within authorization.

Current gameplay remains the 900 N diagnostic baseline. The allocation optimization, compiled-runtime default switch, 450 N rescue tuning and both contact-topology candidates and the nonlinear projection candidate were not accepted. Their raw results and unapplied patches remain available. Gate 1's implementation stop was bypassed by the user; Phase 2 participation and mechanical failures remain explicit, and Phase 3 has not started. No paid resources, hosted clips, public deployment, voice or outside recruitment are authorized by this queue. Do not consume a usage-reset credit.

The active matrix began 2026-09-08 at 00:01:34 UTC in the simulation-evidence task. Run directory: `reports/phase2-parallel-2026-09-08T00-01-34.279Z-688bcbe4-7d3f-4aba-b66f-de8f8cc5703d` in that task's worktree. Source revision `d175701190964a926e968c25f250b2988edf223f`, source manifest SHA-256 `3253adc6e3bd7823ef4d9c7b110ffd6903a68f7a63dc1f14603a210ac6050fcb`, schedule SHA-256 `598d0502785b45555c81f8cd54cebabc2fa9802b928d33a5715d7be39b2d2fba`. Four actual workers started; this is an in-progress job, not a completed distribution. The main dev stack and root browser remain stopped to leave headroom.
