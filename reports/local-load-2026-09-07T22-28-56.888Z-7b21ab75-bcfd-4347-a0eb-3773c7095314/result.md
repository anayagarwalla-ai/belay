# BELAY local socket diagnostic

INCOMPLETE: Host free memory guard reached. **Production qualification: NOT RUN.**

10 rooms, 20 real sockets, 30 seconds of fixed 60 Hz inputs; 4 generator processes plus one authority. Source revision 38f75d860fb78f4ff9291df4b716f2fb1cdf0639; exact file hashes and dirty state are in manifest.json.

| Input evidence | Count |
|---|---:|
| Scheduled | 36000 |
| Offered | 0 |
| Expired generator slots | 0 |
| Disconnected slots | 0 |
| Buffered/send-error slots | 0 |
| Exact server accepted delta | unavailable |
| Observed individual sequence acknowledgements (lower bound) | 0 |

Full-window offered lateness p50/p95/p99/max (ms): unavailable / unavailable / unavailable / unavailable. Raw lossless planes and the deterministic schedule are in JSON; nearest-rank definition is included. Audit: Total schedule population differs from frozen manifest; Missing generator results.

| Room (available completed-callback ring) | Execution p99 ms | Scheduling p99 ms | Paired combined p99 ms | Dropped wall ms | Skipped tick slots |
|---|---:|---:|---:|---:|---:|


Existing room summaries retain at most 2048 recent completed callbacks. Creation/warm-up/drain may overlap the ring. They exclude dropped callback completions and do not expose raw due/start/finish slots. No aggregate room p99 or full fixed-window deadline pass is computed.

Observed owned-process RSS peak: 675.0 MiB. This includes the controller and separate child processes. NOT RUN: no exact JS/native/WASM ownership attribution. Post-disposal memory growth is observational; allocator retention, GC timing and reachable leaks are not distinguished.

Lifecycle: 3 create/dispose cycles plus full-load disposal; final live room count unknown. 4 functional checks recorded. Real slow-reader snapshot skips: unknown. A real ws receive pause is applied. Healthy partner progress is checked. If skip count stays zero, the server backpressure threshold was NOT EXERCISED; OS socket buffers may absorb the bounded pause.

Same-body reconnect: UNIMPLEMENTED (Phase 4), 0 eligible trials, no success-rate claim. Churn uses a fresh join. All 5 owned child exits were observed. Shared-machine contention is uncontrolled; host load/free memory and every sampled process window are in result.json. This is neither a 60-minute production run nor a human gate.
