# Lossless repaired matrix

All **77 original files** from the completed version-4 campaign are preserved: 48,261,366 original bytes stored in 21,631,984 bytes, including all 4,728,413 raw Float64LE timing samples, complete rows, source snapshots, worker receipts and controller resources. No row, failure, censor or timing sample was dropped. Original POSIX modes are in the manifest.

The invocation was `phase2-parallel-2026-09-08T17-00-11.762Z-26d223b4-42bc-47c9-b7c3-c2588819c95f`, measured commit `fdc6ae86b2c76f2255bcbbc2e1df5ab3dffa46c1`. Manifest SHA-256: `38789330374ee631bdc93aa1d639823194b6fa239e3ab90bed77d7248539e1a6`.

From the repository root:

```sh
node --max-old-space-size=256 reports/phase2-repair/evidence-package/restore.mjs --verify
node --max-old-space-size=256 reports/phase2-repair/evidence-package/restore.mjs work/repaired-matrix-restored
```

Use a new output directory; reconstruction refuses to overwrite anything. The decoder is offline and bounded. [Package verification](../package-verification-v4.json), [reconstruction receipt](../package-reconstruction-v4.json), and [direct comparison against original files and modes](../package-original-comparison-v4.json) all succeeded. These check byte integrity, not physics or fun. The independent validator checks the complete matrix and raw timing statistics, with its narrower scope recorded in [the receipt](../full-validation-v4.json). The local original directory remains unchanged; Git stores this complete lossless package to avoid redundant large raw files.

The independent matrix validator intentionally binds worker jobs to their original absolute artifact directory. It [refused the relocated reconstruction](../restored-matrix-validation-v4.json) for that reason; relocation does not receive a new full-matrix validation stamp. The original directory independently passed, and reconstruction proves the packaged files match those originals. Do not rewrite job paths or loosen the validator to make a relocated copy pass.
