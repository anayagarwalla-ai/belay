import { monitorEventLoopDelay, performance, PerformanceObserver } from 'node:perf_hooks';
import { TUNING } from '../tuning';
import type { LocalLoadTuning } from './local-load-model';

if (!process.send || !process.connected) process.exit(1);
const maximumWallMs = Number(process.env.BELAY_LOCAL_LOAD_WALL_MS);
if (!Number.isSafeInteger(maximumWallMs) || maximumWallMs <= 0) process.exit(1);
const watchdog = setTimeout(() => process.exit(1), maximumWallMs);
const role = process.argv[2];
if (role !== 'authority' && role !== 'generator') throw new Error('Unknown local-load worker role');
// Keep Rapier/server modules out of generator processes and SDK global selection out of authority.
const authority = role === 'authority' ? new (await import('./local-load-authority')).LoadAuthority() : undefined;
const generator = role === 'generator' ? new (await import('./local-load-generator')).LoadGenerator() : undefined;
const service = authority ?? generator!;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  // Parent disappearance and stalled cleanup are bounded independently of the parent.
  const forced = setTimeout(() => process.exit(1), TUNING.tools.operations.shutdownGraceMs);
  try { await service.shutdown(); } finally { clearTimeout(watchdog); clearTimeout(forced); process.exit(0); }
}
process.on('disconnect', () => void stop()); process.on('SIGTERM', () => void stop()); process.on('SIGINT', () => void stop());
if (!process.connected) void stop();
let histogram: ReturnType<typeof monitorEventLoopDelay> | undefined;
let previousCpu = process.cpuUsage(), previousUtilization = performance.eventLoopUtilization(), previousAt = performance.now();
let gc: number[] = [], gcOmitted = 0;
const gcObserver = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    if (gc.length < TUNING.network.telemetrySamples) gc.push(entry.duration); else gcOmitted++;
  }
});
gcObserver.observe({ entryTypes: ['gc'] });
function sampleProcess() {
  const now = performance.now(), currentCpu = process.cpuUsage(), utilization = performance.eventLoopUtilization();
  const result = { pid: process.pid, role, fromMonoMs: previousAt, toMonoMs: now, wallAtMs: Date.now(), memory: process.memoryUsage(),
    cpuMicroseconds: { user: currentCpu.user - previousCpu.user, system: currentCpu.system - previousCpu.system },
    eventLoopUtilization: performance.eventLoopUtilization(utilization, previousUtilization),
    loopDelayMs: histogram ? { samples: histogram.count, p50: histogram.percentile(50) / 1e6,
      p95: histogram.percentile(95) / 1e6, p99: histogram.percentile(99) / 1e6, max: histogram.max / 1e6 } : null,
    gcDurationsMs: gc, gcOmitted, memoryScope: 'Whole child process; arrayBuffers is included in external. No per-room attribution.' };
  previousAt = now; previousCpu = currentCpu; previousUtilization = utilization; gc = []; gcOmitted = 0; histogram?.reset();
  return result;
}
process.on('message', async (message: { id: number; command: string; value?: unknown }) => {
  try {
    let result: unknown;
    if (message.command === 'initialize') {
      const settings = message.value as LocalLoadTuning;
      histogram = monitorEventLoopDelay({ resolution: settings.eventLoopResolutionMs }); histogram.enable();
      result = authority ? await authority.initialize() : generator!.initialize(settings);
    } else if (message.command === 'sample') {
      result = { process: sampleProcess(), population: authority ? await authority.inspect(false) : generator!.sample() };
    } else if (message.command === 'inspect' && authority) result = await authority.inspect(true);
    else if (message.command === 'shutdown') { process.send?.({ id: message.id, result: { stopping: true } }, () => void stop()); return; }
    else if (generator) result = await generator.command(message.command, message.value);
    else throw new Error(`Unsupported authority command: ${message.command}`);
    if (process.connected) process.send?.({ id: message.id, result });
  } catch (error) {
    if (process.connected) process.send?.({ id: message.id, error: error instanceof Error ? error.message : 'Worker operation failed' });
  }
});
