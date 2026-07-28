'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WinTier } from '@/lib/slot-machine';
import {
  CASINO_SPIN_DURATION_MS,
  CASINO_SPIN_START_DELAY_MS,
  getCasinoAudioEngine,
} from '@/lib/casino-audio';
import { ALICE_AMBIENCE_CREDIT, getAliceAudioEngine } from '@/lib/alice-audio';

/**
 * Alice Room audio: Bandit lever/reel/win SFX + trip ambience that morphs by level.
 */
export function useAliceAudio(level = 1) {
  const sfxRef = useRef(getCasinoAudioEngine());
  const musicRef = useRef(getAliceAudioEngine());
  const [muted, setMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    const sfx = sfxRef.current;
    const music = musicRef.current;
    return () => {
      sfx.stopAmbience();
      music.stopAmbience();
    };
  }, []);

  // Morph trip bed as the player descends.
  useEffect(() => {
    if (!audioReady || muted) return;
    musicRef.current.setLevel(level);
  }, [level, audioReady, muted]);

  const unlockAudio = useCallback(async () => {
    const sfx = sfxRef.current;
    const music = musicRef.current;
    await sfx.ensureContext();
    await music.ensureContext();
    if (!sfx.isUnlocked && !music.isUnlocked) return false;
    setAudioReady(true);
    // Stop casino lounge if it was started earlier.
    sfx.stopAmbience();
    if (!music.isMuted) await music.startAmbience(level);
    return true;
  }, [level]);

  const toggleMute = useCallback(async () => {
    const sfx = sfxRef.current;
    const music = musicRef.current;
    await sfx.ensureContext();
    await music.ensureContext();
    // Keep both engines in sync for mute.
    const nowMuted = !muted;
    sfx.setMuted(nowMuted);
    music.setMuted(nowMuted);
    setMuted(nowMuted);
    setAudioReady(sfx.isUnlocked || music.isUnlocked);
    if (!nowMuted) {
      sfx.stopAmbience();
      await music.startAmbience(level);
    }
    return nowMuted;
  }, [muted, level]);

  const playLeverPull = useCallback(async () => {
    const sfx = sfxRef.current;
    await unlockAudio();
    await sfx.playLeverPull();
  }, [unlockAudio]);

  const playSpinSequence = useCallback(async () => {
    const sfx = sfxRef.current;
    await sfx.playSpinSequence(CASINO_SPIN_DURATION_MS, CASINO_SPIN_START_DELAY_MS);
  }, []);

  const playWinResult = useCallback(async (winTier: WinTier) => {
    const sfx = sfxRef.current;
    await sfx.playWinResult(winTier);
  }, []);

  return {
    muted,
    audioReady,
    unlockAudio,
    toggleMute,
    playLeverPull,
    playSpinSequence,
    playWinResult,
    ambienceCredit: ALICE_AMBIENCE_CREDIT,
  };
}
