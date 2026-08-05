/**
 * Shared audio preferences — no engine imports (safe for any module).
 * Music and SFX are independent so players can mute beds without killing lever clicks.
 */

import { BRAND } from '@/lib/brand';

/** Legacy full-mute (pre music/SFX split). Migrated once into both channels. */
export const APP_AUDIO_MUTE_KEY = `${BRAND.storagePrefix}-audio-muted`;
export const APP_MUSIC_MUTE_KEY = `${BRAND.storagePrefix}-music-muted`;
export const APP_SFX_MUTE_KEY = `${BRAND.storagePrefix}-sfx-muted`;

export const APP_AUDIO_MUTE_EVENT = 'bonklandia-audio-mute';
export const APP_AUDIO_PREFS_EVENT = 'bonklandia-audio-prefs';

export type AppAudioPrefs = {
  musicMuted: boolean;
  sfxMuted: boolean;
};

function readFlag(key: string): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(key);
    if (v === null) return null;
    return v === '1';
  } catch {
    return null;
  }
}

function writeFlag(key: string, on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, on ? '1' : '0');
  } catch {
    /* private mode */
  }
}

/** Read music/SFX prefs; migrate legacy single mute if needed. */
export function getAppAudioPrefs(): AppAudioPrefs {
  if (typeof window === 'undefined') {
    return { musicMuted: false, sfxMuted: false };
  }
  const music = readFlag(APP_MUSIC_MUTE_KEY);
  const sfx = readFlag(APP_SFX_MUTE_KEY);
  if (music !== null || sfx !== null) {
    return {
      musicMuted: music ?? false,
      sfxMuted: sfx ?? false,
    };
  }
  const legacy = readFlag(APP_AUDIO_MUTE_KEY);
  if (legacy === true) {
    return { musicMuted: true, sfxMuted: true };
  }
  return { musicMuted: false, sfxMuted: false };
}

export function isMusicMuted(): boolean {
  return getAppAudioPrefs().musicMuted;
}

export function isSfxMuted(): boolean {
  return getAppAudioPrefs().sfxMuted;
}

/** True only when both channels are off (legacy “fully muted”). */
export function isAppAudioMuted(): boolean {
  const p = getAppAudioPrefs();
  return p.musicMuted && p.sfxMuted;
}

function emitPrefs(prefs: AppAudioPrefs): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APP_AUDIO_PREFS_EVENT, { detail: prefs }));
  // Keep legacy listeners working (full mute = both off).
  window.dispatchEvent(
    new CustomEvent(APP_AUDIO_MUTE_EVENT, {
      detail: { muted: prefs.musicMuted && prefs.sfxMuted },
    }),
  );
}

export function writeAppAudioPrefs(partial: Partial<AppAudioPrefs>): AppAudioPrefs {
  const next: AppAudioPrefs = { ...getAppAudioPrefs(), ...partial };
  writeFlag(APP_MUSIC_MUTE_KEY, next.musicMuted);
  writeFlag(APP_SFX_MUTE_KEY, next.sfxMuted);
  // Mirror legacy key for older code paths.
  writeFlag(APP_AUDIO_MUTE_KEY, next.musicMuted && next.sfxMuted);
  emitPrefs(next);
  return next;
}

/** @deprecated Prefer writeAppAudioPrefs — sets both channels. */
export function writeAppAudioMuted(muted: boolean): boolean {
  writeAppAudioPrefs({ musicMuted: muted, sfxMuted: muted });
  return muted;
}

export function subscribeAppAudioPrefs(listener: (prefs: AppAudioPrefs) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent<AppAudioPrefs>).detail;
    if (detail && typeof detail.musicMuted === 'boolean') {
      listener(detail);
    } else {
      listener(getAppAudioPrefs());
    }
  };
  const onStorage = (e: StorageEvent) => {
    if (
      e.key === APP_MUSIC_MUTE_KEY ||
      e.key === APP_SFX_MUTE_KEY ||
      e.key === APP_AUDIO_MUTE_KEY
    ) {
      listener(getAppAudioPrefs());
    }
  };

  window.addEventListener(APP_AUDIO_PREFS_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(APP_AUDIO_PREFS_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

/** @deprecated Prefer subscribeAppAudioPrefs */
export function subscribeAppAudioMuted(listener: (muted: boolean) => void): () => void {
  return subscribeAppAudioPrefs(p => listener(p.musicMuted && p.sfxMuted));
}
