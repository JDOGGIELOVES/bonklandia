/**
 * Alice entity dialogue via Web Speech API.
 *
 * Chrome: cancel() then immediate speak() is broken — must delay.
 * Chrome: synth can stick in paused state — resume() before/after speak.
 * iOS: speech often only works during a user gesture (click/tap).
 */

export type AliceVoiceStyle = {
  rate: number;
  pitch: number;
};

/** Per-entity voice color — still the system TTS, but characterful. */
const ENTITY_VOICE: Record<string, AliceVoiceStyle> = {
  'machine-elf': { rate: 1.05, pitch: 1.15 },
  jester: { rate: 1.12, pitch: 1.35 },
  mantis: { rate: 0.92, pitch: 0.85 },
  grey: { rate: 0.88, pitch: 0.75 },
  'light-being': { rate: 0.95, pitch: 1.2 },
  goddess: { rate: 0.9, pitch: 1.05 },
  'fractal-being': { rate: 1.0, pitch: 1.1 },
  serpent: { rate: 0.85, pitch: 0.7 },
  ancestor: { rate: 0.88, pitch: 0.9 },
  'the-other': { rate: 0.8, pitch: 0.55 },
};

const DEFAULT_STYLE: AliceVoiceStyle = { rate: 0.95, pitch: 1 };

/** Bumps so late async starts from a cancelled line never speak. */
let speakGeneration = 0;

function preferredVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter(v => /^en(-|_)/i.test(v.lang) || /english/i.test(v.lang));
  const pool = en.length ? en : voices;
  const ranked = [...pool].sort((a, b) => {
    const score = (v: SpeechSynthesisVoice) => {
      let s = 0;
      const n = v.name.toLowerCase();
      if (v.localService) s += 2;
      if (/google|microsoft|natural|neural|premium|enhanced|samantha|zira|david/i.test(n)) s += 3;
      if (/female|zira|samantha|susan|karen|moira/i.test(n)) s += 1;
      // Prefer non-silent / installed voices
      if (!/compact|eloquence/i.test(n)) s += 1;
      return s;
    };
    return score(b) - score(a);
  });
  return ranked[0] ?? null;
}

/** Warm the voice list (call from a user gesture when possible). */
export function warmAliceVoices(): void {
  if (typeof window === 'undefined') return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.getVoices();
    // Some browsers only populate after this event
    const once = () => synth.getVoices();
    synth.addEventListener('voiceschanged', once, { once: true });
  } catch {
    /* */
  }
}

export type SpeakAliceOptions = {
  entityId?: string;
  /** 0–1 utterance volume (browser TTS). Default 1. */
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  /** Called when speech cannot start (no API / blocked). */
  onError?: (reason: string) => void;
};

/**
 * Speak an entity line. Cancels any in-flight Alice utterance.
 * Safe no-op when speechSynthesis is missing or text is empty.
 */
export function speakAliceLine(text: string, opts: SpeakAliceOptions = {}): void {
  if (typeof window === 'undefined') {
    opts.onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  if (!synth) {
    opts.onError?.('Speech not supported in this browser');
    opts.onEnd?.();
    return;
  }

  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    opts.onEnd?.();
    return;
  }

  const gen = ++speakGeneration;

  // Hard-reset stuck Chrome speech engine
  try {
    synth.cancel();
  } catch {
    /* */
  }
  try {
    synth.resume();
  } catch {
    /* */
  }

  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    opts.onEnd?.();
  };

  const buildUtterance = (): SpeechSynthesisUtterance => {
    const style = (opts.entityId && ENTITY_VOICE[opts.entityId]) || DEFAULT_STYLE;
    const utter = new SpeechSynthesisUtterance(cleaned);
    utter.rate = Math.max(0.7, Math.min(1.4, style.rate));
    utter.pitch = Math.max(0.5, Math.min(1.6, style.pitch));
    utter.volume = Math.max(0, Math.min(1, opts.volume ?? 1));
    const voice = preferredVoice();
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang || 'en-US';
    } else {
      utter.lang = 'en-US';
    }
    utter.onstart = () => {
      if (gen !== speakGeneration) return;
      opts.onStart?.();
    };
    utter.onend = () => {
      if (gen !== speakGeneration) return;
      done();
    };
    utter.onerror = event => {
      if (gen !== speakGeneration) return;
      // 'interrupted' / 'canceled' from our own cancel — treat as end
      const err = (event as SpeechSynthesisErrorEvent).error;
      if (err === 'interrupted' || err === 'canceled') {
        done();
        return;
      }
      opts.onError?.(err || 'speak failed');
      done();
    };
    return utter;
  };

  const start = () => {
    if (gen !== speakGeneration) return;
    try {
      try {
        synth.resume();
      } catch {
        /* */
      }
      const utter = buildUtterance();
      // Re-bind voice after delay — list may have populated
      const v = preferredVoice();
      if (v) {
        utter.voice = v;
        utter.lang = v.lang || 'en-US';
      }
      synth.speak(utter);
      // Chrome sometimes leaves the engine paused after speak()
      window.setTimeout(() => {
        if (gen !== speakGeneration) return;
        try {
          if (synth.paused) synth.resume();
        } catch {
          /* */
        }
      }, 80);
      // If nothing started, report (helps diagnose silent failures)
      window.setTimeout(() => {
        if (gen !== speakGeneration || finished) return;
        if (!synth.speaking && !synth.pending) {
          opts.onError?.('Speech did not start — try again or check system voice settings');
          done();
        }
      }, 900);
    } catch (e) {
      opts.onError?.(e instanceof Error ? e.message : 'speak threw');
      done();
    }
  };

  // Critical: wait after cancel() before speak() (Chrome)
  const afterCancelMs = 60;

  const kick = () => {
    if (gen !== speakGeneration) return;
    // Ensure voices are loaded
    const voices = synth.getVoices();
    if (voices.length === 0) {
      const once = () => {
        synth.removeEventListener('voiceschanged', once);
        window.setTimeout(start, 20);
      };
      synth.addEventListener('voiceschanged', once);
      // Fallback if event never fires
      window.setTimeout(() => {
        synth.removeEventListener('voiceschanged', once);
        start();
      }, 600);
      // Trigger load on some engines
      try {
        synth.getVoices();
      } catch {
        /* */
      }
    } else {
      start();
    }
  };

  window.setTimeout(kick, afterCancelMs);
}

export function stopAliceSpeech(): void {
  if (typeof window === 'undefined') return;
  speakGeneration += 1;
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
}

export function isAliceSpeechSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}
