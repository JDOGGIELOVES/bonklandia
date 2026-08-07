/**
 * Carnival wheel — 32 spaces (months + zodiac + crypto), prize tiers, dice → family coin.
 * Outcomes are assigned by the server (HMAC); this module only defines composition.
 */

import type { FamCoinId } from '@/lib/fam-tokens';

export const CARNIVAL_ENTRY_USD = 0.25;
/** Months 12 + Zodiac 12 + Crypto 8 — numbers 1–31 removed for readability. */
export const CARNIVAL_WHEEL_SPACES = 32;

export type PrizeTierId = 'dead' | 'low' | 'small' | 'medium' | 'big' | 'jackpot';

export type PrizeTier = {
  id: PrizeTierId;
  label: string;
  /** Target USD prize value (paid as spendable chips via Cashier path only). */
  prizeUsd: number;
  /** Spaces allocated (must sum to CARNIVAL_WHEEL_SPACES). */
  spaces: number;
};

/**
 * 32-space boardwalk mix (scaled from former 63-space odds):
 * Dead 10 · Low 6 · Small 9 · Medium 4 · Big 2 · Jackpot 1
 */
export const PRIZE_TIERS: PrizeTier[] = [
  { id: 'dead', label: 'Dead', prizeUsd: 0, spaces: 10 },
  { id: 'low', label: 'Low', prizeUsd: 0.05, spaces: 6 },
  { id: 'small', label: 'Small', prizeUsd: 0.1, spaces: 9 },
  { id: 'medium', label: 'Medium', prizeUsd: 0.3, spaces: 4 },
  { id: 'big', label: 'Big', prizeUsd: 1, spaces: 2 },
  { id: 'jackpot', label: 'Jackpot', prizeUsd: 5, spaces: 1 },
];

/** Verify tier space counts. */
export function assertTierSpaces(): void {
  const sum = PRIZE_TIERS.reduce((a, t) => a + t.spaces, 0);
  if (sum !== CARNIVAL_WHEEL_SPACES) {
    throw new Error(`Carnival tiers must sum to ${CARNIVAL_WHEEL_SPACES} spaces (got ${sum})`);
  }
}

const MONTHS = [
  { label: 'JAN', full: 'January' },
  { label: 'FEB', full: 'February' },
  { label: 'MAR', full: 'March' },
  { label: 'APR', full: 'April' },
  { label: 'MAY', full: 'May' },
  { label: 'JUN', full: 'June' },
  { label: 'JUL', full: 'July' },
  { label: 'AUG', full: 'August' },
  { label: 'SEP', full: 'September' },
  { label: 'OCT', full: 'October' },
  { label: 'NOV', full: 'November' },
  { label: 'DEC', full: 'December' },
] as const;

const ZODIAC = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

const CRYPTO = ['BTC', 'SOL', 'ETH', 'BONK', 'BONGA', 'DOGE', 'XRP', 'USDC'] as const;

export type WheelSpace = {
  index: number;
  label: string;
  /** Longer name for result UI */
  fullLabel: string;
  kind: 'month' | 'zodiac' | 'crypto';
  tierId: PrizeTierId;
  prizeUsd: number;
};

/** Build the fixed 32-space wheel: 12 months, 12 zodiac, 8 crypto. */
export function buildWheelSpaces(): WheelSpace[] {
  assertTierSpaces();
  const labels: { label: string; fullLabel: string; kind: WheelSpace['kind'] }[] = [
    ...MONTHS.map(m => ({ label: m.label, fullLabel: m.full, kind: 'month' as const })),
    ...ZODIAC.map(label => ({
      label: label.length > 6 ? label.slice(0, 4) : label,
      fullLabel: label,
      kind: 'zodiac' as const,
    })),
    ...CRYPTO.map(label => ({ label, fullLabel: label, kind: 'crypto' as const })),
  ];
  if (labels.length !== CARNIVAL_WHEEL_SPACES) {
    throw new Error(`Expected ${CARNIVAL_WHEEL_SPACES} labels, got ${labels.length}`);
  }

  const tierSlots: PrizeTierId[] = [];
  for (const t of PRIZE_TIERS) {
    for (let i = 0; i < t.spaces; i++) tierSlots.push(t.id);
  }
  const perm = fixedPermute(tierSlots.length, 0xc4a1b032);
  const orderedTiers = perm.map(i => tierSlots[i]!);
  const tierById = Object.fromEntries(PRIZE_TIERS.map(t => [t.id, t])) as Record<
    PrizeTierId,
    PrizeTier
  >;

  return labels.map((L, index) => {
    const tierId = orderedTiers[index]!;
    const tier = tierById[tierId];
    return {
      index,
      label: L.label,
      fullLabel: L.fullLabel,
      kind: L.kind,
      tierId,
      prizeUsd: tier.prizeUsd,
    };
  });
}

function fixedPermute(n: number, seed: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  let s = seed >>> 0;
  for (let i = n - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

let _spaces: WheelSpace[] | null = null;
export function getWheelSpaces(): WheelSpace[] {
  if (!_spaces) _spaces = buildWheelSpaces();
  return _spaces;
}

export const DICE_FAMILY_COINS: { face: number; coinId: FamCoinId; name: string }[] = [
  { face: 1, coinId: 'bonk', name: 'Bonk' },
  { face: 2, coinId: 'bonga', name: 'Bonga' },
  { face: 3, coinId: 'bong', name: 'Bong' },
  { face: 4, coinId: 'bink', name: 'Bink' },
  { face: 5, coinId: 'beng', name: 'Beng' },
  { face: 6, coinId: 'bonnie', name: 'Bonnie' },
];

export function coinForDice(face: number) {
  const row = DICE_FAMILY_COINS.find(d => d.face === face) ?? DICE_FAMILY_COINS[0]!;
  return row;
}

export function prizeUsdToChips(prizeUsd: number): number {
  if (prizeUsd <= 0) return 0;
  if (prizeUsd <= 0.05) return 1;
  if (prizeUsd <= 0.1) return 3;
  if (prizeUsd <= 0.3) return 9;
  if (prizeUsd <= 1) return 30;
  return 150;
}

export const ENTRY_SPLIT = {
  treasuryBps: 5500,
  prizePoolBps: 3000,
  opsBps: 1500,
} as const;

export function splitEntryAmount(rawAmount: bigint): {
  treasury: bigint;
  prizePool: bigint;
  ops: bigint;
} {
  const bps = BigInt(10000);
  const treasury = (rawAmount * BigInt(ENTRY_SPLIT.treasuryBps)) / bps;
  const prizePool = (rawAmount * BigInt(ENTRY_SPLIT.prizePoolBps)) / bps;
  const ops = rawAmount - treasury - prizePool;
  return { treasury, prizePool, ops };
}
