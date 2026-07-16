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

export const MAX_EXCHANGES_PER_WALLET_PER_DAY = Number(
  process.env.MAX_EXCHANGES_PER_WALLET_PER_DAY ?? '20',
);

export const MAX_EXCHANGES_PER_IP_PER_HOUR = Number(
  process.env.MAX_EXCHANGES_PER_IP_PER_HOUR ?? '60',
);

export const MAX_SETTLES_PER_IP_PER_HOUR = Number(
  process.env.MAX_SETTLES_PER_IP_PER_HOUR ?? '30',
);