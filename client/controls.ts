import { TUNING } from '../tuning';
import type { Move, PlayerState, Snapshot, Vec3 } from '../shared/protocol';
import { onIce, terrainSolids } from './terrain-view';
import { expeditionContactHalf, supportAt } from '../shared/contact-geometry';

export const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
export function moveFromKeys(keys: ReadonlySet<string>): Move {
  const horizontal = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const vertical = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const angle = TUNING.camera.azimuthDegrees * Math.PI / 180;
  const size = Math.max(1, Math.hypot(horizontal, vertical));
  return { x: (horizontal * Math.cos(angle) - vertical * Math.sin(angle)) / size,
    z: (-horizontal * Math.sin(angle) - vertical * Math.cos(angle)) / size, brace: keys.has('Space') };
}

export function screenDirection(direction: Pick<Vec3, 'x' | 'z'>) {
  const angle = TUNING.camera.azimuthDegrees * Math.PI / 180;
  const horizontal = direction.x * Math.cos(angle) - direction.z * Math.sin(angle);
  const vertical = -direction.x * Math.sin(angle) - direction.z * Math.cos(angle);
  // This is a keyboard label for the fixed camera, not a second movement frame.
  return `${vertical >= 0 ? 'W / ↑' : 'S / ↓'} + ${horizontal >= 0 ? 'D / →' : 'A / ←'}`;
}

export function nearestWall(position: Vec3, terrain: Snapshot['terrain']) {
  if (!terrain) return null;
  const contact = supportAt(position, expeditionContactHalf, terrainSolids(terrain));
  if (contact.support !== 'wall' || !contact.solid) return null;
  const direction = { x: -contact.normal.x || 0, y: 0, z: -contact.normal.z || 0 };
  const distance = contact.normal.x ? Math.abs(position.x - (contact.normal.x > 0 ? contact.solid.maxX : contact.solid.minX))
    : Math.abs(position.z - (contact.normal.z > 0 ? contact.solid.maxZ : contact.solid.minZ));
  return { direction, distance };
}

export function controlHint(player?: PlayerState, snapshot?: Snapshot) {
  if (!player) return 'Join the rope to move. An invited partner uses the same test session.';
  if (player.rescueState === 'lost') return 'This body is beyond the scene boundary. The operator can reset the scene after saving evidence.';
  if (player.support === 'air') return 'In the air: movement gives no thrust, and Space cannot anchor you. Partners can change the rope angle to bring you to a wall.';
  if (player.support === 'wall') {
    if (player.position.y + TUNING.body.height / 2 < 0 && snapshot?.terrain?.bridges.some(b => !b.collapsed
      && player.position.x + TUNING.body.width / 2 > b.minX && player.position.x - TUNING.body.width / 2 < b.maxX
      && player.position.z + TUNING.body.depth / 2 > b.minZ && player.position.z - TUNING.body.depth / 2 < b.maxZ)) {
      return 'Under a snow bridge: move sideways out from under its edge while partners haul, then climb toward the wall.';
    }
    const wall = nearestWall(player.position, snapshot?.terrain);
    const direction = wall && wall.distance <= TUNING.camera.wallCueReachM ? ` (${screenDirection(wall.direction)})` : '';
    return `At the wall: move toward it${direction} while partners haul; move along it to traverse. Pull over the lip when it is within reach.`;
  }
  if (player.support === 'ground' && player.activeIncidentId != null && player.rescueState !== 'safe') return 'Keep stepping back from the lip until your feet are safely on the bank.';
  if (onIce(player.position, snapshot?.terrain)) return 'On ice: traction is lower, so bracing can still slide. Move toward firmer ground to change the support position.';
  return snapshot && (snapshot.scene && snapshot.scene !== 'flat' || snapshot.players.length > TUNING.players)
    ? 'On ground: hold Space to plant your feet. Move while holding Space to haul; step back from the lip together.'
    : 'Pull against each other, then walk together. Hold Space to brace; release it to move.';
}
