'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import {
  FAM_TOKENS,
  formatTokenBalance,
  type FamCoinId,
} from '@/lib/fam-tokens';
import { loadWalletTokenBalancesByMint } from '@/lib/token-accounts';

export type TokenBalance = {
  raw: bigint;
  ui: string;
  decimals: number;
  accountExists: boolean;
};

export type FamBalances = Record<FamCoinId, TokenBalance>;

const ZERO_BALANCE = (decimals: number, accountExists = false): TokenBalance => ({
  raw: BigInt(0),
  ui: '0',
  decimals,
  accountExists,
});

export function useFamTokenBalances() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [balances, setBalances] = useState<Partial<FamBalances>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!connected || !publicKey) {
      setBalances({});
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const mints = FAM_TOKENS.map(t => new PublicKey(t.mint));
      const byMint = await loadWalletTokenBalancesByMint(connection, publicKey, mints);

      // Decimals from mint accounts (or from scanned token amount when available)
      const decimalsByMint = new Map<string, number>();
      await Promise.all(
        FAM_TOKENS.map(async token => {
          const mintStr = token.mint;
          const scanned = byMint.get(mintStr);
          if (scanned && scanned.decimals > 0) {
            decimalsByMint.set(mintStr, scanned.decimals);
            return;
          }
          try {
            const mintInfo = await getMint(connection, new PublicKey(mintStr));
            decimalsByMint.set(mintStr, mintInfo.decimals);
          } catch {
            decimalsByMint.set(mintStr, 9);
          }
        }),
      );

      const next: Partial<FamBalances> = {};
      for (const token of FAM_TOKENS) {
        const found = byMint.get(token.mint);
        const decimals = decimalsByMint.get(token.mint) ?? 9;
        if (found) {
          next[token.id] = {
            raw: found.amount,
            ui: formatTokenBalance(found.amount, decimals),
            decimals,
            accountExists: true,
          };
        } else {
          next[token.id] = ZERO_BALANCE(decimals, false);
        }
      }

      setBalances(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load token balances.');
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, connection]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasAnyBalance = FAM_TOKENS.some(t => (balances[t.id]?.raw ?? BigInt(0)) > BigInt(0));

  return { balances, loading, error, refresh, hasAnyBalance, connected };
}
