/**
 * App-wide audio control: one mute for all engines, exclusive music beds.
 */

import { isAppAudioMuted, writeAppAudioMuted } from '@/lib/audio-mute-state';
import { getAliceAudioEngine } from '@/lib/alice-audio';
import { stopAliceSpeech } from '@/lib/alice-voice';
import { getCasinoAudioEngine } from '@/lib/casino-audio';
import { getCombatAudioEngine } from '@/lib/combat-audio';
import { getActiveMusicBed, setActiveMusicBed, type MusicBed } from '@/lib/music-bed';

export type { MusicBed };
export { getActiveMusicBed };

/** Hard-stop every looping music bed + entity speech. Keeps SFX engines alive. */
export function stopAllMusicBeds(): void {
  setActiveMusicBed('none');
  try {
    getCasinoAudioEngine().stopMusicOnly();
  } catch {
    /* */
  }
  try {
    getAliceAudioEngine().stopAmbience();
  } catch {
    /* */
  }
  try {
    stopAliceSpeech();
  } catch {
    /* */
  }
}

/**
 * Only one music bed may run. Stops the other bed’s music without killing SFX.
 */
export function claimMusicBed(bed: MusicBed): void {
  setActiveMusicBed(bed);
  if (bed === 'casino') {
    try {
      getAliceAudioEngine().stopAmbience();
      stopAliceSpeech();
    } catch {
      /* */
    }
  } else {
    try {
      // Music only — Alice lever/reel SFX use the casino engine.
      getCasinoAudioEngine().stopMusicOnly();
    } catch {
      /* */
    }
  }
}

/** Push mute flag into every engine (does not write localStorage). */
export function applyMuteToAllEngines(muted: boolean): void {
  // Stop beds first so setMuted never races with stale loops.
  if (muted) stopAllMusicBeds();
  try {
    getCasinoAudioEngine().setMuted(muted);
  } catch {
    /* */
  }
  try {
    getAliceAudioEngine().setMuted(muted);
  } catch {
    /* */
  }
  try {
    getCombatAudioEngine().setMuted(muted);
  } catch {
    /* */
  }
}

/** Master mute: persist, sync engines, kill music when off. */
export function setAppAudioMuted(muted: boolean): boolean {
  writeAppAudioMuted(muted);
  applyMuteToAllEngines(muted);
  return muted;
}

export function toggleAppAudioMuted(): boolean {
  return setAppAudioMuted(!isAppAudioMuted());
}

export { isAppAudioMuted, subscribeAppAudioMuted } from '@/lib/audio-mute-state';
