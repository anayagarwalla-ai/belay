# Phase 2 synthetic evidence method

The user authorized Phase 2 implementation by explicitly bypassing the Gate 1 stop. Human fun was not measured by that authorization. This harness does not pass the human Phase 2 rescue check or any production capacity gate.

Run from the repository root:

```sh
npx vitest run --config vitest.config.ts tests/phase2-*.test.ts
npx tsx scripts/phase2-bench.ts --smoke
npx tsx scripts/phase2-bench.ts
npx tsx scripts/phase2-replay.ts
npx tsx scripts/phase2-stress.ts
npx tsx scripts/phase2-cost.ts baseline
```

The benchmark requires the actual Phase 2 shared engine. An interface-only build that rejects crossing/rescue cannot produce a qualifying report. All numerical profiles, target values and evidence bounds are owned by the single root [tuning.ts](../tuning.ts); the harness accepts no numerical CLI overrides. The smoke mode covers each configured team size in each scene with the recovery policy. The full mode covers the frozen policy matrix. Changing root tuning creates a different experiment, with a new exported configuration and source hash.

The separate cost command accepts only the evidence label `baseline` or `selected`. It observes five/six-player bad crossing and the two-player frozen casualty for the root replay horizon, preserving the original full-matrix specs alongside those shortened diagnostic probes. These probes never replace full-matrix trajectories. Conditional cost scenarios show what matching cells would cost if that measured rate persisted to every full horizon; early terminations and later-state costs remain unknown.

The matrix varies team size, then scene, then policy, then repetition. Every complete matrix uses the same seed/family across policies for paired comparisons. Families rotate between matrices. The policies are:

| Policy | Behavior and limitation |
|---|---|
| recovery | Move toward visible crossings; an unsupported climber seeks the nearest wall; helpers alternate planted brace and an away-from-casualty step. This is a finite scripted policy hypothesis, not an optimal strategy or a human. |
| walk | Continue toward the next visible bridge/finish without a rescue response. |
| bad | Fixed seeded idle, brace and wrong-way choices. Probabilities are not adjusted to fit target percentages. |
| static-brace | Supported helpers hold stationary brace from focused-fixture start; in crossing, intervention starts after an incident is observed. Once selected, held IDs do not change when a helper falls. |
| frozen-tail | The last harness receives unchanged rest input from focused-fixture start, or after the first observed crossing incident. In the two-player focused fixture this is the casualty, not a helper. |

Bots read public snapshot geometry and state, including visible crevasses/bridge positions. They do not read seeded hidden bridge capacity. Using complete snapshot geometry is more informed than a human camera view: these results cannot establish warning legibility, perceived fairness or causal blame. No automatic role gate, hidden rescue bonus or physics modification exists in the harness.

Each trajectory ends at a physical terminal run outcome, a focused fixture's completed rescue, a root-configured observation horizon, or an error. A focused fixture recovery is not a completed crossing. A horizon is an administrative **censor**, even if the team made progress, reached a stable hanging state or had earlier successes. Errors remain explicit and make the evidence incomplete.

Every authority snapshot is observed. Recent incident state is copied into a full-trajectory episode ledger and checked against lifetime diagnostics. Event IDs are counted without counting repeated snapshots twice. If records are missing or IDs are reused, evidence is incomplete. Raw report rows preserve episode status, start/end ticks, casualties, cascades and role counters.

Eventual recovery's conservative denominator includes every observed started episode, including unresolved episodes. First-attempt success counts only recovered episodes carrying the engine's firstAttemptSuccess flag. Recovered later attempts and terminal failures are separate from still-active censoring. The report also shows resolved-only fractions and the upper bound if every censored episode eventually succeeded; neither replaces the conservative result. A bot policy distribution is not a population probability estimate.

Rescue durations are reported for observed recoveries, with unsuccessful/unresolved observations alongside them. Run durations are calculated from **crossing** trajectories only. Completed-run duration and any-terminal-outcome duration are separate. The descriptive Kaplan–Meier curve treats administrative censoring as censoring, and errors are excluded with an explicit count. Its independent-censoring assumption is unproven; an unobserved median stays null. A run with no fall stays in the raw data rather than receiving an invented first-fall time.

The count of trajectories that happened to contain four incidents is descriptive post-observation selection. It is not the plan's controlled four-incident completion experiment. Likewise, focused rescue starts at a prescribed hole and cannot establish natural route pacing.

Static counterexamples require an actually recovered episode and a verified continuous intervention from no later than that episode's first fall tick. A helper who initially caught dynamically and then held brace is not reported as static for the whole episode. Records preserve held player IDs and the intervention boundary so this can be audited. Input inactivity, longest unchanged input and motionlessness are supplemental proxies. The displacement threshold is applied per authority step, so that proxy should not be compared across changed authority rates without requalification. The simulation's role counters are also proxies: button changes and movement do not prove useful contribution.

Crossing counterpolicies release their held controls once an episode resolves, resume travel, and reapply the intervention at the next observed incident. They do not intentionally refuse to walk for the rest of the route after a successful rescue. Each intervention's start, held IDs and release tick are preserved.

Timing quantiles use every measured `simulation.step()` attempt in the invocation, including an attempt that throws. Storage capacity is derived from the frozen schedule; the timing buffer plus its sorting copy must fit the root budget before execution. Overflow throws instead of wrapping. Exact nearest-rank full-window quantiles and raw counts are reported; policy execution, snapshot collection, transport and scheduler deadlines are outside this measurement. Source files, lockfile, full root tuning and machine/runtime information are hashed/exported.

Other local tasks may consume CPU during these runs. The timing distribution describes this invocation under that machine load; it is not an isolated capacity result. JSON reads and writes have root byte bounds, and oversized output does not replace a prior report. Raw-record accumulation is bounded before adding another record. The tests verify those failure paths, exact full-window counts, censorship arithmetic, real-world incident reconciliation, and exact replay across all configured team sizes.

New reports also retain the actual process entrypoint, its SHA-256 hash and Node execution flags. A transpiled or bundled runner must be identified separately from the TypeScript source manifest; a runtime change cannot silently inherit earlier timing claims. Historical baseline artifacts remain unchanged.

During execution, bounded incremental records and their source manifest are written under ignored `work/phase2-{mode}-progress*`. They support early failure inspection and interruption recovery; they are explicitly incomplete until the final report is emitted and are never relabelled as the complete 1,000-trajectory result. Per-trajectory progress logs and file writes occur outside the measured simulation step.

The replay suite records actual simulation input tapes, replays them into fresh same-build worlds, and compares complete physical state with the wall-clock timestamp removed. It covers each scene/team/policy cell and preserves bounded focused static/frozen cases, including unsuccessful examples. Version mismatch or truncated tape is not a complete replay pass. A matching replay verifies this build/environment, not cross-platform or cross-version determinism. The policy-input digest is distinct from the tape's accepted-input digest.

The stress suite sequentially creates, steps and frees worlds, compares repeated initial states, records process memory, and fills the configured first-window tape limit before verifying truncation. It does not equate a returned dispose call with proof of all native memory being reclaimed. Process memory includes the runtime/allocator/harness; it is not per-room attribution. Event and incident ring occupancy checks do not claim those rings were saturated. Production 300-room scheduling, memory attribution and reconnection remain untested.

Read actual generated JSON/Markdown results for observed counts. This method document contains no human verdict, recovery percentage result or production qualification.
