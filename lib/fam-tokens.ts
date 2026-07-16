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

const EXCHANGE_RATES: Record<
  FamCoinId,
  { tokensPerChip: number; rateLabel: string; minTokens: number }
> = {
  bonk: { tokensPerChip: 1 / 3, rateLabel: '3 chips → 1 BONK', minTokens: 1 },
  bonga: { tokensPerChip: 1 / 15, rateLabel: '15 chips → 1 BONGA', minTokens: 1 },
  bong: { tokensPerChip: 5, rateLabel: '1 chip → 5 BONG', minTokens: 1 },
  bink: { tokensPerChip: 10, rateLabel: '1 chip → 10 BINK', minTokens: 1 },
  bonnie: { tokensPerChip: 0.05, rateLabel: '1 chip → 0.05 BONNIE', minTokens: 0.05 },
  beng: { tokensPerChip: 0.4, rateLabel: '1 chip → 0.4 BENG', minTokens: 0.4 },
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
    img: c.img,
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