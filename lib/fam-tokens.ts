import { PLAYABLE_CHARACTERS } from '@/lib/characters';

export type FamCoinId = 'bonk' | 'bonga' | 'bong' | 'bink' | 'bonnie' | 'beng';

/** Official Bonk Fam SPL mint addresses (Solana mainnet). */
export const FAM_TOKEN_MINTS: Record<FamCoinId, string> = {
  bonk: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  bonga: '7YoAymCyauHAXus3snMEKcLgRx546MrHuBW3EuUNKKQs',
  bong: 'HnJ1rwyEZcSMWjXQX4XruLFWqmqquGdXn9zJsRakQFex',
  bink: '4QYomLMUbPaqrqRuF3LBbJjE1g1LrE9XMoU4KMuejiJ7',
  bonnie: 'DSKSUL26jPUd2qWfibvVNC5yUucjokfvnNYbhzViHtsp',
  beng: 'BPivnge2WgisHu7HE4JrCE6aiqyDdbs7NrVWiYTWsaX4',
};

export type FamTokenConfig = {
  id: FamCoinId;
  mint: string;
  symbol: string;
  name: string;
  role: string;
  img: string;
  /** SPL tokens received per 1 Bonk Chip at this rate. */
  tokensPerChip: number;
  /** Human-readable rate for the cashier UI. */
  rateLabel: string;
  minTokens: number;
};

/**
 * How many SPL tokens one Bonk Chip buys.
 * Rates should feel rewarding for play time — BONK especially (cheap mint).
 */
const EXCHANGE_RATES: Record<
  FamCoinId,
  { tokensPerChip: number; rateLabel: string; minTokens: number }
> = {
  // Was 3 chips → 1 BONK (essentially nothing). Now prizes scale with chips.
  bonk: { tokensPerChip: 100, rateLabel: '1 chip → 100 BONK', minTokens: 100 },
  bonga: { tokensPerChip: 1, rateLabel: '1 chip → 1 BONGA', minTokens: 1 },
  bong: { tokensPerChip: 50, rateLabel: '1 chip → 50 BONG', minTokens: 10 },
  bink: { tokensPerChip: 100, rateLabel: '1 chip → 100 BINK', minTokens: 10 },
  bonnie: { tokensPerChip: 0.5, rateLabel: '1 chip → 0.5 BONNIE', minTokens: 0.1 },
  beng: { tokensPerChip: 5, rateLabel: '1 chip → 5 BENG', minTokens: 1 },
};

export const FAM_TOKENS: FamTokenConfig[] = PLAYABLE_CHARACTERS.map(c => {
  const id = c.id as FamCoinId;
  const rate = EXCHANGE_RATES[id];
  return {
    id,
    mint: FAM_TOKEN_MINTS[id],
    symbol: c.name.toUpperCase(),
    name: c.name,
    role: c.role,
    /** Official mint logo for Cashier / token UI — not the full-body champion art. */
    img: c.logo,
    tokensPerChip: rate.tokensPerChip,
    rateLabel: rate.rateLabel,
    minTokens: rate.minTokens,
  };
});

export function getFamToken(id: FamCoinId): FamTokenConfig | undefined {
  return FAM_TOKENS.find(t => t.id === id);
}

/** Chips required to receive `tokenAmount` at the coin's rate (rounded up). */
export function calculateChipCost(tokenId: FamCoinId, tokenAmount: number): number {
  const token = getFamToken(tokenId);
  if (!token || !Number.isFinite(tokenAmount) || tokenAmount <= 0) return 0;
  return Math.ceil(tokenAmount / token.tokensPerChip);
}

/** Tokens received for a chip spend at the coin's rate. */
export function calculateTokensForChips(tokenId: FamCoinId, chips: number): number {
  const token = getFamToken(tokenId);
  if (!token || !Number.isFinite(chips) || chips <= 0) return 0;
  return chips * token.tokensPerChip;
}

export function humanAmountToRaw(amount: number, decimals: number): bigint {
  const factor = 10 ** decimals;
  return BigInt(Math.round(amount * factor));
}

export function rawAmountToHuman(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}

export function formatTokenBalance(raw: bigint, decimals: number): string {
  const human = rawAmountToHuman(raw, decimals);
  if (human >= 1_000_000) {
    return human.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  if (human >= 1) {
    return human.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return human.toLocaleString(undefined, { maximumFractionDigits: Math.min(6, decimals) });
}

export function formatMintAddress(mint: string): string {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

export function solscanTokenUrl(mint: string): string {
  return `https://solscan.io/token/${mint}`;
}

export function solscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

/** Wallet must already have the SPL token account — the cashier never creates one. */
export function walletCanReceiveToken(
  balance: { accountExists: boolean } | undefined,
): boolean {
  return Boolean(balance?.accountExists);
}

export function getSolanaRpcUrl(): string {
  return (
    process.env.SOLANA_RPC_URL ??
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
    'https://api.mainnet-beta.solana.com'
  );
}