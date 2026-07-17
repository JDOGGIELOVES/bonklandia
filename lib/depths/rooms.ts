import {
  pickDepthsBoss,
  pickRivalByIndex,
  pickRandomRival,
} from '@/lib/rival-enemies';
import type { Enemy } from '@/lib/enemies';

export type DepthsRoomKind = 'fight' | 'elite' | 'event' | 'rest' | 'boss';

export type DepthsRoom = {
  id: string;
  kind: DepthsRoomKind;
  label: string;
  blurb: string;
  enemy?: Enemy;
  /** Event choice outcomes applied when picked */
  event?: {
    a: { label: string; log: string; hpDelta: number; vibeDelta: number; chips: number };
    b: { label: string; log: string; hpDelta: number; vibeDelta: number; chips: number };
  };
};

/** One floor: branching-lite path of 6 nodes ending in a boss. */
export function buildDepthsFloor(floor: number, run = 1): DepthsRoom[] {
  const f = Math.max(1, floor);
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
      label: "Jeet's Fork",
      blurb: 'A glowing terminal offers two bad ideas.',
      event: {
        a: {
          label: 'Take the free chips',
          log: 'You yoink the chips. Your vibe feels slightly scammed.',
          hpDelta: 0,
          vibeDelta: -8,
          chips: 25,
        },
        b: {
          label: 'Smash the terminal',
          log: 'Bonk energy floods the room. HP restored a bit.',
          hpDelta: 30,
          vibeDelta: 10,
          chips: 0,
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

export const DEPTHS_CHIP_REWARDS = {
  fight: 20,
  elite: 40,
  boss: 80,
  rest: 0,
  event: 0,
  clearBonus: 50,
} as const;
