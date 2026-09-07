import { TUNING } from '../tuning';

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
