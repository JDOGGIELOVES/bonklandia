'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WinTier } from '@/lib/slot-machine';
import {
  CASINO_SPIN_DURATION_MS,
  CASINO_SPIN_START_DELAY_MS,
  getCasinoAudioEngine,
} from '@/lib/casino-audio';
import { ALICE_AMBIENCE_CREDIT, getAliceAudioEngine } from '@/lib/alice-audio';
import {
  isAliceSpeechSupported,
  speakAliceLine,
  stopAliceSpeech,
  warmAliceVoices,
} from '@/lib/alice-voice';
import {
  isAliceVoiceEnabled,
  setAliceVoiceEnabled,
  subscribeAliceVoice,
  toggleAliceVoiceEnabled,
} from '@/lib/alice-voice-pref';
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
  /** Entity TTS — default off (opt-in). */
  const [voiceEnabled, setVoiceEnabledState] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const speechSupported =
    typeof window !== 'undefined' ? isAliceSpeechSupported() : true;

  useEffect(() => {
    const initial = getAppAudioPrefs();
    setMusicMutedState(initial.musicMuted);
    setSfxMutedState(initial.sfxMuted);
    applyAudioChannels(initial);
    setVoiceEnabledState(isAliceVoiceEnabled());
    warmAliceVoices();
    const unsubPrefs = subscribeAppAudioPrefs(p => {
      setMusicMutedState(p.musicMuted);
      setSfxMutedState(p.sfxMuted);
    });
    const unsubVoice = subscribeAliceVoice(setVoiceEnabledState);
    return () => {
      unsubPrefs();
      unsubVoice();
    };
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

    warmAliceVoices();
    return true;
  }, [level]);

  const stopEntitySpeech = useCallback(() => {
    stopAliceSpeech();
    musicRef.current.setMusicDucked(false);
    setEntitySpeaking(false);
  }, []);

  const speakEntityLine = useCallback(
    (text: string, entityId?: string, opts?: { force?: boolean }) => {
      if (!text.trim()) return;
      if (!isAliceSpeechSupported()) {
        setVoiceStatus('Speech not supported in this browser. Try Chrome or Edge on desktop.');
        return;
      }
      // Opt-in VO for auto lines. “Hear them” / Voice On sample uses force.
      if (!opts?.force) {
        if (!isAliceVoiceEnabled()) return;
      }
      const music = musicRef.current;
      // Do NOT call stopEntitySpeech() here — that cancel+delay breaks iOS gestures.
      // speakAliceLine() replaces any in-flight line safely.
      setEntitySpeaking(true);
      setVoiceStatus('Speaking…');
      // Duck trip music hard so system TTS is audible
      if (!isMusicMuted()) music.setMusicDucked(true);
      speakAliceLine(text, {
        entityId,
        volume: 1,
        onStart: () => {
          setEntitySpeaking(true);
          setVoiceStatus(null);
        },
        onEnd: () => {
          music.setMusicDucked(false);
          setEntitySpeaking(false);
          setVoiceStatus(null);
        },
        onError: reason => {
          setVoiceStatus(reason);
          music.setMusicDucked(false);
          setEntitySpeaking(false);
        },
      });
    },
    [],
  );

  const setVoiceEnabled = useCallback(
    (on: boolean) => {
      setAliceVoiceEnabled(on);
      setVoiceEnabledState(on);
      if (!on) {
        stopEntitySpeech();
        setVoiceStatus(null);
      }
    },
    [stopEntitySpeech],
  );

  /**
   * Toggle VO. Turning ON speaks a short confirmation immediately
   * (must stay in the click gesture for iOS / Chrome).
   */
  const toggleVoice = useCallback(() => {
    warmAliceVoices();
    const next = toggleAliceVoiceEnabled();
    setVoiceEnabledState(next);
    if (!next) {
      stopEntitySpeech();
      setVoiceStatus('Voice off.');
      return next;
    }
    // Short plain test line — easiest for system TTS to speak
    speakEntityLine('Voice is on.', undefined, { force: true });
    return next;
  }, [stopEntitySpeech, speakEntityLine]);

  /** Enable VO (if needed) and speak a line now — used by “Hear them speak”. */
  const hearEntityLine = useCallback(
    (text: string, entityId?: string) => {
      const line = text.trim() || 'Hello from the Alice Room.';
      warmAliceVoices();
      if (!isAliceVoiceEnabled()) {
        setAliceVoiceEnabled(true);
        setVoiceEnabledState(true);
      }
      // Must be called from a click handler (user gesture)
      speakEntityLine(line, entityId, { force: true });
    },
    [speakEntityLine],
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
    voiceEnabled,
    voiceStatus,
    speechSupported,
    unlockAudio,
    toggleMute,
    toggleVoice,
    setVoiceEnabled,
    playLeverPull,
    playSpinSequence,
    playLandClunk,
    playWinResult,
    speakEntityLine,
    hearEntityLine,
    stopEntitySpeech,
    ambienceCredit: ALICE_AMBIENCE_CREDIT,
  };
}
