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
  tokenAccount?: string | null;
};

export type FamBalances = Record<FamCoinId, TokenBalance>;

const ZERO_BALANCE = (decimals: number, accountExists = false): TokenBalance => ({
  raw: BigInt(0),
  ui: '0',
  decimals,
  accountExists,
  tokenAccount: null,
});

type ServerTokenRow = {
  id: FamCoinId;
  accountExists: boolean;
  balance: string;
  raw: string;
  decimals: number;
  tokenAccount?: string | null;
};

async function fetchBalancesFromServer(wallet: string): Promise<Partial<FamBalances> | null> {
  try {
    const res = await fetch(`/api/wallet-tokens?wallet=${encodeURIComponent(wallet)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { tokens?: ServerTokenRow[]; error?: string };
    if (!data.tokens?.length) return null;

    const next: Partial<FamBalances> = {};
    for (const row of data.tokens) {
      next[row.id] = {
        raw: BigInt(row.raw || '0'),
        ui: row.balance,
        decimals: row.decimals,
        accountExists: row.accountExists,
        tokenAccount: row.tokenAccount ?? null,
      };
    }
    return next;
  } catch {
    return null;
  }
}

async function fetchBalancesFromClient(
  connection: ReturnType<typeof useConnection>['connection'],
  publicKey: PublicKey,
): Promise<Partial<FamBalances>> {
  const mints = FAM_TOKENS.map(t => new PublicKey(t.mint));
  const byMint = await loadWalletTokenBalancesByMint(connection, publicKey, mints);

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
        tokenAccount: found.address.toBase58(),
      };
    } else {
      next[token.id] = ZERO_BALANCE(decimals, false);
    }
  }
  return next;
}

export function useFamTokenBalances() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [balances, setBalances] = useState<Partial<FamBalances>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'server' | 'client' | null>(null);

  const refresh = useCallback(async () => {
    if (!connected || !publicKey) {
      setBalances({});
      setError(null);
      setSource(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prefer server RPC — more reliable than browser → public mainnet-beta.
      const fromServer = await fetchBalancesFromServer(publicKey.toBase58());
      if (fromServer) {
        setBalances(fromServer);
        setSource('server');
        return;
      }

      const fromClient = await fetchBalancesFromClient(connection, publicKey);
      setBalances(fromClient);
      setSource('client');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load token balances.');
      setBalances({});
      setSource(null);
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, connection]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasAnyBalance = FAM_TOKENS.some(t => (balances[t.id]?.raw ?? BigInt(0)) > BigInt(0));

  return { balances, loading, error, refresh, hasAnyBalance, connected, source };
}
