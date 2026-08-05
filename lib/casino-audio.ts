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
  /** Full mute (both channels) — prefer musicMuted / sfxMuted. */
  private muted = false;
  private musicMuted = false;
  private sfxMuted = false;
  private musicGain = 0.42;
  /** Louder than music so lever/reels cut through lobby / Alice beds. */
  private sfxGain = 1.05;

  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicLoadPromise: Promise<AudioBuffer | null> | null = null;

  private reelStopTimers: ReturnType<typeof setTimeout>[] = [];
  private musicRunning = false;
  /** Bumps on every stop/start so concurrent startMusicLoop races can't leave orphan loops. */
  private musicGeneration = 0;
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
    return this.musicMuted && this.sfxMuted;
  }

  get isMusicMuted() {
    return this.musicMuted;
  }

  get isSfxMuted() {
    return this.sfxMuted;
  }

  setMusicMuted(muted: boolean) {
    this.musicMuted = muted;
    this.muted = this.musicMuted && this.sfxMuted;
    this.applyGain();
    if (muted) this.stopMusicOnly();
  }

  setSfxMuted(muted: boolean) {
    this.sfxMuted = muted;
    this.muted = this.musicMuted && this.sfxMuted;
    this.applyGain();
  }

  setMuted(muted: boolean) {
    this.musicMuted = muted;
    this.sfxMuted = muted;
    this.muted = muted;
    this.applyGain();
    // Never auto-restart on unmute (that stacked beds).
    if (muted) this.stopMusicOnly();
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  private applyGain() {
    if (!this.master || !this.musicBus || !this.sfxBus || !this.ctx) return;
    const t = this.ctx.currentTime;
    // Master stays open so either channel can play independently.
    this.master.gain.setTargetAtTime(1, t, 0.04);
    this.musicBus.gain.setTargetAtTime(this.musicMuted ? 0 : this.musicGain, t, 0.04);
    this.sfxBus.gain.setTargetAtTime(this.sfxMuted ? 0 : this.sfxGain, t, 0.04);
  }

  async startAmbience() {
    const ctx = await this.ensureContext();
    if (!ctx || this.musicMuted) return;
    // Exclusive bed: never layer over Alice Folk Round (or any other trip music).
    const { setActiveMusicBed, getActiveMusicBed } = await import('@/lib/music-bed');
    setActiveMusicBed('casino');
    try {
      const { getAliceAudioEngine } = await import('@/lib/alice-audio');
      const { stopAliceSpeech } = await import('@/lib/alice-voice');
      getAliceAudioEngine().stopAmbience();
      stopAliceSpeech();
    } catch {
      /* */
    }
    this.musicRunning = true;
    await this.startMusicLoop();
    // Another bed may have claimed while we loaded — drop if we lost exclusivity.
    if (getActiveMusicBed() !== 'casino') {
      this.stopMusicOnly();
      return;
    }
    if (this.musicRunning && !this.musicMuted && !this.sfxMuted) this.playCasinoDoorChime();
  }

  /** Stop lobby music only — keeps lever/reel SFX usable (Alice needs this). */
  stopMusicOnly() {
    this.musicRunning = false;
    this.musicGeneration += 1;
    this.killMusicGraph();
  }

  stopAmbience() {
    this.stopMusicOnly();
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

  /**
   * Iconic American one-armed-bandit lever:
   * grip → engage clunk → ratchet scrape down → bottom thunk → spring return.
   * Timed to the ~0.85s lever-arm-yank visual.
   * @param style prize = warmer/heavier; shield = brighter metallic + extra body
   */
  async playLeverPull(style: 'default' | 'prize' | 'shield' = 'default') {
    const ctx = await this.ensureContext();
    if (!ctx || !this.sfxBus || this.sfxMuted) return;
    this.applyGain();
    const t = ctx.currentTime;
    const bus = this.sfxBus;
    const g = style === 'shield' ? 1.28 : style === 'prize' ? 1.18 : 1;
    const p = style === 'shield' ? 1.1 : style === 'prize' ? 0.96 : 1;

    // 1. Hand on the ball
    this.playNoiseBurst(ctx, bus, t, 0.035, 1100 * p, 0.1 * g, 'bandpass');
    this.playTone(ctx, bus, t, 210 * p, 'sine', 0.07 * g, 0.008, 0.04);

    // 2. Mechanism engages — heavy “ka-chunk”
    const engage = t + 0.06;
    this.playTone(ctx, bus, engage, 78 * p, 'sine', 0.5 * g, 0.006, 0.15);
    this.playTone(ctx, bus, engage, 155 * p, 'triangle', 0.28 * g, 0.008, 0.11);
    this.playTone(ctx, bus, engage + 0.012, 310 * p, 'square', 0.1 * g, 0.004, 0.04, 0, 900);
    this.playNoiseBurst(ctx, bus, engage, 0.06, 280 * p, 0.38 * g, 'lowpass');

    // 3. Arm swings down — metal scrape + spring load
    const swingStart = t + 0.1;
    this.playLeverScrape(ctx, bus, swingStart, 0.26, 'down');
    this.playTone(ctx, bus, swingStart, 55 * p, 'sine', 0.18 * g, 0.05, 0.22, 0, 140);
    this.playTone(ctx, bus, swingStart, 140 * p, 'triangle', 0.12 * g, 0.04, 0.2, -80, 400);

    // 4. Ratchet teeth
    for (let i = 0; i < 8; i++) {
      const rt = swingStart + 0.018 + i * 0.028;
      this.playRatchetClick(ctx, bus, rt, (0.9 - i * 0.06) * g);
    }

    // 5. Bottom stop — solid metal THUNK (the money moment)
    const bottom = t + 0.36;
    this.playTone(ctx, bus, bottom, 58 * p, 'sine', 0.68 * g, 0.004, 0.2);
    this.playTone(ctx, bus, bottom, 110 * p, 'triangle', 0.4 * g, 0.005, 0.16);
    this.playTone(ctx, bus, bottom + 0.01, 230 * p, 'sine', 0.2 * g, 0.004, 0.09);
    this.playNoiseBurst(ctx, bus, bottom, 0.1, 170 * p, 0.55 * g, 'lowpass');
    this.playNoiseBurst(ctx, bus, bottom + 0.015, 0.055, 900 * p, 0.22 * g, 'highpass');
    this.playTone(ctx, bus, bottom + 0.03, 480 * p, 'sine', 0.1 * g, 0.01, 0.12, 0, 1200);
    // Extra cabinet body for Alice-style pulls
    if (style !== 'default') {
      this.playTone(ctx, bus, bottom + 0.02, 42, 'sine', 0.35 * g, 0.008, 0.22, 0, 120);
      this.playNoiseBurst(ctx, bus, bottom + 0.025, 0.08, 90, 0.28 * g, 'lowpass');
    }

    // 6. Spring tension
    this.playTone(ctx, bus, bottom + 0.08, 90 * p, 'sine', 0.07 * g, 0.04, 0.16, 0, 200);

    // 7. Spring return
    const ret = t + 0.54;
    this.playLeverScrape(ctx, bus, ret, 0.2, 'up');
    this.playSpringZing(ctx, bus, ret, 0.18);
    for (let i = 0; i < 5; i++) {
      this.playRatchetClick(ctx, bus, ret + 0.02 + i * 0.032, (0.4 - i * 0.04) * g);
    }

    // 8. Settles home
    const home = t + 0.78;
    this.playTone(ctx, bus, home, 130 * p, 'sine', 0.24 * g, 0.005, 0.09);
    this.playTone(ctx, bus, home + 0.008, 260 * p, 'triangle', 0.12 * g, 0.004, 0.05);
    this.playNoiseBurst(ctx, bus, home, 0.045, 500 * p, 0.2 * g, 'bandpass');
  }

  /** Sharp final clunk when reels settle — pairs with payline flash. */
  async playLandClunk(style: 'prize' | 'shield' | 'soft' = 'soft') {
    const ctx = await this.ensureContext();
    if (!ctx || !this.sfxBus || this.sfxMuted) return;
    this.applyGain();
    const t = ctx.currentTime;
    const bus = this.sfxBus;
    const g = style === 'soft' ? 0.55 : style === 'shield' ? 1.1 : 1;
    const f = style === 'shield' ? 1.12 : 1;
    this.playTone(ctx, bus, t, 70 * f, 'sine', 0.45 * g, 0.004, 0.14);
    this.playTone(ctx, bus, t, 140 * f, 'triangle', 0.28 * g, 0.005, 0.1);
    this.playNoiseBurst(ctx, bus, t, 0.06, 220 * f, 0.35 * g, 'lowpass');
    if (style !== 'soft') {
      this.playTone(ctx, bus, t + 0.04, 520 * f, 'sine', 0.12 * g, 0.004, 0.08, 0, 2000);
    }
  }

  async playSpinSequence(spinDurationMs: number, spinStartDelayMs: number) {
    const ctx = await this.ensureContext();
    if (!ctx || this.sfxMuted) return;
    this.applyGain();

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
    if (!ctx || !this.sfxBus || this.sfxMuted) return;
    this.applyGain();
    const t = ctx.currentTime;

    switch (winTier) {
      case 'jackpot':
        this.playJackpotFanfare(ctx, t);
        break;
      case 'fam-triple':
        this.playWinArpeggio(ctx, t, [523.25, 659.25, 783.99, 1046.5], 0.55);
        this.scheduleCoinShower(ctx, t + 0.2, 10, 0.08);
        break;
      case 'fam-any':
        this.playWinArpeggio(ctx, t, [523.25, 659.25, 783.99], 0.45);
        this.scheduleCoinShower(ctx, t + 0.18, 8, 0.09);
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
    if (!this.ctx || !this.musicBus || this.musicMuted || !this.musicRunning) return;

    const gen = ++this.musicGeneration;
    // Tear down any prior loop (including orphaned concurrent starts).
    this.killMusicGraph();

    const buffer = await this.loadMusicBuffer();
    if (
      gen !== this.musicGeneration ||
      !buffer ||
      !this.ctx ||
      !this.musicBus ||
      this.musicMuted ||
      !this.musicRunning
    ) {
      return;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.musicBus);
    source.start();
    this.musicSource = source;
  }

  private stopMusicLoop() {
    this.killMusicGraph();
  }

  /**
   * Hard-kill music: disconnect bus so orphan BufferSources can't keep playing,
   * then rebuild a clean music bus for the next loop.
   */
  private killMusicGraph() {
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch {
        /* already stopped */
      }
      try {
        this.musicSource.disconnect();
      } catch {
        /* */
      }
      this.musicSource = null;
    }
    if (!this.ctx || !this.master) return;
    try {
      this.musicBus?.disconnect();
    } catch {
      /* */
    }
    this.musicBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.applyGain();
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

  /** Short metallic ratchet tooth — the classic bandit “tick-tick” under the pull. */
  private playRatchetClick(ctx: AudioContext, dest: GainNode, start: number, weight: number) {
    const v = Math.max(0.04, weight);
    this.playNoiseBurst(ctx, dest, start, 0.018, 1600 + weight * 400, 0.16 * v, 'bandpass');
    this.playTone(ctx, dest, start, 900 + weight * 200, 'square', 0.07 * v, 0.002, 0.02, 0, 2800);
    this.playTone(ctx, dest, start, 180 + weight * 40, 'triangle', 0.09 * v, 0.002, 0.03);
  }

  /**
   * Metal-on-metal scrape of the arm in the housing.
   * Filter sweeps with the stroke so the mass of the lever is audible.
   */
  private playLeverScrape(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    duration: number,
    direction: 'down' | 'up',
  ) {
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Slightly colored noise (less pure white) reads more like metal friction
      data[i] = (Math.random() * 2 - 1) * (0.55 + 0.45 * Math.random());
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.8, start);
    const f0 = direction === 'down' ? 1400 : 400;
    const f1 = direction === 'down' ? 380 : 1600;
    filter.frequency.setValueAtTime(f0, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(f1, 80), start + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.03);
    gain.gain.setValueAtTime(0.2, start + duration * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(start);
    src.stop(start + duration + 0.02);
  }

  /** Rising spring “zing” as the lever snaps back upright. */
  private playSpringZing(ctx: AudioContext, dest: GainNode, start: number, duration: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, start);
    osc.frequency.exponentialRampToValueAtTime(980, start + duration);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, start);
    filter.frequency.exponentialRampToValueAtTime(4200, start + duration);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(start);
    osc.stop(start + duration + 0.03);

    // Harmonic shimmer over the spring
    this.playTone(ctx, dest, start + 0.02, 660, 'sine', 0.05, 0.02, duration * 0.7, 0, 3000);
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

/** Delay before reels start so the lever bottom-thunk can land first. */
export const CASINO_SPIN_START_DELAY_MS = 420;
export const CASINO_SPIN_DURATION_MS = 2600;
/** Full lever pull SFX + visual cycle. */
export const CASINO_LEVER_PULL_MS = 850;