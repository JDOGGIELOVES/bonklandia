import {
  ALL_ALICE_SYMBOLS,
  getEntityForLevel,
  matchesDefenseEntity,
  type AliceSymbol,
} from '@/lib/alice-room/symbols';

export const ELF_LEVELS = 9; // levels before boss
export const BOSS_LEVEL = 10;
export const TOTAL_LEVELS = BOSS_LEVEL;

/** Alice Coins are run points only — not cashier chips until boss clear conversion. */
export const ALICE_COINS_PER_SPENDABLE_CHIP = 80;
export const MAX_ALICE_SPENDABLE_PAYOUT = Number(
  process.env.MAX_ALICE_SPENDABLE_PAYOUT ?? '90',
);

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

export type LossTier = 'none' | 'moderate' | 'heavy' | 'all';

export type TrickChoice = {
  id: string;
  label: string;
  whisper: string;
  tier: LossTier;
  lossFraction: number;
};

export type AliceLevelInfo = {
  level: number;
  isBoss: boolean;
  name: string;
  blurb: string;
  depthLabel: string;
};

export function getLevelInfo(level: number): AliceLevelInfo {
  const isBoss = level >= BOSS_LEVEL;
  const roster: { name: string; blurb: string }[] = [
    {
      name: 'Machine Elves',
      blurb: 'Self-transforming elves present impossible toys. Spin for Alice Coins — then shield with three elves.',
    },
    {
      name: 'Jesters / Tricksters',
      blurb: 'Cosmic prank energy. Land three Jesters to block the mockery.',
    },
    {
      name: 'Insectoids / Mantis',
      blurb: 'Clinical, supervisory presence. Three Mantis blocks the exam.',
    },
    {
      name: 'Greys',
      blurb: 'Sterile observation. Three Greys form the shield line.',
    },
    {
      name: 'Light Beings',
      blurb: 'Overwhelming benevolence. Loving floor — losses capped; a rare double gift exists.',
    },
    {
      name: 'Goddess / Divine Feminine',
      blurb: 'Heart-level encounter. Loving floor — losses capped; a double path may open.',
    },
    {
      name: 'Fractal Architects',
      blurb: 'Living geometry rebuilds space. Three Fractal Architects block the rearrange.',
    },
    {
      name: 'Serpent / Ouroboros',
      blurb: 'Rising, coiled initiation energy. Three Serpents hold the channel.',
    },
    {
      name: 'Ancestors / Guides',
      blurb: 'Familiar, personal, lineage. Loving floor — losses capped; a double blessing may open.',
    },
    {
      name: 'The Other',
      blurb: 'Boss layer — formless hyper-presence. Three of The Other to withstand the dissolve.',
    },
  ];
  const row = roster[Math.min(level, TOTAL_LEVELS) - 1] ?? roster[0]!;
  return {
    level: Math.min(level, TOTAL_LEVELS),
    isBoss,
    name: row.name,
    blurb: row.blurb,
    depthLabel: isBoss ? 'Reality Layer ∞' : `Reality Layer ${level}`,
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

/** Player spin: easy big Alice Coins (run points only). */
export function spinPlayerReels(): {
  reels: [AliceSymbol, AliceSymbol, AliceSymbol];
  aliceCoins: number;
  message: string;
} {
  const pool = ALL_ALICE_SYMBOLS;
  const reels: [AliceSymbol, AliceSymbol, AliceSymbol] = [
    pick(pool),
    pick(pool),
    pick(pool),
  ];

  let aliceCoins = 200 + Math.floor(Math.random() * 400);
  let message = 'A curious nibble of Alice Coins.';

  const sameThree = reels[0].id === reels[1].id && reels[1].id === reels[2].id;
  const twoMatch =
    reels[0].id === reels[1].id || reels[1].id === reels[2].id || reels[0].id === reels[2].id;
  const lovingLine = reels.every(r => r.kind === 'loving');
  const hasOther = reels.some(r => r.id === 'the-other');

  if (sameThree) {
    aliceCoins = 8000 + Math.floor(Math.random() * 4000);
    message = `Triple ${reels[0].label}! Hyperspace jackpot — huge Alice Coins!`;
  } else if (lovingLine) {
    aliceCoins = 4500 + Math.floor(Math.random() * 2500);
    message = 'A line of loving presence — Alice Coins bloom.';
  } else if (twoMatch) {
    aliceCoins = 1200 + Math.floor(Math.random() * 1800);
    message = 'A matching pair deepens the dream.';
  } else if (hasOther) {
    aliceCoins = 900 + Math.floor(Math.random() * 1100);
    message = 'The Other brushes the line — reality bends.';
  }

  return { reels, aliceCoins, message };
}

/**
 * Defense pull: need three of the **current level's** entity.
 * Slightly weighted toward that entity so blocking is luck + skill, not impossible.
 */
export function spinBlockReels(
  level: number,
  isBoss = level >= BOSS_LEVEL,
): {
  reels: [AliceSymbol, AliceSymbol, AliceSymbol];
  blocked: boolean;
  message: string;
} {
  const target = getEntityForLevel(level);
  const hitWeight = isBoss ? 0.36 : 0.42;
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
      ? `THREE ${target.label.toUpperCase()}S! You parry the encounter — Alice Coins safe!`
      : `No triple ${target.label} shield… the presence springs its test.`,
  };
}

const TRICK_LABELS: { label: string; whisper: string }[] = [
  { label: 'Drink Me', whisper: 'Smaller problems… or smaller fortune?' },
  { label: 'Eat Me', whisper: 'Grow bold — or grow broke.' },
  { label: 'Follow the White Rabbit', whisper: 'He always knows the way. Always.' },
  { label: 'Trust the Cheshire Grin', whisper: 'We are all mad here. Especially the honest ones.' },
  { label: 'Take the Red Pill Card', whisper: 'See how deep the rabbit hole goes.' },
  { label: 'Take the Blue Pill Card', whisper: 'Wake up with whatever is left.' },
  { label: 'Ask the Caterpillar', whisper: 'Whooo are you to keep those coins?' },
  { label: 'Cross the Chessboard', whisper: 'One square forward, three coins back.' },
];

const LOSS_TIERS: { tier: LossTier; lossFraction: number }[] = [
  { tier: 'none', lossFraction: 0 },
  { tier: 'moderate', lossFraction: 0.3 },
  { tier: 'heavy', lossFraction: 0.7 },
  { tier: 'all', lossFraction: 1 },
];

export function buildTrickChoices(isBoss: boolean): TrickChoice[] {
  const tiers = LOSS_TIERS.map(t => ({
    ...t,
    lossFraction:
      isBoss && t.tier === 'moderate'
        ? 0.4
        : isBoss && t.tier === 'heavy'
          ? 0.85
          : t.lossFraction,
  }));
  for (let i = tiers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiers[i], tiers[j]] = [tiers[j]!, tiers[i]!];
  }
  const labels = [...TRICK_LABELS].sort(() => Math.random() - 0.5).slice(0, 4);
  return tiers.map((t, i) => ({
    id: `choice-${i}-${t.tier}`,
    label: labels[i]!.label,
    whisper: labels[i]!.whisper,
    tier: t.tier,
    lossFraction: t.lossFraction,
  }));
}

export function applyTrickLoss(
  coins: number,
  choice: TrickChoice,
): { nextCoins: number; lost: number; flavor: string } {
  const lost = Math.floor(coins * choice.lossFraction);
  const nextCoins = Math.max(0, coins - lost);
  const flavor =
    choice.tier === 'none'
      ? 'The elves snarl — you chose true. Coins untouched.'
      : choice.tier === 'moderate'
        ? 'A moderate toll. The hole deepens, pockets lighter.'
        : choice.tier === 'heavy'
          ? 'Most of your Alice Coins vanish into the looking glass…'
          : 'Everything. The Machine Elves empty your satchel with a bow.';
  return { nextCoins, lost, flavor };
}

export function aliceCoinsToSpendable(aliceCoins: number): number {
  const raw = Math.floor(Math.max(0, aliceCoins) / ALICE_COINS_PER_SPENDABLE_CHIP);
  return Math.min(MAX_ALICE_SPENDABLE_PAYOUT, Math.max(0, raw));
}
