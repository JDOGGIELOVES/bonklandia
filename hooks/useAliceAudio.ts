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
  applyAudioChannels,
  claimMusicBed,
  getAppAudioPrefs,
  isMusicMuted,
  isSfxMuted,
  setAppMusicMuted,
  subscribeAppAudioPrefs,
} from '@/lib/global-audio';

/**
 * Alice Room audio: Bandit lever/reel/win SFX + trip ambience + entity VO.
 * Music and SFX are independent app-wide prefs.
 */
export function useAliceAudio(level = 1) {
  const sfxRef = useRef(getCasinoAudioEngine());
  const musicRef = useRef(getAliceAudioEngine());
  const [musicMuted, setMusicMutedState] = useState(false);
  const [sfxMuted, setSfxMutedState] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [entitySpeaking, setEntitySpeaking] = useState(false);

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
    const sfx = sfxRef.current;
    const music = musicRef.current;
    return () => {
      stopAliceSpeech();
      music.setMusicDucked(false);
      music.stopAmbience();
      sfx.stopMusicOnly();
    };
  }, []);

  useEffect(() => {
    if (!audioReady || musicMuted) return;
    musicRef.current.setLevel(level);
  }, [level, audioReady, musicMuted]);

  const unlockAudio = useCallback(async () => {
    const prefs = getAppAudioPrefs();
    applyAudioChannels(prefs);
    const sfx = sfxRef.current;
    const music = musicRef.current;
    await sfx.ensureContext();
    await music.ensureContext();
    if (!sfx.isUnlocked && !music.isUnlocked) return false;
    setAudioReady(true);

    if (!prefs.musicMuted) {
      claimMusicBed('alice');
      if (!music.isMusicRunning) {
        await music.startAmbience(level);
      } else {
        music.setLevel(level);
      }
    }

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
    setEntitySpeaking(false);
  }, []);

  const speakEntityLine = useCallback(
    (text: string, entityId?: string) => {
      // VO rides with music channel so Music Off also quiets entities.
      if (musicMuted || isMusicMuted() || !text.trim()) return;
      const music = musicRef.current;
      stopAliceSpeech();
      setEntitySpeaking(true);
      music.setMusicDucked(true);
      speakAliceLine(text, {
        entityId,
        volume: 1,
        onStart: () => setEntitySpeaking(true),
        onEnd: () => {
          music.setMusicDucked(false);
          setEntitySpeaking(false);
        },
      });
    },
    [musicMuted],
  );

  /** Toggle music only (header button). */
  const toggleMute = useCallback(async () => {
    const nextMusic = !isMusicMuted();
    setAppMusicMuted(nextMusic);
    setMusicMutedState(nextMusic);
    if (nextMusic) {
      stopEntitySpeech();
    } else {
      const sfx = sfxRef.current;
      const music = musicRef.current;
      await sfx.ensureContext();
      await music.ensureContext();
      setAudioReady(sfx.isUnlocked || music.isUnlocked);
      if (sfx.isUnlocked || music.isUnlocked) {
        claimMusicBed('alice');
        await music.startAmbience(level);
      }
    }
    return nextMusic;
  }, [level, stopEntitySpeech]);

  const playLeverPull = useCallback(
    async (style: 'default' | 'prize' | 'shield' = 'prize') => {
      if (isSfxMuted()) return;
      const sfx = sfxRef.current;
      await unlockAudio();
      await sfx.ensureContext();
      await sfx.playLeverPull(style);
    },
    [unlockAudio],
  );

  const playSpinSequence = useCallback(async () => {
    if (isSfxMuted()) return;
    const sfx = sfxRef.current;
    await sfx.ensureContext();
    if (!isMusicMuted()) musicRef.current.setMusicDucked(true);
    await sfx.playSpinSequence(CASINO_SPIN_DURATION_MS, CASINO_SPIN_START_DELAY_MS);
    window.setTimeout(() => {
      if (!isMusicMuted()) musicRef.current.setMusicDucked(false);
    }, CASINO_SPIN_DURATION_MS + 1200);
  }, []);

  const playLandClunk = useCallback(async (style: 'prize' | 'shield' | 'soft' = 'soft') => {
    if (isSfxMuted()) return;
    const sfx = sfxRef.current;
    await sfx.ensureContext();
    await sfx.playLandClunk(style);
  }, []);

  const playWinResult = useCallback(async (winTier: WinTier) => {
    if (isSfxMuted()) return;
    const sfx = sfxRef.current;
    await sfx.ensureContext();
    await sfx.playWinResult(winTier);
  }, []);

  return {
    muted: musicMuted,
    musicMuted,
    sfxMuted,
    audioReady,
    entitySpeaking,
    unlockAudio,
    toggleMute,
    playLeverPull,
    playSpinSequence,
    playLandClunk,
    playWinResult,
    speakEntityLine,
    stopEntitySpeech,
    ambienceCredit: ALICE_AMBIENCE_CREDIT,
  };
}
