# Integrated performance cleanup

These exploratory paired checks remove an unused contact-normal sweep and avoid constructing arrays for solids outside the existing contact tolerance. No numerical tolerance, input, contact plane or solver order changes. The broad-phase predicate is identical to the one that already returned an empty normal list; each remaining endpoint normal is still computed immediately before use.

| Case | Compared authority ticks | Mean before / candidate | p95 before / candidate |
|---|---:|---:|---:|
| Ordinal 24, six-player bad policy | 5,498, through terminal failure | 26.03 / 21.99 ms | 94.68 / 81.43 ms |
| Ordinal 512, four-player walk policy | 6,000, capped at 200 s | 13.24 / 11.37 ms | 18.35 / 15.97 ms |

Every snapshot field except wall-clock `serverTime` matched exactly after every compared tick. The test alternated which implementation stepped first. These two cases are exploratory, not a preregistered capacity test; the full benchmark and local preview shared the host. Individual timing samples were not persisted, so the saved quantiles are not independently re-computable. The script, candidate source bytes, assertion result and summaries are preserved. Do not pool them into the full matrix or claim a 300-room pass. The six-player case still has expensive ticks.

The shortcut that changed a tension value by floating-point roundoff was rejected. Only the two result-preserving contact changes remain in this candidate. The two saved simulation files were integrated after the full campaign completed and independently reconciled. The diagnostic motor/energy observer was adapted to compute contact normals when the removed cache is absent; historical cached engines retain their existing observer path. See the [final integration receipt](../integration/receipt.json) for tests and source hashes. The 1,000-run timing table measures the pre-cleanup source, not this integrated source.
