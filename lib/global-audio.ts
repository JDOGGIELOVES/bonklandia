/**
 * App-wide audio control: one mute for all engines, exclusive music beds.
 */

import { isAppAudioMuted, writeAppAudioMuted } from '@/lib/audio-mute-state';
import { getAliceAudioEngine } from '@/lib/alice-audio';
import { stopAliceSpeech } from '@/lib/alice-voice';
import { getCasinoAudioEngine } from '@/lib/casino-audio';
import { getCombatAudioEngine } from '@/lib/combat-audio';

export type MusicBed = 'casino' | 'alice';

/** Hard-stop every looping music bed + entity speech. */
export function stopAllMusicBeds(): void {
  try {
    getCasinoAudioEngine().stopAmbience();
  } catch {
    /* */
  }
  try {
    getAliceAudioEngine().stopAmbience();
    getAliceAudioEngine().setMusicDucked(false);
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
 * Only one music bed may run. Call before starting casino or Alice ambience.
 */
export function claimMusicBed(bed: MusicBed): void {
  if (bed === 'casino') {
    try {
      getAliceAudioEngine().stopAmbience();
      getAliceAudioEngine().setMusicDucked(false);
      stopAliceSpeech();
    } catch {
      /* */
    }
  } else {
    try {
      getCasinoAudioEngine().stopAmbience();
    } catch {
      /* */
    }
  }
}

/** Push mute flag into every engine (does not write localStorage). */
export function applyMuteToAllEngines(muted: boolean): void {
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
  if (muted) stopAllMusicBeds();
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
