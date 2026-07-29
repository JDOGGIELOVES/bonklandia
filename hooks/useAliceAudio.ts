'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WinTier } from '@/lib/slot-machine';
import {
  CASINO_SPIN_DURATION_MS,
  CASINO_SPIN_START_DELAY_MS,
  getCasinoAudioEngine,
} from '@/lib/casino-audio';
import { ALICE_AMBIENCE_CREDIT, getAliceAudioEngine } from '@/lib/alice-audio';
import { speakAliceLine, stopAliceSpeech } from '@/lib/alice-voice';

/**
 * Alice Room audio: Bandit lever/reel/win SFX + trip ambience + entity VO.
 * Music ducks while entities speak so lines stay clear over the bed.
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
      stopAliceSpeech();
      music.setMusicDucked(false);
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
    // Warm speech voices after the same user gesture.
    try {
      window.speechSynthesis?.getVoices();
    } catch {
      /* */
    }
    return true;
  }, [level]);

  const stopEntitySpeech = useCallback(() => {
    stopAliceSpeech();
    musicRef.current.setMusicDucked(false);
  }, []);

  const speakEntityLine = useCallback(
    (text: string, entityId?: string) => {
      if (muted || !text.trim()) return;
      const music = musicRef.current;
      // Cancel prior line; duck before speak so first syllables aren’t buried.
      stopAliceSpeech();
      music.setMusicDucked(true);
      speakAliceLine(text, {
        entityId,
        volume: 1,
        onEnd: () => {
          music.setMusicDucked(false);
        },
      });
    },
    [muted],
  );

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
    if (nowMuted) {
      stopEntitySpeech();
    } else {
      sfx.stopAmbience();
      await music.startAmbience(level);
    }
    return nowMuted;
  }, [muted, level, stopEntitySpeech]);

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
    speakEntityLine,
    stopEntitySpeech,
    ambienceCredit: ALICE_AMBIENCE_CREDIT,
  };
}
