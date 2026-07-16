'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddressSync, getMint } from '@solana/spl-token';
import {
  FAM_TOKENS,
  formatTokenBalance,
  type FamCoinId,
} from '@/lib/fam-tokens';

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
      const next: Partial<FamBalances> = {};

      await Promise.all(
        FAM_TOKENS.map(async token => {
          const mint = new PublicKey(token.mint);
          const mintInfo = await getMint(connection, mint);
          const ata = getAssociatedTokenAddressSync(mint, publicKey);

          try {
            const account = await getAccount(connection, ata);
            next[token.id] = {
              raw: account.amount,
              ui: formatTokenBalance(account.amount, mintInfo.decimals),
              decimals: mintInfo.decimals,
              accountExists: true,
            };
          } catch {
            next[token.id] = ZERO_BALANCE(mintInfo.decimals, false);
          }
        }),
      );

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