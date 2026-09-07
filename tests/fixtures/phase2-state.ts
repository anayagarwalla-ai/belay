import { TUNING } from '../../tuning';
import type { Scene, Snapshot, Vec3 } from '../../shared/protocol';
import { mix } from '../../client/presentation';

/** Synthetic presentation input only. No physics, recovery percentage or human verdict is inferred. */
export function phase2State(count = 4, scene: Scene = 'rescue'): Snapshot {
  const casualty = Math.floor(count / 2);
  const players: Snapshot['players'] = Array.from({ length: count }, (_, id) => ({ id,
    position: { x: (id - (count - 1) / 2) * 1.6, y: scene === 'rescue' && id === casualty ? -2.3 : TUNING.body.height / 2, z: scene === 'rescue' && id === casualty ? 0.7 : -0.8 },
    velocity: { x: 0, y: 0, z: 0 }, brace: id !== casualty, connected: true, label: `TEST ${id + 1}`, ackSeq: 0,
    support: scene === 'rescue' && id === casualty ? 'air' : 'ground', rescueState: scene === 'rescue' && id === casualty ? 'hanging' : 'safe',
    activeIncidentId: scene === 'rescue' ? 1 : null }));
  const points: Vec3[] = [], spans: NonNullable<Snapshot['rope']['spans']> = [];
  for (let id = 1; id < count; id++) {
    const harness = (position: Vec3) => ({ ...position, y: position.y - TUNING.body.height / 2 + TUNING.body.harnessHeight });
    const a = harness(players[id - 1].position), b = harness(players[id].position);
    const mid = { x: (a.x + b.x) / 2, y: Math.max(TUNING.rope.floorHeight, Math.min(a.y, b.y)), z: Math.min(a.z, b.z) < 0 && Math.max(a.z, b.z) > 0 ? 0 : (a.z + b.z) / 2 };
    const startPoint = points.length;
    for (let p = 0; p <= TUNING.rope.segments; p++) {
      const t = p / TUNING.rope.segments;
      points.push(t <= 0.5 ? mix(a, mid, t * 2) : mix(mid, b, (t - 0.5) * 2));
    }
    const caught = scene === 'rescue' && (id === casualty || id - 1 === casualty);
    spans.push({ id: id - 1, a: id - 1, b: id, startPoint, endPoint: points.length - 1, length: TUNING.rope.length,
      tension: caught ? 0.8 : 0.1, tensionN: caught ? 560 : 70, slackM: caught ? 0 : 1, catchHighlight: caught });
  }
  return { version: 'phase2-client-fixture', epoch: 1, tick: 60, serverTime: 0, seed: TUNING.seed, family: 'balanced', tickHz: 30, paused: false,
    scene, playerCount: count, players, rope: { points, spans, length: (count - 1) * TUNING.rope.length, tension: 0.8, tensionN: 560, slackM: 1 },
    terrain: { bounds: { minX: -12, maxX: 12, minZ: -16, maxZ: 20 }, finishZ: scene === 'flat' ? null : 16,
      crevasses: scene === 'flat' ? [] : [{ id: 0, minX: -12, maxX: 12, minZ: 0, maxZ: 2.8, depth: 12 }],
      bridges: scene === 'flat' ? [] : [{ id: 0, crevasseId: 0, minX: -1.1, maxX: 1.1, minZ: 0, maxZ: 2.8, cue: 0.8, collapsed: scene === 'rescue' }],
      ice: scene === 'flat' ? [] : [{ id: 0, minX: -4, maxX: -2, minZ: -4, maxZ: -1 }] },
    incidents: scene === 'rescue' ? [{ id: 1, fallTick: 30, playerIds: [casualty], status: 'active', recoveredTick: null,
      cascades: 0, firstAttemptSuccess: true, roleActiveSeconds: players.map(() => 0.5), roleIdleSeconds: players.map(() => 0.5), staticHoldSeconds: players.map(p => p.brace ? 0.5 : 0) }] : [],
    run: { status: scene === 'flat' ? 'testing' : 'active', elapsedSeconds: 2, progress: 0.2 }, events: [],
    counters: { ticks: 60, elapsedSeconds: 2, maximumSpanErrorM: 0, maximumSegmentErrorM: 0, maximumSpeedMps: 0,
      maximumJoltMps2: 0, tautTransitions: 1, totalTensionSeconds: 1, distanceTravelledM: players.map(() => 0) } };
}
