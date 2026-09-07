import { TUNING, FAMILIES, type Family } from '../tuning';
import { seededRandom } from '../shared/terrain';
import { REST, normalizeMove, type Move, type SimulationSnapshot, type Vec3 } from '../shared/protocol';
import type { PolicyName } from './phase2-analysis';

export const PHASE2_POLICIES: readonly PolicyName[] = ['recovery', 'walk', 'bad', 'static-brace', 'frozen-tail'];
export const PHASE2_SCENES = ['crossing', 'rescue'] as const;
export type TrajectorySpec = {
  ordinal: number; seed: number; playerCount: number; scene: typeof PHASE2_SCENES[number];
  policy: PolicyName; family: Family; tickHz: typeof TUNING.tickHz; horizonSeconds: number;
};

/** Team varies first, then scene, then policy. Each complete matrix uses the same seeds
 * across policies, giving paired counterpolicy cases rather than favorable seed selection. */
export function trajectorySchedule(count: number): TrajectorySpec[] {
  if (!Number.isSafeInteger(count) || count < 1 || count > TUNING.phase2Evidence.trajectoryRuns) throw new Error('Invalid trajectory count.');
  const sizes = TUNING.phase2Evidence.teamSizes;
  const families = Object.keys(FAMILIES) as Family[];
  const matrixSize = sizes.length * PHASE2_SCENES.length * PHASE2_POLICIES.length;
  return Array.from({ length: count }, (_, ordinal) => {
    const repetition = Math.floor(ordinal / matrixSize);
    const scene = PHASE2_SCENES[Math.floor(ordinal / sizes.length) % PHASE2_SCENES.length];
    return { ordinal, seed: (TUNING.seed + repetition) >>> 0,
      playerCount: sizes[ordinal % sizes.length], scene,
      policy: PHASE2_POLICIES[Math.floor(ordinal / (sizes.length * PHASE2_SCENES.length)) % PHASE2_POLICIES.length],
      family: families[repetition % families.length], tickHz: TUNING.tickHz,
      horizonSeconds: scene === 'crossing' ? TUNING.phase2Evidence.crossingSeconds : TUNING.phase2Evidence.rescueSeconds };
  });
}

const signMove = (x: number, z: number, brace = false): Move => normalizeMove({ x, z, brace });
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Public geometry only: direction toward the nearest visible crevasse boundary. */
export function towardWall(snapshot: SimulationSnapshot, position: Vec3): Move {
  const gaps = snapshot.terrain.crevasses;
  const candidates = gaps.flatMap(gap => [
    { x: Math.max(gap.minX, Math.min(gap.maxX, position.x)), y: position.y, z: gap.minZ },
    { x: Math.max(gap.minX, Math.min(gap.maxX, position.x)), y: position.y, z: gap.maxZ },
    { x: gap.minX, y: position.y, z: Math.max(gap.minZ, Math.min(gap.maxZ, position.z)) },
    { x: gap.maxX, y: position.y, z: Math.max(gap.minZ, Math.min(gap.maxZ, position.z)) },
  ]).sort((a, b) => distance(a, position) - distance(b, position));
  if (!candidates.length) return { ...REST };
  const at = candidates[0];
  return signMove(Math.sign(at.x - position.x), Math.sign(at.z - position.z));
}

function travel(snapshot: SimulationSnapshot, id: number): Move {
  const player = snapshot.players[id];
  const bridge = snapshot.terrain.bridges.filter(candidate => candidate.maxZ >= player.position.z)
    .sort((a, b) => a.minZ - b.minZ)[0];
  const targetX = bridge ? (bridge.minX + bridge.maxX) / 2 : 0;
  return signMove(Math.max(-1, Math.min(1, (targetX - player.position.x) / TUNING.body.width)), 1);
}

export class Phase2Policy {
  private readonly random: () => number;
  private cached: Move[];
  private nextDecisionTick = 0;
  private armed = false;
  private counterHeld = new Set<number>();
  readonly observations = {
    counterArmedTick: null as number | null,
    heldPlayerIds: [] as number[],
    interventions: [] as { armedTick: number; releasedTick: number | null; heldPlayerIds: number[]; incidentIds: number[] }[],
    policyDescription: 'Scripted public-state/geometry policy; no hidden bridge capacity or human agency inference.',
  };

  constructor(readonly spec: TrajectorySpec) {
    this.random = seededRandom(spec.seed);
    this.cached = Array.from({ length: spec.playerCount }, () => ({ ...REST }));
  }

  inputs(snapshot: SimulationSnapshot): Move[] {
    const active = snapshot.incidents.some(episode => episode.status === 'active');
    const focusedStart = snapshot.scene === 'rescue';
    if (this.armed && !active && !focusedStart) {
      this.armed = false; this.counterHeld.clear(); this.nextDecisionTick = snapshot.tick;
      const previous = this.observations.interventions.at(-1);
      if (previous) previous.releasedTick = snapshot.tick;
    }
    if (!this.armed && (active || focusedStart)) {
      this.armed = true;
      this.observations.counterArmedTick = snapshot.tick;
      if (this.spec.policy === 'static-brace') {
        const casualtyIds = new Set(snapshot.incidents.filter(episode => episode.status === 'active').flatMap(episode => episode.playerIds));
        // The committed focused fixture chooses the middle harness; no secret capacity is read.
        if (focusedStart && !casualtyIds.size) casualtyIds.add(Math.floor(snapshot.playerCount / 2));
        this.counterHeld = new Set(snapshot.players.filter(player => !casualtyIds.has(player.id)).map(player => player.id));
      } else if (this.spec.policy === 'frozen-tail') {
        this.counterHeld.add(snapshot.playerCount - 1);
      }
      this.observations.heldPlayerIds = [...this.counterHeld];
      if (this.counterHeld.size) this.observations.interventions.push({ armedTick: snapshot.tick, releasedTick: null,
        heldPlayerIds: [...this.counterHeld], incidentIds: snapshot.incidents.filter(episode => episode.status === 'active').map(episode => episode.id) });
      this.nextDecisionTick = snapshot.tick; // A counter intervention starts at its reported observation boundary.
    }
    if (snapshot.tick >= this.nextDecisionTick) {
      this.cached = snapshot.players.map(player => {
        if (this.counterHeld.has(player.id)) return { ...REST, brace: this.spec.policy === 'static-brace' };
        if (this.spec.policy === 'walk') return travel(snapshot, player.id);
        if (this.spec.policy === 'bad') {
          const choice = this.random();
          if (choice < TUNING.bot.idleChance) return { ...REST };
          if (choice < TUNING.bot.idleChance + TUNING.bot.braceChance) return { ...REST, brace: true };
          const aim = travel(snapshot, player.id);
          if (this.random() < TUNING.phase2Evidence.badWrongWayChance) return signMove(-aim.x, -aim.z);
          return aim;
        }
        if (player.support !== 'ground' || player.rescueState === 'falling' || player.rescueState === 'hanging' || player.rescueState === 'climbing'
          || (focusedStart && !snapshot.incidents.length && player.id === Math.floor(snapshot.playerCount / 2))) {
          return towardWall(snapshot, player.position);
        }
        if (!active && !focusedStart) return travel(snapshot, player.id);
        const casualty = snapshot.players.filter(candidate => candidate.rescueState !== 'safe' && candidate.rescueState !== 'lost')
          .sort((a, b) => distance(a.position, player.position) - distance(b.position, player.position))[0]
          ?? (focusedStart && !snapshot.incidents.length ? snapshot.players[Math.floor(snapshot.playerCount / 2)] : undefined);
        if (!casualty) return active ? { ...REST, brace: true } : travel(snapshot, player.id);
        const phase = (snapshot.tick / snapshot.tickHz / TUNING.phase2Evidence.recoveryBraceCycleSeconds
          + player.id / snapshot.playerCount) % 1;
        if (phase < TUNING.phase2Evidence.recoveryBraceFraction) return { ...REST, brace: true };
        return signMove(player.position.x - casualty.position.x, player.position.z - casualty.position.z);
      });
      this.nextDecisionTick = snapshot.tick + Math.max(1, Math.round(TUNING.phase2Evidence.actionSeconds * snapshot.tickHz));
    }
    return this.cached.map(input => ({ ...input }));
  }
}
