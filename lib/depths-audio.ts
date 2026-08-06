/**
 * Degen Depths music bed — exclusive loop while crawling chambers.
 * Uses an existing CC track already shipped under /audio/alice (no new binary).
 */

export const DEPTHS_AMBIENCE_URL = '/audio/alice/oppressive-gloom.mp3';
export const DEPTHS_AMBIENCE_CREDIT =
  'Oppressive Gloom · Kevin MacLeod (incompetech.com) · CC BY 3.0';

export class DepthsAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private muted = false;
  private unlocked = false;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicLoadPromise: Promise<AudioBuffer | null> | null = null;
  private musicRunning = false;
  private musicGeneration = 0;
  private musicGain = 0.22;

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

  get isMusicRunning() {
    return this.musicRunning && !!this.musicSource;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyGain();
    if (muted) this.stopAmbience();
  }

  private applyGain() {
    if (!this.master || !this.musicBus || !this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.muted ? 0 : 1;
    this.master.gain.setTargetAtTime(m, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.musicGain * m, t, 0.12);
  }

  async startAmbience() {
    const ctx = await this.ensureContext();
    if (!ctx || this.muted) return;

    const { setActiveMusicBed, getActiveMusicBed } = await import('@/lib/music-bed');
    setActiveMusicBed('depths');
    try {
      const { getCasinoAudioEngine } = await import('@/lib/casino-audio');
      getCasinoAudioEngine().stopMusicOnly();
    } catch {
      /* */
    }
    try {
      const { getAliceAudioEngine } = await import('@/lib/alice-audio');
      getAliceAudioEngine().stopAmbience();
    } catch {
      /* */
    }

    this.musicRunning = true;
    this.applyGain();
    await this.startMusicLoop();

    if (getActiveMusicBed() !== 'depths') {
      this.stopAmbience();
    }
  }

  stopAmbience() {
    this.musicRunning = false;
    this.musicGeneration += 1;
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch {
        /* */
      }
      try {
        this.musicSource.disconnect();
      } catch {
        /* */
      }
      this.musicSource = null;
    }
  }

  private async loadBuffer(): Promise<AudioBuffer | null> {
    if (this.musicBuffer) return this.musicBuffer;
    if (this.musicLoadPromise) return this.musicLoadPromise;
    this.musicLoadPromise = (async () => {
      const ctx = await this.ensureContext();
      if (!ctx) return null;
      try {
        const res = await fetch(DEPTHS_AMBIENCE_URL);
        if (!res.ok) return null;
        const data = await res.arrayBuffer();
        this.musicBuffer = await ctx.decodeAudioData(data.slice(0));
        return this.musicBuffer;
      } catch {
        return null;
      }
    })();
    return this.musicLoadPromise;
  }

  private async startMusicLoop() {
    if (!this.ctx || !this.musicBus || this.muted || !this.musicRunning) return;
    const gen = ++this.musicGeneration;
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch {
        /* */
      }
      this.musicSource = null;
    }
    const buffer = await this.loadBuffer();
    if (gen !== this.musicGeneration || !buffer || !this.ctx || !this.musicBus) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const fade = this.ctx.createGain();
    fade.gain.value = 0;
    source.connect(fade);
    fade.connect(this.musicBus);
    const t = this.ctx.currentTime;
    fade.gain.linearRampToValueAtTime(1, t + 1.6);
    source.start();
    this.musicSource = source;
  }
}

let depthsAudioSingleton: DepthsAudioEngine | null = null;

export function getDepthsAudioEngine(): DepthsAudioEngine {
  if (!depthsAudioSingleton) depthsAudioSingleton = new DepthsAudioEngine();
  return depthsAudioSingleton;
}
