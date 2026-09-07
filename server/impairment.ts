import { Transform, type TransformCallback } from 'node:stream';
import { TUNING } from '../tuning';
import { seededRandom } from '../shared/terrain';

export type NetworkProfile = { addedRttMs: number; jitterMs: number };
export function parseNetworkProfile(value: unknown): NetworkProfile {
  const p = value as NetworkProfile;
  if (!p || typeof p !== 'object' || Object.keys(p).some(k => !['addedRttMs', 'jitterMs'].includes(k))
    || !Number.isFinite(p.addedRttMs) || !Number.isFinite(p.jitterMs)
    || p.addedRttMs < 0 || p.addedRttMs > TUNING.network.maximumAddedRttMs
    || p.jitterMs < 0 || p.jitterMs > TUNING.network.maximumJitterMs) throw new Error('Invalid added RTT/jitter profile.');
  return { addedRttMs: p.addedRttMs, jitterMs: p.jitterMs };
}
/** Delay an ordered byte stream without dropping/corrupting WebSocket frames.
 * This models added latency and jitter, NOT internet packet loss. */
export class DelayedStream extends Transform {
  private lastDelivery = 0;
  private bytes = 0;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private random = seededRandom(TUNING.seed);
  private finish?: TransformCallback;
  constructor(private profile: () => NetworkProfile) { super(); }
  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
    const p = this.profile();
    const delay = Math.max(0, p.addedRttMs / 2 + (this.random() * 2 - 1) * p.jitterMs);
    if (delay === 0 && this.timers.size === 0) { this.push(chunk); callback(); return; }
    this.bytes += chunk.length;
    if (this.bytes > TUNING.network.maximumDelayedBytes) { callback(new Error('Impairment buffer limit exceeded.')); return; }
    const at = Math.max(performance.now() + delay, this.lastDelivery); this.lastDelivery = at;
    const timer = setTimeout(() => {
      this.timers.delete(timer); this.bytes -= chunk.length;
      if (!this.destroyed) this.push(chunk);
      if (!this.timers.size && this.finish) this.finish();
    }, Math.max(0, at - performance.now()));
    this.timers.add(timer); callback();
  }
  _flush(callback: TransformCallback) { if (this.timers.size) this.finish = callback; else callback(); }
  _destroy(error: Error | null, callback: (error?: Error | null) => void) {
    for (const timer of this.timers) clearTimeout(timer); this.timers.clear(); callback(error);
  }
}
