import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BelaySimulation, initializePhysics } from '../shared/simulation';
import { flatTerrain } from '../shared/terrain';
import { REST, parseInput, type Move } from '../shared/protocol';
import { TUNING, type TickHz } from '../tuning';

const simulations: BelaySimulation[] = [];
const create = (tickHz: TickHz = 30) => { const sim = new BelaySimulation({ tickHz }); simulations.push(sim); return sim; };
const walk: Move = { x: -1, z: 0, brace: false };
beforeAll(initializePhysics);
afterEach(() => { for (const sim of simulations.splice(0)) sim.dispose(); });

describe('flat-ground rope contract', () => {
  it('reproduces terrain from an integer seed', () => {
    expect(flatTerrain(123)).toEqual(flatTerrain(123)); expect(flatTerrain(123)).not.toEqual(flatTerrain(124));
  });
  it('drags an idle unbraced partner, but a brace resists the same pull', () => {
    const free = create(), braced = create();
    for (let i = 0; i < 300; i++) { free.step([walk, REST]); braced.step([walk, { ...REST, brace: true }]); }
    expect(free.counters.distanceTravelledM[1]).toBeGreaterThan(15);
    expect(braced.counters.distanceTravelledM[1]).toBeLessThan(0.6);
    expect(braced.counters.distanceTravelledM[1]).toBeLessThan(free.counters.distanceTravelledM[1] / 10);
  });
  it('allows cooperative walking at speed while the rope stays slack', () => {
    const sim = create();
    for (let i = 0; i < 300; i++) sim.step([walk, walk]);
    expect(sim.counters.distanceTravelledM[0]).toBeGreaterThan(27);
    expect(sim.counters.distanceTravelledM[1]).toBeGreaterThan(27);
    expect(sim.snapshot().rope.slackM).toBeGreaterThan(0.5);
  });
  it('catches at the rope length with a jolt instead of unbounded stretch', () => {
    const sim = create();
    for (let i = 0; i < 300; i++) sim.step([walk, { x: 1, z: 0, brace: false }]);
    expect(sim.counters.maximumSpanErrorM).toBeLessThan(0.01);
    expect(sim.counters.maximumSegmentErrorM).toBeLessThan(0.02);
    expect(sim.counters.tautTransitions).toBeGreaterThan(0);
    expect(sim.counters.maximumJoltMps2).toBeGreaterThan(TUNING.body.acceleration);
  });
  it('does not push resting players apart just to draw a straight rope', () => {
    const sim = create();
    for (let i = 0; i < 120; i++) sim.step([REST, REST]);
    expect(sim.counters.distanceTravelledM[0]).toBeLessThan(0.05);
    expect(sim.counters.distanceTravelledM[1]).toBeLessThan(0.05);
    expect(sim.snapshot().rope.slackM).toBeGreaterThan(0.5);
  });
  it('keeps colliders separate when players walk into each other', () => {
    const sim = create();
    for (let i = 0; i < 120; i++) sim.step([{ x: 1, z: 0, brace: false }, walk]);
    const [a, b] = sim.snapshot().players;
    expect(Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z)).toBeGreaterThan(TUNING.body.width * 0.85);
  });
  it('replays a versioned input tape without changing the physical result', () => {
    const sim = create(), replay = create();
    for (let i = 0; i < 300; i++) sim.step([walk, i > 90 ? { ...REST, brace: true } : walk], true);
    for (const frame of sim.tape.frames) replay.step(frame.inputs);
    expect(replay.snapshot().players).toEqual(sim.snapshot().players);
    expect(replay.snapshot().rope).toEqual(sim.snapshot().rope);
  });
  it('matches 30/60 Hz results for controls held through identical internal steps', () => {
    const thirty = create(30), sixty = create(60);
    for (let i = 0; i < 300; i++) thirty.step([walk, REST]);
    for (let i = 0; i < 600; i++) sixty.step([walk, REST]);
    expect(thirty.snapshot().players).toEqual(sixty.snapshot().players);
    expect(thirty.snapshot().rope).toEqual(sixty.snapshot().rope);
  });
});
describe('input authority', () => {
  it('rejects forged state, time, invalid directions, and invalid sequences', () => {
    for (const v of [null, { ...walk, seq: 1, position: { x: 100 } }, { ...walk, seq: 1, dt: 100 },
      { ...walk, seq: 1, x: Infinity }, { ...walk, seq: -1 }, { ...walk, seq: 1, brace: 'true' }, { ...walk, seq: 1, x: 2 }]) expect(parseInput(v)).toBeNull();
  });
  it('normalizes diagonal input', () => {
    const input = parseInput({ x: 1, z: 1, brace: false, seq: 3 })!;
    expect(Math.hypot(input.x, input.z)).toBeCloseTo(1);
  });
});
