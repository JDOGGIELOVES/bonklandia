/**
 * Alice Room ambience — free music from Kevin MacLeod / incompetech.com (CC BY 3.0).
 * Beds morph as the trip deepens (layer → darker / stranger).
 * Lever/reel SFX still come from CasinoAudioEngine (Bandit).
 */

export type AliceAmbienceBed = {
  key: string;
  url: string;
  credit: string;
};

export const ALICE_AMBIENCE_ALTS = {
  folkRound: {
    key: 'folkRound',
    url: '/audio/alice/folk-round.mp3',
    credit: 'Folk Round · Kevin MacLeod (incompetech.com) · CC BY 3.0',
  },
  tellerOfTheTales: {
    key: 'tellerOfTheTales',
    url: '/audio/alice/teller-of-the-tales.mp3',
    credit: 'Teller of the Tales · Kevin MacLeod (incompetech.com) · CC BY 3.0',
  },
  dreamsBecomeReal: {
    key: 'dreamsBecomeReal',
    url: '/audio/alice/dreams-become-real.mp3',
    credit: 'Dreams Become Real · Kevin MacLeod (incompetech.com) · CC BY 3.0',
  },
  virtutesInstrumenti: {
    key: 'virtutesInstrumenti',
    url: '/audio/alice/virtutes-instrumenti.mp3',
    credit: 'Virtutes Instrumenti · Kevin MacLeod (incompetech.com) · CC BY 3.0',
  },
  oppressiveGloom: {
    key: 'oppressiveGloom',
    url: '/audio/alice/oppressive-gloom.mp3',
    credit: 'Oppressive Gloom · Kevin MacLeod (incompetech.com) · CC BY 3.0',
  },
  gymnopedieNo1: {
    key: 'gymnopedieNo1',
    url: '/audio/alice/gymnopedie-no1.mp3',
    credit: 'Gymnopedie No. 1 · Erik Satie / Kevin MacLeod (incompetech.com) · CC BY 3.0',
  },
} as const satisfies Record<string, AliceAmbienceBed>;

/** Primary bed URL (layer 1) — kept for simple importers. */
export const ALICE_AMBIENCE_URL = ALICE_AMBIENCE_ALTS.folkRound.url;

/** Default credit (layer 1). */
export const ALICE_AMBIENCE_CREDIT = ALICE_AMBIENCE_ALTS.folkRound.credit;

/**
 * Voyage depth → music bed.
 * Early: lively / folk · mid: dreamlike · late: heavy · boss: uncanny piano.
 */
export function ambienceBedForLevel(level: number): AliceAmbienceBed {
  const L = Math.max(1, Math.min(10, Math.floor(level)));
  if (L <= 2) return ALICE_AMBIENCE_ALTS.folkRound;
  if (L <= 4) return ALICE_AMBIENCE_ALTS.tellerOfTheTales;
  if (L <= 6) return ALICE_AMBIENCE_ALTS.dreamsBecomeReal;
  if (L <= 8) return ALICE_AMBIENCE_ALTS.virtutesInstrumenti;
  if (L === 9) return ALICE_AMBIENCE_ALTS.oppressiveGloom;
  return ALICE_AMBIENCE_ALTS.gymnopedieNo1;
}

export function aliceAmbienceCreditForLevel(level: number): string {
  return ambienceBedForLevel(level).credit;
}

export class AliceAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private muted = false;
  private unlocked = false;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicFade: GainNode | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
  private loadPromises = new Map<string, Promise<AudioBuffer | null>>();
  private activeBedKey: string | null = null;
  private musicRunning = false;
  private musicGeneration = 0;
  /** Bed level when no dialogue is speaking. */
  private musicGain = 0.26;
  /** Near-mute under entity VO. */
  private musicDuckGain = 0.04;
  private musicDucked = false;
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

  get activeCredit() {
    return ambienceBedForLevel(this.level).credit;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyGain();
    if (muted) this.stopAmbience();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private applyGain() {
    if (!this.master || !this.musicBus || !this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.muted ? 0 : 1;
    const depth = 1 - Math.min(0.18, Math.max(0, this.level - 1) * 0.015);
    const bed = this.musicDucked ? this.musicDuckGain : this.musicGain;
    this.master.gain.setTargetAtTime(m, t, 0.05);
    this.musicBus.gain.setTargetAtTime(bed * m * depth, t, this.musicDucked ? 0.06 : 0.14);
  }

  setLevel(level: number) {
    const next = Math.max(1, Math.min(10, Math.floor(level)));
    const prevBed = ambienceBedForLevel(this.level);
    this.level = next;
    this.applyGain();
    const bed = ambienceBedForLevel(next);
    if (this.musicRunning && bed.key !== prevBed.key) {
      void this.startMusicLoop(true);
    }
  }

  setMusicDucked(ducked: boolean) {
    this.musicDucked = ducked;
    this.applyGain();
  }

  get isMusicDucked() {
    return this.musicDucked;
  }

  get isMusicRunning() {
    return this.musicRunning && !!this.musicSource;
  }

  async startAmbience(level = 1) {
    const ctx = await this.ensureContext();
    if (!ctx || this.muted) return;

    const { setActiveMusicBed, getActiveMusicBed } = await import('@/lib/music-bed');
    setActiveMusicBed('alice');
    try {
      const { getCasinoAudioEngine } = await import('@/lib/casino-audio');
      getCasinoAudioEngine().stopMusicOnly();
    } catch {
      /* */
    }

    this.level = Math.max(1, Math.min(10, Math.floor(level)));
    this.musicRunning = true;
    this.applyGain();
    // Prefetch mid-trip beds so layer changes don’t hitch
    void this.prefetchNearbyBeds();
    await this.startMusicLoop(false);

    if (getActiveMusicBed() !== 'alice') {
      this.stopAmbience();
    }
  }

  stopAmbience() {
    this.musicRunning = false;
    this.musicDucked = false;
    this.musicGeneration += 1;
    this.activeBedKey = null;
    this.killMusicGraph();
  }

  private prefetchNearbyBeds() {
    const keys = new Set<string>();
    for (const L of [this.level, this.level + 1, this.level + 2, 10]) {
      keys.add(ambienceBedForLevel(L).url);
    }
    for (const url of keys) {
      void this.loadMusicBuffer(url);
    }
  }

  private async loadMusicBuffer(url: string): Promise<AudioBuffer | null> {
    const cached = this.bufferCache.get(url);
    if (cached) return cached;
    const inflight = this.loadPromises.get(url);
    if (inflight) return inflight;

    const promise = (async () => {
      const ctx = await this.ensureContext();
      if (!ctx) return null;
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.arrayBuffer();
        const buffer = await ctx.decodeAudioData(data.slice(0));
        this.bufferCache.set(url, buffer);
        return buffer;
      } catch {
        return null;
      } finally {
        this.loadPromises.delete(url);
      }
    })();

    this.loadPromises.set(url, promise);
    return promise;
  }

  /**
   * @param crossfade when true, fade out the current bed then fade in the next.
   */
  private async startMusicLoop(crossfade: boolean) {
    if (!this.ctx || !this.musicBus || this.muted || !this.musicRunning) return;

    const bed = ambienceBedForLevel(this.level);
    if (this.activeBedKey === bed.key && this.musicSource) {
      return;
    }

    const gen = ++this.musicGeneration;
    const buffer = await this.loadMusicBuffer(bed.url);
    if (
      gen !== this.musicGeneration ||
      !buffer ||
      !this.ctx ||
      !this.musicBus ||
      this.muted ||
      !this.musicRunning
    ) {
      return;
    }

    // Fade out previous source if any
    const prevFade = this.musicFade;
    const prevSource = this.musicSource;
    if (crossfade && prevFade && prevSource && this.ctx) {
      const t = this.ctx.currentTime;
      try {
        prevFade.gain.cancelScheduledValues(t);
        prevFade.gain.setValueAtTime(prevFade.gain.value, t);
        prevFade.gain.linearRampToValueAtTime(0, t + 1.1);
      } catch {
        /* */
      }
      window.setTimeout(() => {
        try {
          prevSource.stop();
        } catch {
          /* */
        }
        try {
          prevSource.disconnect();
        } catch {
          /* */
        }
        try {
          prevFade.disconnect();
        } catch {
          /* */
        }
      }, 1200);
      this.musicSource = null;
      this.musicFade = null;
    } else {
      this.killMusicGraph();
    }

    if (gen !== this.musicGeneration || !this.ctx || !this.musicBus) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const fade = this.ctx.createGain();
    fade.gain.value = 0;
    source.connect(fade);
    fade.connect(this.musicBus);
    const t = this.ctx.currentTime;
    fade.gain.linearRampToValueAtTime(1, t + (crossfade ? 1.4 : 1.8));
    source.start();
    this.musicSource = source;
    this.musicFade = fade;
    this.activeBedKey = bed.key;
    void this.prefetchNearbyBeds();
  }

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
    if (this.musicFade) {
      try {
        this.musicFade.disconnect();
      } catch {
        /* */
      }
      this.musicFade = null;
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
}

let aliceAudioSingleton: AliceAudioEngine | null = null;

export function getAliceAudioEngine(): AliceAudioEngine {
  if (!aliceAudioSingleton) aliceAudioSingleton = new AliceAudioEngine();
  return aliceAudioSingleton;
}
