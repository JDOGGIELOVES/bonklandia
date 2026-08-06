/**
 * Alice entity dialogue — same-origin audio TTS (Chrome + Solflare / wallet WebViews).
 *
 * Flow:
 * 1. unlockAliceVoice() on first tap (unlocks shared HTMLAudioElement)
 * 2. speakAliceLine() fetches /api/alice/tts and plays the blob on that element
 *
 * Web Speech API is last-resort backup only (often silent on Windows / in-app browsers).
 */

export type AliceVoiceStyle = {
  seVoice: string;
};

const ENTITY_VOICE: Record<string, AliceVoiceStyle> = {
  'machine-elf': { seVoice: 'Brian' },
  jester: { seVoice: 'Joey' },
  mantis: { seVoice: 'Matthew' },
  grey: { seVoice: 'Justin' },
  'light-being': { seVoice: 'Amy' },
  goddess: { seVoice: 'Salli' },
  'fractal-being': { seVoice: 'Russell' },
  serpent: { seVoice: 'Brian' },
  ancestor: { seVoice: 'Geraint' },
  'the-other': { seVoice: 'Matthew' },
};

const DEFAULT_STYLE: AliceVoiceStyle = { seVoice: 'Brian' };

/** ~0.1s near-silent mp3 — valid enough for autoplay unlock. */
const SILENT_MP3 =
  'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+1DEAAAHAAGf9AAAIgAAN/4AAAB//tQxAAAGwAGf9AAAIgAAN/4AAA==';

let speakGeneration = 0;
let heldObjectUrl: string | null = null;
/** Shared element unlocked by a user gesture so later .play() is allowed. */
let unlockedAudio: HTMLAudioElement | null = null;
let voiceUnlocked = false;

function styleFor(entityId?: string): AliceVoiceStyle {
  return (entityId && ENTITY_VOICE[entityId]) || DEFAULT_STYLE;
}

function ensureAudioEl(): HTMLAudioElement {
  if (typeof window === 'undefined') {
    throw new Error('No window');
  }
  if (!unlockedAudio) {
    unlockedAudio = new Audio();
    unlockedAudio.preload = 'auto';
    unlockedAudio.setAttribute('playsinline', 'true');
    unlockedAudio.setAttribute('webkit-playsinline', 'true');
  }
  return unlockedAudio;
}

function revokeHeldUrl() {
  if (heldObjectUrl) {
    try {
      URL.revokeObjectURL(heldObjectUrl);
    } catch {
      /* */
    }
    heldObjectUrl = null;
  }
}

/**
 * Call from a click/tap handler so the browser allows later playback.
 */
export async function unlockAliceVoice(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return false;
  try {
    const audio = ensureAudioEl();
    if (!voiceUnlocked) {
      audio.src = SILENT_MP3;
      audio.volume = 0.01;
      audio.muted = true;
      try {
        await audio.play();
      } catch {
        // Gesture may still count; keep going
      }
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        /* */
      }
      audio.muted = false;
      audio.volume = 1;
      voiceUnlocked = true;
    }
    return true;
  } catch {
    voiceUnlocked = true;
    return false;
  }
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
  preferNetwork?: boolean;
};

function stopHeld() {
  const audio = unlockedAudio;
  if (audio) {
    try {
      audio.onended = null;
      audio.onerror = null;
      audio.onplay = null;
      audio.pause();
    } catch {
      /* */
    }
  }
  revokeHeldUrl();
}

function ttsUrl(text: string, seVoice: string): string {
  const q = new URLSearchParams({
    text: text.slice(0, 280),
    voice: seVoice || 'Brian',
  });
  return `/api/alice/tts?${q.toString()}`;
}

/**
 * Speak an entity line via same-origin TTS audio.
 * Prefer calling unlockAliceVoice() in the same click first.
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

  if (typeof Audio === 'undefined') {
    opts.onError?.('This browser cannot play voice audio.');
    opts.onEnd?.();
    return;
  }

  const gen = ++speakGeneration;
  stopHeld();

  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    revokeHeldUrl();
    opts.onEnd?.();
  };

  const style = styleFor(opts.entityId);
  const url = ttsUrl(cleaned, style.seVoice);

  const run = async () => {
    try {
      if (!voiceUnlocked) {
        await unlockAliceVoice();
      }

      const res = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'audio/mpeg,audio/*,*/*' },
      });

      if (gen !== speakGeneration) return;

      if (!res.ok) {
        let msg = `Voice service unavailable (${res.status}).`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          /* */
        }
        // Network TTS failed — try Web Speech once
        tryWebSpeech(cleaned, gen, opts, done, msg);
        return;
      }

      const buf = await res.arrayBuffer();
      if (gen !== speakGeneration) return;
      if (!buf.byteLength) {
        tryWebSpeech(cleaned, gen, opts, done, 'Empty voice response.');
        return;
      }

      const blob = new Blob([buf], {
        type: res.headers.get('Content-Type') || 'audio/mpeg',
      });
      const objectUrl = URL.createObjectURL(blob);
      heldObjectUrl = objectUrl;

      const audio = ensureAudioEl();
      audio.volume = Math.max(0, Math.min(1, opts.volume ?? 1));
      audio.muted = false;

      audio.onplay = () => {
        if (gen !== speakGeneration) return;
        opts.onStart?.();
      };
      audio.onended = () => {
        if (gen !== speakGeneration) return;
        done();
      };
      audio.onerror = () => {
        if (gen !== speakGeneration) return;
        tryWebSpeech(cleaned, gen, opts, done, 'Could not decode voice audio.');
      };

      audio.src = objectUrl;
      try {
        await audio.play();
      } catch {
        if (gen !== speakGeneration) return;
        // One more unlock + play (common after first gesture in wallet WebViews)
        await unlockAliceVoice();
        if (gen !== speakGeneration) return;
        try {
          audio.src = objectUrl;
          await audio.play();
          opts.onStart?.();
        } catch {
          if (gen !== speakGeneration) return;
          opts.onError?.(
            'Voice blocked. Tap Test voice once, allow sound for this site, and turn volume up.',
          );
          done();
        }
      }
    } catch {
      if (gen !== speakGeneration) return;
      tryWebSpeech(cleaned, gen, opts, done, 'Could not load voice. Check connection.');
    }
  };

  void run();
}

function tryWebSpeech(
  text: string,
  gen: number,
  opts: SpeakAliceOptions,
  done: () => void,
  fallbackMsg: string,
): void {
  const synth = window.speechSynthesis;
  if (!synth) {
    opts.onError?.(fallbackMsg);
    done();
    return;
  }
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.pitch = 1;
    u.volume = 1;
    u.lang = 'en-US';
    u.onstart = () => {
      if (gen !== speakGeneration) return;
      opts.onStart?.();
    };
    u.onend = () => {
      if (gen !== speakGeneration) return;
      done();
    };
    u.onerror = () => {
      if (gen !== speakGeneration) return;
      opts.onError?.(fallbackMsg);
      done();
    };
    window.setTimeout(() => {
      if (gen !== speakGeneration) return;
      try {
        synth.resume();
        synth.speak(u);
      } catch {
        opts.onError?.(fallbackMsg);
        done();
      }
    }, 40);
  } catch {
    opts.onError?.(fallbackMsg);
    done();
  }
}

export function stopAliceSpeech(): void {
  if (typeof window === 'undefined') return;
  speakGeneration += 1;
  stopHeld();
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* */
  }
}

/** True when we can play HTML audio (includes Solflare in-app browsers). */
export function isAliceSpeechSupported(): boolean {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}
