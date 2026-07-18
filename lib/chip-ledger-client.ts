import { BRAND } from '@/lib/brand';

/** Browser-held sealed ledger (survives Vercel multi-instance). */
export const CHIP_LEDGER_TOKEN_KEY = `${BRAND.storagePrefix}-chip-ledger-token`;

type LedgerEntry = {
  token: string;
  chips: number;
  updatedAt: string;
};

type LedgerMap = Record<string, LedgerEntry | string>;

function readMap(): Record<string, LedgerEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CHIP_LEDGER_TOKEN_KEY);
    if (!raw) return {};
    if (!raw.startsWith('{')) {
      // legacy single-token string
      return {};
    }
    const parsed = JSON.parse(raw) as LedgerMap;
    const out: Record<string, LedgerEntry> = {};
    for (const [wallet, value] of Object.entries(parsed)) {
      if (typeof value === 'string') {
        out[wallet] = { token: value, chips: 0, updatedAt: new Date().toISOString() };
      } else if (value && typeof value.token === 'string') {
        out[wallet] = {
          token: value.token,
          chips: Math.max(0, Math.floor(Number(value.chips) || 0)),
          updatedAt: value.updatedAt ?? new Date().toISOString(),
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, LedgerEntry>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CHIP_LEDGER_TOKEN_KEY, JSON.stringify(map));
  } catch {
    // private mode
  }
}

export function loadChipLedgerToken(wallet?: string | null): string | null {
  if (!wallet) return null;
  return readMap()[wallet]?.token ?? null;
}

export function loadChipLedgerChips(wallet?: string | null): number {
  if (!wallet) return 0;
  return readMap()[wallet]?.chips ?? 0;
}

/**
 * Persist sealed ledger. Never clobber a higher balance with a lower one
 * unless `force` (e.g. after a successful exchange debit).
 */
export function saveChipLedgerToken(
  wallet: string,
  token: string,
  chips: number,
  opts?: { force?: boolean },
): void {
  if (!wallet || !token) return;
  const map = readMap();
  const prev = map[wallet];
  const nextChips = Math.max(0, Math.floor(chips));

  if (!opts?.force && prev && nextChips < prev.chips) {
    // Protect against empty-token overwrites from flaky balance calls.
    return;
  }

  map[wallet] = {
    token,
    chips: nextChips,
    updatedAt: new Date().toISOString(),
  };
  writeMap(map);
}

export function clearChipLedgerToken(wallet: string): void {
  if (!wallet) return;
  const map = readMap();
  delete map[wallet];
  writeMap(map);
}
