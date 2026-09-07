import { TUNING } from '../tuning';
import type { Move, Snapshot, Vec3 } from '../shared/protocol';
import { motorVelocity } from '../shared/movement';
import { inside, ropeSpans, type Rect } from './presentation';
import { onIce } from './terrain-view';

function crossesRect(from: Vec3, to: Vec3, rect: Rect) {
  let enter = 0, exit = 1;
  for (const [start, end, minimum, maximum] of [[from.x, to.x, rect.minX, rect.maxX], [from.z, to.z, rect.minZ, rect.maxZ]]) {
    if (end === start) { if (start < minimum || start > maximum) return false; continue; }
    const a = (minimum - start) / (end - start), b = (maximum - start) / (end - start);
    enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return false;
  }
  return exit > 0 && enter < 1;
}

export function groundSupports(point: Vec3, state: Snapshot) {
  if (!state.terrain || !state.scene || state.scene === 'flat') return true;
  if (!inside(point, state.terrain.bounds)) return false;
  return !state.terrain.crevasses.some(gap => inside(point, gap))
    || state.terrain.bridges.some(bridge => !bridge.collapsed && inside(point, bridge));
}
/** Check every support boundary crossed by a proposed step, including narrow holes between its endpoints. */
export function supportedSweep(from: Vec3, to: Vec3, state: Snapshot) {
  if (!groundSupports(from, state) || !groundSupports(to, state)) return false;
  if (!state.terrain || state.scene === 'flat') return true;
  const times = [0, 1];
  for (const rect of [state.terrain.bounds, ...state.terrain.crevasses, ...state.terrain.bridges]) {
    if (to.x !== from.x) for (const edge of [rect.minX, rect.maxX]) times.push((edge - from.x) / (to.x - from.x));
    if (to.z !== from.z) for (const edge of [rect.minZ, rect.maxZ]) times.push((edge - from.z) / (to.z - from.z));
  }
  const sorted = times.filter(t => t >= 0 && t <= 1).sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    const t = (sorted[i - 1] + sorted[i]) / 2;
    if (!groundSupports({ x: from.x + (to.x - from.x) * t, y: from.y, z: from.z + (to.z - from.z) * t }, state)) return false;
  }
  return true;
}

export function safeGroundPrediction(from: Vec3, proposed: Vec3, localId: number, state: Snapshot): Vec3 {
  const result = { ...proposed, y: from.y };
  const neighbors = ropeSpans(state).filter(span => span.a === localId || span.b === localId).map(span => ({
    length: span.length, player: state.players.find(p => p.id === (span.a === localId ? span.b : span.a)),
  }));
  for (const { length, player } of neighbors) if (player) {
    const dy = result.y - player.position.y;
    const horizontalLimit = Math.sqrt(Math.max(0, length * length - dy * dy));
    const dx = result.x - player.position.x, dz = result.z - player.position.z, distance = Math.hypot(dx, dz);
    if (distance > horizontalLimit && distance > 0) {
      result.x = player.position.x + dx / distance * horizontalLimit;
      result.z = player.position.z + dz / distance * horizontalLimit;
    }
  }
  if (!supportedSweep(from, result, state)) return { ...from };
  // Ice traction depends on authoritative support reactions; do not predict ordinary-ground grip across it.
  if (state.terrain?.ice.some(ice => crossesRect(from, result, ice))) return { ...from };
  for (const { length, player } of neighbors) if (player && Math.hypot(result.x - player.position.x, result.y - player.position.y, result.z - player.position.z) > length + TUNING.rope.solverToleranceM) return { ...from };
  for (const other of state.players) if (other.id !== localId && Math.abs(other.position.y - result.y) < TUNING.body.height) {
    const bounds = { minX: other.position.x - TUNING.body.width, maxX: other.position.x + TUNING.body.width,
      minZ: other.position.z - TUNING.body.depth, maxZ: other.position.z + TUNING.body.depth };
    if (inside(result, bounds) || !inside(from, bounds) && crossesRect(from, result, bounds)) return { ...from };
  }
  return result;
}

/** Ordinary-ground local motor prediction. Ice, wall and air use server interpolation, never invented grip or contacts. */
export class LocalPrediction {
  private identity = '';
  private tick = -1;
  private position?: Vec3;
  private velocity?: Vec3;
  private correction: Vec3 = { x: 0, y: 0, z: 0 };
  reset() { this.identity = ''; this.tick = -1; this.position = undefined; this.velocity = undefined; this.correction = { x: 0, y: 0, z: 0 }; }
  sample(state: Snapshot, rendered: Snapshot, localId: number, input: Move, dt: number, ageMs: number, canMove: boolean) {
    const own = state.players.find(p => p.id === localId), display = rendered.players.find(p => p.id === localId);
    if (!own || !display) { this.reset(); return null; }
    const identity = `${state.epoch}:${localId}:${own.support ?? 'ground'}:${own.rescueState ?? 'safe'}:${state.terrain?.bridges.filter(b => b.collapsed).map(b => b.id).join(',') ?? ''}`;
    if (own.support && own.support !== 'ground' || own.rescueState === 'lost' || !canMove || state.paused
      || onIce(own.position, state.terrain)) {
      this.reset(); return { ...display.position };
    }
    if (this.identity !== identity || !this.position || !this.velocity) {
      this.identity = identity; this.position = { ...own.position }; this.velocity = { ...own.velocity }; this.correction = { x: 0, y: 0, z: 0 };
    } else if (state.tick !== this.tick) {
      this.correction = { x: this.position.x + this.correction.x - own.position.x, y: 0, z: this.position.z + this.correction.z - own.position.z };
      if (Math.hypot(this.correction.x, this.correction.z) > TUNING.network.hardCorrectionDistance) this.correction = { x: 0, y: 0, z: 0 };
      this.position = { ...own.position }; this.velocity = { ...own.velocity };
    }
    this.tick = state.tick;
    if (ageMs < TUNING.network.maximumPredictionMs) {
      const step = Math.min(dt, Math.max(0, TUNING.network.maximumPredictionMs - ageMs) / 1000);
      this.velocity = motorVelocity(this.velocity, input, step, state.family);
      this.position = safeGroundPrediction(this.position, { x: this.position.x + this.velocity.x * step, y: this.position.y, z: this.position.z + this.velocity.z * step }, localId, state);
    }
    const decay = Math.exp(-dt / TUNING.network.reconciliationSeconds);
    this.correction.x *= decay; this.correction.z *= decay;
    return safeGroundPrediction(this.position, { x: this.position.x + this.correction.x, y: this.position.y, z: this.position.z + this.correction.z }, localId, state);
  }
}
