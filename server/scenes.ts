import { isFamily, TUNING } from '../tuning';
import { isScene, type SceneOptions } from '../shared/protocol';

/** Validate before allocating a physics world. The client selects fixtures, never physical state. */
export function resolveScene(value: unknown, current: SceneOptions = {}): Required<SceneOptions> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['seed', 'family', 'tickHz', 'scene', 'playerCount'].includes(key))) {
    throw new Error('Only seed, family, tickHz, scene and playerCount may be selected.');
  }
  const options = value as SceneOptions;
  const seed = options.seed ?? current.seed ?? TUNING.seed;
  const family = options.family ?? current.family ?? 'balanced';
  const tickHz = options.tickHz ?? current.tickHz ?? TUNING.tickHz;
  const scene = options.scene ?? current.scene ?? 'flat';
  const playerCount = options.playerCount ?? current.playerCount ?? TUNING.players;
  // Null is not an omitted field: accepting it would make malformed controls silently change behavior.
  if (Object.values(options).some(item => item === null)) throw new Error('Scene fields cannot be null.');
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be an unsigned 32-bit integer.');
  if (!isFamily(family)) throw new Error('Unknown tuning family.');
  if (tickHz !== 30 && tickHz !== 60) throw new Error('Tick rate must be 30 or 60.');
  if (!isScene(scene)) throw new Error('Unknown test scene.');
  if (!Number.isInteger(playerCount) || playerCount < TUNING.players || playerCount > TUNING.hardCap) {
    throw new Error(`A test rope requires ${TUNING.players}–${TUNING.hardCap} climbers.`);
  }
  return { seed, family, tickHz, scene, playerCount };
}

/** Preserve occupied body identities when an operator changes the fixture's capacity. */
export function assertOccupiedSeatsFit(playerCount: number, seatIds: Iterable<number>) {
  for (const id of seatIds) if (id >= playerCount) {
    throw new Error(`Climber ${id + 1} must leave before reducing the rope to ${playerCount} players.`);
  }
}
