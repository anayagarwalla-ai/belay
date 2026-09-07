# Six-body performance investigation

The strongest engineering candidates are **reusing expanded terrain bounds and contact scratch storage**, followed by removing **per-constraint closures and temporary vectors** while preserving the exact arithmetic and iteration order. The profiles support these candidates; they do not establish production capacity or prove that the earlier five-room ring p99 was caused solely by startup or GC.

This read-only investigation used the corrected pre-optimization physics baseline: original engine `ad00223`, finish correction `9e1415e`, cue events `f2fb8fd`; local source revision `c300ae7`. No physics, server, package, numerical tuning, friction, damping, solver iteration or deadline changes were made by this task. Source hashes and root tuning are frozen in each profile manifest. The physics owner received the function sites and raw profiles before making its separate allocation-only changes.

The machine was contended. The evidence task authorized the profiling window, then started its fixed baseline; the root subsequently paused that baseline for optimization. Replay and other local work remained active. CPU-pass host load averages were around 10.0–10.4, with low raw free memory. These are instrumented invocation observations on this host, not quiet hardware or service-capacity measurements.

| Artifact | Content and status |
|---|---|
| [CPU profile](local-load-profile-666b5a18-4309-4fa2-84c0-07cf199d9d76/simulation.cpuprofile) | Node 26.5.0 `--cpu-prof`, installed default 1,000 µs sampling; full process including startup/warm-up |
| [CPU raw components](local-load-profile-666b5a18-4309-4fa2-84c0-07cf199d9d76/cpu-measurements.json) and [offline analysis](local-load-profile-666b5a18-4309-4fa2-84c0-07cf199d9d76/analysis.json) | Every measured step/snapshot/JSON duration, run-state labels, memory/host windows, and observed GC entries |
| [Crossing allocation samples](local-load-profile-63e96db7-1847-4002-b37f-bd803fe509b9/allocation-crossing.heapprofile.json.gz), [rescue allocation samples](local-load-profile-63e96db7-1847-4002-b37f-bd803fe509b9/allocation-rescue.heapprofile.json.gz) | Separate local Inspector heap sampling after fixed warm-up; default 32,768-byte Poisson interval; collected-minor/major-object flags requested |
| [Allocation measurement pass](local-load-profile-63e96db7-1847-4002-b37f-bd803fe509b9/allocation-measurements.json) | Completed, child exit 0; roughly 16.77 s crossing and 6.80 s rescue measured wall time under allocation instrumentation |
| [One-room preflight](local-load-one-room-1696a46e-c262-41e1-ab87-aaeca2c24ba4/preflight.json) | NOT RUN: 382,582,784 free bytes < unchanged 536,870,912-byte guard. No authority or clients started; no retry |

The two heap profiles are stored as lossless gzip; the analyzer reads them directly. [Compression receipt](local-load-profile-compression.json) preserves both stored and original SHA-256 hashes. They can be decompressed for an Inspector viewer.

The CPU measurement and full profiler JSON completed, but an initial harness cleanup bug treated its own normal IPC disconnection as parent loss and exited 1. That original failure/teardown receipt is preserved. The cleanup was corrected; only the missing allocation pass was subsequently run. The CPU workload was not rerun or silently relabeled as a successful full harness invocation.

Each pass used fresh actual six-body crossing and rescue simulations, fixed seed 1701 at 30 Hz, 60 warm-up ticks (two simulation seconds) followed by 600 measured ticks (20 simulation seconds). Warm-up is a fixed amount of simulation work, not a claim of two wall-clock seconds or universal JIT convergence. All crossing players walked forward unbraced. Rescue players moved back; helpers alternated brace using the existing root cadence. Tape recording stayed enabled. Each measured tick separately timed `step`, `snapshot`, and JSON encoding. Snapshot/JSON are a diagnostic serialization proxy; they exclude Colyseus message encoding, six-client fan-out, queues, transport and scheduling.

| CPU-pass component | Crossing | Rescue |
|---|---:|---:|
| Construction wall ms | 5.546 | 0.814 |
| Fixed warm-up wall ms | 835.30 | 757.01 |
| Measured wall ms | 8,167.05 | 3,380.38 |
| Steps that begin in active physics | 598 | 337 |
| Steps that begin after terminal state | 2 | 263 |
| Active-step p50 ms | 13.163 | 7.276 |
| Active-step p95 ms | 17.679 | 21.918 |
| Active-step p99 ms | 22.856 | 47.555 |
| Active-step max ms | 67.204 | 124.305 |
| Snapshot p99 ms, all 600 ticks | 0.254 | 0.411 |
| JSON p99 ms, all 600 ticks | 0.106 | 0.112 |
| Observed GC entries in measured interval | 673 | 137 |
| Observed GC duration sum ms | 156.90 | 43.10 |
| GC duration / measured wall time | 1.92% | 1.28% |
| Maximum observed GC duration ms | 2.721 | 1.974 |

The crossing finished near the end of the fixed interval; the rescue policy failed earlier. A transition-to-terminal tick still performs physics and is included in the active-before-step distribution. Quiet ticks after completion/failure are kept separate. Using rescue's all-tick median or p99 would understate active physical work. Raw state labels and every component sample allow this distinction to be audited. GC timestamps and component windows share the process performance clock; GC overlap is calculated explicitly.

The V8 CLI CPU profile's timestamp origin differed from `process.hrtime` on this macOS host. The analyzer therefore **does not subtract those clocks or fabricate per-scene CPU percentages**. The following are whole-profile, delta-weighted sampled-time shares across startup, warm-up and both scenes; the JSON also preserves sample-count shares. OS descheduling and profiling overhead can affect the weighted shares. Raw CPU frames have transpiled line 0/columns because the installed `tsx` uses `minifyWhitespace: true`; authored source locations below come from verified function/source inspection, not a claim that profiler line 1 is the authored line.

| Named whole-profile site | Sampled-time share |
|---|---:|
| `sweepBox` | 18.44% |
| `contactNormalsAt` | 9.01% |
| generated `__name` helper in expedition module | 7.72% |
| `constrain` | 7.30% |
| `substep` | 7.02% |
| `projectMotion` | 5.80% |
| `routeRope` | 4.42% |
| GC pseudo-frame | 2.49% |

Anonymous geometry and expedition frames account for another 15.07% and 7.29%; they are not assigned to an authored expression without a source map. An unresolved builtin symbol is also retained in the raw/JSON output. These gaps limit exact attribution but do not erase the strong named geometry/constraint signal. The installed `tsx/dist/index-DCefr8NP.mjs` contains `keepNames: true`; repeatedly created local functions incur its generated name-helper path in this runtime. A future production build may have different transformation overhead.

| Cumulative sampled allocation estimate | Crossing, 600 ticks | Rescue, 600 ticks |
|---|---:|---:|
| Total weighted estimate, decimal GB | 15.111 | 4.541 |
| `sweepBox` share | 37.54% | 23.82% |
| `contactNormalsAt` share | 26.95% | 16.81% |
| `projectMotion` share | 20.82% | 15.56% |
| `constrain` share | 9.05% | 33.95% |

These are cumulative **sampling estimates of allocation churn**, including collected-object sampling, not live heap, retained memory, RSS, native/WASM allocation ownership, or exact room memory. Each allocation tree node's `selfSize` is summed once. The allocation pass's sampled process RSS stayed at roughly 289 MB crossing / 390 MB rescue, illustrating why the cumulative GB figures must not be read as resident room footprints. Heap sampling materially slowed the workload: crossing's all-step median rose from about 13.15 ms in the CPU pass to 25.91 ms in the allocation pass. Allocation-pass timings are not substituted for uninstrumented performance.

| Candidate, in priority order | Verified authored sites | Evidence and preservation requirement |
|---|---|---|
| Cache expanded static-solid bounds for body and rope-particle sizes | `shared/contact-geometry.ts:10`, consumed at `:26`, `:102` and by projection | `limits` creates an object and three bound arrays per query. The named geometry sites dominate CPU and allocation samples. Keep the same expansion arithmetic, comparison/tie order and lifetime/invalidation when solids change; avoid a process-global cache retaining disposed worlds. |
| Reuse per-iteration positions, normal lists and projection scratch values | `shared/expedition-simulation.ts:204`, `:205`; `shared/contact-geometry.ts:42` | Repeated whole-node copies, nested arrays and temporary vectors occur inside solver iterations. Preserve old/new position distinctions and output alias lifetimes; blindly sharing a mutable normal/position object can change physics. |
| Remove per-constraint closure/vector/tuple allocation | `shared/expedition-simulation.ts:297`, `:303`, `:314`, `:319` | `mobility`, `lambdaFor`, and `demand` are created for each constraint; direction/mobility vectors and pair tuples also allocate. `constrain` dominates rescue allocation; generated name-helper CPU supports inspecting local function creation. Preserve axis ordering, formulas, traction updates and floating-point evaluation order. |
| Defer snapshot-copy optimization until the hotter sites are addressed | `shared/expedition-simulation.ts:472`, `:483–484` | Snapshot construction includes structured clones, but its measured invocation cost is much smaller here. This does not measure server fan-out, so it is a priority decision for this fixture, not proof that transport is cheap at scale. |

The original [five-room fixture](local-load-phase2-fixture-17b0a9e7-0548-43fd-92bc-519ded5b2d3b/result.json) used the earlier `ad00223` engine; the new profile includes the finish/cue corrections. Different source revisions, scenes, instrumentation and host contention prevent a direct timing-ratio comparison. The original fixture had zero skipped slots in the post-warm-up `before` inspection and four in `after`. Sample windows first show them during `fixed-input-window`, so they cannot all be dismissed as room creation. One corresponding process window records a ~72.4 ms event-loop-delay sample and a 5.14 ms GC event; another has no event-loop probe samples. That sparse coincidence is insufficient to attribute all delay to GC, physics, OS contention or observer work. The room percentiles are overlapping completed-callback rings, not raw slot windows. The new direct invocation profile narrows where engineering effort can help, while the guarded one-room socket comparison remains unavailable.

The physics owner is validating its separate optimization against exact snapshots and recorded inputs. This task provides candidates and baseline evidence only; it has not claimed an optimization speedup. No 300-room test, default-profile retry, production capacity pass, room-memory attribution or new resource was created.

Reproduce the bounded investigation on an explicitly coordinated window, then re-audit existing artifacts without simulation:

```sh
npx tsx scripts/local-load-profile.ts
npx tsx scripts/local-load-profile-socket.ts
npx tsx scripts/local-load-profile-analysis.ts reports/local-load-profile-666b5a18-4309-4fa2-84c0-07cf199d9d76 reports/local-load-profile-63e96db7-1847-4002-b37f-bd803fe509b9
npx vitest run --config vitest.config.ts tests/local-load-profile-analysis.test.ts
```

The profiler uses direct owned child handles, IPC-parent-loss termination, finite root-derived work, V8 heap caps, sampled RSS checks, an artifact-size check after each pass, and parent-enforced wall timeout. Heap sampling uses an in-process inspector session with no network listener. The original CPU failure receipt and the allocation child's successful teardown are retained. Typecheck, scoped lint and three offline evidence-accounting tests passed; no extra simulation run was used for final validation.
