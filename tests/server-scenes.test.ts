import { describe, expect, it } from 'vitest';
import { assertOccupiedSeatsFit, resolveScene } from '../server/scenes';
import { TUNING } from '../tuning';

describe('scene admission before physics allocation', () => {
  it('preserves the legacy flat pair and preserves a current scene on partial updates', () => {
    expect(resolveScene({})).toEqual({ seed: TUNING.seed, family: 'balanced', tickHz: TUNING.tickHz, scene: 'flat', playerCount: 2 });
    const current = resolveScene({ scene: 'rescue', playerCount: 6, family: 'loose', tickHz: 60 });
    expect(resolveScene({ seed: 5 }, current)).toEqual({ ...current, seed: 5 });
  });
  it('rejects forged state, malformed values and capacity beyond the hard ceiling', () => {
    for (const value of [null, [], 'rescue', { playerCount: 1 }, { playerCount: 7 }, { playerCount: 2.5 },
      { playerCount: NaN }, { playerCount: '6' }, { playerCount: null }, { seed: -1 }, { seed: 2 ** 32 },
      { seed: Infinity }, { family: 'fake' }, { scene: 'daily' }, { tickHz: 120 }, { positions: [] },
      { scene: 'rescue', state: { rescued: true } }, { tickHz: null }]) expect(() => resolveScene(value)).toThrow();
  });
  it('allows every supported team size and valid seed boundary', () => {
    for (let playerCount = 2; playerCount <= TUNING.hardCap; playerCount++) {
      expect(resolveScene({ playerCount, scene: 'crossing', seed: 0xffffffff }).playerCount).toBe(playerCount);
    }
    expect(resolveScene({ seed: 0 }).seed).toBe(0);
  });
  it('never deletes an occupied high-index body, even when total occupancy is low', () => {
    expect(() => assertOccupiedSeatsFit(2, [0, 5])).toThrow('Climber 6');
    expect(() => assertOccupiedSeatsFit(4, [0, 3])).not.toThrow();
    expect(() => assertOccupiedSeatsFit(6, [0, 5])).not.toThrow();
  });
});
