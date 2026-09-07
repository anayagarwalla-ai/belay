import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BelaySimulation, initializePhysics } from '../shared/simulation';
import { FAMILIES, TUNING, type Family, type TickHz } from '../tuning';
import { physicalState, measurePhysics, metricLimits, scenarioInputs } from '../scripts/physics-scenarios';

const simulations: BelaySimulation[] = [];
const create = (family: Family, tickHz: TickHz = 60) => {
  const sim = new BelaySimulation({ family, tickHz }); simulations.push(sim); return sim;
};
beforeAll(initializePhysics);
afterEach(() => { vi.useRealTimers(); for (const sim of simulations.splice(0)) sim.dispose(); });

describe.each(Object.keys(FAMILIES) as Family[])('%s adversarial physical bounds', family => {
  it.each([30, 60] as const)('keeps contacts within 5 mm while crossing at %i Hz', tickHz => {
    const sim = create(family, tickHz), inputs = scenarioInputs('crossing', sim.seed, tickHz);
    for (let tick = 0; tick < tickHz * TUNING.physicsDiagnostics.scenarioSeconds; tick++) {
      sim.step(inputs(tick));
      expect(measurePhysics(sim).bodyOverlapM, `crossing tick ${tick}`).toBeLessThanOrEqual(metricLimits.bodyOverlapM);
    }
  });
  it.each([30, 60] as const)('bounds each segment while circling and switching brace at %i Hz', tickHz => {
    const sim = create(family, tickHz), inputs = scenarioInputs('circling', sim.seed, tickHz);
    for (let tick = 0; tick < tickHz * TUNING.physicsDiagnostics.scenarioSeconds; tick++) {
      sim.step(inputs(tick));
      expect(measurePhysics(sim).bodyOverlapM, `circling tick ${tick}`).toBeLessThanOrEqual(metricLimits.bodyOverlapM);
    }
    expect(sim.counters.maximumSpanErrorM).toBeLessThanOrEqual(metricLimits.spanErrorM);
    expect(sim.counters.maximumSegmentErrorM).toBeLessThanOrEqual(metricLimits.segmentErrorM);
  });
  it('uses identical fixed steps across authority rates and wall-clock pauses', () => {
    const thirty = create(family, 30), sixty = create(family, 60), paused = create(family, 30);
    const inputs = scenarioInputs('random', thirty.seed, 30);
    vi.useFakeTimers();
    for (let tick = 0; tick < 30 * TUNING.physicsDiagnostics.scenarioSeconds; tick++) {
      const frame = inputs(tick);
      thirty.step(frame); sixty.step(frame); sixty.step(frame);
      const before = physicalState(paused);
      vi.setSystemTime(Date.now() + TUNING.body.maximumInputAgeMs);
      expect(physicalState(paused)).toEqual(before);
      paused.step(frame);
    }
    expect(physicalState(paused)).toEqual(physicalState(thirty));
    expect(thirty.snapshot().players).toEqual(sixty.snapshot().players);
    expect(thirty.snapshot().rope).toEqual(sixty.snapshot().rope);
    expect(thirty.counters.elapsedSeconds).toEqual(sixty.counters.elapsedSeconds);
  });
  it('records independent bounded frames and exactly replays mixed controls', () => {
    const sim = create(family), replay = create(family), inputs = scenarioInputs('random', sim.seed, sim.tickHz);
    for (let tick = 0; tick < sim.tickHz * TUNING.physicsDiagnostics.scenarioSeconds; tick++) {
      const frame = inputs(tick).map(v => ({ ...v }));
      sim.step(frame, true);
      frame[0].x = 0; frame[0].brace = !frame[0].brace;
    }
    for (const frame of sim.tape.frames) {
      expect(frame.tick).toBe(replay.tick);
      expect(frame.inputs).toHaveLength(TUNING.players);
      expect(frame.inputs.every(v => Math.hypot(v.x, v.z) <= 1 + Number.EPSILON)).toBe(true);
      replay.step(frame.inputs);
    }
    expect(physicalState(replay)).toEqual(physicalState(sim));
  });
});
