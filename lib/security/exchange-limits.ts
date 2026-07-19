import { MAX_EXCHANGES_PER_WALLET_PER_DAY } from '@/lib/security/config';

type WalletDayBucket = { date: string; count: number };

/** In-memory daily exchange counts (Vercel-safe; never EROFS). */
const buckets = new Map<string, WalletDayBucket>();

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function checkWalletExchangeLimit(
  wallet: string,
): { ok: true } | { ok: false; error: string } {
  try {
    const today = utcDate();
    const bucket = buckets.get(wallet);

    if (!bucket || bucket.date !== today) {
      buckets.set(wallet, { date: today, count: 1 });
      return { ok: true };
    }

    if (bucket.count >= MAX_EXCHANGES_PER_WALLET_PER_DAY) {
      return { ok: false, error: 'Daily exchange limit reached for this wallet.' };
    }

    bucket.count += 1;
    buckets.set(wallet, bucket);
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
