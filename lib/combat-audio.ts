export type CombatAttackSound = 'melee' | 'melee_heavy' | 'arcane' | 'heal' | 'buff' | 'chaos';

export type EnemyAttackSound =
  | 'fud'
  | 'panic'
  | 'rug'
  | 'liquidation'
  | 'shill'
  | 'mystic'
  | 'cope'
  | 'dump';

const ENEMY_SOUND: Record<string, EnemyAttackSound> = {
  fudder: 'fud',
  'non-believer': 'fud',
  boomer: 'fud',
  ngmi: 'fud',
  jeeter: 'panic',
  'paper-hands': 'panic',
  scammer: 'rug',
  leverage: 'liquidation',
  shill: 'shill',
  astrologer: 'mystic',
  copium: 'cope',
  airdrop: 'dump',
  dooge: 'cope',
  'pepe-unbothered': 'fud',
  hatdog: 'shill',
  flokir: 'liquidation',
  popcatto: 'dump',
  mewling: 'panic',
  'based-brett': 'shill',
  mogger: 'mystic',
  'giga-shiba': 'rug',
  'copycat-council': 'fud',
};

export function getEnemySoundType(enemyId: string): EnemyAttackSound {
  return ENEMY_SOUND[enemyId] ?? 'fud';
}

export type EnemyHitOptions = {
  heavy?: boolean;
  heal?: boolean;
};

const ABILITY_SOUND: Record<string, CombatAttackSound> = {
  'bonk-blitz': 'melee_heavy',
  'head-bonk': 'melee',
  'rally-cry': 'buff',
  'frequency-flow': 'arcane',
  'hype-mixtape': 'buff',
  'sonic-boom': 'arcane',
  'chaos-bonk': 'chaos',
  'send-it': 'melee_heavy',
  'vibe-check': 'melee',
  'calculated-strike': 'melee',
  'diamond-hands': 'melee',
  'read-the-room': 'melee',
  'comfort-bonk': 'heal',
  'fam-hug': 'heal',
  'pep-talk': 'buff',
  'guardian-strike': 'melee_heavy',
  'shield-up': 'melee',
  'ground-pound': 'melee_heavy',
};

export function getAbilitySoundType(abilityId: string): CombatAttackSound {
  return ABILITY_SOUND[abilityId] ?? 'melee';
}

export class CombatAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private reverbBus: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;
  private muted = false;
  private sfxGain = 0.88;
  private unlocked = false;

  async ensureContext(): Promise<AudioContext | null> {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const Ctx = window.AudioContext
        ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;

      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.reverbSend = this.ctx.createGain();
      this.reverbBus = this.ctx.createConvolver();
      this.reverbBus.buffer = this.buildReverbImpulse(this.ctx);
      this.reverbSend.gain.value = 0.32;
      this.sfxBus.connect(this.master);
      this.reverbBus.connect(this.reverbSend);
      this.reverbSend.connect(this.master);
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

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyGain();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  get isMuted() {
    return this.muted;
  }

  private applyGain() {
    if (!this.master || !this.sfxBus) return;
    const m = this.muted ? 0 : 1;
    this.master.gain.setTargetAtTime(m, this.ctx?.currentTime ?? 0, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.sfxGain * m, this.ctx?.currentTime ?? 0, 0.03);
  }

  async playAttackWindup(soundType: CombatAttackSound) {
    const ctx = await this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;

    switch (soundType) {
      case 'arcane':
        this.playFlute(ctx, this.sfxBus, t, 587.33, 0.09, 0.18, true);
        break;
      case 'heal':
        this.playFlute(ctx, this.sfxBus, t, 659.25, 0.07, 0.14, true);
        break;
      case 'chaos':
        this.playNoiseSweep(ctx, this.sfxBus, t, 0.1, 800, 180, 0.12);
        break;
      case 'melee_heavy':
        this.playNoiseSweep(ctx, this.sfxBus, t, 0.18, 700, 140, 0.14);
        break;
      default:
        this.playNoiseSweep(ctx, this.sfxBus, t, 0.14, 900, 160, 0.1);
    }
  }

  async playPlayerHit(soundType: CombatAttackSound, isCrit: boolean, damage: number) {
    const ctx = await this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    const power = Math.min(1.35, 0.75 + damage / 120);

    if (isCrit) this.playDiceRoll(ctx, t - 0.08);

    switch (soundType) {
      case 'arcane':
        this.playArcaneImpact(ctx, t, power * (isCrit ? 1.3 : 1));
        break;
      case 'heal':
        this.playHealChime(ctx, t);
        if (damage > 0) this.playMeleeImpact(ctx, t + 0.05, power * 0.55);
        break;
      case 'buff':
        this.playBuffFanfare(ctx, t);
        if (damage > 0) this.playMeleeImpact(ctx, t + 0.08, power * 0.65);
        break;
      case 'chaos':
        this.playChaosImpact(ctx, t, power);
        break;
      case 'melee_heavy':
        this.playMeleeImpact(ctx, t, power * 1.25, true);
        break;
      default:
        this.playMeleeImpact(ctx, t, power, isCrit);
    }

    if (isCrit) {
      this.playBell(ctx, this.sfxBus, t + 0.1, 880, 0.22, 0.5);
    }
  }

  async playEnemyWindup(enemyId: string) {
    const ctx = await this.ensureContext();
    const bus = this.sfxBus;
    if (!ctx || !bus) return;
    const t = ctx.currentTime;
    const sound = getEnemySoundType(enemyId);

    this.playSubRumble(ctx, bus, t, 0.34, 0.14);
    this.playNoiseSweep(ctx, bus, t, 0.28, 520, 72, 0.12);

    switch (sound) {
      case 'fud':
        this.playDissonantPad(ctx, bus, t + 0.04, [220, 233.08, 261.63], 0.1, 0.32);
        this.playTickerClicks(ctx, bus, t + 0.08, 6, 0.07);
        this.playNoiseSweep(ctx, bus, t + 0.12, 0.22, 1400, 320, 0.08);
        break;
      case 'panic':
        this.playHeartbeat(ctx, bus, t + 0.06, 4, 0.11);
        this.playRisingWhistle(ctx, bus, t + 0.1, 420, 1180, 0.1, 0.28);
        break;
      case 'rug':
        this.playChainRattle(ctx, bus, t + 0.05, 0.22, 0.1);
        this.playSubRumble(ctx, bus, t + 0.08, 0.42, 0.18);
        this.playTone(ctx, bus, t + 0.14, 52, 'sine', 0.12, 0.12, 0.22, 0, 160);
        break;
      case 'liquidation':
        this.playMarginAlarm(ctx, bus, t + 0.06, 3, 0.09);
        this.playNoiseSweep(ctx, bus, t + 0.1, 0.35, 90, 48, 0.16);
        break;
      case 'shill':
        this.playMegaphoneBlast(ctx, bus, t + 0.05, 0.14, 0.11);
        this.playRisingWhistle(ctx, bus, t + 0.12, 280, 920, 0.08, 0.24);
        break;
      case 'mystic':
        this.playBell(ctx, bus, t + 0.08, 523.25, 0.08, 0.4);
        this.playFlute(ctx, bus, t + 0.12, 392, 0.07, 0.3, true);
        this.playSparkle(ctx, bus, t + 0.18, 4, 0.06);
        break;
      case 'cope':
        this.playCopeInhale(ctx, bus, t + 0.06, 0.26, 0.1);
        break;
      case 'dump':
        this.playCoinScatter(ctx, bus, t + 0.08, 8, 0.08);
        break;
    }
  }

  async playEnemyHit(damage: number, enemyId: string, options: EnemyHitOptions = {}) {
    const ctx = await this.ensureContext();
    const bus = this.sfxBus;
    if (!ctx || !bus) return;
    const t = ctx.currentTime;
    const sound = getEnemySoundType(enemyId);
    const heavy = options.heavy ?? damage >= 24;
    const power = Math.min(1.45, 0.72 + damage / 70 + (heavy ? 0.18 : 0));

    if (options.heal) {
      this.playCopeInhale(ctx, bus, t, 0.32, 0.12);
      this.playHealChime(ctx, t + 0.08);
      return;
    }

    this.playEnemyBodyImpact(ctx, bus, t, power, heavy);
    this.playSubThump(ctx, bus, t, heavy ? 48 : 62, power * (heavy ? 1.15 : 1));

    switch (sound) {
      case 'fud':
        this.playStaticSlap(ctx, bus, t + 0.02, power, 0.14);
        this.playDissonantPad(ctx, bus, t + 0.05, [196, 207.65, 233.08], 0.08 * power, 0.22);
        this.playTickerClicks(ctx, bus, t + 0.08, 4, 0.05 * power);
        break;
      case 'panic':
        this.playPaperRustle(ctx, bus, t + 0.03, power, 0.12);
        this.playRisingWhistle(ctx, bus, t + 0.04, 880, 320, 0.07 * power, 0.18, true);
        this.playTone(ctx, bus, t + 0.06, 1240, 'sine', 0.06 * power, 0.01, 0.08, 0, 2800);
        break;
      case 'rug':
        this.playChainRattle(ctx, bus, t + 0.04, 0.18, 0.12 * power);
        this.playCoinScatter(ctx, bus, t + 0.06, heavy ? 10 : 6, 0.1 * power);
        this.playTone(ctx, bus, t + 0.02, 78, 'sawtooth', 0.1 * power, 0.02, 0.14, -80, 220);
        break;
      case 'liquidation':
        this.playMarginAlarm(ctx, bus, t + 0.04, heavy ? 4 : 2, 0.1 * power);
        this.playGlassShatter(ctx, bus, t + 0.03, power, 0.14);
        this.playSubThump(ctx, bus, t + 0.08, 38, power * 1.2);
        break;
      case 'shill':
        this.playMegaphoneBlast(ctx, bus, t + 0.02, 0.1, 0.14 * power);
        this.playRapidStings(ctx, bus, t + 0.05, heavy ? 5 : 3, 0.07 * power);
        break;
      case 'mystic':
        this.playSparkle(ctx, bus, t + 0.04, heavy ? 7 : 5, 0.08 * power);
        this.playArcaneImpact(ctx, t + 0.02, power * 0.85);
        break;
      case 'cope':
        this.playCopeInhale(ctx, bus, t + 0.04, 0.2, 0.09 * power);
        this.playStaticSlap(ctx, bus, t + 0.06, power * 0.7, 0.08);
        break;
      case 'dump':
        this.playCoinScatter(ctx, bus, t + 0.02, heavy ? 14 : 9, 0.12 * power);
        this.playTone(ctx, bus, t + 0.05, 180, 'triangle', 0.1 * power, 0.02, 0.1, 0, 600);
        break;
    }

    this.sendToReverb(ctx, bus, t, power * 0.35, heavy ? 0.45 : 0.3);
  }

  async playEnemyCopeHeal(enemyId: string) {
    await this.playEnemyHit(0, enemyId, { heal: true });
  }

  async playBlock() {
    const ctx = await this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    this.playTone(ctx, this.sfxBus, t, 620, 'triangle', 0.28, 0.008, 0.2, 0, 2400);
    this.playTone(ctx, this.sfxBus, t + 0.02, 940, 'sine', 0.18, 0.006, 0.18, 0, 3000);
    this.playNoiseBurst(ctx, this.sfxBus, t, 0.05, 1800, 0.12, 'bandpass');
  }

  /** Short sting when a single wave degen is bonked out. */
  async playWaveClear() {
    const ctx = await this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      this.playBell(ctx, this.sfxBus!, t + i * 0.09, freq, 0.14, 0.38);
    });
    this.playBonkImpact(ctx, t + 0.15, 0.55, false);
  }

  /** Epic fanfare when all 12 waves are cleared. */
  async playRunComplete() {
    const ctx = await this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      this.playBell(ctx, this.sfxBus!, t + i * 0.11, freq, 0.2, 0.6);
    });
    this.playBonkImpact(ctx, t + 0.35, 1.1, true);
    this.playDiceRoll(ctx, t + 0.5, true);
    const bus = this.sfxBus;
    if (bus) this.playFlute(ctx, bus, t + 0.55, 880, 0.1, 0.45);
  }

  /** @deprecated Use playWaveClear or playRunComplete */
  async playVictory() {
    await this.playWaveClear();
  }

  /** New degen steps in — intensity rises with wave number. */
  async playWaveEnter(wave: number) {
    const ctx = await this.ensureContext();
    const bus = this.sfxBus;
    if (!ctx || !bus) return;
    const t = ctx.currentTime;
    const intensity = Math.min(1.4, 0.65 + wave * 0.06);

    this.playNoiseSweep(ctx, bus, t, 0.35, 180 + wave * 12, 55, 0.14 * intensity);
    this.playTone(ctx, bus, t + 0.12, 72 + wave * 4, 'sine', 0.16 * intensity, 0.08, 0.2, 0, 220);
    this.playBell(ctx, bus, t + 0.22, 220 + wave * 18, 0.1 * intensity, 0.35);
    if (wave >= 8) {
      this.playFlute(ctx, bus, t + 0.28, 330 + wave * 10, 0.07 * intensity, 0.25, true);
    }
  }

  /** Run It Back — valley escalates, new run begins. */
  async playRunEscalation(run: number) {
    const ctx = await this.ensureContext();
    const bus = this.sfxBus;
    if (!ctx || !bus) return;
    const t = ctx.currentTime;
    const power = Math.min(1.5, 0.85 + (run - 1) * 0.12);

    this.playNoiseSweep(ctx, bus, t, 0.4, 90, 420 + run * 40, 0.18 * power);
    [392, 523.25, 659.25].forEach((freq, i) => {
      this.playFlute(ctx, bus, t + 0.15 + i * 0.1, freq, 0.1 * power, 0.28);
    });
    this.playBell(ctx, bus, t + 0.5, 587.33 + run * 20, 0.16 * power, 0.55);
    this.playBonkImpact(ctx, t + 0.55, power, true);
  }

  /** Player bonked out — trail off toward the casino. */
  async playDefeat() {
    const ctx = await this.ensureContext();
    const bus = this.sfxBus;
    if (!ctx || !bus) return;
    const t = ctx.currentTime;

    this.playBonkImpact(ctx, t, 0.7, true);
    [440, 349.23, 293.66].forEach((freq, i) => {
      this.playFlute(ctx, bus, t + 0.2 + i * 0.14, freq, 0.09, 0.35, i === 0);
    });
    this.playBell(ctx, bus, t + 0.55, 196, 0.12, 0.5);
  }

  private buildReverbImpulse(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.55);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2.2);
        data[i] = (Math.random() * 2 - 1) * decay;
      }
    }

    return impulse;
  }

  private sendToReverb(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    power: number,
    duration: number,
  ) {
    if (!this.reverbBus || !this.reverbSend) return;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.pow(1 - i / bufferSize, 1.6);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    dry.gain.value = power * 0.55;
    wet.gain.value = power * 0.85;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, start);
    filter.Q.setValueAtTime(0.7, start);

    src.connect(filter);
    filter.connect(dry);
    filter.connect(wet);
    dry.connect(dest);
    wet.connect(this.reverbBus);

    src.start(start);
    src.stop(start + duration);
  }

  private playSubRumble(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    duration: number,
    volume: number,
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(42, start);
    osc.frequency.exponentialRampToValueAtTime(28, start + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, start);

    osc.connect(gain);
    gain.connect(filter);
    filter.connect(dest);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), start + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private playSubThump(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    freq: number,
    power: number,
  ) {
    this.playBonkThud(ctx, dest, start, freq * 2.2, freq, 0.34 * power, 0.28);
    this.playTone(ctx, dest, start + 0.01, freq * 0.5, 'sine', 0.16 * power, 0.004, 0.18, 0, 180);
  }

  private playEnemyBodyImpact(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    power: number,
    heavy: boolean,
  ) {
    this.playNoiseBurst(ctx, dest, start, 0.035, heavy ? 1800 : 2400, 0.2 * power, 'highpass');
    this.playBonkThud(ctx, dest, start, heavy ? 180 : 220, heavy ? 58 : 72, 0.38 * power, heavy ? 0.3 : 0.22);
    this.playBonkRing(ctx, dest, start + 0.025, heavy ? 92 : 118, 0.14 * power, heavy ? 0.32 : 0.24);
    if (heavy) {
      this.playNoiseBurst(ctx, dest, start + 0.02, 0.08, 520, 0.22 * power, 'bandpass');
    }
  }

  private playDissonantPad(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    freqs: number[],
    volume: number,
    decay: number,
  ) {
    freqs.forEach((freq, i) => {
      const detune = (i - 1) * 11;
      this.playTone(ctx, dest, start, freq, 'sawtooth', volume * 0.55, 0.06, decay, detune, 680);
      this.playTone(ctx, dest, start, freq, 'triangle', volume * 0.35, 0.05, decay * 0.9, detune * 1.2, 520);
    });
  }

  private playTickerClicks(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    count: number,
    volume: number,
  ) {
    for (let i = 0; i < count; i++) {
      const t = start + i * 0.045;
      this.playNoiseBurst(ctx, dest, t, 0.012, 2200 + i * 80, volume, 'highpass');
      this.playTone(ctx, dest, t, 1800 + i * 60, 'square', volume * 0.35, 0.002, 0.02, 0, 4000);
    }
  }

  private playHeartbeat(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    beats: number,
    volume: number,
  ) {
    for (let i = 0; i < beats; i++) {
      const t = start + i * 0.11;
      this.playSubThump(ctx, dest, t, 58 + i * 2, volume * (1 - i * 0.08));
      this.playTone(ctx, dest, t + 0.04, 48, 'sine', volume * 0.45, 0.003, 0.06, 0, 140);
    }
  }

  private playRisingWhistle(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    fromHz: number,
    toHz: number,
    volume: number,
    duration: number,
    descending = false,
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    if (descending) {
      osc.frequency.setValueAtTime(fromHz, start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(toHz, 40), start + duration);
    } else {
      osc.frequency.setValueAtTime(fromHz, start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(toHz, 40), start + duration);
    }

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime((fromHz + toHz) / 2, start);
    filter.Q.setValueAtTime(2.5, start);

    osc.connect(gain);
    gain.connect(filter);
    filter.connect(dest);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), start + duration * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private playChainRattle(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    duration: number,
    volume: number,
  ) {
    const hits = Math.floor(duration / 0.028);
    for (let i = 0; i < hits; i++) {
      const t = start + i * 0.028;
      this.playNoiseBurst(ctx, dest, t, 0.018, 900 + Math.random() * 600, volume * 0.7, 'bandpass');
      this.playBell(ctx, dest, t, 620 + Math.random() * 280, volume * 0.25, 0.08);
    }
  }

  private playMarginAlarm(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    beeps: number,
    volume: number,
  ) {
    for (let i = 0; i < beeps; i++) {
      const t = start + i * 0.13;
      this.playTone(ctx, dest, t, 880, 'square', volume, 0.004, 0.06, 0, 2200);
      this.playTone(ctx, dest, t + 0.07, 660, 'square', volume * 0.7, 0.004, 0.05, 0, 1800);
    }
  }

  private playMegaphoneBlast(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    duration: number,
    volume: number,
  ) {
    this.playNoiseBurst(ctx, dest, start, duration, 420, volume, 'bandpass');
    this.playTone(ctx, dest, start, 240, 'sawtooth', volume * 0.55, 0.02, duration * 0.85, 0, 900);
    this.playTone(ctx, dest, start + 0.02, 480, 'triangle', volume * 0.35, 0.015, duration * 0.7, 8, 1400);
  }

  private playSparkle(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    count: number,
    volume: number,
  ) {
    for (let i = 0; i < count; i++) {
      const t = start + i * 0.05;
      const freq = 1200 + Math.random() * 1800;
      this.playBell(ctx, dest, t, freq, volume, 0.18);
      this.playTone(ctx, dest, t + 0.01, freq * 1.5, 'sine', volume * 0.4, 0.003, 0.06, 0, 3200);
    }
  }

  private playCopeInhale(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    duration: number,
    volume: number,
  ) {
    this.playNoiseSweep(ctx, dest, start, duration, 180, 680, volume);
    this.playFlute(ctx, dest, start + duration * 0.35, 330, volume * 0.45, duration * 0.55, true);
  }

  private playCoinScatter(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    count: number,
    volume: number,
  ) {
    for (let i = 0; i < count; i++) {
      const t = start + i * 0.04 + Math.random() * 0.02;
      const freq = 1400 + Math.random() * 2200;
      this.playBell(ctx, dest, t, freq, volume, 0.14);
      this.playNoiseBurst(ctx, dest, t, 0.01, 2800, volume * 0.35, 'highpass');
    }
  }

  private playStaticSlap(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    power: number,
    duration: number,
  ) {
    this.playNoiseBurst(ctx, dest, start, duration, 2400, 0.16 * power, 'highpass');
    this.playNoiseBurst(ctx, dest, start + 0.02, duration * 0.7, 480, 0.12 * power, 'bandpass');
    this.playTone(ctx, dest, start + 0.03, 310, 'sawtooth', 0.08 * power, 0.01, 0.1, -60, 700);
  }

  private playPaperRustle(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    power: number,
    duration: number,
  ) {
    this.playNoiseBurst(ctx, dest, start, duration, 1200, 0.1 * power, 'highpass');
    this.playNoiseBurst(ctx, dest, start + 0.03, duration * 0.8, 600, 0.08 * power, 'bandpass');
  }

  private playGlassShatter(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    power: number,
    duration: number,
  ) {
    for (let i = 0; i < 5; i++) {
      const t = start + i * 0.018;
      this.playNoiseBurst(ctx, dest, t, duration * 0.6, 1800 + i * 400, 0.1 * power, 'highpass');
      this.playBell(ctx, dest, t + 0.01, 900 + i * 220, 0.06 * power, 0.12);
    }
  }

  private playRapidStings(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    count: number,
    volume: number,
  ) {
    for (let i = 0; i < count; i++) {
      const t = start + i * 0.055;
      this.playTone(ctx, dest, t, 520 + i * 90, 'square', volume, 0.003, 0.05, 0, 1800);
      this.playMegaphoneBlast(ctx, dest, t, 0.05, volume * 0.45);
    }
  }

  private playDiceRoll(ctx: AudioContext, start: number, victory = false) {
    if (!this.sfxBus) return;
    const rolls = victory ? 5 : 3;
    for (let i = 0; i < rolls; i++) {
      const t = start + i * 0.055;
      this.playNoiseBurst(ctx, this.sfxBus, t, 0.022, 420 + i * 40, 0.12, 'lowpass');
      this.playBell(ctx, this.sfxBus, t, 520 + i * 60, 0.08, 0.12);
    }
    if (victory) {
      this.playBell(ctx, this.sfxBus, start + rolls * 0.055 + 0.04, 1046.5, 0.24, 0.7);
    }
  }

  /** Cartoon bonk: sharp crack + pitch-drop thud + ringing body. */
  private playBonkImpact(ctx: AudioContext, start: number, power: number, heavy = false) {
    if (!this.sfxBus) return;
    const g = power * (heavy ? 1.2 : 1);

    this.playNoiseBurst(ctx, this.sfxBus, start, 0.025, 2200, 0.22 * g, 'highpass');
    this.playBonkThud(ctx, this.sfxBus, start, heavy ? 200 : 280, heavy ? 65 : 85, 0.42 * g, heavy ? 0.32 : 0.24);
    this.playBonkRing(ctx, this.sfxBus, start + 0.03, heavy ? 110 : 145, 0.2 * g, heavy ? 0.38 : 0.28);

    if (heavy) {
      this.playBonkThud(ctx, this.sfxBus, start + 0.02, 120, 48, 0.28 * g, 0.2);
      this.playBell(ctx, this.sfxBus, start + 0.06, 196, 0.1 * g, 0.22);
    }
  }

  private playBonkThud(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    fromHz: number,
    toHz: number,
    volume: number,
    decay: number,
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fromHz, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(toHz, 30), start + 0.07);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, start);
    filter.frequency.exponentialRampToValueAtTime(280, start + decay);

    osc.connect(gain);
    gain.connect(filter);
    filter.connect(dest);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);

    osc.start(start);
    osc.stop(start + decay + 0.05);
  }

  private playBonkRing(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    freq: number,
    volume: number,
    decay: number,
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.8, start);
    filter.Q.setValueAtTime(2.5, start);

    osc.connect(gain);
    gain.connect(filter);
    filter.connect(dest);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);

    osc.start(start);
    osc.stop(start + decay + 0.05);
  }

  private playMeleeImpact(ctx: AudioContext, start: number, power: number, heavy = false) {
    this.playBonkImpact(ctx, start, power, heavy);
  }

  private playArcaneImpact(ctx: AudioContext, start: number, power: number) {
    if (!this.sfxBus) return;
    this.playBonkImpact(ctx, start, power * 0.75, false);
    [440, 554.37, 659.25].forEach((freq, i) => {
      this.playFlute(ctx, this.sfxBus!, start + 0.04 + i * 0.07, freq, 0.1 * power, 0.2);
    });
    this.playBell(ctx, this.sfxBus, start + 0.22, 880, 0.1 * power, 0.35);
  }

  private playHealChime(ctx: AudioContext, start: number) {
    const bus = this.sfxBus;
    if (!bus) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      this.playBell(ctx, bus, start + i * 0.09, freq, 0.14, 0.45);
    });
  }

  private playBuffFanfare(ctx: AudioContext, start: number) {
    const bus = this.sfxBus;
    if (!bus) return;
    [392, 493.88, 587.33].forEach((freq, i) => {
      this.playFlute(ctx, bus, start + i * 0.08, freq, 0.11, 0.22);
    });
    this.playBell(ctx, bus, start + 0.28, 739.99, 0.1, 0.3);
  }

  private playChaosImpact(ctx: AudioContext, start: number, power: number) {
    const bus = this.sfxBus;
    if (!bus) return;
    this.playBonkImpact(ctx, start, power * 0.95, Math.random() > 0.45);
    this.playBell(ctx, bus, start + 0.08, 620 + Math.random() * 280, 0.08 * power, 0.2);
  }

  /** Hand-bell tone with inharmonic partials. */
  private playBell(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    fundamental: number,
    volume: number,
    decay: number,
  ) {
    const partials = [1, 2.17, 3.14, 4.16, 5.2];
    const amps = [1, 0.55, 0.35, 0.22, 0.12];

    partials.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(fundamental * ratio, start);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, start);
      filter.frequency.exponentialRampToValueAtTime(800, start + decay);

      osc.connect(gain);
      gain.connect(filter);
      filter.connect(dest);

      const amp = volume * amps[i];
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(amp, 0.0002), start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);

      osc.start(start);
      osc.stop(start + decay + 0.05);
    });
  }

  /** Soft breathy flute — sine with vibrato and air noise. */
  private playFlute(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    freq: number,
    volume: number,
    decay: number,
    breathy = false,
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    vibrato.type = 'sine';
    vibrato.frequency.setValueAtTime(5.5, start);
    vibratoGain.gain.setValueAtTime(10, start);
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.detune);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(breathy ? 1400 : 2200, start);
    filter.Q.setValueAtTime(0.7, start);

    osc.connect(gain);
    gain.connect(filter);
    filter.connect(dest);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), start + (breathy ? 0.06 : 0.025));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);

    if (breathy) {
      this.playNoiseBurst(ctx, dest, start, decay * 0.85, 1800, volume * 0.18, 'bandpass');
    }

    osc.start(start);
    vibrato.start(start);
    osc.stop(start + decay + 0.05);
    vibrato.stop(start + decay + 0.05);
  }

  private playNoiseSweep(
    ctx: AudioContext,
    dest: GainNode,
    start: number,
    duration: number,
    fromHz: number,
    toHz: number,
    volume: number,
  ) {
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(fromHz, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(toHz, 40), start + duration);
    filter.Q.setValueAtTime(1.2, start);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(start);
    src.stop(start + duration);
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

let sharedCombatEngine: CombatAudioEngine | null = null;

export function getCombatAudioEngine(): CombatAudioEngine {
  if (!sharedCombatEngine) sharedCombatEngine = new CombatAudioEngine();
  return sharedCombatEngine;
}