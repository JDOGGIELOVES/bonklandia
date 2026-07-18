import { BRAND, LEGACY_STORAGE_KEYS } from '@/lib/brand';

export const BANK_STORAGE_KEY = `${BRAND.storagePrefix}-bank`;
export const BANK_CHANGE_EVENT = 'bonklandia-bank-change';

export type BankState = {
  chips: number;
  lifetimeChipsWon: number;
  lifetimeExchanges: number;
};

export const DEFAULT_BANK_STATE: BankState = {
  chips: 0,
  lifetimeChipsWon: 0,
  lifetimeExchanges: 0,
};

export function loadBankState(): BankState {
  if (typeof window === 'undefined') return { ...DEFAULT_BANK_STATE };

  try {
    let raw = localStorage.getItem(BANK_STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEYS.bank);
      if (legacy) {
        localStorage.setItem(BANK_STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_STORAGE_KEYS.bank);
        raw = legacy;
      }
    }
    if (!raw) return { ...DEFAULT_BANK_STATE };

    const parsed = JSON.parse(raw) as Partial<BankState> & { vault?: unknown };
    return {
      chips: Math.max(0, Math.floor(parsed.chips ?? 0)),
      lifetimeChipsWon: Math.max(0, Math.floor(parsed.lifetimeChipsWon ?? 0)),
      lifetimeExchanges: Math.max(0, Math.floor(parsed.lifetimeExchanges ?? 0)),
    };
  } catch {
    return { ...DEFAULT_BANK_STATE };
  }
}

export function saveBankState(state: BankState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(BANK_CHANGE_EVENT));
}

export function addChips(amount: number): BankState {
  const chips = Math.max(0, Math.floor(amount));
  if (chips <= 0) return loadBankState();

  const state = loadBankState();
  const next: BankState = {
    ...state,
    chips: state.chips + chips,
    lifetimeChipsWon: state.lifetimeChipsWon + chips,
  };
  saveBankState(next);
  return next;
}

export function spendChips(amount: number): { ok: true; state: BankState } | { ok: false; error: string } {
  const chipCost = Math.max(0, Math.floor(amount));
  if (chipCost <= 0) return { ok: false, error: 'Invalid chip amount.' };

  const state = loadBankState();
  if (state.chips < chipCost) {
    return {
      ok: false,
      error: `Need ${chipCost.toLocaleString()} chips — you have ${state.chips.toLocaleString()}.`,
    };
  }

  const next: BankState = {
    ...state,
    chips: state.chips - chipCost,
    lifetimeExchanges: state.lifetimeExchanges + 1,
  };
  saveBankState(next);
  return { ok: true, state: next };
}

/** Remove chips from local bank without counting an exchange (e.g. after server sync). */
export function clearLocalChips(amount?: number): BankState {
  const state = loadBankState();
  const remove =
    amount === undefined ? state.chips : Math.min(state.chips, Math.max(0, Math.floor(amount)));
  const next: BankState = {
    ...state,
    chips: state.chips - remove,
  };
  saveBankState(next);
  return next;
}

export function formatWalletAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}