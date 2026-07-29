/**
 * Alice Room ambience — free music from the same family as Bandit music:
 * Kevin MacLeod / incompetech.com (Creative Commons BY 3.0).
 *
 * Primary: Folk Round — lively tempo / pulse for Machine Elves and deeper layers.
 * Lever/reel SFX still come from CasinoAudioEngine (Bandit).
 */

/** Primary bed — more rhythm than sparse piano */
export const ALICE_AMBIENCE_URL = '/audio/alice/folk-round.mp3';

/**
 * Attribution (CC BY 3.0) — required when using Kevin MacLeod / incompetech.
 */
export const ALICE_AMBIENCE_CREDIT =
  'Folk Round · Kevin MacLeod (incompetech.com) · CC BY 3.0';

/** Optional beds for future layer morphing / A-B */
export const ALICE_AMBIENCE_ALTS = {
  folkRound: {
    url: '/audio/alice/folk-round.mp3',
    credit: 'Folk Round · Kevin MacLeod (incompetech.com) · CC BY 3.0',
  },
  tellerOfTheTales: {
    url: '/audio/alice/teller-of-the-tales.mp3',
    credit: 'Teller of the Tales · Kevin MacLeod (incompetech.com) · CC BY 3.0',
  },
  gymnopedieNo1: {
    url: '/audio/alice/gymnopedie-no1.mp3',
    credit: 'Gymnopedie No. 1 · Erik Satie / Kevin MacLeod (incompetech.com) · CC BY 3.0',
  },
  dreamsBecomeReal: {
    url: '/audio/alice/dreams-become-real.mp3',
    credit: 'Dreams Become Real · Kevin MacLeod (incompetech.com) · CC BY 3.0',
  },
  virtutesInstrumenti: {
    url: '/audio/alice/virtutes-instrumenti.mp3',
    credit: 'Virtutes Instrumenti · Kevin MacLeod (incompetech.com) · CC BY 3.0',
  },
  oppressiveGloom: {
    url: '/audio/alice/oppressive-gloom.mp3',
    credit: 'Oppressive Gloom · Kevin MacLeod (incompetech.com) · CC BY 3.0',
  },
} as const;

export class AliceAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private muted = false;
  private unlocked = false;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicLoadPromise: Promise<AudioBuffer | null> | null = null;
  private musicRunning = false;
  private musicGain = 0.4;
  private level = 1;

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
    if (muted) this.stopMusicLoop();
    else if (this.musicRunning) void this.startMusicLoop();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private applyGain() {
    if (!this.master || !this.musicBus || !this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.muted ? 0 : 1;
    // Slightly lower on late trip layers for intimacy / void feel
    const depth = 1 - Math.min(0.18, Math.max(0, this.level - 1) * 0.015);
    this.master.gain.setTargetAtTime(m, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.musicGain * m * depth, t, 0.12);
  }

  /** Soft volume morph only — classical track stays the same bed. */
  setLevel(level: number) {
    this.level = Math.max(1, Math.min(10, Math.floor(level)));
    this.applyGain();
  }

  async startAmbience(level = 1) {
    const ctx = await this.ensureContext();
    if (!ctx || this.muted) return;
    this.level = Math.max(1, Math.min(10, Math.floor(level)));
    this.musicRunning = true;
    this.applyGain();
    await this.startMusicLoop();
  }

  stopAmbience() {
    this.musicRunning = false;
    this.stopMusicLoop();
  }

  private async loadMusicBuffer(): Promise<AudioBuffer | null> {
    if (this.musicBuffer) return this.musicBuffer;
    if (this.musicLoadPromise) return this.musicLoadPromise;

    this.musicLoadPromise = (async () => {
      const ctx = await this.ensureContext();
      if (!ctx) return null;
      try {
        const response = await fetch(ALICE_AMBIENCE_URL);
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
    // Gentle fade-in so Satie doesn’t slam in
    const fade = this.ctx.createGain();
    fade.gain.value = 0;
    source.connect(fade);
    fade.connect(this.musicBus);
    const t = this.ctx.currentTime;
    fade.gain.linearRampToValueAtTime(1, t + 2.5);
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
    try {
      this.musicSource.disconnect();
    } catch {
      /* */
    }
    this.musicSource = null;
  }
}

let aliceAudioSingleton: AliceAudioEngine | null = null;

export function getAliceAudioEngine(): AliceAudioEngine {
  if (!aliceAudioSingleton) aliceAudioSingleton = new AliceAudioEngine();
  return aliceAudioSingleton;
}
