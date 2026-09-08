/** BELAY's single source of tuning. SI units unless stated otherwise.
 * Changes are recorded by the reports' full configuration and simulation version.
 * Nothing here is a human Gate 1 verdict. */
export const TUNING = {
  version: 'phase2-repair-3',
  phase: 2,
  seed: 1701, // Reproducible default flat test surface; no hazards are generated.
  players: 2, // Gate 1 is exactly two bodies. Later phases must still respect hardCap.
  hardCap: 6,
  tickHz: 30 as 30 | 60, // Six tuning sessions use 30; 60 is the separate contingency.
  physicsHz: 60, // Identical internal steps in both authority-rate profiles.
  solverIterations: 8, // Initial PBD work budget; benchmark before increasing.
  maximumSolverIterations: 32, // Bounded extra projection only when the base eight leave a segment outside tolerance.
  maximumCatchupTicks: 4, // Bound work after a stall; report discarded wall time explicitly.
  gravity: 9.81,
  body: {
    mass: 80, // kg; keeps traction and rope-force diagnostics interpretable.
    width: 0.55, height: 0.9, depth: 0.55, // Plain grey-box colliders, not character art.
    walkSpeed: 3.1, // m/s; cooperative travel should not require tiny corrective taps.
    acceleration: 10, // m/s²; brief acceleration preserves immediate control without teleports.
    coastDeceleration: 1.4, // m/s²; an idle unbraced partner must remain draggable.
    braceFriction: 1.6, // Coulomb ground traction on the sole Phase 1 surface.
    braceMassMultiplier: 6, // Effective mass in rope constraints, never an animation flag.
    groundFriction: 0.08, // Low walking-contact friction; brace traction supplies anchoring.
    contactPredictionM: 0.12, // Covers two climbers closing at 3.1 m/s over 1/60 s (0.103 m); prevents measured 3.25 cm overlaps.
    harnessHeight: 0.42,
    maximumInputAgeMs: 250, // A stalled client must not keep walking indefinitely.
  },
  rope: {
    length: 3.6, // m between harnesses; slack is actual chain length, not a visual offset.
    segments: 12, // Light particles plus a redundant span constraint accelerate convergence.
    particleMass: 0.2, // kg; the rope is lighter than a climber.
    drag: 2.5, // s⁻¹; exponential, so changing tick rate does not change damping.
    floorHeight: 0.04,
    radius: 0.035, // Geometry only; no decorative spring physics.
    tensionReferenceN: 700, // Normalization for readouts; not a breaking threshold.
    tensionSmoothingSeconds: 0.1, // Smooth the display only, never the physical impulse.
    tautFraction: 0.97, // Counter threshold for taut/slack transitions.
    initialSpacing: 2.5,
    initialSag: 0.35,
    initialBend: 0.6,
    solverToleranceM: 0.01, // Refine residuals above 1 cm; the regression ceiling is 2 cm, previously exceeded while circling.
  },
  terrain: {
    halfExtent: 500, // Flat contact patch follows the team, so no edge can end this test.
    gridUnit: 1, // Metre marks repeat with the moving flat patch to convey distance.
    landmarkCount: 24, // Seeded flush ground marks let players judge motion, not hazards.
    landmarkRange: 36,
    markSize: 0.18,
  },
  camera: {
    bridgeCueSagM: 0.06, // Small gray surface displacement makes a server cue readable without depicting a collapse early.
    catchRadiusMultiplier: 1.75, // A caught span gets a thicker black stroke; no color, flash, slow motion or force change.
    terrainEdgeWidthM: 0.04, // Flush gray seams separate bridge/ice patches from ordinary ground.
    wallCueReachM: 0.8, // Show a direction cue only near a known crevasse wall, not a distant implied foothold.
    maximumCueEvidence: 256, // Bound per-client first-visible cue/collapse observations between scene resets.
    localWeight: 0.35,
    elevationDegrees: 55,
    azimuthDegrees: 45,
    baseVerticalSpan: 11,
    maximumVerticalSpan: 24, // Hard zoom-out bound; no unlimited shrinking of climbers.
    margin: 4,
    smoothingSeconds: 0.22,
    distance: 60,
    maximumPixelRatio: 2, // Bound fill cost on Retina laptops.
    edgeInsetPx: 36,
    labelOffsetPx: 26,
    braceVisualHeight: 0.58, // Auxiliary grey-box pose; physical brace works independently.
  },
  network: {
    inputHz: 60, // Same submission rate for both authority profiles.
    interpolationMs: 70, // Remote entities only; record it in the latency evidence.
    snapshotHistory: 32,
    reconciliationSeconds: 0.07,
    hardCorrectionDistance: 1.5, // Large authoritative corrections cannot be hidden by easing.
    maximumPredictionMs: 100, // Never extrapolate through an unbounded outage.
    pingIntervalMs: 500,
    staleSnapshotMs: 1000,
    probeTimeoutMs: 2000,
    maximumMessagesPerSecond: 120,
    maximumFrameBytes: 4096,
    telemetrySamples: 2048,
    debugTimeoutMs: 5000,
    joinTimeoutMs: 10000, // A failed join must return control instead of leaving an endless disabled button.
    maximumPendingDebugCommands: 8, // Bound operator promises/timers during a slow connection.
    maximumDebugCommandsPerSecond: 12, // Pause/reset/report bursts fit; repeated tape/step requests cannot monopolize a room.
    maximumSnapshotBufferedBytes: 64 * 1024, // Skip obsolete snapshots for a slow reader instead of accumulating a long playback queue.
    maximumDebugResponseBytes: 16 * 1024 * 1024, // Fits the bounded 20-minute 60 Hz input tape; never enqueue unbounded diagnostic replies.
    hudUpdateMs: 250, // Readouts need not rerender React at simulation frequency.
    maximumStepTicks: 3600,
    rttBracketsMs: [30, 60, 100, 150, 250],
    emulatedJitterMs: 10, // Applied message delay, explicitly not measured internet packet loss.
    maximumAddedRttMs: 500, maximumJitterMs: 50, // Bounds for the operator's test impairment tool.
    maximumDelayedBytes: 1024 * 1024, // Bound queued transport data; fail instead of growing memory.
    maximumTapeSeconds: 1200, // Preserve the first 20 minutes after reset; mark truncation rather than grow forever.
  },
  server: {
    host: '127.0.0.1', // All origins remain loopback-only; only the protected gateway is tunneled.
    port: 2567,
    webPort: 5173,
    gatewayPort: 8787,
    protectedPort: 8788,
    sessionLifetimeSeconds: 7200, // Expiring test access; teardown invalidates it sooner.
    tokenBytes: 32,
    maximumAuthBodyBytes: 1024,
    authAttemptsPerMinute: 15,
    roomIdleMinutes: 30,
    httpTimeoutMs: 15000,
  },
  bot: {
    actionSeconds: 1.2, // Reproducibly change direction, occasionally counterproductively.
    braceChance: 0.22,
    idleChance: 0.12,
    benchmarkRuns: 1000,
    benchmarkSeconds: 20, // Phase 1 diagnostic trajectories, not invented glacier runs.
  },
  physicsDiagnostics: {
    scenarioSeconds: 60, // Repeated contacts and tugs, independent of a human feel session.
    longWalkSeconds: 1200, // Cross the original 500 m floor extent and fill the entire tape budget.
    crossingRadiansPerSecond: 0.6,
    circlingRadiansPerSecond: 2,
    circlingPhaseRadians: 1,
    circleBracePeriodsTicks: [100, 70], circleBraceTicks: 20,
    togglePeriodsTicks: [2, 3], // Deliberately switch brace as often as individual authority ticks.
    randomActionSeconds: 0.1, randomBraceChance: 0.25,
    maximumBodyOverlapM: 0.005, // 5 mm contact budget; catches centimetre-scale visible interpenetration.
    maximumFloorErrorM: 0.001, // Rapier's metre-scale contact tolerance, including float32 roundoff.
    maximumSpanErrorM: 0.01, maximumSegmentErrorM: 0.02, // Preserve the existing rope regression tolerances.
    maximumSpeedMultiplier: 4, // Explosion guard only; a rope catch may exceed walking speed.
    minimumWalkSpeedFraction: 0.8, // Broad correctness guard for long travel, not a feel target.
  },
  phase2: {
    defaultScene: 'crossing' as const, defaultPlayers: 4, // Application default; simulation's legacy default stays flat/two.
    routeHalfWidth: 12, routeStartZ: -16, finishZ: 950, // About five minutes of travel before rescues; fixed grey-box route, not daily generation.
    finishApronM: 30, // All six climbers must fit safely beyond the finish, including the longest family spans.
    crevasseStarts: [8, 230, 480, 740], crevasseWidth: 2.8, crevasseDepth: 12,
    terminalY: -16, // Explicit out-of-world boundary; hanging duration never ends a run.
    bridgeHalfWidth: 1.1, bridgeThickness: 0.25,
    bridgeLaneOffsets: [0, -2.2, 2.2], // Adjacent snow bridges leave a physical way around a collapsed crossing.
    bridgeCapacityBodyWeights: [0.62, 0.92], // Weak central snow bridge: one sustained crossing load can trigger an early catch.
    alternateBridgeCapacityBodyWeights: [4, 6], // Broad alternate bridges support a hauled team; six bunched climbers or sustained catch loads can still overload them.
    bridgeOverloadSeconds: 0.32, bridgeRecoveryRate: 2, // Sustained overload memory; never a per-entry random roll.
    bridgeCueStartFraction: 0.65, bridgeWarningSeconds: 0.4, // Cue and collapse derive from the same support load.
    rescueLipZ: 0, rescueSafeOffset: 0.8, rescueFallerAdvance: 0.7, rescueSpacing: 1.6,
    groundContactTolerance: 0.045, wallContactTolerance: 0.05, collisionSkin: 0.004,
    bodyContactSkinM: 0.004, // A matching native/PBD contact envelope prevents coplanar bridge seams snagging a cuboid's lower edge.
    contactSeparationM: 0.000001, // Projection clearance below the energy roundoff budget; 4 mm ground lifts injected potential every step.
    contactPredictionM: 0.002, // Wide predictive contacts snag coplanar bank/bridge seams; swept body projection handles the residual here.
    collisionSweepPasses: 4, // Sweep PBD corrections too; Rapier CCD only covers the Rapier step.
    solverIterations: 12, maximumSolverIterations: 256, solverToleranceM: 0.005, // Bounded refinement resolves the 400:1 particle/body mass ratio at a lip; acceptance tolerances stay unchanged.
    ropeContactBends: 4, ropeProjectionLineSearchSteps: 12, // Bound contact routing and nonlinear projection within a material link.
    iceTractionMultiplier: 0.3, // A known low-traction patch, not a hidden difficulty adjustment.
    wallClimbSpeed: 0.65, wallDescendSpeed: 1, wallAcceleration: 2.5, // Slow footwork leaves time for teammates to haul.
    wallPressSpeed: 0.45, wallNormalEffortN: 450, wallFriction: 1, // Wall effort stays below body weight: ascent requires rope support and hauling.
    haulSpeed: 0.22, walkingAcceleration: 3, // Crouched steps provide strong slow traction; ordinary walking has less push.
    ledgeReachAboveHeadM: 0.05, ledgePullEffortN: 1050, // A hand can pull over the lip only once the head reaches its edge; no remote rescue impulse.
    rescueSlackTargetM: 0.05, // Take up the final slack before slowing to a planted haul; stopping at 15 cm left outer helpers unloaded.
    rescueCatchSeconds: 0.8, // Bot reaction/catch window before taking physical hauling steps.
    wallRopeSupportFraction: 0.08, // Loaded-rope participation proxy only; wall ascent is limited by contact pressing/friction.
    fallDepth: 0.2, fallSpeed: 0.5, catchSpeed: 0.35, catchConfirmSeconds: 0.12,
    recoverySupportFraction: 0.75, // A sliver of foot contact at the lip is not yet a safe recovery.
    recoveryConfirmSeconds: 0.3, catchHighlightSeconds: 0.5,
    energyToleranceJ: 0.01, // Per internal step roundoff allowance; contacts/rope cannot supply unexplained kinetic energy.
    mechanicsProbeSeconds: 10, // Bounded per-size/rate regression window; evidence scenarios run longer separately.
    mechanicsLoadSeed: 2000, // Reproduces a first bridge whose fixed capacity is below one supported body's weight.
    inputChangeEpsilon: 0.08, usefulMotionMps: 0.04, // Participation proxies; static-brace success remains a design counterexample.
    maximumIncidents: 64, maximumEvents: 256, // Bound retained evidence and disclose truncation; lifetime totals remain.
  },
  historicalDiagnostics: {
    wallClimbSpeed: 1.6, wallDescendSpeed: 1.8, wallAcceleration: 5,
    wallPressSpeed: 0.45, wallNormalEffortN: 900, wallFriction: 1.3,
  }, // Frozen inputs for the unapplied actuator experiment; never used by the live engine.
  phase2Evidence: {
    targets: {
      rescueSeconds: [10, 20], firstAttemptRecoveryFraction: [0.6, 0.75], eventualRecoveryFraction: [0.88, 0.92],
      fourIncidentCompletionFraction: [0.6, 0.72], incidentsPerRun: [3, 6], firstFallBeforeSeconds: 45,
      runSeconds: [300, 600], maximumIdleFraction: 0.2,
    }, // Existing PLAN.md targets, quoted centrally; bots cannot pass the human rescue stop.
    trajectoryRuns: 1000, // Fixed evidence budget across every scene/team/policy; never adapt chance to hit targets.
    smokeTrajectories: 10, // Covers both scenes at all five team sizes with the recovery policy before the full run.
    teamSizes: [2, 3, 4, 5, 6], // Every approved Phase 2 rope size, reported separately.
    crossingSeconds: 600, // Observe up to the run target's ten-minute upper end; unfinished trajectories are censored.
    rescueSeconds: 60, // Focused recovery gets three times the normal 20-second upper target before censoring.
    actionSeconds: 0.5, // Bounded state-reactive bot decision cadence; no per-tick omniscient steering.
    steeringSeconds: 1.5, // Proportional lateral velocity settles into a bridge lane without half-second full-speed oscillation.
    followingSeconds: 1, // Maintain the initial rope-order spacing after a rescue; bunched bots otherwise all enter the next hole together.
    badWrongWayChance: 0.2, // Fixed diagnostic mistake chance; existing bot brace/idle chances are reused unchanged.
    recoveryBraceCycleSeconds: 2, recoveryBraceFraction: 0.5, // Helpers alternate a planted catch and a repositioning step; a policy hypothesis.
    movementEpsilonM: 0.01, // Input/movement inactivity proxy only, not proof of useful rescue contribution.
    inputChangeEpsilon: 0.05, // Ignore numerical steering jitter when measuring continuous held controls.
    lifecycleRuns: 25, lifecycleSeconds: 2, // Sequential create/step/free stress; explicitly not 300-room qualification.
    replaySeconds: 20, // Bounded same-build accepted-input replay checks across scene/team/policy fixtures.
    maximumTimingBytes: 256 * 1024 * 1024, // Reserve exact full-window Float64 timing storage plus sorting copy, or refuse the run.
    maximumReportBytes: 16 * 1024 * 1024, // Bound aggregate/raw-trajectory report output.
    maximumSavedTapes: 20, maximumTapeOutputBytes: 32 * 1024 * 1024, // Bound representative failure/counterexample artifacts; report omitted/truncated evidence.
    parallel: {
      workers: 4, // Four independent local simulation processes; fixed contiguous ordinal shards, never extra trials.
      maximumWallMs: 24 * 60 * 60 * 1000, // Finite ceiling for the unchanged 1,000 long-horizon trajectories; timeout leaves explicit incomplete evidence.
      maximumWorkerRssBytes: 512 * 1024 * 1024, // Per-process ceiling supplements localLoad's 256 MiB old-space and 3 GiB total-RSS policies.
      minimumInitialAvailableBytes: (3 * 1024 + 512) * 1024 * 1024, // Offline-only: cover the 3 GiB RSS ceiling plus 512 MiB initial headroom; raw free is separately recorded.
      minimumOngoingAvailableBytes: 1024 * 1024 * 1024, // Stop on less than 1 GiB heuristic available memory during the job; retain socket-load's existing raw-free guard unchanged.
      availableMemoryRuntime: { node: '26.5.0', uv: '1.52.1', platform: 'darwin' }, // Only the inspected availableMemory implementation is supported; unknown runtimes fail closed.
      watchdogHeapMiB: 16, // Independent small watchdog thread can stop a blocked simulation or orphan after parent death.
      timingChunkSamples: 4096, // Lossless Float64LE disk IO in 32 KiB chunks, outside the measured step.
      maximumMetadataBytes: 1024 * 1024, // Bound each manifest, checkpoint, teardown receipt and readable summary.
      maximumFinalReportBytes: 32 * 1024 * 1024, // Reserve both the report and an atomic replacement within the existing 256 MiB job-output envelope.
      maximumResourceBytes: 16 * 1024 * 1024, // Bound retained resource observations; guard sampling still uses localLoad.sampleMs.
      resourceRetainMs: 60 * 1000, // Retain minute observations plus sampled peaks across an hours-long job, without an unbounded telemetry array.
      maximumOutputBytes: 256 * 1024 * 1024, // Per-job disk envelope for source snapshot, raw timings/records, resource log and final report.
    },
  },
  clientLatency: {
    teamSizes: [2, 6], authorityHz: [30, 60], addedRttMs: [100, 250], sampleSeconds: 10,
    jitterMs: 0, // Fixed ordered-stream delay matrix; measured RTT and loss remain separate observations.
  },
  localLoad: {
    smokeRooms: 10, smokeSeconds: 30, // Default finite loopback diagnostic; no production qualification.
    largeRooms: 300, largeSeconds: 30, // Explicit profile only, after six-body integration and coordination.
    generatorProcesses: 4, // Independent event loops; actual population and lateness remain measured.
    maximumRooms: 300, maximumSeconds: 120, // Refuse larger or longer profiles rather than grow the test allocation.
    warmupMs: 2000, startLeadMs: 1000, sampleMs: 1000, // Fixed warm-up, IPC start lead and process/population cadence.
    startupTimeoutMs: 120000, maximumWallMs: 180000, shutdownGraceMs: 3000, // Bound startup, whole-run lifetime and owned-child shutdown.
    maximumTotalRssBytes: 3 * 1024 * 1024 * 1024, minimumFreeMemoryBytes: 512 * 1024 * 1024, // Local safety caps, not per-room attribution or provider sizing.
    authorityHeapMiB: 1024, generatorHeapMiB: 256, // V8 caps supplement sampled RSS; native/WASM memory is separately observed.
    maximumReportBytes: 64 * 1024 * 1024, maximumChildLogBytes: 16 * 1024, // Bound retained evidence and child diagnostics.
    maximumInputBufferedBytes: 16 * 1024, // Skip/report offers when the actual client socket backs up.
    maximumLatePeriods: 4, // Drop overdue scheduled offers beyond this age; never catch up with an unbounded burst.
    lifecycleCycles: 3, lifecycleRooms: 2, lifecycleHoldMs: 250, // Repeat real create/join/leave/dispose and compare natural memory samples.
    slowReaderStartFraction: 0.25, slowReaderDurationFraction: 0.25, // Pause one real SDK socket's reads; no fake bufferedAmount injection.
    churnStartFraction: 0.5, churnEveryRooms: 10, // Disconnect/rejoin one non-owner per cohort; explicitly a fresh seat, not reconnect.
    probePollMs: 25, eventLoopResolutionMs: 20, // Bounded functional polling and process loop-delay probe (converted ns to ms).
  },
  clip: {
    seconds: 15, width: 1280, height: 720, fps: 24,
    videoBitsPerSecond: 800000, audioBitsPerSecond: 48000,
    maximumBytes: 2 * 1024 * 1024,
    retentionDays: 7, permanentSlots: 1, uploadsPerIdentityPerUtcDay: 3,
    globalBytes: 256 * 1024 * 1024,
    uploadsEnabled: false, // No upload code until Phase 6 and the cost proposal.
  },
  later: {
    idleBotSeconds: 20, reconnectSeconds: 60, attachWaitSeconds: 30,
    stableTensionFraction: 0.2, stableSeconds: 0.5,
    publicTeamSize: 4, minimumVoteTeam: 4, agreeingVotes: 3,
    dailyAttempts: 3, // Best of three, server-simulated. No daily implemented in Phase 1.
  },
  gates: {
    tuningSessions: 6, sessionsPerFamily: 2, diagnosticSessions: 3,
    freePlayMinutes: 10,
  },
  tools: {
    operations: {
      startupTimeoutMs: 120000, // Allow the first frontend compile, but never announce an unready session.
      tunnelStartupTimeoutMs: 90000, // A missing tunnel registration must fail closed, not hang indefinitely.
      probeTimeoutMs: 3000, pollMs: 250, // Bound local readiness requests and keep shutdown responsive.
      shutdownGraceMs: 3000, // Give owned children time to exit, then kill their isolated process group.
      stopTimeoutMs: 15000, // Includes child shutdown and gateway/socket cleanup before reporting success.
      downloadTimeoutMs: 120000, // A stalled installer must leave the previous binary intact.
      maximumTunnelLogBytes: 16384, // Bound private diagnostic parsing; raw tunnel output is never printed.
      maximumDownloadBytes: 64 * 1024 * 1024, // Bound official archive downloads in memory.
    },
    cloudflaredVersion: '2026.8.3', // Pinned official release; no account or card required for Quick Tunnels.
    cloudflaredSha256: {
      arm64: '40c9144d86df8937c5b43293a1f7d2d2107029aa74725023dd46b1b27154352f',
      x64: '61e1316266a00fd70ce40da011d612badc805367fb65293dd1925f938f704c99',
    },
  },
} as const;

export const FAMILIES = {
  balanced: { label: 'Intermediate / strong brace', ropeLength: 3.6, ropeDrag: 2.5, braceMassMultiplier: 6, braceFriction: 1.6 },
  short: { label: 'Short / damped', ropeLength: 3.0, ropeDrag: 5, braceMassMultiplier: 4, braceFriction: 1.2 },
  loose: { label: 'Long / momentum', ropeLength: 4.5, ropeDrag: 1.2, braceMassMultiplier: 4, braceFriction: 1.2 },
} as const; // Deliberately different slack/damping/traction families, two evaluated sessions each.
export type Family = keyof typeof FAMILIES;
export type TickHz = 30 | 60;
export const isFamily = (value: unknown): value is Family => typeof value === 'string' && Object.hasOwn(FAMILIES, value);
