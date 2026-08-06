import {
  pickDepthsBoss,
  pickRivalByIndex,
  pickRandomRival,
} from '@/lib/rival-enemies';
import type { Enemy } from '@/lib/enemies';
import { pickDepthsEventPack } from '@/lib/depths/events';

export type DepthsRoomKind = 'fight' | 'elite' | 'event' | 'rest' | 'boss';

export type DepthsRoom = {
  id: string;
  kind: DepthsRoomKind;
  label: string;
  blurb: string;
  enemy?: Enemy;
  /** Event choice outcomes applied when picked */
  event?: {
    a: {
      label: string;
      whisper?: string;
      log: string;
      hpDelta: number;
      vibeDelta: number;
      chips: number;
    };
    b: {
      label: string;
      whisper?: string;
      log: string;
      hpDelta: number;
      vibeDelta: number;
      chips: number;
    };
  };
};

/** One floor: branching-lite path of 6 nodes ending in a boss. */
export function buildDepthsFloor(floor: number, run = 1): DepthsRoom[] {
  const f = Math.max(1, floor);
  const eventPack = pickDepthsEventPack(f * 17 + run * 31);
  return [
    {
      id: `${f}-1`,
      kind: 'fight',
      label: 'Copycat Corridor',
      blurb: 'A rival mascot blocks the tunnel.',
      enemy: pickRivalByIndex(f * 2, run),
    },
    {
      id: `${f}-2`,
      kind: 'event',
      label: eventPack.label,
      blurb: eventPack.blurb,
      event: {
        a: {
          label: eventPack.a.label,
          whisper: eventPack.a.whisper,
          log: eventPack.a.log,
          hpDelta: eventPack.a.hpDelta,
          vibeDelta: eventPack.a.vibeDelta,
          chips: eventPack.a.chips,
        },
        b: {
          label: eventPack.b.label,
          whisper: eventPack.b.whisper,
          log: eventPack.b.log,
          hpDelta: eventPack.b.hpDelta,
          vibeDelta: eventPack.b.vibeDelta,
          chips: eventPack.b.chips,
        },
      },
    },
    {
      id: `${f}-3`,
      kind: 'elite',
      label: 'Aura Chamber',
      blurb: 'Something with main-character energy waits inside.',
      enemy: pickRivalByIndex(f * 3 + 1, run),
    },
    {
      id: `${f}-4`,
      kind: 'rest',
      label: 'Frequency Camp',
      blurb: 'Bonga left a hum in the stone. Catch your breath.',
    },
    {
      id: `${f}-5`,
      kind: 'fight',
      label: 'Meme Crossroads',
      blurb: pickRandomRival(run).name + ' was here. Still is.',
      enemy: pickRandomRival(run),
    },
    {
      id: `${f}-6`,
      kind: 'boss',
      label: f >= 2 ? 'Council Vault' : 'Impostor Throne',
      blurb:
        f >= 2
          ? 'Three heads. One agenda. Zero originality.'
          : 'Someone is wearing knockoff gold and calling it the First Bonk.',
      enemy: pickDepthsBoss(f, run),
    },
  ];
}

/**
 * Flat chip drips are intentionally tiny — real rewards route through the
 * Bonklandia Bandit (free victory pulls on floor clear, quarter slots on room wins).
 */
export const DEPTHS_CHIP_REWARDS = {
  fight: 0,
  elite: 0,
  boss: 0,
  rest: 0,
  event: 0,
  clearBonus: 0,
} as const;
