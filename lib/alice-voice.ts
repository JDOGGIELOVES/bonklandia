/**
 * Alice entity dialogue via Web Speech API.
 *
 * Critical browser quirks:
 * - Chrome GC: SpeechSynthesisUtterance must be kept in a module-level ref or speech never plays.
 * - Chrome: cancel() then immediate speak() often fails — short delay only when cancel was needed.
 * - iOS: speak() must run in the same user-gesture turn when possible (no setTimeout if idle).
 * - Chrome: engine can stick paused — resume() before/after speak.
 */

export type AliceVoiceStyle = {
  rate: number;
  pitch: number;
};

const ENTITY_VOICE: Record<string, AliceVoiceStyle> = {
  'machine-elf': { rate: 1.02, pitch: 1.12 },
  jester: { rate: 1.08, pitch: 1.25 },
  mantis: { rate: 0.94, pitch: 0.9 },
  grey: { rate: 0.9, pitch: 0.85 },
  'light-being': { rate: 0.96, pitch: 1.15 },
  goddess: { rate: 0.92, pitch: 1.05 },
  'fractal-being': { rate: 1.0, pitch: 1.08 },
  serpent: { rate: 0.88, pitch: 0.8 },
  ancestor: { rate: 0.9, pitch: 0.95 },
  'the-other': { rate: 0.85, pitch: 0.7 },
};

const DEFAULT_STYLE: AliceVoiceStyle = { rate: 0.98, pitch: 1 };

/** Prevents GC from killing in-flight speech (Chrome). */
let heldUtterance: SpeechSynthesisUtterance | null = null;
let speakGeneration = 0;
let chromeKeepAliveTimer: ReturnType<typeof setInterval> | null = null;

function preferredVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const en = voices.filter(v => /^en(-|_)/i.test(v.lang) || /english/i.test(v.name));
  const pool = en.length ? en : voices;

  const ranked = [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return ranked[0] ?? null;
}

function scoreVoice(v: SpeechSynthesisVoice): number {
  let s = 0;
  const n = v.name.toLowerCase();
  if (v.localService) s += 3;
  if (/google|microsoft|natural|neural|premium|enhanced/i.test(n)) s += 4;
  if (/samantha|zira|david|mark|susan|karen|moira|daniel|ravi|hazel/i.test(n)) s += 2;
  if (/en-us|en_us|en-gb|en_gb|en-au/i.test(v.lang)) s += 2;
  // Avoid known-weak compact voices when alternatives exist
  if (/compact|eloquence|espeak/i.test(n)) s -= 2;
  return s;
}

export function warmAliceVoices(): void {
  if (typeof window === 'undefined') return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.getVoices();
    synth.addEventListener(
      'voiceschanged',
      () => {
        synth.getVoices();
      },
      { once: true },
    );
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
};

function clearKeepAlive() {
  if (chromeKeepAliveTimer != null) {
    clearInterval(chromeKeepAliveTimer);
    chromeKeepAliveTimer = null;
  }
}

/**
 * Speak an entity line. Replaces any in-flight line.
 * Call from a click/tap handler when possible (iOS).
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
  clearKeepAlive();

  const needsCancel = synth.speaking || synth.pending;
  if (needsCancel) {
    try {
      synth.cancel();
    } catch {
      /* */
    }
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
    clearKeepAlive();
    // Keep heldUtterance until next speak so Chrome doesn't GC mid-line
    opts.onEnd?.();
  };

  const start = () => {
    if (gen !== speakGeneration) return;

    try {
      try {
        synth.resume();
      } catch {
        /* */
      }

      // Fresh getVoices at speak time
      warmAliceVoices();
      const style = (opts.entityId && ENTITY_VOICE[opts.entityId]) || DEFAULT_STYLE;
      const utter = new SpeechSynthesisUtterance(cleaned);
      // Keep pitch/rate moderate — extreme values can be silent on some voices
      utter.rate = Math.max(0.85, Math.min(1.15, style.rate));
      utter.pitch = Math.max(0.8, Math.min(1.3, style.pitch));
      utter.volume = 1;

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
        const err = (event as SpeechSynthesisErrorEvent).error;
        if (err === 'interrupted' || err === 'canceled') {
          done();
          return;
        }
        opts.onError?.(
          err === 'not-allowed'
            ? 'Speech blocked — tap Hear them speak again (needs a click).'
            : err || 'Speech failed',
        );
        done();
      };

      // CRITICAL: hold reference so Chrome does not GC the utterance
      heldUtterance = utter;
      synth.speak(utter);

      // Chrome long-utterance bug: pause/resume keep-alive
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

      window.setTimeout(() => {
        if (gen !== speakGeneration || finished) return;
        try {
          if (synth.paused) synth.resume();
        } catch {
          /* */
        }
      }, 100);

      // Detect silent failure
      window.setTimeout(() => {
        if (gen !== speakGeneration || finished) return;
        if (!synth.speaking && !synth.pending) {
          opts.onError?.(
            'No speech audio — check Windows Speech settings or try another browser (Chrome/Edge).',
          );
          done();
        }
      }, 1200);
    } catch (e) {
      opts.onError?.(e instanceof Error ? e.message : 'speak threw');
      done();
    }
  };

  // Only delay after cancel (Chrome). Immediate speak preserves iOS user gesture.
  if (needsCancel) {
    window.setTimeout(start, 80);
  } else if (synth.getVoices().length === 0) {
    // Voices not loaded yet — wait briefly (still usually ok after a click)
    const once = () => {
      synth.removeEventListener('voiceschanged', once);
      start();
    };
    synth.addEventListener('voiceschanged', once);
    window.setTimeout(() => {
      synth.removeEventListener('voiceschanged', once);
      start();
    }, 300);
    try {
      synth.getVoices();
    } catch {
      /* */
    }
  } else {
    start();
  }
}

export function stopAliceSpeech(): void {
  if (typeof window === 'undefined') return;
  speakGeneration += 1;
  clearKeepAlive();
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
