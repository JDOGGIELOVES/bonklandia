import {
  CHIPS_PER_BONGA,
  MAX_BONGA_EQUIVALENT_PER_EXCHANGE,
  MAX_BONGA_EQUIVALENT_PER_WALLET_PER_DAY,
  MAX_CHIP_COST_PER_EXCHANGE,
  MAX_CHIPS_EXCHANGED_PER_IP_PER_DAY,
  MAX_CHIPS_EXCHANGED_PER_WALLET_PER_DAY,
  MAX_EXCHANGES_PER_WALLET_PER_DAY,
  MAX_USD_PER_EXCHANGE,
  MAX_USD_PER_IP_PER_DAY,
  MAX_USD_PER_WALLET_PER_DAY,
  USD_CONCERN_THRESHOLD,
  chipsToBongaEquivalent,
} from '@/lib/security/config';
import { formatUsd } from '@/lib/security/token-usd';

type WalletDayBucket = {
  date: string;
  exchanges: number;
  chipsSpent: number;
  usdSpent: number;
};

type IpDayBucket = {
  date: string;
  chipsSpent: number;
  usdSpent: number;
};

/**
 * In-memory daily exchange quotas (Vercel-safe).
 * Tracks chips + estimated USD. All Fam coins share the same budget.
 */
const walletBuckets = new Map<string, WalletDayBucket>();
const ipBuckets = new Map<string, IpDayBucket>();

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function walletBucket(wallet: string): WalletDayBucket {
  const today = utcDate();
  const existing = walletBuckets.get(wallet);
  if (!existing || existing.date !== today) {
    const fresh: WalletDayBucket = { date: today, exchanges: 0, chipsSpent: 0, usdSpent: 0 };
    walletBuckets.set(wallet, fresh);
    return fresh;
  }
  return existing;
}

function ipBucket(ip: string): IpDayBucket {
  const today = utcDate();
  const existing = ipBuckets.get(ip);
  if (!existing || existing.date !== today) {
    const fresh: IpDayBucket = { date: today, chipsSpent: 0, usdSpent: 0 };
    ipBuckets.set(ip, fresh);
    return fresh;
  }
  return existing;
}

export type ExchangeQuotaSnapshot = {
  exchangesUsed: number;
  exchangesMax: number;
  chipsUsed: number;
  chipsMax: number;
  remainingChips: number;
  maxChipCostPerExchange: number;
  bongaUsed: number;
  bongaMax: number;
  remainingBonga: number;
  maxBongaPerExchange: number;
  chipsPerBonga: number;
  usdUsed: number;
  usdMax: number;
  remainingUsd: number;
  maxUsdPerExchange: number;
  concernUsd: number;
};

export function getWalletExchangeQuota(wallet: string): ExchangeQuotaSnapshot {
  const b = walletBucket(wallet);
  const chipsMax = MAX_CHIPS_EXCHANGED_PER_WALLET_PER_DAY;
  const remainingChips = Math.max(0, chipsMax - b.chipsSpent);
  const remainingUsd = Math.max(0, MAX_USD_PER_WALLET_PER_DAY - b.usdSpent);
  return {
    exchangesUsed: b.exchanges,
    exchangesMax: MAX_EXCHANGES_PER_WALLET_PER_DAY,
    chipsUsed: b.chipsSpent,
    chipsMax,
    remainingChips,
    maxChipCostPerExchange: MAX_CHIP_COST_PER_EXCHANGE,
    bongaUsed: chipsToBongaEquivalent(b.chipsSpent),
    bongaMax: MAX_BONGA_EQUIVALENT_PER_WALLET_PER_DAY,
    remainingBonga: chipsToBongaEquivalent(remainingChips),
    maxBongaPerExchange: MAX_BONGA_EQUIVALENT_PER_EXCHANGE,
    chipsPerBonga: CHIPS_PER_BONGA,
    usdUsed: b.usdSpent,
    usdMax: MAX_USD_PER_WALLET_PER_DAY,
    remainingUsd,
    maxUsdPerExchange: MAX_USD_PER_EXCHANGE,
    concernUsd: USD_CONCERN_THRESHOLD,
  };
}

export type ExchangeLimitInput = {
  wallet: string;
  ip: string;
  chipCost: number;
  /** Estimated USD value of this cashout (all Fam coins). */
  usdValue: number;
};

/**
 * Pre-flight fairness checks. Does not record usage — call
 * {@link recordSuccessfulExchange} only after treasury payout succeeds.
 */
export function assertExchangeWithinLimits(
  input: ExchangeLimitInput,
): { ok: true; concern: boolean } | { ok: false; error: string; code: string } {
  try {
    const { wallet, ip, chipCost, usdValue } = input;

    if (!Number.isFinite(chipCost) || chipCost <= 0) {
      return { ok: false, error: 'Invalid chip cost.', code: 'INVALID_CHIP_COST' };
    }
    if (!Number.isFinite(usdValue) || usdValue < 0) {
      return { ok: false, error: 'Invalid cashout value estimate.', code: 'INVALID_USD' };
    }

    // ── USD micro-prize caps (primary) ──────────────────────────────
    if (usdValue > MAX_USD_PER_EXCHANGE + 1e-9) {
      return {
        ok: false,
        error: `Max ${formatUsd(MAX_USD_PER_EXCHANGE)} estimated value per cashout. Large cashouts are not allowed — try a smaller amount.`,
        code: 'MAX_USD_PER_EXCHANGE',
      };
    }

    const w = walletBucket(wallet);
    if (w.usdSpent + usdValue > MAX_USD_PER_WALLET_PER_DAY + 1e-9) {
      const rem = Math.max(0, MAX_USD_PER_WALLET_PER_DAY - w.usdSpent);
      return {
        ok: false,
        error:
          rem <= 0
            ? `Daily cash-out limit reached (${formatUsd(MAX_USD_PER_WALLET_PER_DAY)} estimated value per wallet). Resets midnight UTC.`
            : `Only ~${formatUsd(rem)} left on your daily cash-out limit of ${formatUsd(MAX_USD_PER_WALLET_PER_DAY)}.`,
        code: 'DAILY_USD_CAP',
      };
    }

    const ipB = ipBucket(ip);
    if (ipB.usdSpent + usdValue > MAX_USD_PER_IP_PER_DAY + 1e-9) {
      return {
        ok: false,
        error: `Network daily cash-out limit reached (~${formatUsd(MAX_USD_PER_IP_PER_DAY)}). Try again tomorrow (UTC).`,
        code: 'DAILY_IP_USD_CAP',
      };
    }

    // ── Chip backstops (all Fam coins → chips) ──────────────────────
    if (chipCost > MAX_CHIP_COST_PER_EXCHANGE) {
      return {
        ok: false,
        error: `Max ${MAX_CHIP_COST_PER_EXCHANGE.toLocaleString()} Bonk Chips per cashout (~${MAX_BONGA_EQUIVALENT_PER_EXCHANGE} BONGA-equivalent). Split into smaller amounts.`,
        code: 'MAX_PER_EXCHANGE',
      };
    }

    if (w.exchanges >= MAX_EXCHANGES_PER_WALLET_PER_DAY) {
      return {
        ok: false,
        error: `Daily exchange limit reached (${MAX_EXCHANGES_PER_WALLET_PER_DAY} per wallet). Try again tomorrow (UTC).`,
        code: 'DAILY_EXCHANGE_COUNT',
      };
    }

    if (w.chipsSpent + chipCost > MAX_CHIPS_EXCHANGED_PER_WALLET_PER_DAY) {
      const remainingChips = Math.max(0, MAX_CHIPS_EXCHANGED_PER_WALLET_PER_DAY - w.chipsSpent);
      return {
        ok: false,
        error:
          remainingChips <= 0
            ? `Daily chip cash-out limit reached (${MAX_CHIPS_EXCHANGED_PER_WALLET_PER_DAY.toLocaleString()} chips / ~${MAX_BONGA_EQUIVALENT_PER_WALLET_PER_DAY} BONGA-eq). Resets midnight UTC.`
            : `Only ${remainingChips.toLocaleString()} Bonk Chips left on your daily chip cash-out limit.`,
        code: 'DAILY_CHIP_CAP',
      };
    }

    if (ipB.chipsSpent + chipCost > MAX_CHIPS_EXCHANGED_PER_IP_PER_DAY) {
      return {
        ok: false,
        error: 'Network daily chip cash-out limit reached. Try again tomorrow (UTC).',
        code: 'DAILY_IP_CHIP_CAP',
      };
    }

    const concern = usdValue >= USD_CONCERN_THRESHOLD - 1e-9;
    return { ok: true, concern };
  } catch {
    return {
      ok: false,
      error: 'Exchange limits temporarily unavailable. Try again shortly.',
      code: 'LIMIT_CHECK_FAILED',
    };
  }
}

/** Call only after a successful treasury SPL transfer. */
export function recordSuccessfulExchange(
  wallet: string,
  ip: string,
  chipCost: number,
  usdValue: number,
): void {
  try {
    const cost = Math.max(0, Math.floor(chipCost));
    const usd = Math.max(0, usdValue);
    const w = walletBucket(wallet);
    w.exchanges += 1;
    w.chipsSpent += cost;
    w.usdSpent += usd;
    walletBuckets.set(wallet, w);

    const ipB = ipBucket(ip);
    ipB.chipsSpent += cost;
    ipB.usdSpent += usd;
    ipBuckets.set(ip, ipB);
  } catch {
    // Best-effort
  }
}

/** @deprecated */
export function checkWalletExchangeLimit(
  wallet: string,
): { ok: true } | { ok: false; error: string } {
  const result = assertExchangeWithinLimits({
    wallet,
    ip: 'legacy',
    chipCost: 1,
    usdValue: 0.01,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}
