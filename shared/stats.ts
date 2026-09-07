import { TUNING } from '../tuning';
export class Samples {
  private values: number[] = [];
  private cursor = 0;
  add(value: number) {
    if (!Number.isFinite(value)) return;
    if (this.values.length < TUNING.network.telemetrySamples) this.values.push(value);
    else this.values[this.cursor++ % this.values.length] = value;
  }
  summary() {
    const a = [...this.values].sort((x, y) => x - y);
    const q = (fraction: number) => a.length ? a[Math.min(a.length - 1, Math.ceil(a.length * fraction) - 1)] : null;
    return { samples: a.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: a.at(-1) ?? null };
  }
}
