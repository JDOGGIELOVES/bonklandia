import { pickDepthsBoss, pickRivalByIndex } from '@/lib/rival-enemies';
import { pickDegenByIndex } from '@/lib/enemies';
import type { Enemy } from '@/lib/enemies';
import { pickDepthsEventPack } from '@/lib/depths/events';

export type DepthsRoomKind = 'fight' | 'elite' | 'event' | 'rest' | 'boss' | 'degen';

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

/** Rotating “Valley Leak” chamber skins — same degen fight rules. */
const DEGEN_ROOM_SKINS = [
  {
    label: 'Valley Leak',
    blurb:
      'A crack in the ceiling pours Degen Valley air. A psychology-type degen tumbled through — still mid-cope.',
  },
  {
    label: 'Telegram Trench',
    blurb:
      'Pinned messages and pure cope. A classic valley degen holds the trench with bad takes and worse timing.',
  },
  {
    label: 'Cope Vent',
    blurb:
      'Sweet pink fog and worse opinions. Someone from the main valley is lost down here — and armed with vibes.',
  },
] as const;

/**
 * Instant rewards for clearing a degen (Valley Leak) chamber — before Bandit opens.
 * Rivals lean Bandit-only; degens pay chips + vibe too (comedy tax refund).
 */
export function depthsDegenClearReward(difficulty: 'easy' | 'medium' | 'hard'): {
  chips: number;
  vibe: number;
} {
  switch (difficulty) {
    case 'easy':
      return { chips: 28, vibe: 16 };
    case 'hard':
      return { chips: 18, vibe: 10 };
    default:
      return { chips: 22, vibe: 12 };
  }
}

/** One floor: path of 6 nodes ending in a boss. Includes a degen “Valley Leak” chamber. */
export function buildDepthsFloor(floor: number, run = 1): DepthsRoom[] {
  const f = Math.max(1, floor);
  const eventPack = pickDepthsEventPack(f * 17 + run * 31);
  const degenSkin = DEGEN_ROOM_SKINS[Math.abs(f * 5 + run * 3) % DEGEN_ROOM_SKINS.length]!;
  const degenEnemy = pickDegenByIndex(f * 7 + run * 11, run);

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
      kind: 'degen',
      label: degenSkin.label,
      blurb: `${degenSkin.blurb} (${degenEnemy.name} is here.)`,
      enemy: degenEnemy,
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
 * Flat chip drips — degen chambers pay via depthsDegenClearReward + Bandit.
 * Rival clears are mostly Bandit-only.
 */
export const DEPTHS_CHIP_REWARDS = {
  fight: 0,
  elite: 0,
  boss: 0,
  rest: 0,
  event: 0,
  degen: 22,
  clearBonus: 0,
} as const;
