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
 * Micro-prize cashier policy (sole treasury SPL exit = /api/exchange).
 *
 * Large cashouts are not allowed. ~$1 USD is the concern threshold:
 * anything at or above that is blocked per exchange and logged.
 * All Fam coins (BONK, BONGA, BONG, …) use the same USD + chip rules.
 */

/** Hard max estimated USD value for a single exchange. */
export const MAX_USD_PER_EXCHANGE = Number(process.env.MAX_USD_PER_EXCHANGE ?? '1');

/**
 * Hard max estimated USD a wallet may cash out per UTC day.
 * Slightly above $1 so a few tiny wins can still redeem; not a whale day.
 */
export const MAX_USD_PER_WALLET_PER_DAY = Number(process.env.MAX_USD_PER_WALLET_PER_DAY ?? '3');

/** Soft multi-wallet brake on one IP (best-effort per instance). */
export const MAX_USD_PER_IP_PER_DAY = Number(
  process.env.MAX_USD_PER_IP_PER_DAY ?? String(MAX_USD_PER_WALLET_PER_DAY * 3),
);

/** Log / flag when a cashout reaches this USD (default = same as max/tx). */
export const USD_CONCERN_THRESHOLD = Number(process.env.USD_CONCERN_THRESHOLD ?? '1');

/** Official cashier rate: chips required for 1 BONGA. */
export const CHIPS_PER_BONGA = Number(process.env.CHIPS_PER_BONGA ?? '15');

/**
 * Chip backstops — apply even if a token’s USD price is near zero
 * (so “worthless” mints cannot drain unlimited supply).
 * Defaults: 2 BONGA worth of chips per tx, 6 BONGA per day.
 */
export const MAX_CHIP_COST_PER_EXCHANGE = Number(
  process.env.MAX_CHIP_COST_PER_EXCHANGE ?? String(2 * CHIPS_PER_BONGA),
);

export const MAX_CHIPS_EXCHANGED_PER_WALLET_PER_DAY = Number(
  process.env.MAX_CHIPS_EXCHANGED_PER_WALLET_PER_DAY ?? String(6 * CHIPS_PER_BONGA),
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
  process.env.MAX_EXCHANGES_PER_WALLET_PER_DAY ?? '12',
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
