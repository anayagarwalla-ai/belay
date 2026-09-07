import { describe, expect, it } from 'vitest';
import { TUNING } from '../tuning';
import type { SimulationSnapshot } from '../shared/protocol';
import { emptyPhysicalDiagnostics } from '../shared/physical-diagnostics';
import { PHASE2_POLICIES, Phase2Policy, towardWall, trajectorySchedule } from '../scripts/phase2-policies';

function observation(playerCount = 4): SimulationSnapshot {
  return {
    version: 'policy-test', epoch: 0, tick: 0, serverTime: 0, seed: TUNING.seed, family: 'balanced', tickHz: TUNING.tickHz,
    paused: false, scene: 'rescue', playerCount,
    terrain: { bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, finishZ: null,
      crevasses: [{ id: 0, minX: -10, maxX: 10, minZ: 0, maxZ: 3, depth: 10 }], bridges: [], ice: [] },
    players: Array.from({ length: playerCount }, (_, id) => ({ id, position: { x: id - playerCount / 2, y: 0.45, z: id === Math.floor(playerCount / 2) ? 0.7 : -0.8 },
      velocity: { x: 0, y: 0, z: 0 }, brace: false, connected: true, label: 'synthetic', ackSeq: 0,
      support: 'ground', rescueState: 'safe', activeIncidentId: null })),
    rope: { points: [], spans: [], length: 3, tension: 0, tensionN: 0, slackM: 0 },
    counters: { ticks: 0, elapsedSeconds: 0, maximumSpanErrorM: 0, maximumSegmentErrorM: 0,
      maximumSpeedMps: 0, maximumJoltMps2: 0, tautTransitions: 0, totalTensionSeconds: 0, distanceTravelledM: [] },
    incidents: [], events: [], run: { status: 'active', elapsedSeconds: 0, progress: 0 },
    diagnostics: emptyPhysicalDiagnostics(),
  };
}

describe('Phase 2 bounded policy schedule', () => {
  it('covers all team/scene/policy cells and pairs their seeds without adaptive selection', () => {
    const schedule = trajectorySchedule(TUNING.phase2Evidence.trajectoryRuns);
    const cells = new Map<string, number[]>();
    for (const row of schedule) {
      const key = `${row.playerCount}/${row.scene}/${row.policy}`;
      cells.set(key, [...(cells.get(key) ?? []), row.seed]);
    }
    expect(cells.size).toBe(TUNING.phase2Evidence.teamSizes.length * 2 * PHASE2_POLICIES.length);
    for (const size of TUNING.phase2Evidence.teamSizes) for (const scene of ['crossing', 'rescue']) {
      const reference = cells.get(`${size}/${scene}/recovery`);
      for (const policy of PHASE2_POLICIES) expect(cells.get(`${size}/${scene}/${policy}`)).toEqual(reference);
    }
    expect(() => trajectorySchedule(TUNING.phase2Evidence.trajectoryRuns + 1)).toThrow(/count/);
  });
  it('starts static helper brace at focused-fixture tick zero and never drops it when a helper falls', () => {
    const spec = { ...trajectorySchedule(1)[0], playerCount: 4, scene: 'rescue' as const, policy: 'static-brace' as const };
    const policy = new Phase2Policy(spec), state = observation();
    expect(policy.inputs(state)[3]).toEqual({ x: 0, z: 0, brace: true });
    state.tick = state.tickHz * TUNING.phase2Evidence.recoveryBraceCycleSeconds;
    state.players[3].support = 'air'; state.players[3].rescueState = 'falling';
    expect(policy.inputs(state)[3]).toEqual({ x: 0, z: 0, brace: true });
    expect(policy.observations.heldPlayerIds).toEqual([0, 1, 3]);
    expect(policy.observations.counterArmedTick).toBe(0);
  });
  it('freezes the actual tail, including the casualty at team size two, without calling it a helper', () => {
    const spec = { ...trajectorySchedule(1)[0], scene: 'rescue' as const, policy: 'frozen-tail' as const };
    const policy = new Phase2Policy(spec);
    expect(policy.inputs(observation(2))[1]).toEqual({ x: 0, z: 0, brace: false });
    expect(policy.observations.heldPlayerIds).toEqual([1]);
  });
  it('resumes crossing travel after a held-policy incident resolves', () => {
    const spec = { ...trajectorySchedule(1)[0], playerCount: 4, policy: 'static-brace' as const };
    const policy = new Phase2Policy(spec), state = observation(); state.scene = 'crossing';
    expect(policy.inputs(state)[0].brace).toBe(false);
    state.tick++;
    state.incidents = [{ id: 0, fallTick: state.tick, playerIds: [2], status: 'active', recoveredTick: null, cascades: 0,
      firstAttemptSuccess: true, roleActiveSeconds: [0, 0, 0, 0], roleIdleSeconds: [0, 0, 0, 0], staticHoldSeconds: [0, 0, 0, 0] }];
    expect(policy.inputs(state)[0]).toEqual({ x: 0, z: 0, brace: true });
    state.tick++; state.incidents[0].status = 'recovered'; state.incidents[0].recoveredTick = state.tick;
    expect(policy.inputs(state)[0].brace).toBe(false);
    expect(policy.inputs(state)[0].z).toBeGreaterThan(0);
    expect(policy.observations.interventions[0].releasedTick).toBe(state.tick);
  });
  it('uses visible wall geometry and repeats the same seeded bad decisions within bounded move inputs', () => {
    const state = observation();
    expect(towardWall(state, { x: 0, y: -2, z: 0.7 })).toEqual({ x: 0, z: -1, brace: false });
    const spec = { ...trajectorySchedule(1)[0], playerCount: 4, policy: 'bad' as const };
    const first = new Phase2Policy(spec), second = new Phase2Policy(spec);
    for (let tick = 0; tick < state.tickHz * TUNING.phase2Evidence.replaySeconds; tick++) {
      state.tick = tick;
      const a = first.inputs(state), b = second.inputs(state);
      expect(a).toEqual(b);
      expect(a.every(input => Math.hypot(input.x, input.z) <= 1 + Number.EPSILON)).toBe(true);
    }
  });
});
