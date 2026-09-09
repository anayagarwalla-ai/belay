import { TUNING } from '../tuning';
import type { Snapshot } from '../shared/protocol';

/** Gesture-started synthesis. No assets, microphone or server-side audio state. */
export class RopeSound {
  private context?: AudioContext;
  private master?: GainNode;
  private ropeGain?: GainNode;
  private filter?: BiquadFilterNode;
  private noise?: AudioBufferSourceNode;
  private voices = new Set<AudioScheduledSourceNode>();
  private epoch = -1;
  private cursor = -1;
  muted = false;
  async start() {
    try {
      if (!this.context) {
        const context = this.context = new AudioContext(), p = TUNING.sound;
        this.master = context.createGain(); this.master.gain.value = this.muted ? 0 : p.masterGain; this.master.connect(context.destination);
        const buffer = context.createBuffer(1, context.sampleRate * p.noiseSeconds, context.sampleRate);
        const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.noise = context.createBufferSource(); this.noise.buffer = buffer; this.noise.loop = true;
        this.filter = context.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = p.ropeBaseHz;
        this.ropeGain = context.createGain(); this.ropeGain.gain.value = 0;
        this.noise.connect(this.filter).connect(this.ropeGain).connect(this.master); this.noise.start();
      }
      await this.context.resume();
    } catch { /* Unavailable audio must not prevent playing. */ }
  }
  setMuted(muted: boolean) { this.muted = muted; if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : TUNING.sound.masterGain, this.context.currentTime, TUNING.sound.envelopeAttackSeconds); }
  quiet() { for (const voice of this.voices) voice.stop(); this.voices.clear(); if (this.ropeGain && this.context) this.ropeGain.gain.setTargetAtTime(0, this.context.currentTime, TUNING.sound.envelopeAttackSeconds); }
  observe(state: Snapshot) {
    if (state.epoch !== this.epoch) { this.epoch = state.epoch; this.cursor = state.events?.at(-1)?.id ?? -1; }
    const tension = state.paused || state.run?.status !== 'active' ? 0 : Math.max(0, Math.min(1, state.rope.tension));
    if (this.context && this.ropeGain && this.filter) {
      const t = this.context.currentTime;
      this.ropeGain.gain.setTargetAtTime(tension * tension * TUNING.sound.ropeGain, t, TUNING.sound.envelopeAttackSeconds);
      this.filter.frequency.setTargetAtTime(TUNING.sound.ropeBaseHz + tension * TUNING.sound.ropeRangeHz, t, TUNING.sound.envelopeAttackSeconds);
    }
    const fresh = state.events?.filter(event => event.id > this.cursor) ?? [];
    this.cursor = Math.max(this.cursor, ...fresh.map(event => event.id));
    if (fresh.some(event => event.kind === 'catch')) this.note(false);
    else if (fresh.some(event => event.kind === 'recovery' || event.kind === 'complete')) this.note(true);
  }
  private note(recovered: boolean) {
    if (this.muted || this.voices.size >= TUNING.hardCap || !this.context || !this.master || this.context.state !== 'running') return;
    const p = TUNING.sound, context = this.context, t = context.currentTime;
    const oscillator = context.createOscillator(), gain = context.createGain();
    const duration = recovered ? p.recoverySeconds : p.catchSeconds;
    oscillator.type = recovered ? 'triangle' : 'sine'; oscillator.frequency.setValueAtTime(recovered ? p.recoveryHz : p.catchStartHz, t);
    if (!recovered) oscillator.frequency.exponentialRampToValueAtTime(p.catchEndHz, t + duration);
    gain.gain.setValueAtTime(p.minimumGain, t); gain.gain.exponentialRampToValueAtTime(1, t + p.envelopeAttackSeconds);
    gain.gain.exponentialRampToValueAtTime(p.minimumGain, t + duration);
    this.voices.add(oscillator); oscillator.connect(gain).connect(this.master); oscillator.start(); oscillator.stop(t + duration);
    oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
  }
  dispose() { this.quiet(); this.noise?.stop(); this.noise?.disconnect(); this.filter?.disconnect(); this.ropeGain?.disconnect(); this.master?.disconnect(); void this.context?.close().catch(() => {}); this.context = undefined; }
}
