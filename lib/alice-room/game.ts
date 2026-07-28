import {
  ALL_ALICE_SYMBOLS,
  ELF_SYMBOLS,
  ENTITY_SYMBOLS,
  GUIDE_SYMBOLS,
  WILD_SYMBOL,
  isElf,
  type AliceSymbol,
} from '@/lib/alice-room/symbols';

export const ELF_LEVELS = 7;
export const BOSS_LEVEL = 8;
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
  if (isBoss) {
    return {
      level: BOSS_LEVEL,
      isBoss: true,
      name: 'The Red Machine Queen',
      blurb: 'The deepest layer. One last spin — then her court tries to empty your pockets.',
      depthLabel: 'Reality Layer ∞',
    };
  }
  const names = [
    'Tick-Tock Scout',
    'Glitch Messenger',
    'Mirror Twin',
    'Smoke Whisperer',
    'Tea-Time Trickster',
    'Card-Suit Saboteur',
    'Cheshire Circuit',
  ];
  return {
    level,
    isBoss: false,
    name: names[level - 1] ?? `Machine Elf ${level}`,
    blurb: `Layer ${level} of the rabbit hole. Spin for Alice Coins — then survive the elf turn.`,
    depthLabel: `Reality Layer ${level}`,
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
  const pool = [
    ...GUIDE_SYMBOLS,
    ...GUIDE_SYMBOLS,
    ...ENTITY_SYMBOLS,
    ...ENTITY_SYMBOLS,
    ...ELF_SYMBOLS,
    WILD_SYMBOL,
  ];
  const reels: [AliceSymbol, AliceSymbol, AliceSymbol] = [
    pick(pool),
    pick(pool),
    pick(pool),
  ];

  let aliceCoins = 200 + Math.floor(Math.random() * 400);
  let message = 'A curious nibble of Alice Coins.';

  const guideIds = reels.filter(r => r.kind === 'guide').map(r => r.id);
  const allGuideOrWild = reels.every(r => r.kind === 'guide' || r.kind === 'wild');
  const allSameGuide =
    allGuideOrWild && guideIds.length >= 1 && guideIds.every(id => id === guideIds[0]);
  const allEntity = reels.every(r => r.kind === 'entity' || r.kind === 'wild');
  const allElf = reels.every(r => r.kind === 'elf');
  const twoMatch =
    reels[0].id === reels[1].id || reels[1].id === reels[2].id || reels[0].id === reels[2].id;
  const hasWild = reels.some(r => r.kind === 'wild');

  if (allSameGuide) {
    aliceCoins = 8000 + Math.floor(Math.random() * 4000);
    message = 'Triple guide through the looking glass! Huge Alice Coins!';
  } else if (allGuideOrWild) {
    aliceCoins = 3500 + Math.floor(Math.random() * 2500);
    message = 'Full guide line — the hole rewards boldness!';
  } else if (allEntity) {
    aliceCoins = 5000 + Math.floor(Math.random() * 3000);
    message = 'Entity cascade! Alice Coins pour like tea!';
  } else if (allElf) {
    aliceCoins = 1500 + Math.floor(Math.random() * 1000);
    message = 'Three elves on YOUR spin — ironic gift of Alice Coins.';
  } else if (twoMatch) {
    aliceCoins = 1200 + Math.floor(Math.random() * 1800);
    message = 'A matching pair deepens the dream.';
  } else if (hasWild) {
    aliceCoins = 900 + Math.floor(Math.random() * 1100);
    message = 'Looking Glass wild — reality bends in your favor.';
  }

  return { reels, aliceCoins, message };
}

/**
 * Block attempt: need 3 elves on the line.
 * Slightly elf-weighted so blocking is skillful-luck, not impossible.
 */
export function spinBlockReels(isBoss: boolean): {
  reels: [AliceSymbol, AliceSymbol, AliceSymbol];
  blocked: boolean;
  message: string;
} {
  const elfWeight = isBoss ? 0.38 : 0.42;
  const roll = (): AliceSymbol => {
    if (Math.random() < elfWeight) return pick(ELF_SYMBOLS);
    if (Math.random() < 0.5) return pick(GUIDE_SYMBOLS);
    return pick(ENTITY_SYMBOLS);
  };
  const reels: [AliceSymbol, AliceSymbol, AliceSymbol] = [roll(), roll(), roll()];
  const blocked = reels.every(isElf);
  return {
    reels,
    blocked,
    message: blocked
      ? 'THREE MACHINE ELVES! You parry the attack — Alice Coins safe!'
      : 'No triple-elf shield… the Machine Elves spring their trick.',
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
