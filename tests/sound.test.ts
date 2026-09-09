import { afterEach, expect, it, vi } from 'vitest';
import { RopeSound } from '../client/sound';
import { phase2State } from './fixtures/phase2-state';
import { TUNING } from '../tuning';

class AudioNodeStub {
  connect(target: AudioNodeStub) { return target; }
  disconnect = vi.fn();
  start = vi.fn(); stop = vi.fn();
  onended?: () => void;
  gain = { value: 0, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
  frequency = this.gain;
}
class ContextStub {
  state = 'running'; currentTime = 0; sampleRate = 24;
  destination = new AudioNodeStub();
  oscillators: AudioNodeStub[] = [];
  resume = vi.fn(async () => {}); close = vi.fn(async () => {});
  createGain = () => new AudioNodeStub();
  createBiquadFilter = () => new AudioNodeStub();
  createBufferSource = () => new AudioNodeStub();
  createBuffer = () => ({ getChannelData: () => new Float32Array(48) });
  createOscillator = () => { const node = new AudioNodeStub(); this.oscillators.push(node); return node; };
}
afterEach(() => vi.unstubAllGlobals());
it('plays new physical events once, bounds voices and silences them on leaving or hiding', async () => {
  const context = new ContextStub(); vi.stubGlobal('AudioContext', class { constructor() { return context; } });
  const sound = new RopeSound(), state = phase2State();
  const event = (id: number) => ({ id, epoch: state.epoch, tick: state.tick, substep: 0, kind: 'catch' as const,
    incidentId: 1, playerIds: [2], spanIds: [1], surfaceIds: [] });
  state.events = [event(1)]; sound.observe(state); expect(context.oscillators).toHaveLength(0);
  await sound.start(); sound.observe(state); expect(context.oscillators).toHaveLength(0);
  state.events.push(event(2)); sound.observe(state); sound.observe(state); expect(context.oscillators).toHaveLength(1);
  sound.setMuted(true); state.events.push(event(3)); sound.observe(state); expect(context.oscillators).toHaveLength(1);
  sound.setMuted(false);
  for (let id = 4; id < 20; id++) { state.events.push(event(id)); sound.observe(state); }
  expect(context.oscillators).toHaveLength(TUNING.hardCap);
  sound.quiet(); expect(context.oscillators.every(node => node.stop.mock.calls.length === 2)).toBe(true);
  state.epoch++; state.events = [event(20)]; sound.observe(state); expect(context.oscillators).toHaveLength(TUNING.hardCap);
  sound.dispose(); expect(context.close).toHaveBeenCalledOnce();
});
it('lets play proceed when Web Audio is unavailable', async () => {
  vi.stubGlobal('AudioContext', class { constructor() { throw new Error('unavailable'); } });
  const sound = new RopeSound(); await expect(sound.start()).resolves.toBeUndefined();
  sound.observe(phase2State()); sound.quiet(); sound.dispose();
});
