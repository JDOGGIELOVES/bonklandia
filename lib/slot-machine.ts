import { type Difficulty, PLAYABLE_CHARACTERS } from '@/lib/characters';
import { DEGEN_ENEMIES } from '@/lib/enemies';

export const TOTAL_WAVES = DEGEN_ENEMIES.length;

/** Consolation spins when bonked out — always flat regardless of wave or difficulty. */
export const DEATH_SPIN_COUNT = 2;

/** Victory spins granted for a full run clear, scaled by fighter difficulty. */
export const VICTORY_SPINS_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 3,
  medium: 5,
  hard: 10,
};

/** Victory sessions earn +25% chip payouts on every winning line. */
export const VICTORY_CHIP_MULTIPLIER = 1.25;

export type CasinoOutcome = 'victory' | 'defeat';

export type SlotSymbolKind = 'fam' | 'enemy' | 'jackpot';

export type SlotSymbol = {
  id: string;
  label: string;
  image: string | null;
  kind: SlotSymbolKind;
};

export type CasinoTier = {
  id: string;
  name: string;
  jackpotBias: number;
  transitionMs: number;
  tagline: string;
};

export type CasinoSession = {
  outcome: CasinoOutcome;
  spins: number;
  /** Wave used for paytable scaling (victory always uses max wave). */
  paytableWave: number;
  tier: CasinoTier;
  chipMultiplier: number;
  difficulty: Difficulty;
};

export const JACKPOT_SYMBOL: SlotSymbol = {
  id: 'jackpot',
  label: 'BONK',
  image: null,
  kind: 'jackpot',
};

export const SLOT_SYMBOL_POOL: SlotSymbol[] = [
  ...PLAYABLE_CHARACTERS.map(c => ({
    id: `fam-${c.id}`,
    label: c.name,
    image: c.img,
    kind: 'fam' as const,
  })),
  ...DEGEN_ENEMIES.map(e => ({
    id: `enemy-${e.id}`,
    label: e.name,
    image: e.img,
    kind: 'enemy' as const,
  })),
  JACKPOT_SYMBOL,
];

export function getVictorySpins(difficulty: Difficulty): number {
  return VICTORY_SPINS_BY_DIFFICULTY[difficulty];
}

function victoryTagline(difficulty: Difficulty): string {
  switch (difficulty) {
    case 'easy':
      return 'Forgiving run, legendary payout — Bonga Chill unlocks the victory vault.';
    case 'medium':
      return 'Balanced bonks, premium spins — the Fam cleared the valley on merit.';
    case 'hard':
      return 'Chaos conquered. Ten victory pulls and max payouts — degens kneel.';
  }
}

export function getCasinoTier(wave: number, outcome: CasinoOutcome = 'defeat'): CasinoTier {
  if (wave >= 10) {
    return {
      id: outcome === 'victory' ? 'victory-vip' : 'vip',
      name: outcome === 'victory' ? 'Victory Hall — Diamond Hands' : 'Diamond Hands VIP',
      jackpotBias: outcome === 'victory' ? 0.22 : 0.18,
      transitionMs: outcome === 'victory' ? 2200 : 2400,
      tagline:
        outcome === 'victory'
          ? 'Full clear. The one-armed bandit bows to a champion.'
          : 'You bonked deep into Degen Valley. The house respects a grinder.',
    };
  }
  if (wave >= 7) {
    return {
      id: outcome === 'victory' ? 'victory-high-roller' : 'high-roller',
      name: outcome === 'victory' ? 'Victory Hall — High Roller' : 'High Roller Lounge',
      jackpotBias: outcome === 'victory' ? 0.16 : 0.12,
      transitionMs: 2000,
      tagline:
        outcome === 'victory'
          ? 'Champion\'s lounge — every pull hits the max paytable.'
          : 'Wave after wave — the pit boss slides you a golden stool.',
    };
  }
  if (wave >= 4) {
    return {
      id: outcome === 'victory' ? 'victory-midnight' : 'midnight',
      name: outcome === 'victory' ? 'Victory Hall — Bonklandia Casino' : 'Bonklandia Casino',
      jackpotBias: outcome === 'victory' ? 0.12 : 0.08,
      transitionMs: 1800,
      tagline:
        outcome === 'victory'
          ? 'The velvet rope lifts for a valley conqueror.'
          : 'Not bad. The one-armed bandit winks from the velvet dark.',
    };
  }
  return {
    id: outcome === 'victory' ? 'victory-degen-den' : 'degen-den',
    name: outcome === 'victory' ? 'Victory Hall — Degen Den' : 'Degen Den Slots',
    jackpotBias: outcome === 'victory' ? 0.08 : 0.05,
    transitionMs: 1500,
    tagline:
      outcome === 'victory'
        ? 'Even early clears earn the champion\'s reel.'
        : 'Bonked out? Two consolation spins — win the run for way more.',
  };
}

export function buildCasinoSession(
  outcome: CasinoOutcome,
  reachedWave: number,
  difficulty: Difficulty,
): CasinoSession {
  const paytableWave = outcome === 'victory' ? TOTAL_WAVES : Math.max(1, reachedWave);
  const tier = getCasinoTier(paytableWave, outcome);
  const spins = outcome === 'victory' ? getVictorySpins(difficulty) : DEATH_SPIN_COUNT;

  return {
    outcome,
    spins,
    paytableWave,
    tier: {
      ...tier,
      tagline: outcome === 'victory' ? victoryTagline(difficulty) : tier.tagline,
    },
    chipMultiplier: outcome === 'victory' ? VICTORY_CHIP_MULTIPLIER : 1,
    difficulty,
  };
}

export function getVictoryRewardSummary(difficulty: Difficulty) {
  const spins = getVictorySpins(difficulty);
  const maxJackpot = Math.round(getMaxJackpot(TOTAL_WAVES) * VICTORY_CHIP_MULTIPLIER);
  return { spins, maxJackpot, deathSpins: DEATH_SPIN_COUNT };
}

function weightedPick(pool: SlotSymbol[], jackpotBias: number): SlotSymbol {
  const weights = pool.map(s => {
    if (s.kind === 'jackpot') return jackpotBias;
    if (s.kind === 'fam') return 1.15;
    return 1;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export function spinReels(jackpotBias: number): [SlotSymbol, SlotSymbol, SlotSymbol] {
  return [
    weightedPick(SLOT_SYMBOL_POOL, jackpotBias),
    weightedPick(SLOT_SYMBOL_POOL, jackpotBias),
    weightedPick(SLOT_SYMBOL_POOL, jackpotBias),
  ];
}

export type WinTier = 'jackpot' | 'fam-triple' | 'bonk-single' | 'degen-triple' | 'none';

export type PaytableRow = {
  tier: WinTier;
  combo: string;
  detail: string;
  payout: number;
  rowClass: string;
};

export type SpinResult = {
  reels: [SlotSymbol, SlotSymbol, SlotSymbol];
  winTier: WinTier;
  isJackpot: boolean;
  isFamMatch: boolean;
  payout: number;
  message: string;
};

/** Scales chip payouts — tuned so casino runs fund real-token exchanges at the cashier. */
const CHIP_BASE_PER_WAVE = 500;

export function formatBonkChips(amount: number): string {
  return amount.toLocaleString('en-US');
}

function scalePayout(amount: number, multiplier: number): number {
  return Math.round(amount * multiplier);
}

export function getPaytable(wave: number, chipMultiplier = 1): PaytableRow[] {
  const base = CHIP_BASE_PER_WAVE * Math.max(1, wave);

  return [
    {
      tier: 'jackpot',
      combo: 'BONK · BONK · BONK',
      detail: 'Jackpot symbol on all 3 lines',
      payout: scalePayout(base * 300, chipMultiplier),
      rowClass: 'paytable-row-jackpot',
    },
    {
      tier: 'fam-triple',
      combo: 'Fam · Fam · Fam',
      detail: 'Same Bonk Fam member on every line',
      payout: scalePayout(base * 50, chipMultiplier),
      rowClass: 'paytable-row-fam',
    },
    {
      tier: 'bonk-single',
      combo: 'BONK · ? · ?',
      detail: 'One or two BONKs on the line',
      payout: scalePayout(base * 12, chipMultiplier),
      rowClass: 'paytable-row-bonk',
    },
    {
      tier: 'degen-triple',
      combo: 'Degen · Degen · Degen',
      detail: 'Three enemy symbols across the line',
      payout: scalePayout(base * 6, chipMultiplier),
      rowClass: 'paytable-row-degen',
    },
    {
      tier: 'none',
      combo: 'No match',
      detail: 'Mixed symbols with no winning line',
      payout: 0,
      rowClass: 'paytable-row-none',
    },
  ];
}

export function getPayoutForTier(tier: WinTier, wave: number, chipMultiplier = 1): number {
  return getPaytable(wave, chipMultiplier).find(row => row.tier === tier)?.payout ?? 0;
}

export function getMaxJackpot(wave: number, chipMultiplier = 1): number {
  return getPayoutForTier('jackpot', wave, chipMultiplier);
}

function buildWinMessage(tier: WinTier, payout: number, famName?: string): string {
  const chips = formatBonkChips(payout);

  switch (tier) {
    case 'jackpot':
      return `BONK BONK BONK! MEGA JACKPOT — +${chips} Bonk Chips!`;
    case 'fam-triple':
      return `Triple ${famName ?? 'Fam'}! +${chips} Bonk Chips.`;
    case 'bonk-single':
      return `BONK on the line! +${chips} Bonk Chips.`;
    case 'degen-triple':
      return `Triple degen line — +${chips} Bonk Chips (cope payout).`;
    default:
      return 'No winning line. Pull again if you have spins left.';
  }
}

export function evaluateSpin(
  reels: [SlotSymbol, SlotSymbol, SlotSymbol],
  wave: number,
  chipMultiplier = 1,
): SpinResult {
  const [a, b, c] = reels;
  const isJackpot = a.kind === 'jackpot' && b.kind === 'jackpot' && c.kind === 'jackpot';
  const isFamMatch = a.kind === 'fam' && b.id === c.id && a.id === b.id;

  let winTier: WinTier = 'none';
  if (isJackpot) winTier = 'jackpot';
  else if (isFamMatch) winTier = 'fam-triple';
  else if (a.kind === 'jackpot' || b.kind === 'jackpot' || c.kind === 'jackpot') winTier = 'bonk-single';
  else if (a.kind === 'enemy' && b.kind === 'enemy' && c.kind === 'enemy') winTier = 'degen-triple';

  const payout = getPayoutForTier(winTier, wave, chipMultiplier);
  const message = buildWinMessage(winTier, payout, isFamMatch ? a.label : undefined);

  return {
    reels,
    winTier,
    isJackpot,
    isFamMatch,
    payout,
    message,
  };
}

export function buildReelStrip(result: SlotSymbol, pool: SlotSymbol[], length = 28): SlotSymbol[] {
  const strip: SlotSymbol[] = [];
  for (let i = 0; i < length; i++) {
    strip.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  strip.push(result);
  return strip;
}