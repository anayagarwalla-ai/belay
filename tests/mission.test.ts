import { describe, expect, it } from 'vitest';
import { mission } from '../client/mission';
import { controlHint, moveFromKeys } from '../client/controls';
import { phase2State } from './fixtures/phase2-state';

describe('a legible crossing', () => {
  it('uses the tail to measure progress and points keys toward the real finish', () => {
    const state = phase2State(4, 'crossing'); state.players.forEach(p => { p.brace = false; p.position.z = 8; });
    state.players[3].position.z = 1;
    expect(mission(state, 0)).toMatchObject({ remaining: 15, crossed: 0, title: 'GET EVERYONE TO THE HUT.' });
    const move = moveFromKeys(new Set(['KeyS', 'KeyA'])); expect(move.z).toBeCloseTo(1); expect(move.x).toBeCloseTo(0);
    expect(controlHint(state.players[0], state)).toContain('release it to keep walking');
    state.players[0].brace = true; expect(controlHint(state.players[0], state)).toContain('Release Space');
  });
  it('changes each player’s instruction between catching, hauling, hanging, and climbing', () => {
    const state = phase2State(4); state.players[0].brace = false;
    expect(mission(state, 0).title).toContain('BRACE');
    state.players[0].brace = true; expect(mission(state, 0).title).toContain('HAUL');
    expect(mission(state, 2).title).toBe('THE ROPE HAS YOU.');
    state.players[2].support = 'wall'; expect(mission(state, 2).title).toContain('CLIMB');
  });
  it('only announces a recovery or finish when the authority records it', () => {
    const state = phase2State(); state.incidents![0].status = 'recovered'; state.incidents![0].recoveredTick = state.tick;
    state.players.forEach(p => { p.support = 'ground'; p.rescueState = 'safe'; });
    expect(mission(state, 0).title).toBe('BACK ON THE SNOW.');
    state.tick += 300; expect(mission(state, 0).detail).toContain('Reset the rescue');
    state.incidents = []; expect(mission(state, 0).title).not.toContain('HUT');
    state.run!.status = 'failed'; expect(mission(state, 0).title).toBe('THE GLACIER GOT US.');
    state.run!.status = 'complete'; expect(mission(state, 0).title).toBe('EVERYBODY MADE IT.');
  });
});
