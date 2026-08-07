/** Server HMAC secret for casino sessions and chip claims. */
export function getCasinoSessionSecret(): string {
  return (
    process.env.CASINO_SESSION_SECRET?.trim() ??
    process.env.BONGA_TREASURY_SECRET_KEY?.trim()?.slice(0, 32) ??
    'dev-only-change-casino-session-secret'
  );
}

export const NONCE_TTL_MS = 5 * 60 * 1000;
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export const MAX_PAID_SPINS_PER_SESSION = 25;
export const MAX_PAID_SPINS_PER_WALLET_PER_HOUR = 40;

/**
 * Cashier payout policy (sole treasury SPL exit = /api/exchange).
 *
 * Two separate limits (do not confuse them):
 * 1) USD caps — estimated dollar value of the tokens (safety net for expensive mints).
 *    10,000 BONK is ~cents, not $50. USD caps only bite when price × amount is high.
 * 2) Chip caps — game currency spent (backstop if a mint’s USD price is ~0).
 *
 * Override with env in Vercel if needed.
 */

/** Max estimated USD value for one cashout (not “token count”). */
export const MAX_USD_PER_EXCHANGE = Number(process.env.MAX_USD_PER_EXCHANGE ?? '5');

/** Max estimated USD a wallet may cash out per UTC day. */
export const MAX_USD_PER_WALLET_PER_DAY = Number(process.env.MAX_USD_PER_WALLET_PER_DAY ?? '15');

/** Soft multi-wallet brake on one IP (best-effort per instance). */
export const MAX_USD_PER_IP_PER_DAY = Number(
  process.env.MAX_USD_PER_IP_PER_DAY ?? String(MAX_USD_PER_WALLET_PER_DAY * 3),
);

/** Log / flag larger cashouts (does not block until max/tx). */
export const USD_CONCERN_THRESHOLD = Number(process.env.USD_CONCERN_THRESHOLD ?? '3');

/** Official accounting: chips per 1 BONGA-equivalent (internal, not the cashier rate table). */
export const CHIPS_PER_BONGA = Number(process.env.CHIPS_PER_BONGA ?? '15');

/**
 * Chip backstops — if a mint is nearly worthless in USD, still stop unlimited drain.
 * At 100 BONK / chip, 10k chips ≈ 1,000,000 BONK (~$20 if BONK is $0.00002).
 */
export const MAX_CHIP_COST_PER_EXCHANGE = Number(
  process.env.MAX_CHIP_COST_PER_EXCHANGE ?? '10000',
);

export const MAX_CHIPS_EXCHANGED_PER_WALLET_PER_DAY = Number(
  process.env.MAX_CHIPS_EXCHANGED_PER_WALLET_PER_DAY ?? '50000',
);

export const MAX_CHIPS_EXCHANGED_PER_IP_PER_DAY = Number(
  process.env.MAX_CHIPS_EXCHANGED_PER_IP_PER_DAY ??
    String(MAX_CHIPS_EXCHANGED_PER_WALLET_PER_DAY * 3),
);

/** BONGA-equivalent views of chip caps (for UI / API). */
export const MAX_BONGA_EQUIVALENT_PER_EXCHANGE =
  MAX_CHIP_COST_PER_EXCHANGE / Math.max(1, CHIPS_PER_BONGA);

export const MAX_BONGA_EQUIVALENT_PER_WALLET_PER_DAY =
  MAX_CHIPS_EXCHANGED_PER_WALLET_PER_DAY / Math.max(1, CHIPS_PER_BONGA);

export const MAX_BONGA_EQUIVALENT_PER_IP_PER_DAY =
  MAX_CHIPS_EXCHANGED_PER_IP_PER_DAY / Math.max(1, CHIPS_PER_BONGA);

/** Successful cashier exchanges per wallet per UTC day. */
export const MAX_EXCHANGES_PER_WALLET_PER_DAY = Number(
  process.env.MAX_EXCHANGES_PER_WALLET_PER_DAY ?? '50',
);

/** Exchange attempt gate per IP per hour. */
export const MAX_EXCHANGES_PER_IP_PER_HOUR = Number(
  process.env.MAX_EXCHANGES_PER_IP_PER_HOUR ?? '30',
);

export function chipsToBongaEquivalent(chips: number): number {
  if (!Number.isFinite(chips) || chips <= 0 || CHIPS_PER_BONGA <= 0) return 0;
  return chips / CHIPS_PER_BONGA;
}

export function bongaEquivalentToChips(bonga: number): number {
  if (!Number.isFinite(bonga) || bonga <= 0 || CHIPS_PER_BONGA <= 0) return 0;
  return Math.ceil(bonga * CHIPS_PER_BONGA);
}

export const MAX_SETTLES_PER_IP_PER_HOUR = Number(
  process.env.MAX_SETTLES_PER_IP_PER_HOUR ?? '30',
);
