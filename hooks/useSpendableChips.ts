'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { fetchSpendableChips, type SpendableBalance } from '@/lib/chips-client';
import { loadChipLedgerToken } from '@/lib/chip-ledger-client';

/**
 * Server-verified spendable Bonk Chips for the connected wallet.
 * Fake localStorage chips are not included.
 */
export function useSpendableChips() {
  const { publicKey, connected } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const [balance, setBalance] = useState<SpendableBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet || !connected) {
      setBalance(null);
      setError(null);
      return null;
    }
    setLoading(true);
    setError(null);
    const next = await fetchSpendableChips(wallet);
    setLoading(false);
    if (!next) {
      // No prior ledger — zero spendable until they earn
      const empty: SpendableBalance = {
        chips: 0,
        lifetimeWon: 0,
        lifetimeExchanged: 0,
        ledgerToken: loadChipLedgerToken(wallet),
      };
      setBalance(empty);
      return empty;
    }
    setBalance(next);
    return next;
  }, [wallet, connected]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    wallet,
    connected,
    spendableChips: balance?.chips ?? 0,
    lifetimeWon: balance?.lifetimeWon ?? 0,
    lifetimeExchanged: balance?.lifetimeExchanged ?? 0,
    ledgerToken: balance?.ledgerToken ?? (wallet ? loadChipLedgerToken(wallet) : null),
    loading,
    error,
    refresh,
    setBalance,
  };
}
