# Reproducing the rejected rescue re-cut

The coordinator selected the existing 900 N diagnostic baseline. This handoff contains **evidence and an unapplied source patch only**. It does not change active engine, tuning, scripts or tests. The 450 N experiment remains rejected as a Phase 2 solution; human feel is unmeasured and Phase 3 remains blocked.

## Pinned sources

- Physics baseline: `ad00223526c9f3ba93320bfe284c74f1f30697fd`.
- Original experiment scaffold: `4bef043e96d4900563b485454f950d4b6473ce72`.
- Rejected core tuning candidate: `54eec098d3e90abf5cd9c3b59a5927c0c3c48c89`.
- Complete experimental source/evidence tree: `2eef347027d094bf9fd882ef4d0054691b11f2e6` on `codex/phase2-rescue-recut`.

The included [source patch](rescue-recut-source.patch) reconstructs all eight changed experimental source files from that exact baseline: the optional offline fixture constructor, root tuning, four experiment scripts, and two test files. It includes the rejected 450 N default solely to reproduce the experiment. It was applied to a temporary Git index and compared against the pinned final source tree; all eight files matched exactly. It has not been applied in this evidence-only checkout. Later baseline finish/cue/performance changes were not used for these measurements.

The coordinator supplies [phase2-baseline.bundle](phase2-baseline.bundle), advertised as `refs/heads/codex/evidence-baseline`, plus [its verification manifest](phase2-baseline-bundle.json). Historical local commit IDs are not necessarily present in API-published remote history. The bundle fetch below supplies `ad002` and its ancestors; the experimental patch and Git-blob hashes supply the variant source without assuming its local commits were pushed. The exact fetch command was verified in a fresh temporary bare repository.

## Isolated reproduction

Run these commands from the repository containing this evidence. They create a separate detached worktree and apply the patch there. The primary checkout keeps its selected baseline.

```sh
recut_evidence_dir="$PWD"
git bundle verify "$recut_evidence_dir/reports/phase2-baseline.bundle"
git fetch "$recut_evidence_dir/reports/phase2-baseline.bundle" refs/heads/codex/evidence-baseline
recut_checkout_dir="$(mktemp -d)"
git worktree add --detach "$recut_checkout_dir" ad00223526c9f3ba93320bfe284c74f1f30697fd
cd "$recut_checkout_dir"
git apply "$recut_evidence_dir/reports/rescue-recut-source.patch"
npm ci --ignore-scripts
npm run typecheck
npm run lint
npx vitest run tests/phase2-mechanics.test.ts tests/physics.test.ts tests/rescue-recut-evidence.test.ts
npx tsx scripts/rescue-recut-run.ts screen
npx tsx scripts/rescue-recut-run.ts matrix
npx tsx scripts/rescue-recut-summary.ts
```

The matrix can instead run as four disjoint processes using worker arguments `0`, `1`, `2`, `3`; after all four finish, run `npx tsx scripts/rescue-recut-merge.ts` and then the summary command. The merge rejects missing/duplicate cases or mismatched worker configuration hashes. No service, account, browser session or network player is needed. Stop after the fixed cases; these commands do not create another tuning family.

The final source has the `phase2-recut-1` version and 450 N default. The stored screen ran before that metadata/default change, explicitly selecting each variant. The first 46 corrected matrix cases also preceded partitioning; every matrix case explicitly selects 450 N, so the physical parameters and policy are identical across that scheduling boundary. Generated timestamps and top-level configuration metadata can therefore differ on a fresh reproduction; compare canonical specs, accepted-input hashes, physical diagnostics and outcomes. All profiles and original metadata remain in the raw reports. These are same-build mechanical checks, not a cross-platform determinism claim.

## Stored raw artifacts

The three large raw JSON artifacts are stored as lossless gzip. [Packaging receipt](rescue-recut-compression.json) records compressed and original SHA-256 hashes; decompressed bytes match the original artifact manifest. To inspect the existing evidence without rerunning physics, decompress copies in an ignored directory:

```sh
mkdir -p work/recut-raw
gzip -dc reports/rescue-recut-matrix.json.gz > work/recut-raw/rescue-recut-matrix.json
gzip -dc reports/rescue-recut-screen.json.gz > work/recut-raw/rescue-recut-screen.json
gzip -dc reports/rescue-recut-preflight-screen.json.gz > work/recut-raw/rescue-recut-preflight-screen.json
```

The isolated experiment still writes ordinary JSON. The original report and source hashes remain in [the original manifest](rescue-recut-original-manifest.json). The current manifest verifies the packaged files and updated links; the compression receipt connects both without changing measurements.

## Evidence accounting

Final datasets: [32-case screen](rescue-recut-screen.json.gz) and [250-case matrix](rescue-recut-matrix.json.gz). The matrix has 76 recoveries, 133 censored cases and 41 terminal cases, with no harness errors. Exactly 250 unique canonical specs were verified during merging.

Preflight evidence is retained separately: [32-case screen](rescue-recut-preflight-screen.json.gz) and [60 completed old-policy matrix summaries](rescue-recut-preflight-matrix.log). A helper bank-selection bug was corrected once. Corrected screen input hashes/outcomes exactly match the preflight screen; preflight results are not pooled into final counts. The interrupted old-policy matrix did not retain full state, which is disclosed rather than reconstructed. Corrected worker checkpoints were merged without dropping cases; redundant checkpoints were removed after verification.

[Decision](rescue-recut-decision.md) · [Detailed results](rescue-recut-summary.md) · [Force/geometry derivation and protocol](../docs/design/phase2-recut-experiments.md) · [Artifact hashes](rescue-recut-manifest.json)
