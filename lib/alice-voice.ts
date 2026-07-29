/**
 * Alice entity dialogue via Web Speech API.
 * Music ducking is handled by AliceAudioEngine while a line is speaking.
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

function preferredVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  // Prefer English; slightly favor clearer / narrative-ish names when present.
  const en = voices.filter(v => /^en(-|_)/i.test(v.lang) || /english/i.test(v.lang));
  const pool = en.length ? en : voices;
  const ranked = [...pool].sort((a, b) => {
    const score = (v: SpeechSynthesisVoice) => {
      let s = 0;
      const n = v.name.toLowerCase();
      if (v.localService) s += 2;
      if (/google|microsoft|natural|neural|premium|enhanced/i.test(n)) s += 3;
      if (/female|zira|samantha|susan|karen|moira/i.test(n)) s += 1;
      return s;
    };
    return score(b) - score(a);
  });
  return ranked[0] ?? null;
}

export type SpeakAliceOptions = {
  entityId?: string;
  /** 0–1 utterance volume (browser TTS). Default 1. */
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
};

/**
 * Speak an entity line. Cancels any in-flight Alice utterance.
 * Safe no-op when speechSynthesis is missing or text is empty.
 */
export function speakAliceLine(text: string, opts: SpeakAliceOptions = {}): void {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) {
    opts.onEnd?.();
    return;
  }

  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    opts.onEnd?.();
    return;
  }

  synth.cancel();

  const style = (opts.entityId && ENTITY_VOICE[opts.entityId]) || DEFAULT_STYLE;
  const utter = new SpeechSynthesisUtterance(cleaned);
  utter.rate = style.rate;
  utter.pitch = style.pitch;
  utter.volume = Math.max(0, Math.min(1, opts.volume ?? 1));

  const voice = preferredVoice();
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang || 'en-US';
  } else {
    utter.lang = 'en-US';
  }

  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    opts.onEnd?.();
  };

  utter.onstart = () => opts.onStart?.();
  utter.onend = done;
  utter.onerror = done;

  // Chrome often returns empty getVoices() until voiceschanged.
  const start = () => {
    try {
      const v = preferredVoice();
      if (v) {
        utter.voice = v;
        utter.lang = v.lang || 'en-US';
      }
      synth.speak(utter);
    } catch {
      done();
    }
  };

  if (synth.getVoices().length === 0) {
    const once = () => {
      synth.removeEventListener('voiceschanged', once);
      start();
    };
    synth.addEventListener('voiceschanged', once);
    // Fallback if event never fires
    window.setTimeout(() => {
      synth.removeEventListener('voiceschanged', once);
      if (!finished && !synth.speaking) start();
    }, 400);
  } else {
    start();
  }
}

export function stopAliceSpeech(): void {
  if (typeof window === 'undefined') return;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* */
  }
}
