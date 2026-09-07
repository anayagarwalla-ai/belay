# macOS local-load memory guard: read-only proposal

The existing 512 MiB guard measures the immediately free physical-page pool. It is conservative relative to potentially reclaimable memory and is working according to that configured meaning. **Keep it unchanged.** A different launch budget requires an explicit policy and a separately calibrated threshold; renaming the same 512 MiB value or silently substituting another API would change the policy.

## Observations

The host has 16 GiB physical RAM and runs Node v26.5.0 / libuv 1.52.1 on Darwin 27.0.0 arm64. An initial paired Node observation returned 293,175,296 raw-free bytes (~279.6 MiB) and 3,321,413,632 available-heuristic bytes (~3.09 GiB). An adjacent read-only pressure-level query returned normal (1). These sequential calls are not an atomic snapshot.

The preserved [later observation](local-load-memory-guard-observation.json), taken at 2026-09-07T22:58:26Z, returned 647,839,744 raw-free bytes (~617.8 MiB), 4,844,240,896 available-heuristic bytes (~4.51 GiB), kernel memory-status level 54 and pressure level 1. Conditions changed during normal host activity; this later reading does not revise any earlier aborted run or authorize a retry. Swap occupancy was ~8,127 MiB, which is a stock, not a current swapping rate.

Only Node OS queries, read-only sysctl/vm_stat and source/header inspection were used. No memory_pressure invocation, pressure generation, load test or profiling workload was run for this investigation.

## Meaning of the APIs

| Measurement | Defensible interpretation | Limitation |
|---|---|---|
| os.freemem() | In the installed libuv version, HOST_VM_INFO free_count × page size | Immediately free pool; excludes inactive/purgeable additions used by the available heuristic |
| process.availableMemory() | In libuv 1.52.1 on Darwin, (free_count + inactive_count + purgeable_count) × page size | Reclaimability heuristic; not reserved memory, a hard allocation guarantee, or proof that reclaiming it is cheap |
| os_proc_available_memory() | Current process dirty-memory-limit headroom on supported Apple platforms | Installed macOS SDK explicitly marks it API_UNAVAILABLE(macos); not a CLI host-memory replacement |
| Memory-status percentage | memory_pressure obtains a kernel memory-status level through memorystatus_get_level | A different metric; do not multiply the percentage by physical RAM to invent an allocatable-byte budget |
| Pressure condition | Passive public dispatch memory-pressure notifications distinguish normal, warning and critical | Complementary health signal, not a byte budget; no notification does not establish the initial state |

Node's [v26.5.0 process binding](https://raw.githubusercontent.com/nodejs/node/v26.5.0/src/node_process_methods.cc) delegates availableMemory directly to libuv. The formulas above are verified in the [exact installed libuv tag](https://raw.githubusercontent.com/libuv/libuv/v1.52.1/src/unix/darwin.c); pin the runtime when recording this metric rather than relying on a generic cross-platform description.

Apple's [vm_stat source](https://raw.githubusercontent.com/apple-oss-distributions/system_cmds/main/vm_stat/vm_stat.c) subtracts speculative pages from the displayed “Pages free.” The kernel free_count already includes speculative pages, as the installed mach/vm_statistics.h explains. Do not add speculative pages twice when reconstructing the kernel count. Separate invocations may disagree because the host changes between calls.

Apple's [memory_pressure source](https://raw.githubusercontent.com/apple-oss-distributions/system_cmds/main/memory_pressure/memory_pressure.c) obtains its printed percentage via memorystatus_get_level. The [XNU implementation](https://raw.githubusercontent.com/apple-oss-distributions/xnu/main/bsd/kern/kern_memorystatus.c) exposes the kernel memory-status level, also visible through kern.memorystatus_level. Current Apple open-source main is supporting context, not proof of the exact Darwin 27 binary's formula. The earlier root-observed ~50% and low raw-free bytes are therefore not inconsistent measurements of one quantity.

Installed SDK evidence: /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/os/proc.h (process-limit API), dispatch/source.h (passive pressure notifications), and mach/vm_statistics.h (VM counters). The read-only kern.memorystatus_vm_pressure_level sysctl is useful diagnostic evidence but should be treated as version-dependent, not a portable public API contract.

## Proposed policy, not implemented

1. Keep the current raw-free guard, RSS/V8 limits, finite lifetime, disk bounds and cleanup behavior. Historical default and one-room attempts remain aborted/not run.
2. In a future diagnostic change, record rawFreeBytes and availableHeuristicBytes separately with timestamps, platform/Node/libuv versions and the metric formula/version. Record owned RSS and pressure source/state separately. Unsupported or unavailable readings must remain unknown, not pass.
3. First decide the intended budget: immediately free reserve, reclaimable headroom, or suitability for timing. If root chooses reclaimable headroom, introduce a distinctly named minimumAvailableMemoryBytes with an explicitly chosen threshold and retain a deliberate raw reserve policy. Do not copy the old threshold automatically.
4. Add a passive warning/critical pressure signal as an independent no-start/abort condition if a supported implementation is adopted. Normal pressure alone is insufficient to qualify performance measurements. Observe ordinary host activity before calibrating; no induced-pressure experiment is proposed here.
5. Do not count swap capacity as RAM, sum compressed and uncompressed representations, or infer per-room capacity from host memory. Assess active reclaim/compression/swap rates and competing work separately when interpreting timings.

This proposal identifies a better-labeled observation, not permission to consume the estimated bytes or weaken the guard. No implementation or numerical setting changed; no pressure/load process was started.
