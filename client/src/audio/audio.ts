/**
 * Lightweight synthesized audio (US4, FR-019) — no asset files. A gentle ambient
 * pad for atmosphere, a chime cue, and a pulsing incident alarm, all built with
 * the Web Audio API. Starts muted (browser autoplay policy); the HUD mute toggle
 * provides the required user gesture to start the AudioContext.
 */
class AudioEngine {
  private ctx?: AudioContext;
  private master?: GainNode;
  private ambientGain?: GainNode;
  private alarmGain?: GainNode;
  private alarmOsc?: OscillatorNode;
  private alarmLfo?: OscillatorNode;
  private started = false;
  private muted = true;

  /** Create the graph + start the ambient pad. Call from a user gesture. */
  private ensure(): void {
    if (this.started) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Ambient pad: a few detuned oscillators through a low-pass + slow tremolo.
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.12;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    this.ambientGain.connect(lp).connect(this.master);
    [110, 164.81, 220].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (i - 1) * 6;
      o.connect(this.ambientGain!);
      o.start();
    });
    const trem = ctx.createOscillator();
    const tremGain = ctx.createGain();
    trem.frequency.value = 0.15;
    tremGain.gain.value = 0.04;
    trem.connect(tremGain).connect(this.ambientGain.gain);
    trem.start();

    // Incident alarm: a pulsed tone, kept silent until an incident starts.
    this.alarmGain = ctx.createGain();
    this.alarmGain.gain.value = 0;
    this.alarmGain.connect(this.master);
    this.alarmOsc = ctx.createOscillator();
    this.alarmOsc.type = 'sawtooth';
    this.alarmOsc.frequency.value = 440;
    this.alarmOsc.connect(this.alarmGain);
    this.alarmOsc.start();
    this.alarmLfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    this.alarmLfo.frequency.value = 4;
    lfoGain.gain.value = 0; // ramped up when an incident is active
    this.alarmLfo.connect(lfoGain).connect(this.alarmGain.gain);
    this.alarmLfo.start();
    this.alarmLfoGain = lfoGain;

    this.started = true;
  }

  private alarmLfoGain?: GainNode;

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!muted) {
      this.ensure();
      void this.ctx?.resume();
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.6, this.ctx.currentTime, 0.2);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Short notification chime. */
  chime(): void {
    if (this.muted || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(1320, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.42);
  }

  /** Ramp the incident alarm on/off. */
  setIncident(active: boolean): void {
    if (!this.ctx || !this.alarmLfoGain) return;
    this.alarmLfoGain.gain.setTargetAtTime(active ? 0.18 : 0, this.ctx.currentTime, 0.3);
  }
}

export const audio = new AudioEngine();
