import {
  buildChoicesForLevel,
  getEncounter,
  LOSS_FRACTION,
  type ChoiceTier,
  type EncounterChoice,
} from '@/lib/alice-room/encounters';
import {
  ALL_ALICE_SYMBOLS,
  getEntityForLevel,
  matchesDefenseEntity,
  type AliceSymbol,
} from '@/lib/alice-room/symbols';

export const PRE_BOSS_LEVELS = 9;
export const BOSS_LEVEL = 10;
export const TOTAL_LEVELS = 10;
/** @deprecated use PRE_BOSS_LEVELS */
export const ELF_LEVELS = PRE_BOSS_LEVELS;

export const ALICE_COINS_PER_SPENDABLE_CHIP = 80;
export const MAX_ALICE_SPENDABLE_PAYOUT = Number(
  process.env.MAX_ALICE_SPENDABLE_PAYOUT ?? '90',
);

/**
 * Only hard-kill after many *identical punishing* choices in a row.
 * Safe ("none") and double never count — always playable.
 * UI slot spam removed (too many false positives when labels shuffle).
 */
export const TRIP_KILL_SAME_TIER_STREAK = 6;
export const TRIP_KILL_WARN_STREAK = 5;

export type AlicePhase =
  | 'intro'
  | 'player-spin'
  | 'spinning'
  | 'player-result'
  | 'elf-attack'
  | 'block-spinning'
  | 'block-result'
  | 'trick-choices'
  | 'level-clear'
  | 'victory'
  | 'defeat';

export type TrickChoice = EncounterChoice & {
  id: string;
  /** UI slot after shuffle (for anti-rush) */
  slotIndex: number;
  lossFraction: number;
};

export type AliceLevelInfo = {
  level: number;
  isBoss: boolean;
  name: string;
  blurb: string;
  depthLabel: string;
  loving: boolean;
  entityId: string;
  attackLine: string;
  failLine: string;
};

export function getLevelInfo(level: number): AliceLevelInfo {
  const enc = getEncounter(level);
  const isBoss = level >= BOSS_LEVEL;
  return {
    level: Math.min(level, TOTAL_LEVELS),
    isBoss,
    name: enc.name,
    blurb: enc.attackLine,
    depthLabel: isBoss ? 'Reality Layer ∞' : `Reality Layer ${level}`,
    loving: enc.loving,
    entityId: enc.entityId,
    attackLine: enc.attackLine,
    failLine: enc.failLine,
  };
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function buildAliceReelStrip(
  result: AliceSymbol,
  pool: AliceSymbol[] = ALL_ALICE_SYMBOLS,
  length = 28,
): AliceSymbol[] {
  const strip: AliceSymbol[] = [];
  for (let i = 0; i < length; i++) {
    strip.push(i === length - 1 ? result : pick(pool));
  }
  return strip;
}

/** Easy large Alice Coin wins (run points only). */
export function spinPlayerReels(level: number): {
  reels: [AliceSymbol, AliceSymbol, AliceSymbol];
  aliceCoins: number;
  message: string;
} {
  const depthBoost = 1 + (level - 1) * 0.06;
  const pool = ALL_ALICE_SYMBOLS;
  const reels: [AliceSymbol, AliceSymbol, AliceSymbol] = [
    pick(pool),
    pick(pool),
    pick(pool),
  ];

  let aliceCoins = Math.floor((400 + Math.random() * 600) * depthBoost);
  let message = 'Alice Coins pour easily — dream-wealth only until the end.';

  const sameThree = reels[0].id === reels[1].id && reels[1].id === reels[2].id;
  const twoMatch =
    reels[0].id === reels[1].id || reels[1].id === reels[2].id || reels[0].id === reels[2].id;
  const lovingLine = reels.every(r => r.kind === 'loving');

  if (sameThree) {
    aliceCoins = Math.floor((7000 + Math.random() * 5000) * depthBoost);
    message = `Triple ${reels[0].label}! Hyperspace jackpot!`;
  } else if (lovingLine) {
    aliceCoins = Math.floor((4000 + Math.random() * 2500) * depthBoost);
    message = 'A line of loving presence — Alice Coins bloom.';
  } else if (twoMatch) {
    aliceCoins = Math.floor((1500 + Math.random() * 2000) * depthBoost);
    message = 'A matching pair deepens the dream.';
  }

  return { reels, aliceCoins, message };
}

export function spinBlockReels(level: number): {
  reels: [AliceSymbol, AliceSymbol, AliceSymbol];
  blocked: boolean;
  message: string;
} {
  const target = getEntityForLevel(level);
  const isBoss = level >= BOSS_LEVEL;
  const hitWeight = isBoss ? 0.34 : 0.4;
  const roll = (): AliceSymbol => {
    if (Math.random() < hitWeight) return target;
    return pick(ALL_ALICE_SYMBOLS.filter(s => s.id !== target.id));
  };
  const reels: [AliceSymbol, AliceSymbol, AliceSymbol] = [roll(), roll(), roll()];
  const blocked = reels.every(r => matchesDefenseEntity(r, level));
  return {
    reels,
    blocked,
    message: blocked
      ? `THREE ${target.label.toUpperCase()}! Encounter blocked — Alice Coins safe!`
      : getEncounter(level).failLine,
  };
}

export function buildTrickChoices(
  level: number,
  runSeed: number,
  doubleAlreadyUsed: boolean,
): TrickChoice[] {
  const enc = getEncounter(level);
  const raw = buildChoicesForLevel(level, runSeed, doubleAlreadyUsed);
  return raw.map((c, slotIndex) => {
    let lossFraction = LOSS_FRACTION[c.tier];
    if (c.tier === 'double') lossFraction = 0;
    else if (enc.loving) {
      lossFraction = Math.min(lossFraction, enc.maxLossFraction);
    } else if (level >= BOSS_LEVEL && c.tier === 'moderate') {
      lossFraction = 0.4;
    } else if (level >= BOSS_LEVEL && c.tier === 'heavy') {
      lossFraction = 0.85;
    }
    return {
      ...c,
      id: `L${level}-${c.tier}-${slotIndex}-${c.label.slice(0, 12)}`,
      slotIndex,
      lossFraction,
    };
  });
}

export function applyChoice(
  coins: number,
  choice: TrickChoice,
): { nextCoins: number; lost: number; gained: number; flavor: string } {
  if (choice.tier === 'double') {
    const next = coins * 2;
    return {
      nextCoins: next,
      lost: 0,
      gained: coins,
      flavor: 'The presence opens fully — Alice Coins double.',
    };
  }
  const lost = Math.floor(coins * choice.lossFraction);
  const nextCoins = Math.max(0, coins - lost);
  const flavor =
    choice.tier === 'none'
      ? 'True path. Coins untouched.'
      : choice.tier === 'moderate'
        ? 'A moderate toll. The trip deepens.'
        : choice.tier === 'heavy'
          ? 'Heavy loss. The satchel thins.'
          : lost >= coins
            ? 'Everything. The satchel is empty.'
            : 'Harsh cut — loving floors still spare half.';
  return { nextCoins, lost, gained: 0, flavor };
}

/** @deprecated use applyChoice */
export function applyTrickLoss(coins: number, choice: TrickChoice) {
  const r = applyChoice(coins, choice);
  return { nextCoins: r.nextCoins, lost: r.lost, flavor: r.flavor };
}

export type TripKillState = {
  /** Last failed-defense *punishing* tiers only (moderate / heavy / wipe). */
  punishHistory: ChoiceTier[];
  warned: boolean;
};

export function emptyTripKillState(): TripKillState {
  return { punishHistory: [], warned: false };
}

export type TripKillResult =
  | { kill: false; warn: boolean; message?: string }
  | { kill: true; message: string };

function isPunishingTier(tier: ChoiceTier): boolean {
  return tier === 'moderate' || tier === 'heavy' || tier === 'wipe';
}

/**
 * Soft anti-rush only.
 * - Safe / double choices never count toward kill.
 * - Successful defense should call {@link resetTripKillStreak}.
 * - Need 6 identical punishing tiers in a row to eject (very hard to hit by accident).
 */
export function evaluateTripKill(
  state: TripKillState,
  choice: TrickChoice,
): { state: TripKillState; result: TripKillResult } {
  // Good / gift paths clear the rush meter.
  if (!isPunishingTier(choice.tier)) {
    return {
      state: { punishHistory: [], warned: false },
      result: { kill: false, warn: false },
    };
  }

  const punishHistory = [...state.punishHistory, choice.tier];
  const next: TripKillState = {
    punishHistory,
    warned: state.warned,
  };

  const tierStreak = trailingStreak(punishHistory);

  if (tierStreak >= TRIP_KILL_SAME_TIER_STREAK) {
    return {
      state: next,
      result: {
        kill: true,
        message:
          'TRIP KILL — You forced the same harsh path six times in a row. Slow down and read the doors. Final tally: nothing spendable.',
      },
    };
  }

  if (!state.warned && tierStreak >= TRIP_KILL_WARN_STREAK) {
    next.warned = true;
    return {
      state: next,
      result: {
        kill: false,
        warn: true,
        message:
          'Pattern warning — repeating the same harsh choice many times may eject the trip. Try a different door.',
      },
    };
  }

  return { state: next, result: { kill: false, warn: false } };
}

/** Call after a successful 3-entity shield so blocks refresh the meter. */
export function resetTripKillStreak(state: TripKillState): TripKillState {
  return { punishHistory: [], warned: false };
}

function trailingStreak<T>(arr: T[]): number {
  if (arr.length === 0) return 0;
  const last = arr[arr.length - 1];
  let n = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] === last) n++;
    else break;
  }
  return n;
}

export function aliceCoinsToSpendable(aliceCoins: number): number {
  const raw = Math.floor(Math.max(0, aliceCoins) / ALICE_COINS_PER_SPENDABLE_CHIP);
  return Math.min(MAX_ALICE_SPENDABLE_PAYOUT, Math.max(0, raw));
}

export function newRunSeed(): number {
  return (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0;
}
