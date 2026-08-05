'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WinTier } from '@/lib/slot-machine';
import {
  CASINO_SPIN_DURATION_MS,
  CASINO_SPIN_START_DELAY_MS,
  getCasinoAudioEngine,
} from '@/lib/casino-audio';
import {
  applyAudioChannels,
  getAppAudioPrefs,
  isMusicMuted,
  isSfxMuted,
  setAppMusicMuted,
  subscribeAppAudioPrefs,
} from '@/lib/global-audio';

export function useCasinoAudio() {
  const engineRef = useRef(getCasinoAudioEngine());
  const [musicMuted, setMusicMutedState] = useState(false);
  const [sfxMuted, setSfxMutedState] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    const initial = getAppAudioPrefs();
    setMusicMutedState(initial.musicMuted);
    setSfxMutedState(initial.sfxMuted);
    applyAudioChannels(initial);
    return subscribeAppAudioPrefs(p => {
      setMusicMutedState(p.musicMuted);
      setSfxMutedState(p.sfxMuted);
    });
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    return () => {
      engine.stopAmbience();
    };
  }, []);

  const unlockAudio = useCallback(async () => {
    const engine = engineRef.current;
    applyAudioChannels(getAppAudioPrefs());
    await engine.ensureContext();
    if (!engine.isUnlocked) return false;
    setAudioReady(true);
    if (!isMusicMuted()) await engine.startAmbience();
    return true;
  }, []);

  const toggleMute = useCallback(async () => {
    const engine = engineRef.current;
    const nextMusic = !isMusicMuted();
    setAppMusicMuted(nextMusic);
    setMusicMutedState(nextMusic);
    if (!nextMusic) {
      await engine.ensureContext();
      setAudioReady(engine.isUnlocked);
      if (engine.isUnlocked) await engine.startAmbience();
    }
    return nextMusic;
  }, []);

  const playLeverPull = useCallback(
    async (style: 'default' | 'prize' | 'shield' = 'prize') => {
      if (isSfxMuted()) return;
      const engine = engineRef.current;
      await unlockAudio();
      await engine.playLeverPull(style);
    },
    [unlockAudio],
  );

  const playSpinSequence = useCallback(async () => {
    if (isSfxMuted()) return;
    const engine = engineRef.current;
    await engine.playSpinSequence(CASINO_SPIN_DURATION_MS, CASINO_SPIN_START_DELAY_MS);
  }, []);

  const playLandClunk = useCallback(async (style: 'prize' | 'shield' | 'soft' = 'prize') => {
    if (isSfxMuted()) return;
    const engine = engineRef.current;
    await engine.ensureContext();
    await engine.playLandClunk(style);
  }, []);

  const playWinResult = useCallback(async (winTier: WinTier) => {
    if (isSfxMuted()) return;
    const engine = engineRef.current;
    await engine.playWinResult(winTier);
  }, []);

  return {
    muted: musicMuted,
    musicMuted,
    sfxMuted,
    audioReady,
    unlockAudio,
    toggleMute,
    playLeverPull,
    playSpinSequence,
    playLandClunk,
    playWinResult,
  };
}
