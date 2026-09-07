# Rejected Phase 2 allocation-only candidate

Baseline: `f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1`.

The candidate was rejected and the runtime changes reverted: rescue and crossing became slower in all four paired runs. No performance improvement is claimed or handed off to the full evidence run. The rejected source and its cache tests are retained in `phase2-performance-rejected.patch`; the runtime remains at the committed baseline.

The rejected candidate cached expanded terrain bounds and reused per-iteration position and normal arrays. Cache entries verified all six source boundaries and all three half extents with `Object.is`, including signed zero; weak keys avoided retaining disposed terrain. Constraint order, collision order, numerical expressions, solver iterations, tolerances, masses, friction, event order, and energy diagnostics were unchanged.

The load task's whole-process CPU sample identified `sweepBox` (18.44%), `contactNormalsAt` (9.01%), and anonymous contact geometry work (15.07%). Collected-object allocation sampling identified those functions plus `projectMotion` as the largest crossing allocation sites. These are sampling observations, not retained-memory attribution. Source profiling artifacts are in the load task's `reports/local-load-profile-666b5a18-4309-4fa2-84c0-07cf199d9d76` and `reports/local-load-profile-63e96db7-1847-4002-b37f-bd803fe509b9` directories.

## Exact state verification

`scripts/phase2-performance.ts` exports the committed baseline into an owned temporary directory and imports baseline and candidate in the same Node/Rapier runtime. The baseline records normalized input frames; the candidate receives those exact frames. Node `assert.deepStrictEqual` checks every snapshot field except wall-clock `serverTime`, which is set to zero. This includes players, rope particles, spans, terrain, events, incidents, counters, run outcomes, and physical diagnostics. Recorded tapes also compare exactly. V8-serialized SHA256 sample hashes preserve signed zero.

All 42 fixtures, 23,430 recorded frames per engine and 1,136 initial/intermediate/final snapshots matched exactly. The matrix covers 2–6 players, 30/60 Hz, flat mixed movement/brace, focused rescue, crossing through finish, weak-bridge cue/collapse/cascade, and additional six-player short/loose rope families. Raw fixture descriptions, input hashes, intermediate/final hashes, source checksums and final diagnostics are in `phase2-performance-equivalence.json`.

Cache tests separately mutate every terrain boundary and half extent and compare cached geometry with fresh-key calculations, and check that caller-supplied normal buffers clear without mutating previous default outputs. All 63 contact, Phase 1 physics/stress, and Phase 2 mechanics tests passed. Typecheck and focused lint passed. The branch's unrelated operations fixture still hardcodes Phase 1; the coordinator already fixed it in the integrated branch and owns the full integration suite.

## Timing method

Median of four per-run `stepTotalMs` measurements, each containing 240 measured ticks:

| Six-player scene | Baseline | Rejected candidate | Candidate change |
| --- | ---: | ---: | ---: |
| Flat | 3842.10 ms | 3440.58 ms | −10.5%; individual pairs mixed |
| Rescue | 1142.21 ms | 1332.18 ms | +16.6%; all four pairs slower |
| Crossing | 2557.83 ms | 3083.03 ms | +20.5%; all four pairs slower |

Node v26.5.0, macOS arm64, Apple M4, 10 logical CPUs. Measurement window: 2026-09-07 22:55:01–22:56:31 UTC. Host one-minute load fell from 14.14 to 11.84. These results justify rejecting this candidate; they do not isolate the individual cost of the cache versus scratch reuse.

The benchmark records one baseline input tape per six-player scene, then runs four alternating baseline/candidate pairs in one process. Each replay uses 60 warm-up ticks and 240 measured ticks at 30 Hz. `stepTotalMs` sums only the timed `step` calls; whole-window elapsed time and process CPU also include snapshot status observation. Raw per-run quantiles, final-state hashes, memory samples, runtime, and host load are retained in `phase2-performance-benchmark.json`. No forced GC or CPU affinity is used.

The full 1,000-trajectory evidence run and allocation profiler were paused/finished. Other authorized design-matrix workers, client checks, Chrome renderers, and the desktop environment shared the host. These paired measurements cannot establish a server deadline, production capacity, per-room memory cost, or a causal memory reduction. The bounded optimization stops here; no second candidate or solver retuning is included.

In a fresh published clone, first import the historical baseline from the shipped bundle. API-based publication preserves source trees but may not preserve the original local commit IDs. From the published checkout root, run:

```sh
git bundle verify reports/phase2-baseline.bundle
git fetch reports/phase2-baseline.bundle refs/heads/codex/evidence-baseline:refs/remotes/phase2-bundle/evidence-baseline
git rev-parse --verify 'f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1^{commit}'
```

The final command must print the baseline ID above. `reports/phase2-baseline-bundle.json` records the bundle checksum and verified historical trees. This import does not depend on an existing local worktree branch.

Then start an isolated checkout at the imported baseline commit, copy the measurement script and rejected patch from the published checkout, apply `phase2-performance-rejected.patch`, and run `npx tsx scripts/phase2-performance.ts f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1 equivalence` and the same command with `benchmark`. Running the script on the unchanged baseline instead would compare the baseline with itself. Check the raw reports' source hashes to distinguish the rejected candidate from current runtime files.

## Physical limitations remain

Exact preservation includes existing failures. The supplied seed-1701 recovery tapes reproduce 0.02670579485121427 m (two players) and 0.04483601525525138 m (six players) maximum segment excess against the existing 0.02 m ceiling, with maximum single energy corrections of 2939.592213872114 J and 1503.672964229034 J respectively. No tolerance is increased. Per-substep tracing finds those segment errors before the body commit in nonconverged 256-iteration substeps; the later authority snapshot can report a smaller last-substep iteration count. This allocation change fixes neither those mechanical defects nor the static-helper agency counterexample. Human fun remains unmeasured.
