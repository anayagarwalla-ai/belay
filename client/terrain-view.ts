import { TUNING } from '../tuning';
import type { Rect, TerrainState, Vec3 } from '../shared/protocol';
import { projectMotion, type Solid } from '../shared/contact-geometry';

export type { Rect } from '../shared/protocol';
export const inside = (point: Pick<Vec3, 'x' | 'z'>, rect: Rect) => point.x > rect.minX && point.x < rect.maxX && point.z > rect.minZ && point.z < rect.maxZ;
const contains = (point: Pick<Vec3, 'x' | 'z'>, rect: Rect) => point.x >= rect.minX && point.x <= rect.maxX && point.z >= rect.minZ && point.z <= rect.maxZ;
export const onIce = (point: Vec3, terrain?: TerrainState) => terrain?.ice.some(ice => contains(point, ice)) ?? false;

/** Subtract rectangular holes from a finite top surface instead of covering them with one floor. */
export function groundPatches(bounds: Rect, gaps: readonly Rect[]): Rect[] {
  const xs = [...new Set([bounds.minX, bounds.maxX, ...gaps.flatMap(g => [g.minX, g.maxX]).filter(x => x > bounds.minX && x < bounds.maxX)])].sort((a, b) => a - b);
  const zs = [...new Set([bounds.minZ, bounds.maxZ, ...gaps.flatMap(g => [g.minZ, g.maxZ]).filter(z => z > bounds.minZ && z < bounds.maxZ)])].sort((a, b) => a - b);
  const result: Rect[] = [];
  for (let x = 1; x < xs.length; x++) for (let z = 1; z < zs.length; z++) {
    const cell = { minX: xs[x - 1], maxX: xs[x], minZ: zs[z - 1], maxZ: zs[z] };
    if (!gaps.some(g => inside({ x: (cell.minX + cell.maxX) / 2, z: (cell.minZ + cell.maxZ) / 2 }, g))) result.push(cell);
  }
  return result;
}

const cachedSolids = new WeakMap<TerrainState, Solid[]>();
/** Public geometry only: never run the seeded capacity generator in the presentation path. */
export function terrainSolids(terrain: TerrainState): Solid[] {
  const cached = cachedSolids.get(terrain); if (cached) return cached;
  const depth = Math.max(TUNING.phase2.crevasseDepth, ...terrain.crevasses.map(gap => gap.depth));
  const solids: Solid[] = groundPatches(terrain.bounds, terrain.crevasses).map((rect, id) => ({ ...rect, id, minY: -depth, maxY: 0 }));
  for (const bridge of terrain.bridges) if (!bridge.collapsed) solids.push({ ...bridge, id: solids.length, bridgeId: bridge.id, minY: -TUNING.phase2.bridgeThickness, maxY: 0 });
  cachedSolids.set(terrain, solids); return solids;
}

export function projectDisplayedBody(from: Vec3, desired: Vec3, terrain: TerrainState) {
  return projectMotion(from, desired, { x: TUNING.body.width / 2, y: TUNING.body.height / 2, z: TUNING.body.depth / 2 }, terrainSolids(terrain)).position;
}

/** Orthographic sight ray toward the fixed camera. Near-bank top faces can hide deeper falls even with the walls removed. */
export function topSurfaceOccludesBody(rect: Rect, surfaceY: number, body: Vec3) {
  if (body.y >= surfaceY) return false;
  const azimuth = TUNING.camera.azimuthDegrees * Math.PI / 180, elevation = TUNING.camera.elevationDegrees * Math.PI / 180;
  const depth = surfaceY - body.y;
  return contains({ x: body.x + depth * Math.sin(azimuth) / Math.tan(elevation),
    z: body.z + depth * Math.cos(azimuth) / Math.tan(elevation) }, rect);
}
