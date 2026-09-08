import { afterEach, expect, it, vi } from 'vitest';
import { isValidElement } from 'react';
import GateClient from '../client/GateClient';
import { BelayConnection } from '../client/connection';

const hooks = vi.hoisted(() => ({ slot: 0, effects: [] as (() => void | (() => void))[], changed: vi.fn() }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(),
  useEffect: (effect: () => void | (() => void)) => hooks.effects.push(effect),
  useRef: (value: unknown) => ({ current: value }),
  // Render the existing-session state so the real Save measurements handler is available.
  useState: (value?: unknown) => [hooks.slot++ === 4 ? true : value, hooks.changed],
}));
vi.mock('../components/ui/button', () => ({ Button: () => null }));
vi.mock('../client/viewport', () => ({ createViewport: () => ({ canvas: { focus() {} }, dispose() {} }) }));

afterEach(() => { hooks.slot = 0; hooks.effects.length = 0; hooks.changed.mockClear(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function saveHandler(node: unknown): (() => Promise<void>) | undefined {
  if (Array.isArray(node)) return node.map(saveHandler).find(Boolean);
  if (!isValidElement<{ children?: unknown; onClick?: () => Promise<void> }>(node)) return;
  return node.props.children === 'Save measurements' ? node.props.onClick : saveHandler(node.props.children);
}

it.each(['mounted', 'unmounted', 'unmounted with failed capture'])('keeps a pending measurement export owned by its view: %s', async mode => {
  vi.useFakeTimers(); vi.stubGlobal('window', new EventTarget());
  const click = vi.fn(), create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:owned-measurement');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.stubGlobal('document', Object.assign(new EventTarget(), { createElement: () => ({ click }) }));
  let resolve!: (report: Awaited<ReturnType<BelayConnection['captureReport']>>) => void, reject!: (error: Error) => void;
  const report = new Promise<Awaited<ReturnType<BelayConnection['captureReport']>>>((done, fail) => { resolve = done; reject = fail; });
  vi.spyOn(BelayConnection.prototype, 'captureReport').mockReturnValue(report);
  const tree = GateClient(), cleanup = hooks.effects[0]() as () => void;
  const pending = saveHandler(tree)!();
  try {
    if (mode !== 'mounted') cleanup();
    hooks.changed.mockClear();
    if (mode.endsWith('failed capture')) reject(new Error('Capture failed after unmount'));
    else resolve({} as Awaited<ReturnType<BelayConnection['captureReport']>>);
    await pending;
    expect(click).toHaveBeenCalledTimes(mode === 'mounted' ? 1 : 0);
    expect(create).toHaveBeenCalledTimes(mode === 'mounted' ? 1 : 0);
    expect(revoke).toHaveBeenCalledTimes(mode === 'mounted' ? 1 : 0);
    if (mode !== 'mounted') expect(hooks.changed).not.toHaveBeenCalled();
  } finally { if (mode === 'mounted') cleanup(); }
  expect(vi.getTimerCount()).toBe(0);
});
