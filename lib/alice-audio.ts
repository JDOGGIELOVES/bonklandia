/**
 * Alice Room trip ambience — procedural Web Audio.
 * Escalates by layer (playful drones → clinical → love pads → void).
 * Lever/reel SFX still come from the Bandit CasinoAudioEngine.
 */

export const ALICE_AMBIENCE_CREDIT = 'Procedural hyperspace ambience · Bonklandia';

type TripBed = {
  oscs: OscillatorNode[];
  gains: GainNode[];
  filters: BiquadFilterNode[];
  noise?: AudioBufferSourceNode;
  noiseGain?: GainNode;
  lfo?: OscillatorNode;
  lfoGain?: GainNode;
  master: GainNode;
};

export class AliceAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private muted = false;
  private unlocked = false;
  private bed: TripBed | null = null;
  private level = 1;
  private musicGain = 0.38;

  async ensureContext(): Promise<AudioContext | null> {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyGain();
    }
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        return this.ctx;
      }
    }
    this.unlocked = true;
    return this.ctx;
  }

  get isUnlocked() {
    return this.unlocked;
  }

  get isMuted() {
    return this.muted;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyGain();
    if (muted) this.stopBed();
    else if (this.unlocked) void this.startAmbience(this.level);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private applyGain() {
    if (!this.master || !this.musicBus || !this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.muted ? 0 : 1;
    this.master.gain.setTargetAtTime(m, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.musicGain * m, t, 0.08);
  }

  /** Depth 1–10 reshapes the trip bed. */
  setLevel(level: number) {
    this.level = Math.max(1, Math.min(10, Math.floor(level)));
    if (this.bed && this.ctx && !this.muted) {
      this.morphBed(this.level);
    }
  }

  async startAmbience(level = 1) {
    const ctx = await this.ensureContext();
    if (!ctx || !this.musicBus || this.muted) return;
    this.level = Math.max(1, Math.min(10, Math.floor(level)));
    this.stopBed();
    this.bed = this.buildBed(ctx, this.musicBus, this.level);
    this.morphBed(this.level);
  }

  stopAmbience() {
    this.stopBed();
  }

  private stopBed() {
    if (!this.bed || !this.ctx) {
      this.bed = null;
      return;
    }
    const t = this.ctx.currentTime;
    try {
      this.bed.master.gain.cancelScheduledValues(t);
      this.bed.master.gain.setValueAtTime(this.bed.master.gain.value, t);
      this.bed.master.gain.linearRampToValueAtTime(0, t + 0.4);
    } catch {
      // ignore
    }
    const bed = this.bed;
    this.bed = null;
    window.setTimeout(() => {
      try {
        bed.oscs.forEach(o => {
          try {
            o.stop();
          } catch {
            /* */
          }
          o.disconnect();
        });
        bed.noise?.stop();
        bed.noise?.disconnect();
        bed.lfo?.stop();
        bed.lfo?.disconnect();
        bed.gains.forEach(g => g.disconnect());
        bed.filters.forEach(f => f.disconnect());
        bed.noiseGain?.disconnect();
        bed.lfoGain?.disconnect();
        bed.master.disconnect();
      } catch {
        // ignore
      }
    }, 450);
  }

  private paramsForLevel(level: number) {
    // Escalating: playful → clinical → angelic → serpent → void
    if (level <= 2) {
      return {
        base: 55,
        intervals: [1, 1.5, 2.01, 3.02],
        types: ['sine', 'triangle', 'sine', 'sine'] as OscillatorType[],
        gains: [0.12, 0.07, 0.05, 0.03],
        filter: 900,
        noise: 0.012,
        lfoRate: 0.07,
        lfoDepth: 8,
        detune: 4,
      };
    }
    if (level <= 4) {
      return {
        base: 48,
        intervals: [1, 1.498, 2.0, 2.997],
        types: ['sine', 'triangle', 'square', 'sine'] as OscillatorType[],
        gains: [0.1, 0.05, 0.015, 0.04],
        filter: 520,
        noise: 0.02,
        lfoRate: 0.11,
        lfoDepth: 14,
        detune: 7,
      };
    }
    if (level <= 6) {
      return {
        base: 65,
        intervals: [1, 1.26, 1.5, 2.0, 2.52],
        types: ['sine', 'sine', 'triangle', 'sine', 'triangle'] as OscillatorType[],
        gains: [0.11, 0.06, 0.05, 0.04, 0.03],
        filter: 1400,
        noise: 0.008,
        lfoRate: 0.05,
        lfoDepth: 6,
        detune: 3,
      };
    }
    if (level <= 8) {
      return {
        base: 42,
        intervals: [1, 1.333, 1.666, 2.01, 2.666],
        types: ['sawtooth', 'sine', 'triangle', 'sine', 'sawtooth'] as OscillatorType[],
        gains: [0.04, 0.09, 0.05, 0.04, 0.02],
        filter: 380,
        noise: 0.028,
        lfoRate: 0.15,
        lfoDepth: 22,
        detune: 12,
      };
    }
    if (level === 9) {
      return {
        base: 58,
        intervals: [1, 1.25, 1.5, 2.0],
        types: ['sine', 'triangle', 'sine', 'sine'] as OscillatorType[],
        gains: [0.1, 0.06, 0.045, 0.035],
        filter: 1100,
        noise: 0.01,
        lfoRate: 0.04,
        lfoDepth: 5,
        detune: 2,
      };
    }
    // Level 10 — The Other: vast, sparse, low
    return {
      base: 32,
      intervals: [1, 1.01, 2.0, 3.0],
      types: ['sine', 'sine', 'sine', 'triangle'] as OscillatorType[],
      gains: [0.14, 0.08, 0.04, 0.02],
      filter: 220,
      noise: 0.035,
      lfoRate: 0.03,
      lfoDepth: 18,
      detune: 1,
    };
  }

  private buildBed(ctx: AudioContext, out: GainNode, level: number): TripBed {
    const p = this.paramsForLevel(level);
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(out);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = p.filter;
    filter.Q.value = 0.7;
    filter.connect(master);

    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    const filters: BiquadFilterNode[] = [filter];

    p.intervals.forEach((mult, i) => {
      const osc = ctx.createOscillator();
      osc.type = p.types[i] ?? 'sine';
      osc.frequency.value = p.base * mult;
      osc.detune.value = (i % 2 === 0 ? 1 : -1) * p.detune * i;

      const g = ctx.createGain();
      g.gain.value = p.gains[i] ?? 0.04;
      osc.connect(g);
      g.connect(filter);
      osc.start();
      oscs.push(osc);
      gains.push(g);
    });

    // Soft noise bed (air / static of the trip)
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 400 + level * 40;
    noiseFilter.Q.value = 0.4;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = p.noise;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start();
    filters.push(noiseFilter);

    // Slow LFO on filter for melting motion
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = p.lfoRate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = p.lfoDepth * 12;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    // Fade in
    const t = ctx.currentTime;
    master.gain.setValueAtTime(0, t);
    master.gain.linearRampToValueAtTime(1, t + 1.2);

    return { oscs, gains, filters, noise, noiseGain, lfo, lfoGain, master };
  }

  private morphBed(level: number) {
    if (!this.bed || !this.ctx) return;
    const p = this.paramsForLevel(level);
    const t = this.ctx.currentTime;
    const filter = this.bed.filters[0];
    if (filter) {
      filter.frequency.cancelScheduledValues(t);
      filter.frequency.setValueAtTime(filter.frequency.value, t);
      filter.frequency.linearRampToValueAtTime(p.filter, t + 2.5);
    }
    this.bed.oscs.forEach((osc, i) => {
      const mult = p.intervals[i];
      if (mult == null) return;
      const target = p.base * mult;
      try {
        osc.frequency.cancelScheduledValues(t);
        osc.frequency.setValueAtTime(osc.frequency.value, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, target), t + 2.8);
        osc.detune.setTargetAtTime((i % 2 === 0 ? 1 : -1) * p.detune * i, t, 0.8);
      } catch {
        // ignore
      }
    });
    this.bed.gains.forEach((g, i) => {
      const target = p.gains[i] ?? 0;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(target, t + 2.2);
    });
    if (this.bed.noiseGain) {
      this.bed.noiseGain.gain.setTargetAtTime(p.noise, t, 0.6);
    }
    if (this.bed.lfo) {
      this.bed.lfo.frequency.setTargetAtTime(p.lfoRate, t, 0.5);
    }
    if (this.bed.lfoGain) {
      this.bed.lfoGain.gain.setTargetAtTime(p.lfoDepth * 12, t, 0.5);
    }
  }
}

let aliceAudioSingleton: AliceAudioEngine | null = null;

export function getAliceAudioEngine(): AliceAudioEngine {
  if (!aliceAudioSingleton) aliceAudioSingleton = new AliceAudioEngine();
  return aliceAudioSingleton;
}
