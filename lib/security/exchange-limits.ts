import { MAX_EXCHANGES_PER_WALLET_PER_DAY } from '@/lib/security/config';
import { loadJsonStore, saveJsonStore } from '@/lib/security/persistent-store';

type WalletDayBucket = { date: string; count: number };

type ExchangeLimitStore = Record<string, WalletDayBucket>;

const STORE_FILE = 'exchange-limits.json';

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function checkWalletExchangeLimit(
  wallet: string,
): { ok: true } | { ok: false; error: string } {
  const store = loadJsonStore<ExchangeLimitStore>(STORE_FILE, {});
  const today = utcDate();
  const bucket = store[wallet];

  if (!bucket || bucket.date !== today) {
    store[wallet] = { date: today, count: 1 };
    saveJsonStore(STORE_FILE, store);
    return { ok: true };
  }

  if (bucket.count >= MAX_EXCHANGES_PER_WALLET_PER_DAY) {
    return { ok: false, error: 'Daily exchange limit reached for this wallet.' };
  }

  bucket.count += 1;
  store[wallet] = bucket;
  saveJsonStore(STORE_FILE, store);
  return { ok: true };
}