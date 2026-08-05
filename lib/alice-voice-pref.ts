/**
 * Entity speech (browser TTS) preference — default OFF.
 * Music/SFX are separate; this only gates spoken entity lines.
 */

import { BRAND } from '@/lib/brand';

export const ALICE_VOICE_KEY = `${BRAND.storagePrefix}-alice-voice-on`;
export const ALICE_VOICE_EVENT = 'bonklandia-alice-voice';

/** Default: quiet trip — players opt in with “Hear them speak”. */
export function isAliceVoiceEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ALICE_VOICE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAliceVoiceEnabled(on: boolean): boolean {
  if (typeof window === 'undefined') return on;
  try {
    window.localStorage.setItem(ALICE_VOICE_KEY, on ? '1' : '0');
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent(ALICE_VOICE_EVENT, { detail: { on } }));
  return on;
}

export function toggleAliceVoiceEnabled(): boolean {
  return setAliceVoiceEnabled(!isAliceVoiceEnabled());
}

export function subscribeAliceVoice(listener: (on: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onCustom = (e: Event) => {
    const on = (e as CustomEvent<{ on?: boolean }>).detail?.on;
    listener(typeof on === 'boolean' ? on : isAliceVoiceEnabled());
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === ALICE_VOICE_KEY) listener(isAliceVoiceEnabled());
  };
  window.addEventListener(ALICE_VOICE_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(ALICE_VOICE_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}
