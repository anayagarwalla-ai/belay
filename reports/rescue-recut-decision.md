# Re-cut decision: retain the 900 N diagnostic baseline

The coordinator retained 900 N and rejected selection of 450 N. This evidence-only handoff includes an [unapplied patch and isolated reproduction recipe](rescue-recut-reproduce.md); it does not change active engine or tuning.

Rejected core candidate: `54eec098d3e90abf5cd9c3b59a5927c0c3c48c89` on `codex/phase2-rescue-recut`. The candidate changes wall effort/version and mechanics regressions only. Experiment hooks and evidence are separate commits. No Phase 3 work or human gate pass is implied.

**The 450 N variant improves the force envelope but still fails the static-role requirement and is not a validated 2–6-player solution.** It caps vertical wall assistance at 585 N against 784.8 N weight, requiring at least 199.8 N upward rope force for steady ascent. The original 1170 N cap allowed self-climbing.

The final dataset is complete: 32 screen cases plus 250 matrix cases. Separate preflight evidence retains a 32-case screen and 60 interrupted-matrix outcome rows; these are not pooled into final counts. There was one documented helper-policy bug correction, not another parameter family.

| Variant | Decision |
|---|---|
| Baseline, 900 N | Original static-helper self-climb remains an explicit failure. |
| 450 N | Original two-player all-static-helper climb censored at 30 s; active snow rescues remain possible. Other static helpers and idle casualties can still recover. |
| 300 N | Reject as a selected variant: the two-player fan-out policy stalls and exceeds the 2 cm segment ceiling. |
| 450 N, wider/nearer stance | Reject: some stalls remain; maximum screen segment residual is 0.109 m. |

Static helper: three players, middle casualty P2, P3 continuously braces from tick zero: matrix row 38, 2.400 s; held inputs verified, maximum segment residual 0.004999 m.

Idle casualty: four players, tail P4 starts at z=1.4 m, all helpers on the near bank; P4 holds REST throughout: matrix row 103, 2.800 s; held inputs verified, maximum segment residual 0.004998 m.

Across the matrix, 44 passive recoveries meet existing contact/rope bounds; 86/250 cases exceed a contact/rope ceiling or error. Recovered duration spans 2.033–4.917 s. The 10–20 s rescue target and human participation/feel remain unvalidated. This focused fixture work does not establish incident count, route duration, first-exposure probabilities or four-incident completion.

Numerical limits are material: maximum single-step kinetic-energy removal 2808519.502 J; unresolved potential excess 3561.911 J. Wall horizontal motor assignments can reach 46461.571 N, so the nominal normal-effort parameter is not a measured Coulomb contact normal. The solver was retained, not tuned to hide these failures.

A disconnected limp body is not an active participant, so its recovery alone is not an agency verdict. But an identically idle connected casualty can share the same physics. The zero-input recovery above shows that casualty action changes are not mechanically necessary in that fixture. Available useful participation is a different criterion from mechanically necessary action. Freezing a helper leaves its body and static support present; it does not prove the body is unnecessary. No connection/input gate is proposed.

[Detailed results and exact failure rows](rescue-recut-summary.md) · [Raw screen](rescue-recut-screen.json.gz) · [Raw matrix](rescue-recut-matrix.json.gz) · [Derivation and protocol](../docs/design/phase2-recut-experiments.md)
