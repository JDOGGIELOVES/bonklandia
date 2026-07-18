import { loadJsonStore, saveJsonStore } from '@/lib/security/persistent-store';
import {
  emptyChipLedger,
  openChipLedger,
  sealChipLedger,
  type ChipLedgerPayload,
} from '@/lib/security/chip-token';

export type WalletChipRecord = {
  chips: number;
  lifetimeWon: number;
  lifetimeExchanged: number;
  updatedAt: string;
  /** HMAC token the client must send back (portable across serverless). */
  ledgerToken: string;
};

type ChipLedgerStore = Record<string, Omit<WalletChipRecord, 'ledgerToken'>>;

const STORE_FILE = 'chip-ledger.json';

function loadFileLedger(): ChipLedgerStore {
  return loadJsonStore<ChipLedgerStore>(STORE_FILE, {});
}

function saveFileLedger(ledger: ChipLedgerStore): void {
  try {
    saveJsonStore(STORE_FILE, ledger);
  } catch {
    // Vercel read-only /tmp races are OK — sealed token is source of truth.
  }
}

function toPayload(wallet: string, record: Omit<WalletChipRecord, 'ledgerToken'>): ChipLedgerPayload {
  return {
    v: 1,
    wallet,
    chips: record.chips,
    lifetimeWon: record.lifetimeWon,
    lifetimeExchanged: record.lifetimeExchanged,
    updatedAt: record.updatedAt,
  };
}

function withToken(wallet: string, record: Omit<WalletChipRecord, 'ledgerToken'>): WalletChipRecord {
  return {
    ...record,
    ledgerToken: sealChipLedger(toPayload(wallet, record)),
  };
}

/**
 * Resolve ledger for a wallet. Prefer the client-held sealed token
 * (works on multi-instance serverless). Fall back to local file for dev.
 */
export function getWalletChipBalance(
  wallet: string,
  ledgerToken?: string | null,
): WalletChipRecord {
  const fromToken = openChipLedger(ledgerToken);
  if (fromToken && fromToken.wallet === wallet) {
    return withToken(wallet, {
      chips: fromToken.chips,
      lifetimeWon: fromToken.lifetimeWon,
      lifetimeExchanged: fromToken.lifetimeExchanged,
      updatedAt: fromToken.updatedAt,
    });
  }

  const file = loadFileLedger()[wallet];
  if (file) {
    return withToken(wallet, {
      chips: Math.max(0, Math.floor(file.chips ?? 0)),
      lifetimeWon: Math.max(0, Math.floor(file.lifetimeWon ?? 0)),
      lifetimeExchanged: Math.max(0, Math.floor(file.lifetimeExchanged ?? 0)),
      updatedAt: file.updatedAt ?? new Date().toISOString(),
    });
  }

  return withToken(wallet, emptyChipLedger(wallet));
}

function persist(
  wallet: string,
  next: Omit<WalletChipRecord, 'ledgerToken'>,
): WalletChipRecord {
  const ledger = loadFileLedger();
  ledger[wallet] = next;
  saveFileLedger(ledger);
  return withToken(wallet, next);
}

export function creditWalletChips(
  wallet: string,
  amount: number,
  ledgerToken?: string | null,
): { ok: true; record: WalletChipRecord } | { ok: false; error: string } {
  const chips = Math.max(0, Math.floor(amount));
  if (chips <= 0) return { ok: false, error: 'Invalid chip credit.' };

  const prev = getWalletChipBalance(wallet, ledgerToken);
  const next = {
    chips: prev.chips + chips,
    lifetimeWon: prev.lifetimeWon + chips,
    lifetimeExchanged: prev.lifetimeExchanged,
    updatedAt: new Date().toISOString(),
  };
  return { ok: true, record: persist(wallet, next) };
}

/**
 * Move chips onto the ledger without bumping lifetimeWon
 * (import of local bank that was already counted as won client-side).
 */
export function depositWalletChips(
  wallet: string,
  amount: number,
  ledgerToken?: string | null,
): { ok: true; record: WalletChipRecord; deposited: number } | { ok: false; error: string } {
  const chips = Math.max(0, Math.floor(amount));
  if (chips <= 0) return { ok: false, error: 'Invalid chip deposit.' };

  const prev = getWalletChipBalance(wallet, ledgerToken);
  const next = {
    chips: prev.chips + chips,
    lifetimeWon: prev.lifetimeWon,
    lifetimeExchanged: prev.lifetimeExchanged,
    updatedAt: new Date().toISOString(),
  };
  return { ok: true, record: persist(wallet, next), deposited: chips };
}

export function debitWalletChips(
  wallet: string,
  amount: number,
  ledgerToken?: string | null,
): { ok: true; record: WalletChipRecord } | { ok: false; error: string } {
  const chipCost = Math.max(0, Math.floor(amount));
  if (chipCost <= 0) return { ok: false, error: 'Invalid chip debit.' };

  const prev = getWalletChipBalance(wallet, ledgerToken);
  if (prev.chips < chipCost) {
    return {
      ok: false,
      error: `Need ${chipCost.toLocaleString()} cashier chips — you have ${prev.chips.toLocaleString()}.`,
    };
  }

  const next = {
    chips: prev.chips - chipCost,
    lifetimeWon: prev.lifetimeWon,
    lifetimeExchanged: prev.lifetimeExchanged + 1,
    updatedAt: new Date().toISOString(),
  };
  return { ok: true, record: persist(wallet, next) };
}
