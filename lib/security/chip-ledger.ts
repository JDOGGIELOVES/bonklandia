import { loadJsonStore, saveJsonStore } from '@/lib/security/persistent-store';

export type WalletChipRecord = {
  chips: number;
  lifetimeWon: number;
  lifetimeExchanged: number;
  updatedAt: string;
};

type ChipLedgerStore = Record<string, WalletChipRecord>;

const STORE_FILE = 'chip-ledger.json';

function loadLedger(): ChipLedgerStore {
  return loadJsonStore<ChipLedgerStore>(STORE_FILE, {});
}

function saveLedger(ledger: ChipLedgerStore): void {
  saveJsonStore(STORE_FILE, ledger);
}

export function getWalletChipBalance(wallet: string): WalletChipRecord {
  const ledger = loadLedger();
  return (
    ledger[wallet] ?? {
      chips: 0,
      lifetimeWon: 0,
      lifetimeExchanged: 0,
      updatedAt: new Date().toISOString(),
    }
  );
}

export function creditWalletChips(
  wallet: string,
  amount: number,
): { ok: true; record: WalletChipRecord } | { ok: false; error: string } {
  const chips = Math.max(0, Math.floor(amount));
  if (chips <= 0) return { ok: false, error: 'Invalid chip credit.' };

  const ledger = loadLedger();
  const prev = getWalletChipBalance(wallet);
  const next: WalletChipRecord = {
    chips: prev.chips + chips,
    lifetimeWon: prev.lifetimeWon + chips,
    lifetimeExchanged: prev.lifetimeExchanged,
    updatedAt: new Date().toISOString(),
  };
  ledger[wallet] = next;
  saveLedger(ledger);
  return { ok: true, record: next };
}

export function debitWalletChips(
  wallet: string,
  amount: number,
): { ok: true; record: WalletChipRecord } | { ok: false; error: string } {
  const chipCost = Math.max(0, Math.floor(amount));
  if (chipCost <= 0) return { ok: false, error: 'Invalid chip debit.' };

  const ledger = loadLedger();
  const prev = getWalletChipBalance(wallet);
  if (prev.chips < chipCost) {
    return {
      ok: false,
      error: `Need ${chipCost.toLocaleString()} server-verified chips — you have ${prev.chips.toLocaleString()}.`,
    };
  }

  const next: WalletChipRecord = {
    chips: prev.chips - chipCost,
    lifetimeWon: prev.lifetimeWon,
    lifetimeExchanged: prev.lifetimeExchanged + 1,
    updatedAt: new Date().toISOString(),
  };
  ledger[wallet] = next;
  saveLedger(ledger);
  return { ok: true, record: next };
}