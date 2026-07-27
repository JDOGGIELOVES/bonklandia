import {
  loadChipLedgerToken,
  saveChipLedgerToken,
} from '@/lib/chip-ledger-client';
import type { EarnSource } from '@/lib/security/earn-limits';

export type SpendableBalance = {
  chips: number;
  lifetimeWon: number;
  lifetimeExchanged: number;
  ledgerToken: string | null;
};

export async function fetchSpendableChips(wallet: string): Promise<SpendableBalance | null> {
  if (!wallet) return null;
  const token = loadChipLedgerToken(wallet);
  try {
    const res = await fetch('/api/chips/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, ledgerToken: token }),
    });
    const data = (await res.json()) as {
      chips?: number;
      lifetimeWon?: number;
      lifetimeExchanged?: number;
      ledgerToken?: string | null;
      error?: string;
    };
    if (!res.ok) return null;
    const chips = Math.max(0, Math.floor(Number(data.chips) || 0));
    const ledgerToken = data.ledgerToken?.trim() || null;
    if (ledgerToken) {
      saveChipLedgerToken(wallet, ledgerToken, chips, { force: true });
    }
    return {
      chips,
      lifetimeWon: Math.max(0, Math.floor(Number(data.lifetimeWon) || 0)),
      lifetimeExchanged: Math.max(0, Math.floor(Number(data.lifetimeExchanged) || 0)),
      ledgerToken,
    };
  } catch {
    return null;
  }
}

/** Credit spendable chips from in-game play (Depths events, etc.). */
export async function earnSpendableChips(params: {
  wallet: string;
  amount: number;
  source: Exclude<EarnSource, 'casino-claim'>;
}): Promise<SpendableBalance | null> {
  const { wallet, amount, source } = params;
  if (!wallet || amount <= 0) return null;
  const token = loadChipLedgerToken(wallet);
  try {
    const res = await fetch('/api/chips/earn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet,
        amount: Math.floor(amount),
        source,
        ledgerToken: token,
      }),
    });
    const data = (await res.json()) as {
      chips?: number;
      lifetimeWon?: number;
      lifetimeExchanged?: number;
      ledgerToken?: string;
      error?: string;
    };
    if (!res.ok || !data.ledgerToken) return null;
    const chips = Math.max(0, Math.floor(Number(data.chips) || 0));
    saveChipLedgerToken(wallet, data.ledgerToken, chips, { force: true });
    return {
      chips,
      lifetimeWon: Math.max(0, Math.floor(Number(data.lifetimeWon) || 0)),
      lifetimeExchanged: Math.max(0, Math.floor(Number(data.lifetimeExchanged) || 0)),
      ledgerToken: data.ledgerToken,
    };
  } catch {
    return null;
  }
}

/** Move settled casino session winnings onto the spendable ledger. */
export async function claimCasinoToLedger(params: {
  wallet: string;
  sessionId: string;
  settleToken: string;
}): Promise<SpendableBalance | null> {
  const { wallet, sessionId, settleToken } = params;
  if (!wallet || !sessionId || !settleToken || settleToken === 'local') return null;
  const token = loadChipLedgerToken(wallet);
  try {
    const res = await fetch('/api/chips/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet,
        sessionId,
        settleToken,
        ledgerToken: token,
      }),
    });
    const data = (await res.json()) as {
      chips?: number;
      credited?: number;
      ledgerToken?: string;
      error?: string;
    };
    if (!res.ok || !data.ledgerToken) return null;
    const chips = Math.max(0, Math.floor(Number(data.chips) || 0));
    saveChipLedgerToken(wallet, data.ledgerToken, chips, { force: true });
    return {
      chips,
      lifetimeWon: chips,
      lifetimeExchanged: 0,
      ledgerToken: data.ledgerToken,
    };
  } catch {
    return null;
  }
}
