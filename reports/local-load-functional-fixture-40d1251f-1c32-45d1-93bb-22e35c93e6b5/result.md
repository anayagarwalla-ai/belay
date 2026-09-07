# BELAY local socket diagnostic

COMPLETE. **Production qualification: NOT RUN.**

2 rooms, 4 real sockets, 2 seconds of fixed 60 Hz inputs; 2 generator processes plus one authority. Source revision 38f75d860fb78f4ff9291df4b716f2fb1cdf0639; exact file hashes and dirty state are in manifest.json.

| Diagnostic check | Status |
|---|---|
| rawSchedule | PASS |
| offeredSchedule | PASS |
| exactAcceptance | PASS |
| completePopulation | PASS |
| workloadRoomDisposal | PASS |
| fullSlotTiming | NOT RUN |
| perRoomMemoryAttribution | NOT RUN |
| sameBodyReconnection | UNIMPLEMENTED |

| Input evidence | Count |
|---|---:|
| Scheduled | 480 |
| Offered | 463 |
| Expired generator slots | 0 |
| Disconnected slots | 17 |
| Buffered/send-error slots | 0 |
| Exact server accepted delta | 463 |
| Observed individual sequence acknowledgements (lower bound) | 234 |

Full-window offered lateness p50/p95/p99/max (ms): 0.606 / 1.144 / 1.328 / 2.973. Raw lossless planes and the deterministic schedule are in JSON; nearest-rank definition is included. Audit: all scheduled slots reconcile.

| Room (available completed-callback ring) | Execution p99 ms | Scheduling p99 ms | Paired combined p99 ms | Dropped wall ms | Skipped tick slots |
|---|---:|---:|---:|---:|---:|
| Jz0NWvr44 | 2.384 | 1.290 | 2.935 | 0.000 | 0.000 |
| LDV5Gc7Wj | 4.788 | 1.592 | 5.383 | 0.000 | 0.000 |

Existing room summaries retain at most 2048 recent completed callbacks. Creation/warm-up/drain may overlap the ring. They exclude dropped callback completions and do not expose raw due/start/finish slots. No aggregate room p99 or full fixed-window deadline pass is computed.

Observed owned-process RSS peak: 570.4 MiB. This includes the controller and separate child processes. NOT RUN: no exact JS/native/WASM ownership attribution. Post-disposal memory growth is observational; allocator retention, GC timing and reachable leaks are not distinguished.

| Empty authority observation | Live rooms | Process RSS MiB | Heap used MiB | External MiB |
|---|---:|---:|---:|---:|
| initialized-empty-baseline | 0.000 | 231.6 | 31.2 | 12.1 |
| after-create-dispose-cycle 0 | 0.000 | 231.8 | 31.8 | 12.1 |
| after-create-dispose-cycle 1 | 0.000 | 231.9 | 32.3 | 12.1 |
| after-full-population-disposal | 0.000 | 245.0 | 39.2 | 12.7 |

These are natural, unforced-GC process samples; external includes arrayBuffers. They expose growth after disposal without attributing it to room leaks.

Lifecycle: 2 create/dispose cycles plus full-load disposal; final live room count 0. 4 functional checks recorded. Real slow-reader snapshot skips: 0. A real ws receive pause is applied. Healthy partner progress is checked. If skip count stays zero, the server backpressure threshold was NOT EXERCISED; OS socket buffers may absorb the bounded pause.

Same-body reconnect: UNIMPLEMENTED (Phase 4), 0 eligible trials, no success-rate claim. Churn uses a fresh join. All 3 owned child exits were observed. Shared-machine contention is uncontrolled; host load/free memory and every sampled process window are in result.json. This is neither a 60-minute production run nor a human gate.
