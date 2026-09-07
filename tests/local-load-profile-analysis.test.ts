import { describe, expect, it } from 'vitest';
import { cpuSummary, heapSummary } from '../scripts/local-load-profile-analysis';
const frame = (functionName: string) => ({ functionName, url: 'file:///fixture.ts', lineNumber: 0 });
describe('local profile evidence accounting', () => {
  it('distinguishes weighted elapsed sample shares from sample-count shares', () => {
    const summary = cpuSummary({ startTime: 0, endTime: 10, nodes: [{ id: 1, callFrame: frame('a') }, { id: 2, callFrame: frame('b') }], samples: [1, 1, 2], timeDeltas: [1, 1, 8] });
    expect(summary.functions[0].frame.functionName).toBe('b');
    expect(summary.functions[0].sampleFraction).toBe(1 / 3); expect(summary.functions[0].sampledTimeFraction).toBe(0.8);
  });
  it('rejects missing CPU evidence rather than inventing timing weights', () => {
    expect(() => cpuSummary({ startTime: 0, endTime: 10, nodes: [], samples: [1], timeDeltas: [] })).toThrow('length mismatch');
    expect(() => cpuSummary({ startTime: 0, endTime: 10, nodes: [], samples: [1], timeDeltas: [1] })).toThrow('missing node');
  });
  it('aggregates exclusive sampled allocations once across repeated stack nodes', () => {
    const summary = heapSummary({ callFrame: frame('a'), selfSize: 4, children: [
      { callFrame: frame('b'), selfSize: 7, children: [] }, { callFrame: frame('a'), selfSize: 3, children: [] }] });
    expect(summary.totalEstimatedBytes).toBe(14); expect(summary.functions.map(row => row.estimatedSelfBytes)).toEqual([7, 7]);
  });
});
