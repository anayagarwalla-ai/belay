import { afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { BelayConnection } from '../client/connection';
import { ClientEvidence } from '../client/evidence';
import { LocalPrediction } from '../client/prediction';
import { createViewport } from '../client/viewport';
import { phase2State } from './fixtures/phase2-state';
import { REST } from '../shared/protocol';

const rendering = vi.hoisted(() => ({ complete: () => {}, calls: 0, scene: undefined as import('three').Scene | undefined, disposals: 0 }));
// Keep actual scene geometry, camera, prediction and evidence. Only the GPU and DOM boundary are stand-ins.
vi.mock('three', async importOriginal => ({
  ...await importOriginal<typeof import('three')>(),
  WebGLRenderer: class {
    domElement = { tabIndex: 0, setAttribute() {}, remove() {} };
    info = { render: { calls: 0 }, memory: { geometries: 0 } };
    setPixelRatio() {}
    setSize() {}
    render(scene: import('three').Scene) { rendering.scene = scene; rendering.calls++; rendering.complete(); }
    dispose() { rendering.disposals++; }
  },
}));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); rendering.complete = () => {}; rendering.calls = 0; rendering.scene = undefined; rendering.disposals = 0; });

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

it('releases scene/team resources while reusing shared geometry, then closes RAF, observer and DOM ownership', () => {
  const disposedGeometry = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose'), disposedMaterial = vi.spyOn(THREE.Material.prototype, 'dispose');
  const frames = new Map<number, FrameRequestCallback>(), nodes = new Set<object>();
  let nextFrame = 0, observed = false;
  vi.stubGlobal('devicePixelRatio', 1);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('ResizeObserver', class { observe() { observed = true; } disconnect() { observed = false; } });
  const node = () => ({ setAttribute() {}, remove() {}, style: {}, offsetWidth: 0, offsetHeight: 0, offsetLeft: 0, offsetTop: 0 });
  vi.stubGlobal('document', { createElement: node });
  const host = { ...node(), clientWidth: 1280, clientHeight: 633, querySelectorAll: () => [],
    append(child: ReturnType<typeof node>) { nodes.add(child); child.remove = () => { nodes.delete(child); }; } } as unknown as HTMLElement;
  const connection = { latest: undefined, history: [], evidence: new ClientEvidence(), localId: 0, input: REST,
    acceptsMovement: true, viewCounters: () => null } as unknown as BelayConnection;
  const viewport = createViewport(host, connection);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const paint = (count: number, scene: 'crossing' | 'rescue' | 'flat') => {
    const state = phase2State(count, scene); state.epoch = nextFrame;
    connection.latest = state; connection.history = [{ at: performance.now(), state }];
    const [id, callback] = frames.entries().next().value!; frames.delete(id); callback(performance.now());
    rendering.scene!.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    });
    expect(frames.size).toBe(1); expect(nodes.size).toBe(1 + count * 2 + state.terrain!.bridges.length);
  };
  try {
    paint(6, 'rescue');
    const bodyGroup = rendering.scene!.children[1], pooledRopeMeshes = rendering.scene!.children[2].children.length;
    const sharedGeometry = (bodyGroup.children[0] as THREE.Mesh).geometry;
    const removedMaterials = bodyGroup.children.slice(2).flatMap(body => [body, ...body.children].map(object => (object as THREE.Mesh).material));
    const oldTerrain: (THREE.BufferGeometry | THREE.Material)[] = [];
    rendering.scene!.children[0].traverse(object => {
      const mesh = object as THREE.Mesh; if (mesh.geometry) oldTerrain.push(mesh.geometry);
      if (mesh.material) oldTerrain.push(...Array.isArray(mesh.material) ? mesh.material : [mesh.material]);
    });
    paint(2, 'flat');
    expect(disposedGeometry.mock.instances).not.toContain(sharedGeometry);
    for (const material of removedMaterials) expect(disposedMaterial.mock.instances).toContain(material);
    for (const resource of oldTerrain) expect([...disposedGeometry.mock.instances, ...disposedMaterial.mock.instances]).toContain(resource);
    paint(6, 'crossing');
    expect((bodyGroup.children[0] as THREE.Mesh).geometry).toBe(sharedGeometry);
    expect(rendering.scene!.children[2].children).toHaveLength(pooledRopeMeshes);
  } finally { viewport.dispose(); }
  for (const geometry of geometries) expect(disposedGeometry.mock.instances).toContain(geometry);
  for (const material of materials) expect(disposedMaterial.mock.instances).toContain(material);
  expect(rendering.disposals).toBe(1); expect(frames.size).toBe(0); expect(observed).toBe(false); expect(nodes.size).toBe(0);
  expect(connection.viewCounters()).toBeNull();
});
