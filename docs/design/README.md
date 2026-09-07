# BELAY designs prepared while Gate 1 waits

Status: **proposals for review; no later phase implemented or authorized by these documents.** Prepared 2026-09-07 against repository commit `d194cb6` and `TUNING.version = phase1-1`. Gate 1 has no human verdict; Gate 2 has zero recruits. The coordinating task reviewed and integrated this preparation; it does not change the approved gameplay scope.

| Document | Decision it prepares |
|---|---|
| [Phase 2 incidents and rescue](phase2-incidents-rescue.md) | Contact and rope coupling, active roles at every team size, legibility, metric definitions and the mandatory rescue stop |
| [Phase 3 local recorder](phase3-local-recorder.md) | Actual rolling video and game-audio capture, bounded export, portrait framing and a future hosted boundary |
| [Gate 2 closed test packet](gate2-closed-test-packet.md) | Unpublished invitation, unfamiliarity checks, individual access, neutral hosting and an empty score sheet |
| [Phase 6 production load protocol](phase6-production-load-protocol.md) | Reproducible production qualification, deadline accounting, memory attribution, reconnection and raw evidence |

Read [PLAN.md](../../PLAN.md), [PLAYTEST.md](../../PLAYTEST.md), [RUNBOOK.md](../../RUNBOOK.md) and the root [tuning.ts](../../tuning.ts) first. They remain the governing contract. In particular, the Phase 2 rescue check is a stop condition; the Phase 2 re-cut budget and Gate 3 failure branch remain unresolved. Typography and the sixth parka colour remain for the user's review. Neither this package nor its commit passes a human gate, approves costs, posts a recruitment message or provisions a resource.

## Evidence and configuration convention

- **Existing:** directly inspected repository behavior, with a file reference. Existing reports are historical evidence from their stated environment, not measurements made by this design task.
- **Contract:** a requirement already recorded in the plan or tuning. Quoted numbers are traceability, not independent defaults.
- **Proposal/hypothesis:** our design choice or predicted outcome; it needs implementation and the named checks. A protocol is not a test result. Empty score cells are not zero-valued observations.
- **API fact:** narrowly supported by a linked primary source, consulted 2026-09-07. Specs and vendor documentation establish API semantics, not BELAY performance or universal browser support. Pin and recheck the actual dependency/browser versions at implementation.

All executable numbers, test-profile parameters and policy limits must continue to live in the **single root `tuning.ts`**, with rationale and an exported configuration hash. These documents use existing `TUNING` keys where available. Proposed missing keys are identified without assigning new numerical defaults; they are not a second configuration file. Before an experiment, commit its complete root profile and freeze it in the evidence manifest. A missing required value blocks that experiment; it does not authorize an implementation to pick a hidden constant.

The production protocol therefore specifies exact workload algorithms and evidence contracts, but is deliberately not an executable load harness or a completed provider configuration. Completing a manifest later is necessary for reproducibility and requires the applicable phase/cost authorization.

## Authoring validation and unresolved findings

Documentation checks passed: all 26 local file/section references resolve; all 24 cited external URLs returned HTTP 200 and their specified anchors exist; Markdown table widths, code fences and whitespace are consistent; the clip-byte, capacity, tick/input-count and four-incident probability arithmetic was checked. Repository inspection confirms only these new design documents changed. No gameplay, codec, human or production load tests were run by this documentation task.

Review attention remains on whether the physical rescue model can support active far-tail roles, whether the complete recorder codec/audio/mux chain works on each target browser, how much native/WASM allocation can be directly attributed versus estimated, and the later frozen production profile/provider envelope. Those are explicit hypotheses or implementation prerequisites, not measured successes. The two open user decisions in the plan remain open.
