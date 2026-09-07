/** BELAY's single source of tuning. SI units unless stated otherwise.
 * Changes are recorded by the reports' full configuration and simulation version.
 * Nothing here is a human Gate 1 verdict. */
export const TUNING = {
  version: 'phase1-1',
  phase: 1,
  seed: 1701, // Reproducible default flat test surface; no hazards are generated.
  players: 2, // Gate 1 is exactly two bodies. Later phases must still respect hardCap.
  hardCap: 6,
  tickHz: 30 as 30 | 60, // Six tuning sessions use 30; 60 is the separate contingency.
  physicsHz: 60, // Identical internal steps in both authority-rate profiles.
  solverIterations: 8, // Initial PBD work budget; benchmark before increasing.
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
  },
  terrain: {
    halfExtent: 500, // Flat contact patch follows the team, so no edge can end this test.
    gridUnit: 1, // Metre marks repeat with the moving flat patch to convey distance.
    landmarkCount: 24, // Seeded flush ground marks let players judge motion, not hazards.
    landmarkRange: 36,
    markSize: 0.18,
  },
  camera: {
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
