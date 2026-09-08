import { TUNING } from '../tuning';
import type { Scene, TerrainState } from './protocol';
import type { Solid } from './contact-geometry';

/** Integer-only seeded generator. Rendering may use trig; world generation never depends on it. */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export function flatTerrain(seed: number) {
  const random = seededRandom(seed);
  return {
    kind: 'flat' as const,
    height: 0,
    marks: Array.from({ length: TUNING.terrain.landmarkCount }, () => ({
      x: (random() - 0.5) * TUNING.terrain.landmarkRange,
      z: (random() - 0.5) * TUNING.terrain.landmarkRange,
    })),
  };
}

export function physicalTerrain(scene: Scene, seed: number) {
  const p = TUNING.phase2, random = seededRandom(seed);
  const half = scene === 'flat' ? TUNING.terrain.halfExtent : p.routeHalfWidth;
  const bounds = { minX: -half, maxX: half, minZ: scene === 'flat' ? -half : p.routeStartZ,
    maxZ: scene === 'flat' ? half : p.finishZ + p.finishApronM };
  const starts = scene === 'flat' ? [] : scene === 'rescue' ? [p.rescueLipZ] : [...p.crevasseStarts];
  const state: TerrainState = { bounds, finishZ: scene === 'crossing' ? p.finishZ : null,
    crevasses: starts.map((z, id) => ({ id, minX: -half, maxX: half, minZ: z, maxZ: z + p.crevasseWidth, depth: p.crevasseDepth })),
    bridges: [], ice: [] };
  const solids: Solid[] = [];
  let z = bounds.minZ;
  for (const gap of state.crevasses) {
    solids.push({ id: solids.length, minX: -half, maxX: half, minZ: z, maxZ: gap.minZ, minY: -p.crevasseDepth, maxY: 0 });
    z = gap.maxZ;
  }
  solids.push({ id: solids.length, minX: -half, maxX: half, minZ: z, maxZ: bounds.maxZ, minY: -p.crevasseDepth, maxY: 0 });
  const capacities = new Map<number, number>();
  if (scene === 'crossing') for (const gap of state.crevasses) {
    for (const offset of p.bridgeLaneOffsets) {
      const bridge = { id: state.bridges.length, crevasseId: gap.id, minX: offset - p.bridgeHalfWidth, maxX: offset + p.bridgeHalfWidth,
        minZ: gap.minZ, maxZ: gap.maxZ, cue: 0, collapsed: false };
      state.bridges.push(bridge);
      solids.push({ ...bridge, id: solids.length, minY: -p.bridgeThickness, maxY: 0, bridgeId: bridge.id });
      const range = offset === 0 ? p.bridgeCapacityBodyWeights : p.alternateBridgeCapacityBodyWeights;
      capacities.set(bridge.id, TUNING.body.mass * TUNING.gravity * (range[0] + random() * (range[1] - range[0])));
    }
    state.ice.push({ id: gap.id, minX: p.bridgeHalfWidth, maxX: p.bridgeHalfWidth + TUNING.rope.initialSpacing,
      minZ: gap.minZ - TUNING.rope.initialSpacing, maxZ: gap.minZ });
  }
  return { state, solids, capacities };
}
