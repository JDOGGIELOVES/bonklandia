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
import {
  applyMuteToAllEngines,
  isAppAudioMuted,
  setAppAudioMuted,
  subscribeAppAudioMuted,
} from '@/lib/global-audio';

/**
 * Alice Room audio: Bandit lever/reel/win SFX + trip ambience + entity VO.
 * Mute is app-wide (same as fixed MUSIC button). Music ducks while entities speak.
 */
export function useAliceAudio(level = 1) {
  const sfxRef = useRef(getCasinoAudioEngine());
  const musicRef = useRef(getAliceAudioEngine());
  const [muted, setMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    const initial = isAppAudioMuted();
    setMuted(initial);
    applyMuteToAllEngines(initial);
    return subscribeAppAudioMuted(setMuted);
  }, []);

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

  useEffect(() => {
    if (!audioReady || muted) return;
    musicRef.current.setLevel(level);
  }, [level, audioReady, muted]);

  const unlockAudio = useCallback(async () => {
    if (isAppAudioMuted()) {
      applyMuteToAllEngines(true);
      return false;
    }
    const sfx = sfxRef.current;
    const music = musicRef.current;
    await sfx.ensureContext();
    await music.ensureContext();
    if (!sfx.isUnlocked && !music.isUnlocked) return false;
    setAudioReady(true);
    sfx.stopAmbience();
    if (!isAppAudioMuted()) await music.startAmbience(level);
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
      if (muted || isAppAudioMuted() || !text.trim()) return;
      const music = musicRef.current;
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
    const nowMuted = setAppAudioMuted(!isAppAudioMuted());
    setMuted(nowMuted);
    if (nowMuted) {
      stopEntitySpeech();
    } else {
      const sfx = sfxRef.current;
      const music = musicRef.current;
      await sfx.ensureContext();
      await music.ensureContext();
      setAudioReady(sfx.isUnlocked || music.isUnlocked);
      sfx.stopAmbience();
      if (sfx.isUnlocked || music.isUnlocked) await music.startAmbience(level);
    }
    return nowMuted;
  }, [level, stopEntitySpeech]);

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
