'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  applyAudioChannels,
  getAppAudioPrefs,
  setAppAudioMuted,
  setAppMusicMuted,
  setAppSfxMuted,
  subscribeAppAudioPrefs,
  toggleAppMusicMuted,
  toggleAppSfxMuted,
  type AppAudioPrefs,
} from '@/lib/global-audio';

/**
 * Shared music/SFX prefs across Home, Bandit, Alice, Depths, Cashier.
 * Matches the fixed bottom-right dock.
 */
export function useAppAudioMute() {
  const [prefs, setPrefs] = useState<AppAudioPrefs>({ musicMuted: false, sfxMuted: false });

  useEffect(() => {
    const initial = getAppAudioPrefs();
    setPrefs(initial);
    applyAudioChannels(initial);
    return subscribeAppAudioPrefs(setPrefs);
  }, []);

  const toggleMusic = useCallback(() => {
    const next = toggleAppMusicMuted();
    setPrefs(next);
    return next;
  }, []);

  const toggleSfx = useCallback(() => {
    const next = toggleAppSfxMuted();
    setPrefs(next);
    return next;
  }, []);

  /** Mute both channels (legacy). */
  const toggleMute = useCallback(() => {
    const bothOff = prefs.musicMuted && prefs.sfxMuted;
    const next = setAppAudioMuted(!bothOff);
    setPrefs(getAppAudioPrefs());
    return next;
  }, [prefs.musicMuted, prefs.sfxMuted]);

  const setMusicMuted = useCallback((musicMuted: boolean) => {
    setPrefs(setAppMusicMuted(musicMuted));
  }, []);

  const setSfxMuted = useCallback((sfxMuted: boolean) => {
    setPrefs(setAppSfxMuted(sfxMuted));
  }, []);

  return {
    musicMuted: prefs.musicMuted,
    sfxMuted: prefs.sfxMuted,
    /** Fully silent (both off). */
    muted: prefs.musicMuted && prefs.sfxMuted,
    toggleMusic,
    toggleSfx,
    toggleMute,
    setMusicMuted,
    setSfxMuted,
    setMute: setAppAudioMuted,
  };
}
