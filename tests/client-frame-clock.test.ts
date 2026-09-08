import { afterEach, expect, it, vi } from 'vitest';
import type { BelayConnection } from '../client/connection';
import { ClientEvidence } from '../client/evidence';
import { LocalPrediction } from '../client/prediction';
import { createViewport } from '../client/viewport';
import { phase2State } from './fixtures/phase2-state';
import { REST } from '../shared/protocol';

const rendering = vi.hoisted(() => ({ complete: () => {}, calls: 0 }));
// Keep actual scene geometry, camera, prediction and evidence. Only the GPU and DOM boundary are stand-ins.
vi.mock('three', async importOriginal => ({
  ...await importOriginal<typeof import('three')>(),
  WebGLRenderer: class {
    domElement = { tabIndex: 0, setAttribute() {}, remove() {} };
    info = { render: { calls: 0 }, memory: { geometries: 0 } };
    setPixelRatio() {}
    setSize() {}
    render() { rendering.calls++; rendering.complete(); }
    dispose() {}
  },
}));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); rendering.complete = () => {}; rendering.calls = 0; });

it('uses callback time for received snapshot age and post-render time for cues when the frame timestamp predates receipt', () => {
  let now = 90, nextFrame: FrameRequestCallback | undefined;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('devicePixelRatio', 1);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { nextFrame = callback; return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const node = () => ({ setAttribute() {}, remove() {}, style: {}, offsetWidth: 0, offsetHeight: 0, offsetLeft: 0, offsetTop: 0 });
  vi.stubGlobal('document', { createElement: node });
  const host = { ...node(), clientWidth: 1280, clientHeight: 633, append() {}, querySelectorAll: () => [] } as unknown as HTMLElement;
  const state = phase2State(2, 'crossing'), evidence = new ClientEvidence();
  const connection = { latest: state, history: [{ at: 100, state }], evidence, localId: 0, input: REST, acceptsMovement: true,
    viewCounters: () => null } as unknown as BelayConnection;
  const prediction = vi.spyOn(LocalPrediction.prototype, 'sample');
  const viewport = createViewport(host, connection);
  try {
    now = 100; evidence.receive(state, 0); // A queued snapshot is processed after the frame's original 98.8 ms timestamp.
    now = 101; rendering.complete = () => { now = 104; };
    nextFrame!(98.8);
    expect(rendering.calls).toBe(1);
    const call = prediction.mock.calls[0];
    expect.soft(call[4]).toBeCloseTo(0.011, 6); // Actual callback elapsed time from viewport creation.
    expect.soft(call[5]).toBe(1); // Latest receipt age cannot be the old frame timestamp minus receipt time.
    const cue = evidence.report().observations.find(row => row.kind === 'bridge-cue')!;
    expect(cue.firstReceivedAtMs).toBe(0);
    expect(cue.firstDrawnAtMs).toBe(4); // Captures completion, including three milliseconds spent rendering.
    expect(cue.firstDrawnTick).toBe(state.tick);
  } finally { viewport.dispose(); }
});
