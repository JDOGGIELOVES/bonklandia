import type { WinTier } from '@/lib/slot-machine';

/**
 * Ambience: "Lobby Time" by Kevin MacLeod (incompetech.com)
 * Licensed under Creative Commons: By Attribution 3.0
 * https://creativecommons.org/licenses/by/3.0/
 */
export const CASINO_AMBIENCE_URL = '/audio/casino/lobby-time.mp3';
export const CASINO_AMBIENCE_CREDIT = 'Lobby Time · Kevin MacLeod (incompetech.com)';

const REEL_STOP_DELAYS_MS = [0, 400, 800] as const;
const SPIN_SFX_GAIN = 1.65;

export class CasinoAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private muted = false;
  private musicGain = 0.42;
  private sfxGain = 0.72;

  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicLoadPromise: Promise<AudioBuffer | null> | null = null;

  private reelStopTimers: ReturnType<typeof setTimeout>[] = [];
  private musicRunning = false;
  private unlocked = false;

  async ensureContext(): Promise<AudioContext | null> {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const Ctx = window.AudioContext
        ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;

      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
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
    if (muted) this.stopMusicLoop();
    else if (this.musicRunning) void this.startMusicLoop();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private applyGain() {
    if (!this.master || !this.musicBus || !this.sfxBus) return;
    const m = this.muted ? 0 : 1;
    this.master.gain.setTargetAtTime(m, this.ctx?.currentTime ?? 0, 0.04);
    this.musicBus.gain.setTargetAtTime(this.musicGain * m, this.ctx?.currentTime ?? 0, 0.04);
    this.sfxBus.gain.setTargetAtTime(this.sfxGain * m, this.ctx?.currentTime ?? 0, 0.04);
  }

  async startAmbience() {
    const ctx = await this.ensureContext();
    if (!ctx || this.muted) return;
    this.musicRunning = true;
    await this.startMusicLoop();
    this.playCasinoDoorChime();
  }

  stopAmbience() {
    this.musicRunning = false;
    this.stopMusicLoop();
    this.stopSpinTicks();
    this.clearReelStopTimers();
  }

  dispose() {
    this.stopAmbience();
    if (this.ctx) {
      void this.ctx.close();
    }
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.musicBuffer = null;
    this.musicLoadPromise = null;
    this.unlocked = false;
  }

  async playLeverPull() {
    const ctx = await this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;

    this.playNoiseBurst(ctx, this.sfxBus, t, 0.06, 180, 0.22, 'highpass');
    this.playTone(ctx, this.sfxBus, t, 120, 'sine', 0.18, 0.09, 80);
    this.playTone(ctx, this.sfxBus, t + 0.04, 880, 'triangle', 0.12, 0.05, 0.02);
    this.playTone(ctx, this.sfxBus, t + 0.08, 2400, 'sine', 0.08, 0.04, 0.015, -400);
  }

  async playSpinSequence(spinDurationMs: number, spinStartDelayMs: number) {
    await this.ensureContext();

    this.stopSpinTicks();
    this.clearReelStopTimers();

    let tickInterval = 52;
    let elapsed = 0;
    const maxElapsed = spinDurationMs + Math.max(...REEL_STOP_DELAYS_MS);

    const scheduleTick = () => {
      const tickTimer = setTimeout(() => {
        void this.playReelTick(tickInterval);
        elapsed += tickInterval;
        tickInterval = Math.min(210, tickInterval + 5 + elapsed * 0.018);
        if (elapsed < maxElapsed) scheduleTick();
      }, tickInterval);
      this.reelStopTimers.push(tickTimer);
    };

    const startTimer = setTimeout(scheduleTick, spinStartDelayMs);
    this.reelStopTimers.push(startTimer);

    REEL_STOP_DELAYS_MS.forEach((delay, index) => {
      const stopTimer = setTimeout(() => {
        void this.playReelStop(index);
      }, spinStartDelayMs + spinDurationMs + delay);
      this.reelStopTimers.push(stopTimer);
    });
  }

  async playWinResult(winTier: WinTier) {
    const ctx = await this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;

    switch (winTier) {
      case 'jackpot':
        this.playJackpotFanfare(ctx, t);
        break;
      case 'fam-triple':
        this.playWinArpeggio(ctx, t, [523.25, 659.25, 783.99, 1046.5], 0.55);
        this.scheduleCoinShower(ctx, t + 0.2, 10, 0.08);
        break;
      case 'bonk-single':
        this.playWinArpeggio(ctx, t, [659.25, 830.61, 987.77], 0.38);
        this.scheduleCoinShower(ctx, t + 0.15, 6, 0.1);
        break;
      case 'degen-triple':
        this.playTone(ctx, this.sfxBus, t, 440, 'triangle', 0.2, 0.12, 0.05);
        this.scheduleCoinShower(ctx, t + 0.1, 4, 0.12);
        break;
      case 'none':
        this.playTone(ctx, this.sfxBus, t, 220, 'sine', 0.14, 0.1, 0.06, -30);
        break;
    }
  }

  private async loadMusicBuffer(): Promise<AudioBuffer | null> {
    if (this.musicBuffer) return this.musicBuffer;
    if (this.musicLoadPromise) return this.musicLoadPromise;

    this.musicLoadPromise = (async () => {
      const ctx = await this.ensureContext();
      if (!ctx) return null;

      try {
        const response = await fetch(CASINO_AMBIENCE_URL);
        if (!response.ok) return null;
        const data = await response.arrayBuffer();
        this.musicBuffer = await ctx.decodeAudioData(data.slice(0));
        return this.musicBuffer;
      } catch {
        return null;
      }
    })();

    return this.musicLoadPromise;
  }

  private async startMusicLoop() {
    if (!this.ctx || !this.musicBus || this.musicSource || this.muted) return;

    const buffer = await this.loadMusicBuffer();
    if (!buffer || !this.ctx || !this.musicBus || this.muted) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.musicBus);
    source.start();
    this.musicSource = source;
  }

  private stopMusicLoop() {
    if (!this.musicSource) return;

    try {
      this.musicSource.stop();
    } catch {
      /* already stopped */
    }
    this.musicSource.disconnect();
    this.musicSource = null;
  }

  private async playReelTick(intervalMs: number) {
    const ctx = await this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    const g = SPIN_SFX_GAIN;
    const pitch = 900 + (220 - intervalMs) * 3;
    this.playNoiseBurst(ctx, this.sfxBus, t, 0.032, pitch, 0.22 * g, 'bandpass');
    this.playTone(ctx, this.sfxBus, t, pitch * 1.2, 'square', 0.16 * g, 0.028, 0.014);
    this.playTone(ctx, this.sfxBus, t, pitch * 0.55, 'sine', 0.1 * g, 0.022, 0.045, 0, 500);
  }

  private async playReelStop(reelIndex: number) {
    const ctx = await this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    const g = SPIN_SFX_GAIN;
    const thudHz = 180 - reelIndex * 25;

    this.playTone(ctx, this.sfxBus, t, thudHz, 'sine', 0.48 * g, 0.1, 0.1);
    this.playNoiseBurst(ctx, this.sfxBus, t, 0.08, 420 + reelIndex * 60, 0.4 * g, 'bandpass');
    this.playTone(ctx, this.sfxBus, t + 0.03, 620 + reelIndex * 90, 'triangle', 0.34 * g, 0.08, 0.06);
    this.playTone(ctx, this.sfxBus, t + 0.05, thudHz * 2.5, 'square', 0.14 * g, 0.04, 0.035, 0, 900);
  }

  private playJackpotFanfare(ctx: AudioContext, start: number) {
    if (!this.sfxBus) return;
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
    fanfare.forEach((freq, i) => {
      this.playTone(ctx, this.sfxBus!, start + i * 0.11, freq, 'sawtooth', 0.32, 0.18, 0.06, 0, 1200);
      this.playTone(ctx, this.sfxBus!, start + i * 0.11, freq * 0.5, 'square', 0.12, 0.1, 0.05, 0, 800);
    });

    this.playNoiseBurst(ctx, this.sfxBus, start + 0.55, 0.45, 2400, 0.35, 'highpass');
    this.scheduleCoinShower(ctx, start + 0.35, 18, 0.06);

    for (let i = 0; i < 8; i++) {
      this.playTone(
        ctx,
        this.sfxBus,
        start + 0.7 + i * 0.07,
        1400 + i * 110,
        'sine',
        0.1,
        0.06,
        0.03,
      );
    }
  }

  private playWinArpeggio(ctx: AudioContext, start: number, freqs: number[], volume: number) {
    if (!this.sfxBus) return;
    freqs.forEach((freq, i) => {
      this.playTone(ctx, this.sfxBus!, start + i * 0.09, freq, 'triangle', volume, 0.22, 0.04, 0, 1800);
      this.playTone(ctx, this.sfxBus!, start + i * 0.09, freq * 2, 'sine', volume * 0.35, 0.12, 0.03, 0, 2400);
    });
  }

  private scheduleCoinShower(ctx: AudioContext, start: number, count: number, spacing: number) {
    if (!this.sfxBus) return;
    for (let i = 0; i < count; i++) {
      const t = start + i * spacing;
      const freq = 1800 + Math.random() * 1400;
      this.playTone(ctx, this.sfxBus, t, freq, 'sine', 0.09, 0.05, 0.025);
      this.playTone(ctx, this.sfxBus, t + 0.01, freq * 1.5, 'triangle', 0.05, 0.03, 0.015);
    }
  }

  private playCasinoDoorChime() {
    if (!this.ctx || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    [659.25, 830.61, 987.77].forEach((freq, i) => {
      this.playTone(this.ctx!, this.sfxBus!, t + i * 0.14, freq, 'sine', 0.14, 0.35, 0.08, 0, 2000);
    });
  }

  private stopSpinTicks() {
    /* tick timers cleared via clearReelStopTimers during spin reset */
  }

  private clearReelStopTimers() {
    this.reelStopTimers.forEach(clearTimeout);
    this.reelStopTimers = [];
  }

  private playTone(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    freq: number,
    type: OscillatorType,
    volume: number,
    attack: number,
    release: number,
    detune = 0,
    filterHz?: number,
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.detune.setValueAtTime(detune, start);

    let output: AudioNode = gain;
    if (filterHz) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterHz, start);
      gain.connect(filter);
      output = filter;
    }

    osc.connect(gain);
    output.connect(dest);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + release);

    osc.start(start);
    osc.stop(start + attack + release + 0.05);
  }

  private playNoiseBurst(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    duration: number,
    filterFreq: number,
    volume: number,
    filterType: BiquadFilterType,
  ) {
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(start);
    src.stop(start + duration);
  }
}

let sharedEngine: CasinoAudioEngine | null = null;

export function getCasinoAudioEngine(): CasinoAudioEngine {
  if (!sharedEngine) sharedEngine = new CasinoAudioEngine();
  return sharedEngine;
}

export const CASINO_SPIN_START_DELAY_MS = 480;
export const CASINO_SPIN_DURATION_MS = 2600;