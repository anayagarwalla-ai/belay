import { TUNING } from '../tuning';
import type { Scene } from '../shared/protocol';

/** All workload and resource defaults must be merged into root tuning.ts. */
export type LocalLoadTuning = {
  smokeRooms: number; smokeSeconds: number; largeRooms: number; largeSeconds: number;
  generatorProcesses: number; maximumRooms: number; maximumSeconds: number;
  warmupMs: number; startLeadMs: number; sampleMs: number; startupTimeoutMs: number;
  maximumWallMs: number; shutdownGraceMs: number; maximumTotalRssBytes: number;
  minimumFreeMemoryBytes: number; authorityHeapMiB: number; generatorHeapMiB: number;
  maximumReportBytes: number; maximumChildLogBytes: number; maximumInputBufferedBytes: number;
  maximumLatePeriods: number; lifecycleCycles: number; lifecycleRooms: number; lifecycleHoldMs: number;
  slowReaderStartFraction: number; slowReaderDurationFraction: number;
  churnStartFraction: number; churnEveryRooms: number; probePollMs: number; eventLoopResolutionMs: number;
};
export type RoomPlan = { index: number; generator: number; scene: Scene; playerCount: number; seed: number };
export type LoadManifest = {
  schema: 'belay-local-load-v1'; profile: 'smoke' | '300' | 'test-fixture'; physics: 'legacy' | 'phase2';
  settings: LocalLoadTuning; seconds: number; rooms: RoomPlan[]; generators: number;
  inputHz: number; tickHz: number; framesPerClient: number; expectedClients: number; expectedScheduled: number;
  schedule: string; qualification: 'LOCAL DIAGNOSTIC ONLY';
};
export const rootSettings = (): LocalLoadTuning => {
  const settings = (TUNING as unknown as { localLoad?: LocalLoadTuning }).localLoad;
  if (!settings) throw new Error('Root TUNING.localLoad is required; merge work/local-load-tuning.patch. Tests may supply a named fixture override.');
  return { ...settings };
};

export function manifest(profile: LoadManifest['profile'], physics: LoadManifest['physics'], settings = rootSettings()): LoadManifest {
  for (const [key, value] of Object.entries(settings)) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid local-load setting ${key}`);
  }
  const count = profile === '300' ? settings.largeRooms : settings.smokeRooms;
  const seconds = profile === '300' ? settings.largeSeconds : settings.smokeSeconds;
  if (!Number.isSafeInteger(count) || count > settings.maximumRooms || seconds > settings.maximumSeconds
    || !Number.isSafeInteger(settings.generatorProcesses) || !Number.isSafeInteger(seconds * TUNING.network.inputHz)) throw new Error('Profile exceeds finite local diagnostic bounds.');
  if (profile === '300' && physics !== 'phase2') throw new Error('The 300-room diagnostic requires integrated six-body Phase 2 physics and server admission.');
  if (settings.slowReaderStartFraction + settings.slowReaderDurationFraction >= 1 || settings.churnStartFraction >= 1) throw new Error('Faults must fit inside the fixed interval.');
  const generators = Math.min(count, settings.generatorProcesses);
  const scenes: Scene[] = ['flat', 'crossing', 'rescue'];
  const rooms = Array.from({ length: count }, (_, index) => ({ index, generator: index % generators,
    scene: physics === 'legacy' ? 'flat' as const : scenes[index % scenes.length],
    playerCount: physics === 'legacy' ? 2 : profile === '300' ? TUNING.hardCap : 2 + index % (TUNING.hardCap - 1), seed: TUNING.seed + index }));
  const expectedClients = rooms.reduce((sum, room) => sum + room.playerCount, 0);
  const framesPerClient = seconds * TUNING.network.inputHz;
  // Two byte planes and one Float64 plane are exported losslessly as base64 JSON.
  const expectedScheduled = framesPerClient * expectedClients;
  if (expectedScheduled * (Float64Array.BYTES_PER_ELEMENT + 2) * 4 / 3 > settings.maximumReportBytes) throw new Error('Raw schedule planes alone exceed the report byte cap.');
  return { schema: 'belay-local-load-v1', profile, physics, settings: { ...settings }, seconds, rooms, generators,
    inputHz: TUNING.network.inputHz, tickHz: TUNING.tickHz, framesPerClient, expectedClients, expectedScheduled,
    schedule: 'Per generator, clients ordered by room index then seat. Event e is due at monotonicOrigin + e * (1000/inputHz) / clientCount; round=floor(e/clientCount), client=e%clientCount, seq=round+1. No adaptive rate, retries, or dropped-slot replacement.',
    qualification: 'LOCAL DIAGNOSTIC ONLY' };
}

export function action(room: number, seat: number, sequence: number, inputHz: number) {
  const phase = Math.floor((sequence - 1) / (inputHz * TUNING.bot.actionSeconds));
  const directions = [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: -1, z: 0 }];
  const move = directions[(phase + room + seat) % directions.length];
  return { ...move, brace: (phase + seat) % directions.length === 0, seq: sequence };
}

export const outcomes = { pending: 0, offered: 1, late: 2, disconnected: 3, backpressure: 4, sendError: 5 } as const;
export function distribution(values: Iterable<number>) {
  const sorted = Array.from(values).filter(Number.isFinite).sort((a, b) => a - b);
  const q = (p: number) => sorted.length ? sorted[Math.ceil(sorted.length * p) - 1] : null;
  return { count: sorted.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: sorted.at(-1) ?? null };
}
export function encodePlane(view: Uint8Array | Float64Array) {
  // Explicit little endian; artifacts can be decoded independently of the host.
  if (view instanceof Float64Array) {
    const buffer = Buffer.allocUnsafe(view.byteLength);
    view.forEach((value, i) => buffer.writeDoubleLE(value, i * Float64Array.BYTES_PER_ELEMENT));
    return buffer.toString('base64');
  }
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString('base64');
}
export function decodeFloat64(encoded: string) {
  const buffer = Buffer.from(encoded, 'base64');
  if (buffer.length % Float64Array.BYTES_PER_ELEMENT) throw new Error('Invalid Float64 plane length.');
  return Array.from({ length: buffer.length / Float64Array.BYTES_PER_ELEMENT }, (_, i) => buffer.readDoubleLE(i * Float64Array.BYTES_PER_ELEMENT));
}
export const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
export async function until(check: () => boolean | Promise<boolean>, timeout: number, poll: number, label: string) {
  const started = performance.now();
  while (!await check()) {
    if (performance.now() - started >= timeout) throw new Error(`Timed out: ${label}`);
    await delay(poll);
  }
}
