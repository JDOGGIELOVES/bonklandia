import { BRAND } from '@/lib/brand';

/** Browser-held sealed ledger (survives Vercel multi-instance). */
export const CHIP_LEDGER_TOKEN_KEY = `${BRAND.storagePrefix}-chip-ledger-token`;

export function loadChipLedgerToken(wallet?: string | null): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CHIP_LEDGER_TOKEN_KEY);
    if (!raw) return null;
    // Prefer wallet-scoped map if present
    if (raw.startsWith('{')) {
      const map = JSON.parse(raw) as Record<string, string>;
      if (wallet && map[wallet]) return map[wallet];
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

export function saveChipLedgerToken(wallet: string, token: string): void {
  if (typeof window === 'undefined' || !wallet || !token) return;
  try {
    let map: Record<string, string> = {};
    const raw = localStorage.getItem(CHIP_LEDGER_TOKEN_KEY);
    if (raw?.startsWith('{')) {
      map = JSON.parse(raw) as Record<string, string>;
    }
    map[wallet] = token;
    localStorage.setItem(CHIP_LEDGER_TOKEN_KEY, JSON.stringify(map));
  } catch {
    // private mode
  }
}
