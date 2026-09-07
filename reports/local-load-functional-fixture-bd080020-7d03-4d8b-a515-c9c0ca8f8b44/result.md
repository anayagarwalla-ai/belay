# BELAY local socket diagnostic

COMPLETE. **Production qualification: NOT RUN.**

2 rooms, 4 real sockets, 2 seconds of fixed 60 Hz inputs; 2 generator processes plus one authority. Source revision 43cc44478797c231c2c017d4ce036c6d38f4a6e3; exact file hashes and dirty state are in manifest.json.

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
| Observed individual sequence acknowledgements (lower bound) | 233 |

Full-window offered lateness p50/p95/p99/max (ms): 0.480 / 1.175 / 1.582 / 1.853. Raw lossless planes and the deterministic schedule are in JSON; nearest-rank definition is included. Audit: all scheduled slots reconcile.

| Room (available completed-callback ring) | Execution p99 ms | Scheduling p99 ms | Paired combined p99 ms | Dropped wall ms | Skipped tick slots |
|---|---:|---:|---:|---:|---:|
| spui6VTX5 | 0.993 | 7.800 | 8.057 | 0.000 | 0.000 |
| WVULym0ps | 26.150 | 4.775 | 30.586 | 0.000 | 0.000 |

Existing room summaries retain at most 2048 recent completed callbacks. Creation/warm-up/drain may overlap the ring. They exclude dropped callback completions and do not expose raw due/start/finish slots. No aggregate room p99 or full fixed-window deadline pass is computed.

Observed owned-process RSS peak: 526.9 MiB. This includes the controller and separate child processes. NOT RUN: no exact JS/native/WASM ownership attribution. Post-disposal memory growth is observational; allocator retention, GC timing and reachable leaks are not distinguished.

| Empty authority observation | Live rooms | Process RSS MiB | Heap used MiB | External MiB |
|---|---:|---:|---:|---:|
| initialized-empty-baseline | 0.000 | 227.3 | 29.4 | 12.2 |
| after-create-dispose-cycle 0 | 0.000 | 227.4 | 30.0 | 12.2 |
| after-create-dispose-cycle 1 | 0.000 | 228.4 | 30.4 | 12.2 |
| after-full-population-disposal | 0.000 | 240.5 | 37.6 | 12.9 |

These are natural, unforced-GC process samples; external includes arrayBuffers. They expose growth after disposal without attributing it to room leaks.

Lifecycle: 2 create/dispose cycles plus full-load disposal; final live room count 0. 4 functional checks recorded. Real slow-reader snapshot skips: 0. A real ws receive pause is applied. Healthy partner progress is checked. If skip count stays zero, the server backpressure threshold was NOT EXERCISED; OS socket buffers may absorb the bounded pause.

Same-body reconnect: UNIMPLEMENTED (Phase 4), 0 eligible trials, no success-rate claim. Churn uses a fresh join. All 3 owned child exits were observed. Shared-machine contention is uncontrolled; host load/free memory and every sampled process window are in result.json. This is neither a 60-minute production run nor a human gate.
