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
/** Added latency on an ordered byte stream, never a packet-loss simulation.
 * One queue and one delivery timer preserve order even when timer rounding differs. */
export class DelayedStream extends Transform {
  private queue: { chunk: Buffer; at: number }[] = [];
  private head = 0;
  private bytes = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private random = seededRandom(TUNING.seed);
  private finish?: TransformCallback;
  constructor(private profile: () => NetworkProfile) { super(); }
  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
    if (this.bytes + this.readableLength + chunk.length > TUNING.network.maximumDelayedBytes) {
      callback(new Error('Impairment buffer limit exceeded.')); return;
    }
    const p = this.profile();
    const delay = Math.max(0, p.addedRttMs / 2 + (this.random() * 2 - 1) * p.jitterMs);
    if (delay === 0 && this.head === this.queue.length) { this.push(chunk); callback(); return; }
    this.bytes += chunk.length;
    const at = Math.max(performance.now() + delay, this.queue.at(-1)?.at ?? 0);
    this.queue.push({ chunk, at });
    if (!this.timer) this.schedule();
    callback();
  }
  private schedule() {
    const next = this.queue[this.head];
    if (!next || this.destroyed) return;
    this.timer = setTimeout(this.deliver, Math.max(0, Math.ceil(next.at - performance.now())));
  }
  private deliver = () => {
    this.timer = undefined;
    const now = performance.now();
    while (this.head < this.queue.length && this.queue[this.head].at <= now) {
      const next = this.queue[this.head++]; this.bytes -= next.chunk.length;
      if (!this.destroyed) this.push(next.chunk);
    }
    if (this.head === this.queue.length) {
      this.queue = []; this.head = 0;
      const finish = this.finish; this.finish = undefined; finish?.();
    } else {
      if (this.head * 2 >= this.queue.length) { this.queue = this.queue.slice(this.head); this.head = 0; }
      this.schedule();
    }
  };
  _flush(callback: TransformCallback) { if (this.head < this.queue.length) this.finish = callback; else callback(); }
  _destroy(error: Error | null, callback: (error?: Error | null) => void) {
    clearTimeout(this.timer); this.queue = []; this.head = 0; this.bytes = 0; callback(error);
  }
}
