import { afterEach, expect, it, vi } from 'vitest';
import { getEventListeners } from 'node:events';
import GateClient from '../client/GateClient';
import { PracticeTeam } from '../client/practice-team';

const effects = vi.hoisted(() => [] as (() => void | (() => void))[]);
// Invoke the actual mount/cleanup effect with its real connection and inspection registration.
// Rendering and hook storage are irrelevant to ownership of the published debug reference.
vi.mock('react', async original => ({ ...await original<typeof import('react')>(),
  useEffect: (effect: () => void | (() => void)) => effects.push(effect),
  useRef: (value: unknown) => ({ current: value }),
  useState: (value?: unknown) => [value, () => {}],
}));
vi.mock('../components/ui/button', () => ({ Button: () => null }));
vi.mock('../client/viewport', () => ({ createViewport: () => ({ canvas: { focus() {} }, dispose() {} }) }));

afterEach(() => { effects.length = 0; vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const environment = () => {
  vi.useFakeTimers();
  vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('document', new EventTarget());
};
const mount = () => { GateClient(); return effects.at(-1)!() as () => void; };

it('stops browser practice on tab hiding and removes that handler at unmount', () => {
  environment(); const stop = vi.spyOn(PracticeTeam.prototype, 'stop'), cleanup = mount();
  Object.defineProperty(document, 'hidden', { value: true });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(stop).toHaveBeenCalledWith('Practice bots stopped because the tab was hidden.');
  cleanup(); stop.mockClear(); document.dispatchEvent(new Event('visibilitychange')); expect(stop).not.toHaveBeenCalled();
});

it('removes the disposed client debug API and its timers when the mounted view is cleaned up', () => {
  environment(); const cleanup = mount();
  const listeners = () => [getEventListeners(window, 'keydown'), getEventListeners(window, 'keyup'), getEventListeners(window, 'blur'),
    getEventListeners(document, 'visibilitychange'), getEventListeners(document, 'focusin')].map(list => list.length);
  expect(window.BELAY).toBeDefined(); expect(vi.getTimerCount()).toBe(1);
  expect(listeners()).toEqual([1, 1, 1, 1, 1]);
  cleanup();
  expect(Object.hasOwn(window, 'BELAY')).toBe(false);
  expect(listeners()).toEqual([0, 0, 0, 0, 0]);
  expect(vi.getTimerCount()).toBe(0);
});

it('does not let an older view cleanup remove the newer mounted view debug API', () => {
  environment(); const oldCleanup = mount(), oldApi = window.BELAY;
  const newCleanup = mount(), newApi = window.BELAY;
  expect(newApi).not.toBe(oldApi);
  oldCleanup(); expect(window.BELAY).toBe(newApi);
  newCleanup(); expect(Object.hasOwn(window, 'BELAY')).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
