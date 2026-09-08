# Lossless Phase 2 evidence package

This package preserves the complete fixed 1,000-run invocation and both separate zero-worker preflight refusals. All **71 original files / 34,795,282 bytes** are represented by individual files totaling **13,595,969 stored bytes**. Every raw timing sample, trajectory, resource-journal line, status receipt, log and frozen source file is retained. Original directories remain unchanged in the evidence checkout.

Read the [final findings](../phase2-final-evidence.md), [launch history](../phase2-parallel-launches.md), [original generated full table](payload/reports/phase2-parallel-2026-09-08T00-01-34.279Z-688bcbe4-7d3f-4aba-b66f-de8f8cc5703d/result.md), and coordinator-created [independent validation receipt](provenance/independent-final-validation.json). Original generated relative links resolve after reconstruction; large JSON files are compressed in this Git package. That receipt validates the original finalized invocation; reconstruction elsewhere does not recreate its original-host process attestation.

## Contents and integrity

[manifest.json](manifest.json) maps every original repository-relative path to its stored path and records original/stored SHA-256, original/stored byte count, encoding and original POSIX mode. It also records directory modes, source revision, source/runtime/schedule identities, invocation identity and the independent receipt's hash. Every frozen source file, every timing stream and other files at least 65,536 bytes use separate gzip files; remaining smaller files are unchanged bytes. Compressed historical TypeScript files cannot accidentally enter the root project compilation. No lossy compression, truncation, pooling or sample transformation is used.

The manifest covers three original directories:

- `phase2-parallel-2026-09-07T23-39-10.686Z-8255cbc7-cc24-41aa-8450-9f2f2a39e61b`: initial memory refusal, four files, zero workers/records/samples.
- `phase2-parallel-2026-09-07T23-41-52.448Z-ccb8cc4a-f29e-4e6b-aab0-210e26464561`: separate initial memory refusal, four files, zero workers/records/samples.
- `phase2-parallel-2026-09-08T00-01-34.279Z-688bcbe4-7d3f-4aba-b66f-de8f8cc5703d`: COMPLETE/finished, 63 files, 1,000 records, 2,763,309 raw samples / 22,106,472 timing bytes.

Git does not preserve the distinction between mode 0444 and 0644. The reconstruction script restores the recorded modes, including all 29 frozen source files as read-only. This package preserves bytes, paths and permission modes; inode identity, ownership, ACLs, filesystem timestamps and original live-process identity are not recreated. [SHA256SUMS](SHA256SUMS) additionally hashes the packaged files, manifest, restoration script and provenance documents. Hashes detect changes relative to the committed manifest; they are not external cryptographic attestation.

## Reconstruct without overwriting originals

Use Node with builtins only. From the repository root, verify compressed and original bytes without writing an output directory:

```sh
node --max-old-space-size=256 reports/phase2-evidence-package/restore.mjs --verify
```

To restore, supply a **new, nonexistent** destination whose parent exists. Do not select the original finalized directory:

```sh
node --max-old-space-size=256 reports/phase2-evidence-package/restore.mjs /absolute/path/to/new-evidence-copy
```

The script refuses existing destinations and symlinked archive payloads, validates all hashes and bounds, restores `reports/<original-invocation>/...`, reapplies file/directory modes and rechecks reconstructed hashes/modes. It imports no simulation, harness or collector. A successful reconstruction reports `RECONSTRUCTED_BYTES_AND_MODES`. The independently prepared final validator intentionally refuses relocated/copied evidence, live/reused recorded PIDs or changed original host; do not use relocation as a way to obtain another final-run pass.

Reconstruction was executed during this handoff and verified all 71 files and 10 directory modes. See [package-verification.json](provenance/package-verification.json). The coordinator had already completed independent final matrix validation; no physics or timing-statistics workload was rerun for packaging.

The monitoring snapshot is non-secret notification provenance, captured before this final handoff. Historical cadence/check-cap and reported-shard fields do not define a live automation. The BELAY heartbeat definition was absent when checked after the coordinator's deletion report; no schedule is included or recreated. The generic [prepared plan](../phase2-parallel-plan.json) is retained as historical preparation only; the packaged invocation manifests are authoritative.
