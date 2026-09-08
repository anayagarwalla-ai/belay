# Independent audit of the first completed matrix records

**PREFIX CHECKS PASSED; full matrix INCOMPLETE/RUNNING at capture.** This receipt preserves the single read-only audit captured on **2026-09-08 at 00:04:29.283–00:04:29.296 UTC**. It is a selected prefix, not a census of all records completed by that time. No equivalent prefix was rechecked, no simulation was imported or executed, and no live worker file was copied or modified.

Source evidence directory: `/Users/anayagarwalla/.codex/worktrees/850a/testastra/reports/phase2-parallel-2026-09-08T00-01-34.279Z-688bcbe4-7d3f-4aba-b66f-de8f8cc5703d`.

| Identity | Value |
|---|---|
| Source revision | `d175701190964a926e968c25f250b2988edf223f` |
| Source manifest SHA-256 | `3253adc6e3bd7823ef4d9c7b110ffd6903a68f7a63dc1f14603a210ac6050fcb` |
| Fixed schedule SHA-256 | `598d0502785b45555c81f8cd54cebabc2fa9802b928d33a5715d7be39b2d2fba` |
| Published runtime-manifest signature | `6a090feeb9b10a0da6515d99844c284468b271f2cc47ed5ecd7daf2310d19a24` |

Selection was fixed at **up to eight complete JSONL records per worker**, starting at the first record in each shard. A bounded read used the observed file size and newline boundaries; later complete records and any partial final line were excluded. Timing reads covered only the exact number of bytes attributed to those selected complete records. Cross-worker reads occurred sequentially, not as an atomic fleet snapshot.

| Worker / recorded PID | Exact selected ordinals | Records | Step samples | Validated raw timing bytes | Timing file bytes observed at open | Excluded suffix bytes |
|---|---|---:|---:|---:|---:|---:|
| 0 / 27985 | 0, 1, 2, 3, 4, 5, 6, 7 | 8 | 3,251 | 26,008 | 164,904 | 138,896 |
| 1 / 27986 | 250, 251 | 2 | 1,775 | 14,200 | 110,016 | 95,816 |
| 2 / 27987 | 500, 501, 502 | 3 | 37,571 | 300,568 | 319,808 | 19,240 |
| 3 / 27988 | 750, 751, 752 | 3 | 19,895 | 159,160 | 169,232 | 10,072 |
| **Total selected** | **16 distinct ordinals** | **16** | **62,492** | **499,936** | — | — |

Each raw timing prefix contains IEEE-754 Float64 little-endian milliseconds: `validated bytes = samples × 8`. Excluded suffixes may contain later completed trajectories or an active trajectory. They are neither audited evidence nor errors. PIDs identify the original worker receipts only; they must never be reused as authority to signal a process.

| Worker | Selected timing-prefix SHA-256 | Selected record-prefix bytes | Selected record-prefix SHA-256 |
|---|---|---:|---|
| 0 | `371052328a6b550e7fbfa92562df6006d2ca0932320e4331bbdcd6705eef0397` | 18,758 | `49e256853bc97b1c8f985094cbbd510f1b3aa1f62048411dcdfad4491b45a3b3` |
| 1 | `cf619d0c6219c2bfe414950d04903c62aaa6a52aa3616c06378730a7d7518821` | 6,533 | `396a70641a5183f567304b1c01080f4157cffb8ea7e000ad7c7c7bde009f1517` |
| 2 | `c9e9ed078e0741ce82de39cf41041e663bad80ffab5e7de2b355569e88cd8a76` | 12,556 | `eea5440bf351686ffa94afdeb15a73733754724b313ef17b42d5937a4bcc6070` |
| 3 | `3455e3afc9aa8fbd3009b507ec81da105c8a226180e047e4372049ddd4406c49` | 15,563 | `1a29f8867246f75184f3dc840ca5c983a01b4f492e1ad288b1f372a8f6df8de8` |

The independent reader rebuilt all 1,000 scheduled specifications from the frozen tuning, family insertion order and inspected schedule formula: team size varies first, then scene, then policy; seed/family change by complete matrix repetition. It matched every planned specification, all four contiguous 250-ordinal shards, assignment hashes, and the schedule digest. The planned ceiling reconciles to **9,900,000 samples / 79,200,000 raw timing bytes**. This validates the plan, not its execution completeness.

The audit rehashed all **29 actual frozen source files** and checked their read-only modes. Every worker's job, source-file list, startup manifest, native entrypoint hash, assignment identity and published runtime signature matched the controller's manifest. Installed runtime binaries were **not independently rehashed**, and running process memory was not inspected; runtime comparison is limited to the published asset identities.

For each selected record, the reader checked its exact shard position/specification, integral tick and attempt bounds, `observedSeconds = ticks / tickHz`, and outcome-label consistency. It decoded the corresponding raw timing slice, checked every value was finite and nonnegative, then independently recomputed count, min, nearest-rank p50/p95/p99, max and sequential-arithmetic mean. Every statistic matched that record's timing summary exactly.

Selected outcomes were **9 crossing completions, 3 focused-fixture recoveries, 1 terminal failure and 3 censors**. No selected row had `evidenceComplete = false`. Ordinals **500, 502 and 752** were each correctly censored at **18,000 ticks = 600 observed seconds**, matching their full crossing horizon. Censoring was not relabeled as success.

No final source checks, final artifact receipts, complete worker shards or full-matrix reconciliation were asserted while the job was running. This receipt establishes only the selected prefix's integrity. It supplies no full-matrix success, performance verdict, physics-target pass, human-gate result or production-capacity qualification.
