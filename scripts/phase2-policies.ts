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
  const x = Math.sign(at.x - position.x), z = Math.sign(at.z - position.z);
  if (z && position.y + TUNING.body.height / 2 < 0) {
    const half = TUNING.body.width / 2;
    const roof = snapshot.terrain.bridges.find(b => !b.collapsed && position.x + half > b.minX && position.x - half < b.maxX
      && position.z + TUNING.body.depth / 2 > b.minZ && position.z - TUNING.body.depth / 2 < b.maxZ);
    if (roof) {
      const left = roof.minX - half - TUNING.phase2.collisionSkin, right = roof.maxX + half + TUNING.phase2.collisionSkin;
      return signMove(Math.sign(Math.abs(position.x - left) < Math.abs(position.x - right) ? left - position.x : right - position.x), z);
    }
  }
  return signMove(x, z);
}

function travel(snapshot: SimulationSnapshot, id: number): Move {
  const player = snapshot.players[id];
  // Stay in one crossing lane until the whole rope clears it. A faster leader
  // steering toward the next bridge can otherwise pin the tail on this one's edge.
  const tailZ = Math.min(...snapshot.players.map(person => person.position.z));
  const bridge = snapshot.terrain.bridges.filter(candidate => !candidate.collapsed && candidate.maxZ >= tailZ)
    .sort((a, b) => a.minZ - b.minZ || a.id - b.id)[0];
  const targetX = bridge ? (bridge.minX + bridge.maxX) / 2 : 0;
  const x = Math.max(-1, Math.min(1, (targetX - player.position.x) / (TUNING.phase2Evidence.steeringSeconds * TUNING.phase2.walkingSpeed)));
  if (bridge && player.position.z < bridge.maxZ
    && (player.position.x < bridge.minX + TUNING.body.width / 2 || player.position.x > bridge.maxX - TUNING.body.width / 2)
    && player.position.z >= bridge.minZ - TUNING.body.depth * 2) {
    return signMove(x, player.position.z > bridge.minZ - TUNING.body.depth ? -1 : 0);
  }
  const ahead = snapshot.players[id - 1];
  const speed = ahead ? Math.max(0, Math.min(TUNING.phase2.walkingSpeed, ahead.velocity.z
    + (ahead.position.z - player.position.z - TUNING.rope.initialSpacing) / TUNING.phase2Evidence.followingSeconds)) : TUNING.phase2.walkingSpeed;
  return signMove(x, Math.min(speed / TUNING.phase2.walkingSpeed, Math.sqrt(Math.max(0, 1 - x * x))));
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

  declare readonly spec: TrajectorySpec;
  constructor(spec: TrajectorySpec) {
    this.spec = spec;
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
        const started = snapshot.incidents.find(episode => episode.status === 'active')?.fallTick ?? 0;
        if ((snapshot.tick - started) / snapshot.tickHz < TUNING.phase2.rescueCatchSeconds) return { ...REST, brace: true };
        const toward = towardWall(snapshot, casualty.position);
        const neighborId = player.id < casualty.id ? player.id + 1 : player.id - 1;
        const neighbor = snapshot.players[neighborId];
        const span = snapshot.rope.spans.find(s => s.a === Math.min(player.id, neighborId) && s.b === Math.max(player.id, neighborId));
        if (neighbor && neighbor.id !== casualty.id && neighbor.support === 'ground' && span) {
          const edge = TUNING.body.width * 2;
          const x = player.position.x <= snapshot.terrain.bounds.minX + edge || player.position.x >= snapshot.terrain.bounds.maxX - edge
            ? 0 : player.position.x - neighbor.position.x;
          // Keep pulling away from the adjacent harness once the slack is gone.
          // Merely matching its backward motion leaves the outer helper unloaded.
          const haul = span.slackM <= TUNING.phase2.rescueSlackTargetM;
          const move = signMove(x, toward.z, haul);
          if (haul) return move;
          // Fan out in rope order. Equal velocities merely translate a slack
          // group: inner helpers take shorter steps so every outer span opens.
          const sideCount = player.id < casualty.id ? casualty.id : snapshot.playerCount - casualty.id - 1;
          const fraction = (Math.abs(player.id - casualty.id) - 1) / (sideCount - 1);
          return { ...move, x: move.x * fraction, z: move.z * fraction };
        }
        // Retreat perpendicular to the lip while planted. Walking sideways away
        // from a casualty can leave a taut span pulling horizontally at the edge.
        return signMove(toward.x, toward.z, true);
      });
      this.nextDecisionTick = snapshot.tick + Math.max(1, Math.round(TUNING.phase2Evidence.actionSeconds * snapshot.tickHz));
    }
    return this.cached.map(input => ({ ...input }));
  }
}
