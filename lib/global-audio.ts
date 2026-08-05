/**
 * App-wide audio control: independent music/SFX, exclusive music beds.
 */

import {
  getAppAudioPrefs,
  isAppAudioMuted,
  isMusicMuted,
  isSfxMuted,
  writeAppAudioMuted,
  writeAppAudioPrefs,
  type AppAudioPrefs,
} from '@/lib/audio-mute-state';
import { getAliceAudioEngine } from '@/lib/alice-audio';
import { stopAliceSpeech } from '@/lib/alice-voice';
import { getCasinoAudioEngine } from '@/lib/casino-audio';
import { getCombatAudioEngine } from '@/lib/combat-audio';
import { getActiveMusicBed, setActiveMusicBed, type MusicBed } from '@/lib/music-bed';

export type { MusicBed, AppAudioPrefs };
export { getActiveMusicBed, isAppAudioMuted, isMusicMuted, isSfxMuted, getAppAudioPrefs };

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
      getCasinoAudioEngine().stopMusicOnly();
    } catch {
      /* */
    }
  }
}

/** Push channel prefs into every engine. */
export function applyAudioChannels(prefs?: AppAudioPrefs): void {
  const p = prefs ?? getAppAudioPrefs();
  if (p.musicMuted) stopAllMusicBeds();
  try {
    getCasinoAudioEngine().setMusicMuted(p.musicMuted);
    getCasinoAudioEngine().setSfxMuted(p.sfxMuted);
  } catch {
    /* */
  }
  try {
    // Alice engine is music/VO only.
    getAliceAudioEngine().setMuted(p.musicMuted);
  } catch {
    /* */
  }
  try {
    // Combat is SFX only.
    getCombatAudioEngine().setMuted(p.sfxMuted);
  } catch {
    /* */
  }
}

/** @deprecated Prefer applyAudioChannels */
export function applyMuteToAllEngines(muted: boolean): void {
  applyAudioChannels({ musicMuted: muted, sfxMuted: muted });
}

export function setAppMusicMuted(musicMuted: boolean): AppAudioPrefs {
  const prefs = writeAppAudioPrefs({ musicMuted });
  applyAudioChannels(prefs);
  return prefs;
}

export function setAppSfxMuted(sfxMuted: boolean): AppAudioPrefs {
  const prefs = writeAppAudioPrefs({ sfxMuted });
  applyAudioChannels(prefs);
  return prefs;
}

export function toggleAppMusicMuted(): AppAudioPrefs {
  return setAppMusicMuted(!isMusicMuted());
}

export function toggleAppSfxMuted(): AppAudioPrefs {
  return setAppSfxMuted(!isSfxMuted());
}

/** Master mute: both channels. */
export function setAppAudioMuted(muted: boolean): boolean {
  writeAppAudioMuted(muted);
  applyAudioChannels(getAppAudioPrefs());
  return muted;
}

export function toggleAppAudioMuted(): boolean {
  return setAppAudioMuted(!isAppAudioMuted());
}

export {
  subscribeAppAudioMuted,
  subscribeAppAudioPrefs,
} from '@/lib/audio-mute-state';
