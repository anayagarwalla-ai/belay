import { describe, expect, it } from 'vitest';
import { DelayedStream, parseNetworkProfile } from '../server/impairment';
import { isFamily } from '../tuning';

describe('bounded ordered network impairment', () => {
  it('does not accept inherited object properties as a scene family', () => {
    expect(isFamily('constructor')).toBe(false);
    expect(isFamily('__proto__')).toBe(false);
    expect(isFamily('balanced')).toBe(true);
  });
  it('preserves byte order even when jitter would reorder deliveries', async () => {
    const stream = new DelayedStream(() => ({ addedRttMs: 30, jitterMs: 20 }));
    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(chunk));
    const ended = new Promise<void>((resolve, reject) => { stream.on('end', resolve); stream.on('error', reject); });
    for (let i = 0; i < 100; i++) stream.write(Buffer.from([i]));
    stream.end(); await ended;
    expect(Buffer.concat(chunks)).toEqual(Buffer.from(Array.from({ length: 100 }, (_, i) => i)));
  });
  it('rejects unbounded, missing, nonfinite and invented packet-loss settings', () => {
    for (const value of [null, {}, { addedRttMs: -1, jitterMs: 0 }, { addedRttMs: Infinity, jitterMs: 0 },
      { addedRttMs: 0, jitterMs: 51 }, { addedRttMs: 10, jitterMs: 0, packetLoss: 0.1 }]) expect(() => parseNetworkProfile(value)).toThrow();
    expect(parseNetworkProfile({ addedRttMs: 100, jitterMs: 10 })).toEqual({ addedRttMs: 100, jitterMs: 10 });
  });
});
