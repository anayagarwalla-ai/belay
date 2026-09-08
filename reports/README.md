# Evidence guide

Start with [the integrated checkpoint](phase2-verification.md). Passing software checks do not pass the rescue, human-fun or production-load gates.

| Question | Evidence |
|---|---|
| What can be played and what currently fails? | [Integration checkpoint](phase2-verification.md) |
| How do the baseline bots behave? | [Baseline findings](phase2-baseline-findings.md), [ten-run smoke](phase2-smoke.md), [incomplete 1,000-run prefix](phase2-paused-prefix.json) |
| Do accepted inputs replay? | [50-case replay](phase2-replay.json), saved `phase2-tapes/` |
| Can a player remain static during rescue? | [250-case rejected re-cut](rescue-recut-decision.md), [reproduction](rescue-recut-reproduce.md) |
| Why can the rope exceed its length bound? | [Rejected contact candidates](phase2-topology-failure-analysis.md) |
| Why are the largest corrections physically invalid? | [Motor and energy diagnosis](phase2-motor-energy-design.md) |
| What reached a real browser/server? | [Six-connection browser baseline](phase2-live-browser-baseline.json), [access/protocol checks](phase2-network.json) |
| Where does local CPU/allocation time go? | [Profiling](local-load-profile-findings.md), [rejected allocation change](phase2-performance.md), [mixed build-runtime experiment](local-load-runtime-findings.md) |
| Did 300 rooms pass? | **No.** [Local harness results](local-load-verification.md) retain limited fixtures and guard aborts |
| What would hosting cost? | [Preparatory proposal](../docs/design/phase6-hosting-clip-cost-proposal.md); no resources provisioned |

Use `npm run verify:evidence` to check registered artifacts, lossless compressed bytes and the historical source bundle. Compression receipts preserve original hashes. This command checks integrity, not whether the measurements meet a target.

Historical local commit IDs used by probes can be imported without another task's worktree:

```sh
git bundle verify reports/phase2-baseline.bundle
git fetch reports/phase2-baseline.bundle refs/heads/codex/evidence-baseline:refs/remotes/evidence/phase2-baseline
```

Each report identifies its source, runtime, fixture, scope and missing outcomes. Keep baseline, rejected experiments, incomplete prefixes and future full runs distinct. Never pool different horizons or policies to manufacture an acceptance percentage, average worker percentiles, or treat a timeout as a physical loss.

The [client latency source bundle](phase2-client-source-bundle.json) separately preserves the 33 measured files, including the original renderer-clock defect. Follow the [fresh-clone validation commands](phase2-client-latency.md#source-recovery-in-a-fresh-clone); it is a partial source reference, not a runnable checkout.
