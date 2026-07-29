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
  claimMusicBed,
  isAppAudioMuted,
  setAppAudioMuted,
  subscribeAppAudioMuted,
} from '@/lib/global-audio';

/**
 * Alice Room audio: Bandit lever/reel/win SFX + trip ambience + entity VO.
 * Mute is app-wide. Only one music bed. SFX always use casino engine (music-only stop).
 */
export function useAliceAudio(level = 1) {
  const sfxRef = useRef(getCasinoAudioEngine());
  const musicRef = useRef(getAliceAudioEngine());
  const [muted, setMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const startedRef = useRef(false);

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
      music.stopAmbience();
      // Do not call sfx.stopAmbience() — that kills reel timers; music-only is enough.
      sfx.stopMusicOnly();
      startedRef.current = false;
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
    // Sync mute flags so SFX master gain is open.
    sfx.setMuted(false);
    music.setMuted(false);
    if (!sfx.isUnlocked && !music.isUnlocked) return false;
    setAudioReady(true);

    // Claim Alice bed once; startAmbience is idempotent against double loops.
    claimMusicBed('alice');
    if (!music.isMusicRunning) {
      await music.startAmbience(level);
    } else {
      music.setLevel(level);
    }
    startedRef.current = true;

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
      startedRef.current = false;
    } else {
      const sfx = sfxRef.current;
      const music = musicRef.current;
      await sfx.ensureContext();
      await music.ensureContext();
      sfx.setMuted(false);
      music.setMuted(false);
      setAudioReady(sfx.isUnlocked || music.isUnlocked);
      // Explicit single start after unmute (setMuted never auto-starts).
      if (sfx.isUnlocked || music.isUnlocked) {
        claimMusicBed('alice');
        await music.startAmbience(level);
        startedRef.current = true;
      }
    }
    return nowMuted;
  }, [level, stopEntitySpeech]);

  const playLeverPull = useCallback(async () => {
    if (isAppAudioMuted()) return;
    const sfx = sfxRef.current;
    await unlockAudio();
    // Resume SFX context + ensure not muted (Alice music is a different engine).
    await sfx.ensureContext();
    if (!isAppAudioMuted()) sfx.setMuted(false);
    await sfx.playLeverPull();
  }, [unlockAudio]);

  const playSpinSequence = useCallback(async () => {
    if (isAppAudioMuted()) return;
    const sfx = sfxRef.current;
    await sfx.ensureContext();
    if (!isAppAudioMuted()) sfx.setMuted(false);
    // Light music duck so reel ticks cut through Folk Round.
    musicRef.current.setMusicDucked(true);
    await sfx.playSpinSequence(CASINO_SPIN_DURATION_MS, CASINO_SPIN_START_DELAY_MS);
    window.setTimeout(() => {
      if (!isAppAudioMuted()) musicRef.current.setMusicDucked(false);
    }, CASINO_SPIN_DURATION_MS + 1200);
  }, []);

  const playWinResult = useCallback(async (winTier: WinTier) => {
    if (isAppAudioMuted()) return;
    const sfx = sfxRef.current;
    await sfx.ensureContext();
    if (!isAppAudioMuted()) sfx.setMuted(false);
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
