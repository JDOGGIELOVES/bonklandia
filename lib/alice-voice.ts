/**
 * Alice entity dialogue.
 *
 * Strategy:
 * 1) Try Web Speech API (instant, offline when it works).
 * 2) If it doesn't start within a short window, fall back to StreamElements TTS
 *    (plays via HTMLAudioElement — works when system Speech is broken/muted).
 *
 * Chrome quirks addressed: hold utterance ref (GC), avoid cancel+immediate speak,
 * resume() keepalive, user-gesture friendly path for Audio.play().
 */

export type AliceVoiceStyle = {
  rate: number;
  pitch: number;
  /** StreamElements voice id for HTTP fallback */
  seVoice: string;
};

const ENTITY_VOICE: Record<string, AliceVoiceStyle> = {
  'machine-elf': { rate: 1.02, pitch: 1.1, seVoice: 'Brian' },
  jester: { rate: 1.08, pitch: 1.2, seVoice: 'Joey' },
  mantis: { rate: 0.95, pitch: 0.95, seVoice: 'Matthew' },
  grey: { rate: 0.92, pitch: 0.9, seVoice: 'Justin' },
  'light-being': { rate: 0.98, pitch: 1.1, seVoice: 'Amy' },
  goddess: { rate: 0.94, pitch: 1.05, seVoice: 'Salli' },
  'fractal-being': { rate: 1.0, pitch: 1.05, seVoice: 'Russell' },
  serpent: { rate: 0.9, pitch: 0.9, seVoice: 'Brian' },
  ancestor: { rate: 0.92, pitch: 0.95, seVoice: 'Geraint' },
  'the-other': { rate: 0.88, pitch: 0.85, seVoice: 'Matthew' },
};

const DEFAULT_STYLE: AliceVoiceStyle = { rate: 1, pitch: 1, seVoice: 'Brian' };

/** Prevents Chrome from GC'ing the utterance mid-speech */
let heldUtterance: SpeechSynthesisUtterance | null = null;
let heldAudio: HTMLAudioElement | null = null;
let speakGeneration = 0;
let chromeKeepAliveTimer: ReturnType<typeof setInterval> | null = null;

function styleFor(entityId?: string): AliceVoiceStyle {
  return (entityId && ENTITY_VOICE[entityId]) || DEFAULT_STYLE;
}

function preferredVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter(v => /^en(-|_)/i.test(v.lang) || /english/i.test(v.name));
  const pool = en.length ? en : voices;
  return (
    [...pool].sort((a, b) => {
      const score = (v: SpeechSynthesisVoice) => {
        let s = 0;
        const n = v.name.toLowerCase();
        if (v.localService) s += 3;
        if (/google|microsoft|natural|neural|premium|enhanced/i.test(n)) s += 4;
        if (/samantha|zira|david|mark|daniel/i.test(n)) s += 2;
        if (/en-us|en_us|en-gb/i.test(v.lang)) s += 2;
        if (/compact|eloquence|espeak/i.test(n)) s -= 3;
        return s;
      };
      return score(b) - score(a);
    })[0] ?? null
  );
}

export function warmAliceVoices(): void {
  if (typeof window === 'undefined') return;
  try {
    window.speechSynthesis?.getVoices();
  } catch {
    /* */
  }
}

export type SpeakAliceOptions = {
  entityId?: string;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (reason: string) => void;
  /** Prefer HTTP TTS (more reliable when OS speech is broken). */
  preferNetwork?: boolean;
};

function clearKeepAlive() {
  if (chromeKeepAliveTimer != null) {
    clearInterval(chromeKeepAliveTimer);
    chromeKeepAliveTimer = null;
  }
}

function stopNetworkAudio() {
  if (heldAudio) {
    try {
      heldAudio.pause();
      heldAudio.removeAttribute('src');
      heldAudio.load();
    } catch {
      /* */
    }
    heldAudio = null;
  }
}

/** StreamElements free TTS — returns audio/mpeg, playable via <audio>. */
function networkTtsUrl(text: string, seVoice: string): string {
  const q = encodeURIComponent(text.slice(0, 280));
  const voice = encodeURIComponent(seVoice || 'Brian');
  return `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${q}`;
}

function speakViaNetwork(
  text: string,
  seVoice: string,
  gen: number,
  opts: SpeakAliceOptions,
  done: () => void,
): void {
  stopNetworkAudio();
  const url = networkTtsUrl(text, seVoice);
  const audio = new Audio();
  heldAudio = audio;
  audio.volume = Math.max(0, Math.min(1, opts.volume ?? 1));
  audio.preload = 'auto';

  const fail = (reason: string) => {
    if (gen !== speakGeneration) return;
    opts.onError?.(reason);
    done();
  };

  audio.onplay = () => {
    if (gen !== speakGeneration) return;
    opts.onStart?.();
  };
  audio.onended = () => {
    if (gen !== speakGeneration) return;
    done();
  };
  audio.onerror = () => {
    fail('Network voice failed — check internet, or try Chrome/Edge with Windows Speech installed.');
  };

  audio.src = url;
  const playPromise = audio.play();
  if (playPromise && typeof playPromise.then === 'function') {
    playPromise.catch(() => {
      // Autoplay blocked without gesture — surface clear error
      fail('Voice blocked by browser — tap Test voice again (needs a direct click).');
    });
  }
}

function speakViaWebSpeech(
  text: string,
  entityId: string | undefined,
  gen: number,
  opts: SpeakAliceOptions,
  done: () => void,
  onFailSilent: () => void,
): void {
  const synth = window.speechSynthesis;
  if (!synth) {
    onFailSilent();
    return;
  }

  try {
    synth.resume();
  } catch {
    /* */
  }

  const style = styleFor(entityId);
  const utter = new SpeechSynthesisUtterance(text);
  // Keep rate/pitch near neutral — extreme values are silent on some Windows voices
  utter.rate = 1;
  utter.pitch = 1;
  utter.volume = 1;
  utter.lang = 'en-US';

  const voice = preferredVoice();
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang || 'en-US';
  }

  let started = false;

  utter.onstart = () => {
    if (gen !== speakGeneration) return;
    started = true;
    opts.onStart?.();
  };
  utter.onend = () => {
    if (gen !== speakGeneration) return;
    done();
  };
  utter.onerror = event => {
    if (gen !== speakGeneration) return;
    const err = (event as SpeechSynthesisErrorEvent).error;
    if (err === 'interrupted' || err === 'canceled') {
      done();
      return;
    }
    // Fall through to network TTS
    onFailSilent();
  };

  heldUtterance = utter;

  const needsCancel = synth.speaking || synth.pending;
  if (needsCancel) {
    try {
      synth.cancel();
    } catch {
      /* */
    }
    window.setTimeout(() => {
      if (gen !== speakGeneration) return;
      try {
        synth.resume();
        synth.speak(utter);
      } catch {
        onFailSilent();
      }
    }, 90);
  } else {
    try {
      synth.speak(utter);
    } catch {
      onFailSilent();
      return;
    }
  }

  chromeKeepAliveTimer = setInterval(() => {
    if (gen !== speakGeneration) {
      clearKeepAlive();
      return;
    }
    try {
      if (synth.paused) synth.resume();
      if (!synth.speaking && !synth.pending) clearKeepAlive();
    } catch {
      clearKeepAlive();
    }
  }, 4000);

  // If OS speech never starts, fall back to network TTS
  window.setTimeout(() => {
    if (gen !== speakGeneration) return;
    if (!started && !synth.speaking) {
      try {
        synth.cancel();
      } catch {
        /* */
      }
      onFailSilent();
    }
  }, 700);
}

/**
 * Speak an entity line. Prefer Web Speech; fall back to network TTS.
 * Call from a click/tap handler when possible.
 */
export function speakAliceLine(text: string, opts: SpeakAliceOptions = {}): void {
  if (typeof window === 'undefined') {
    opts.onEnd?.();
    return;
  }

  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    opts.onEnd?.();
    return;
  }

  const gen = ++speakGeneration;
  clearKeepAlive();
  stopNetworkAudio();

  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    clearKeepAlive();
    opts.onEnd?.();
  };

  const style = styleFor(opts.entityId);

  const useNetwork = () => {
    if (gen !== speakGeneration) return;
    speakViaNetwork(cleaned, style.seVoice, gen, opts, done);
  };

  // Prefer network if requested or if speechSynthesis missing
  if (opts.preferNetwork || typeof window.speechSynthesis === 'undefined') {
    useNetwork();
    return;
  }

  speakViaWebSpeech(cleaned, opts.entityId, gen, opts, done, useNetwork);
}

export function stopAliceSpeech(): void {
  if (typeof window === 'undefined') return;
  speakGeneration += 1;
  clearKeepAlive();
  stopNetworkAudio();
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* */
  }
  try {
    window.speechSynthesis?.resume();
  } catch {
    /* */
  }
  heldUtterance = null;
}

export function isAliceSpeechSupported(): boolean {
  // Network TTS works even when speechSynthesis is missing
  return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}
