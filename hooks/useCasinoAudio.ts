'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WinTier } from '@/lib/slot-machine';
import {
  CASINO_SPIN_DURATION_MS,
  CASINO_SPIN_START_DELAY_MS,
  getCasinoAudioEngine,
} from '@/lib/casino-audio';
import {
  applyMuteToAllEngines,
  isAppAudioMuted,
  setAppAudioMuted,
  subscribeAppAudioMuted,
} from '@/lib/global-audio';

export function useCasinoAudio() {
  const engineRef = useRef(getCasinoAudioEngine());
  const [muted, setMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    const initial = isAppAudioMuted();
    setMuted(initial);
    applyMuteToAllEngines(initial);
    return subscribeAppAudioMuted(setMuted);
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    return () => {
      engine.stopAmbience();
    };
  }, []);

  const unlockAudio = useCallback(async () => {
    if (isAppAudioMuted()) {
      applyMuteToAllEngines(true);
      return false;
    }
    const engine = engineRef.current;
    await engine.ensureContext();
    if (!engine.isUnlocked) return false;
    setAudioReady(true);
    if (!isAppAudioMuted()) await engine.startAmbience();
    return true;
  }, []);

  const toggleMute = useCallback(async () => {
    const engine = engineRef.current;
    const nowMuted = setAppAudioMuted(!isAppAudioMuted());
    setMuted(nowMuted);
    if (!nowMuted) {
      await engine.ensureContext();
      setAudioReady(engine.isUnlocked);
      if (engine.isUnlocked) await engine.startAmbience();
    }
    return nowMuted;
  }, []);

  const playLeverPull = useCallback(async () => {
    const engine = engineRef.current;
    await unlockAudio();
    await engine.playLeverPull();
  }, [unlockAudio]);

  const playSpinSequence = useCallback(async () => {
    const engine = engineRef.current;
    await engine.playSpinSequence(CASINO_SPIN_DURATION_MS, CASINO_SPIN_START_DELAY_MS);
  }, []);

  const playWinResult = useCallback(async (winTier: WinTier) => {
    const engine = engineRef.current;
    await engine.playWinResult(winTier);
  }, []);

  return {
    muted,
    audioReady,
    unlockAudio,
    toggleMute,
    playLeverPull,
    playSpinSequence,
    playWinResult,
  };
}
