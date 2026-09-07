# Bounded build-runtime comparison

**The result is scene-specific: compiled rescue improved, crossing did not.** Keep the mixed result; it does not support changing the default runtime or claiming a general speedup. No simulation, numerical tuning, solver, server or package configuration was changed.

| Six-body / 30 Hz scene | tsx median step total | esbuild median step total | Change in medians | Compiled faster in paired runs |
|---|---:|---:|---:|---:|
| Crossing | 2,788.32 ms | 2,892.98 ms | +3.75% | 1 / 4 |
| Rescue | 1,231.57 ms | 834.42 ms | −32.25% | 4 / 4 |

Each total covers 240 active step calls after 60 fixed warm-up ticks. Positive change means slower. Median paired changes are +3.12% crossing and −23.40% rescue; ratios of medians and medians of paired ratios are different statistics. Rescue's consistent direction is promising for this fixture, while its size varies materially with run conditions.

| Pair, zero-based | Run order | Crossing change | Rescue change |
|---|---|---:|---:|
| 0 | tsx → compiled | +3.45% | −24.48% |
| 1 | compiled → tsx | −8.81% | −42.28% |
| 2 | tsx → compiled | +4.59% | −21.99% |
| 3 | compiled → tsx | +2.80% | −22.31% |

## Exactness gate and source

The script adapts the physics owner's performance-equivalence method from commit bd8254c36e1a210a72e08f95e99e3a19a6d7b220. It compares unchanged corrected physics (shared source identical to f2fb8fd7f828b706ccdabbaffcbb72a0565b58a1) through two build treatments. Local root tuning is frozen identically in both; no rejected allocation patch was applied.

Before any timing, both six-body balanced-family seed-1701 crossing/rescue fixtures passed exact comparison of **602 initial/every-tick snapshots and 600 normalized tape frames per runtime**. Only snapshot serverTime is replaced with zero. Node assert.deepStrictEqual compares every remaining field, including events, incidents, diagnostics, particles, counters and run state. Complete recorded tapes compare exactly; V8-serialized hashes preserve signed zero. This covers two 300-tick fixtures at 30 Hz, not the physics owner's full 42-fixture matrix, other sizes/families/rates, arbitrary states or cross-platform determinism.

The baseline-generated normalized inputs are then replayed unchanged. Crossing moves all players forward. Rescue holds helpers braced; the middle player rests for two simulation seconds then moves backward. All 240 measured ticks in every run begin in active physics. Timed replays use the physics harness's default unrecorded step call; tape recording is enabled during the preceding exactness gate. Terminal quiet ticks do not enter these timing distributions. All timed final hashes agree within each scene.

## Build treatment and interpretation

The candidate bundles shared/simulation.ts into a 72,628-byte Node ESM file using installed esbuild 0.28.1, packages: external, target: node26, keepNames: false, minify: false and no source map. The build metadata confirms local simulation/tuning code is bundled while Rapier stays external. Generated output contains no __name helper.

The reference uses tsx 4.23.13, whose installed transformer uses esbuild 0.28.2 and keepNames: true. Both modules execute in the same Node v26.5.0 process with the installed external Rapier dependency. The [esbuild name-preservation option](https://esbuild.github.io/api/#keep-names) concerns function/class names; this experiment also changes bundling, transformation and esbuild version. Consequently the timings do **not** isolate helper-removal cost. The earlier sampled __name share is a hypothesis generator, not a guaranteed recoverable speedup.

The child ran from 2026-09-07 23:01:03–23:01:57 UTC on an Apple M4, Darwin 27.0.0 arm64, 10 logical CPUs, 16 GiB RAM. One-minute load during measured runs ranged roughly 9.90–10.65. Other tasks shared the host. Alternating order reduces but does not eliminate JIT, GC, scheduling or host-activity bias. Four pairs do not justify a statistical significance or capacity claim. Snapshots used for status observation are outside step timings but inside whole-window wall/CPU observations. Compilation/import/startup, networking and serialization are not benchmarked.

Peak sampled child RSS was about 263 MB; this is shared process state, not a per-room allocation or causal memory reduction. Prior profiles used different fixtures/instrumentation/tape behavior, so their timing values are not substituted into this comparison. Existing physical defects are preserved by exactness, not repaired.

## Reproducible local experiment

The bounded command automatically builds the candidate, checks both fixtures, runs four alternating pairs per scene, writes separate artifacts and removes its generated bundle:

```sh
npx tsx scripts/local-load-runtime-build.ts
```

For a local benchmark that explicitly imports a precompiled simulation, this is the same build recipe; it only compiles the module and does not run a benchmark:

```sh
node --input-type=module <<'JS'
import { build, stop } from 'esbuild';
try {
  await build({
    entryPoints: ['shared/simulation.ts'],
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
    target: 'node26',
    keepNames: false,
    minify: false,
    sourcemap: false,
    outfile: 'work/local-load-runtime-build/simulation.mjs',
  });
} finally {
  await stop();
}
JS
```

Record the exact runtime, package lock, source/tuning hashes and build flags with any new result. This is a reproducible experimental option for the demonstrated rescue fixture, not a replacement for npm run bench or a new default server build. No full benchmark or further tuning candidate was run.

## Evidence and cleanup

[Raw measurements](local-load-runtime-483fda44-4031-4b15-9376-5f7b22c8cdf0/measurements.json) retain every normalized input and raw timed step, all exactness hashes, run order, active status, memory and host samples. [Offline analysis](local-load-runtime-483fda44-4031-4b15-9376-5f7b22c8cdf0/analysis.json) validates source hashes, frame/sample counts, order, final hashes, raw sums and successful teardown. The same directory includes the manifest, build metadata and child exit receipt.

The executed harness is preserved byte-for-byte as executed-harness.ts.txt and matches the manifest hash. After the run, scoped lint identified two unawaited esbuild stop() promises in the parent; the reusable script now awaits them. No simulation or timing code changed, and no workload was repeated for that cleanup correction. Typecheck and scoped lint subsequently passed.

The invocation uses the prior direct-profiler budget: an owned IPC child, parent-enforced 180-second wall limit, 1 GiB V8 cap, sampled 3 GiB child RSS cap and 64 MiB report cap. Raw host free memory is recorded. The existing transport/load 512 MiB launch guard is unchanged; no socket/load retry was made. Child PID 9039 exited 0, the temporary bundle was removed, and no owned experiment/compiler process remains.
