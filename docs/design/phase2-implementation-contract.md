# Phase 2 parallel implementation contract

Implementation authorized by the user on 2026-09-07 after explicitly bypassing the Gate 1 stop. Human fun evidence remains unmeasured. This contract coordinates isolated project worktrees; it does not change later stops or enable art/audio/recording/voice/uploads.

## Shared interfaces

The physics task owns `shared/protocol.ts`, `shared/simulation.ts`, `shared/terrain.ts`, new shared physics helpers, and the root `tuning.ts` physics/scene additions. Preserve all existing Phase 1 methods and counters. Default `new BelaySimulation()` remains the flat two-body regression fixture; the application server explicitly selects the new crossing scene.

- `SceneOptions`: add `scene?: 'flat' | 'crossing' | 'rescue'`, `playerCount?: number` (integer 2–6).
- The simulation exposes readonly `scene`, `playerCount` in addition to existing `seed`, `family`, `tickHz`, `bodies`, `points`, `counters`, `tape`, `step()`, `snapshot()`, `dispose()`.
- `Snapshot`: add `scene`, `playerCount`, `terrain`, `incidents`, `run`, and rope `spans`. Existing `rope.points/length/tension/tensionN/slackM` remain aggregate-compatible.
- `PlayerState`: add `support: 'ground' | 'wall' | 'air'`, `rescueState: 'safe' | 'falling' | 'hanging' | 'climbing' | 'lost'`, `activeIncidentId: number | null`. Existing `position/velocity/brace/connected/label/ackSeq` remain.
- Each rope span: `{id, a, b, startPoint, endPoint, length, tension, tensionN, slackM, catchHighlight}`. `startPoint/endPoint` index the aggregate rope point array; consumers draw spans separately, never connect unrelated endpoints. Span `a/b` identify adjacent harness players. No spring approximation.
- `terrain`: `{bounds: {minX,maxX,minZ,maxZ}, finishZ: number | null, crevasses: {id,minX,maxX,minZ,maxZ,depth}[], bridges: {id,crevasseId,minX,maxX,minZ,maxZ,cue: number,collapsed: boolean}[], ice: {id,minX,maxX,minZ,maxZ}[]}`. Ordinary snapshots do not expose hidden load capacity. Surfaces are flat gray geometry; future art is gated.
- `incidents`: bounded recent `{id,fallTick,playerIds:number[],status:'active'|'recovered'|'failed',recoveredTick:number|null,cascades:number,firstAttemptSuccess:boolean,roleActiveSeconds:number[],roleIdleSeconds:number[],staticHoldSeconds:number[]}`. Keep honest proxy metrics, not claims that key activity proves useful contribution.
- `run`: `{status:'testing'|'active'|'complete'|'failed',elapsedSeconds:number,progress:number}`. Flat is testing. Crossing uses a fixed seeded-capacity test route with a plain finish boundary; procedural route generation is still Phase 5. Rescue is a focused fixture.
- `Tape`: includes scene/playerCount; replay creates those exact options. Frame count remains bounded.

The physics task may refine internal implementation freely. If any public field needs to change, send the precise correction to the coordinating task and both consuming tasks immediately, before callers depend on it. No parallel defaults file: numerical values are root tuning entries with units/rationale. Client/harness tasks prepare their root additions as a patch for the coordinator to merge, so only the physics task edits `tuning.ts` during implementation.

## Ownership and verification

- **Physics task:** physical support/contact, multiple adjacent spans, seeded bridges/collapse, gravity/catch/haul/wall travel through move/brace, bounded incident/run counters; meaningful mechanics tests. Do not edit client/server or script harnesses owned elsewhere.
- **Client task:** `client/`, active `app/` UI/styles, own client tests. Dynamic 2–6 gray boxes, terrain/bridge cues, rope span highlights, support and rescue control readability, operator scene/team controls, camera depth and own-body-only prediction. No audio/art/slow motion/clips or automatic rescue button. Keep reports usable for testers and disconnected users.
- **Evidence task:** new Phase 2 bot/scenario/benchmark/stress scripts and tests, reports. Test all team sizes, catch physics, failed policies/static hold counterexamples, deterministic replay, bounded memory and lifecycle. Do not fake target percentages, human agency or production qualification. Keep old Phase 1 reports historical.
- **Coordinator:** server room creation/reset/validation, access and payload limits, integration and browser checks, docs and GitHub publication. Main server explicitly starts `crossing` with four bodies; operator may reset to any approved scene and team size. Reject team reduction that would delete an occupied high-index seat. Room cap always matches scene count and is never greater than six.

All work stays in isolated Git worktrees until reviewed. Tasks commit and report exact SHA/path without pushing, provisioning, recruiting or claiming human gates. Root integrates and publishes validated work. The Phase 2 human stop for arbitrary falls or static rescue roles remains in force before Phase 3.
