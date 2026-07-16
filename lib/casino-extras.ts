/** USD price for one Quarter Slot Machine spin (25¢ of Solana). */
export const PAID_SPIN_USD = 0.25;

/** Jackpot ladder fills after this many spins (non-jackpot spins still count). */
export const JACKPOT_LADDER_STEPS = 4;

/** Payout multiplier when ladder is full on the next spin. */
export const JACKPOT_LADDER_PAYOUT_MULT = 2;

/** Reel jackpot bias when ladder is primed. */
export const JACKPOT_LADDER_BIAS = 0.42;

export type ChipBetOption = {
  chips: number;
  multiplier: number;
  label: string;
};

export const CHIP_BET_OPTIONS: ChipBetOption[] = [
  { chips: 0, multiplier: 1, label: 'Free pull' },
  { chips: 100, multiplier: 1.25, label: '100 chips · 1.25×' },
  { chips: 300, multiplier: 1.5, label: '300 chips · 1.5×' },
  { chips: 750, multiplier: 2, label: '750 chips · 2×' },
];

export function getChipBetOption(chips: number): ChipBetOption {
  return CHIP_BET_OPTIONS.find(o => o.chips === chips) ?? CHIP_BET_OPTIONS[0];
}