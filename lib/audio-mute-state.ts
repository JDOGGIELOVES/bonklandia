/**
 * Shared mute preference — no engine imports (safe for any module).
 * Persists across pages so mute on Alice stays mute on Bandit / home.
 */

import { BRAND } from '@/lib/brand';

export const APP_AUDIO_MUTE_KEY = `${BRAND.storagePrefix}-audio-muted`;
export const APP_AUDIO_MUTE_EVENT = 'bonklandia-audio-mute';

export function isAppAudioMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(APP_AUDIO_MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Persist + notify UI. Does not touch audio engines (see global-audio). */
export function writeAppAudioMuted(muted: boolean): boolean {
  if (typeof window === 'undefined') return muted;
  try {
    window.localStorage.setItem(APP_AUDIO_MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent(APP_AUDIO_MUTE_EVENT, { detail: { muted } }));
  return muted;
}

export function subscribeAppAudioMuted(listener: (muted: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onCustom = (e: Event) => {
    const muted = (e as CustomEvent<{ muted?: boolean }>).detail?.muted;
    listener(typeof muted === 'boolean' ? muted : isAppAudioMuted());
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === APP_AUDIO_MUTE_KEY) listener(isAppAudioMuted());
  };

  window.addEventListener(APP_AUDIO_MUTE_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(APP_AUDIO_MUTE_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}
