import {
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';

export type WalletTokenAccount = {
  address: PublicKey;
  amount: bigint;
  decimals: number;
  isAta: boolean;
};

/**
 * Find a wallet's SPL token account for a mint.
 * Prefers the canonical ATA; falls back to any token account for that mint
 * (some wallets hold balances outside the derived ATA — Phantom still shows them).
 */
export async function findWalletTokenAccount(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
): Promise<WalletTokenAccount | null> {
  const ata = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID);

  try {
    const account = await getAccount(connection, ata, 'confirmed', TOKEN_PROGRAM_ID);
    return {
      address: ata,
      amount: account.amount,
      decimals: 0, // filled by caller when needed
      isAta: true,
    };
  } catch (err) {
    if (!(err instanceof TokenAccountNotFoundError)) {
      // Non-missing errors (RPC flakiness) — still try owner scan before giving up
      console.warn('[token-accounts] ATA lookup failed, scanning owner accounts', err);
    }
  }

  try {
    const scanned = await connection.getParsedTokenAccountsByOwner(
      owner,
      { mint },
      'confirmed',
    );

    if (!scanned.value.length) return null;

    // Prefer highest balance, then ATA if tied
    let best: WalletTokenAccount | null = null;
    for (const { pubkey, account } of scanned.value) {
      const info = account.data.parsed?.info as
        | {
            tokenAmount?: { amount?: string; decimals?: number };
          }
        | undefined;
      const amount = BigInt(info?.tokenAmount?.amount ?? '0');
      const decimals = Number(info?.tokenAmount?.decimals ?? 0);
      const isAta = pubkey.equals(ata);
      const candidate: WalletTokenAccount = {
        address: pubkey,
        amount,
        decimals,
        isAta,
      };
      if (
        !best ||
        candidate.amount > best.amount ||
        (candidate.amount === best.amount && candidate.isAta && !best.isAta)
      ) {
        best = candidate;
      }
    }
    return best;
  } catch (err) {
    console.warn('[token-accounts] owner scan failed', err);
    return null;
  }
}

/** True when the wallet can receive transfers of this mint (any existing token account). */
export async function walletHasTokenAccount(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
): Promise<boolean> {
  const found = await findWalletTokenAccount(connection, owner, mint);
  return found !== null;
}

/**
 * Load balances for many mints with one owner scan (matches Phantom-style discovery).
 */
export async function loadWalletTokenBalancesByMint(
  connection: Connection,
  owner: PublicKey,
  mints: PublicKey[],
): Promise<Map<string, WalletTokenAccount>> {
  const mintSet = new Set(mints.map(m => m.toBase58()));
  const result = new Map<string, WalletTokenAccount>();

  // Seed with ATA checks in parallel for speed when accounts are standard
  await Promise.all(
    mints.map(async mint => {
      const ata = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID);
      try {
        const account = await getAccount(connection, ata, 'confirmed', TOKEN_PROGRAM_ID);
        result.set(mint.toBase58(), {
          address: ata,
          amount: account.amount,
          decimals: 0,
          isAta: true,
        });
      } catch {
        // filled by scan below if present elsewhere
      }
    }),
  );

  // Owner scan catches non-ATA holdings and fills gaps when ATA RPC failed
  try {
    const scanned = await connection.getParsedTokenAccountsByOwner(
      owner,
      { programId: TOKEN_PROGRAM_ID },
      'confirmed',
    );

    for (const { pubkey, account } of scanned.value) {
      const info = account.data.parsed?.info as
        | {
            mint?: string;
            tokenAmount?: { amount?: string; decimals?: number };
          }
        | undefined;
      const mintStr = info?.mint;
      if (!mintStr || !mintSet.has(mintStr)) continue;

      const amount = BigInt(info?.tokenAmount?.amount ?? '0');
      const decimals = Number(info?.tokenAmount?.decimals ?? 0);
      const existing = result.get(mintStr);
      const isAta =
        existing?.isAta && existing.address.equals(pubkey)
          ? true
          : pubkey.equals(getAssociatedTokenAddressSync(new PublicKey(mintStr), owner, false, TOKEN_PROGRAM_ID));

      if (!existing || amount > existing.amount || (amount === existing.amount && isAta)) {
        result.set(mintStr, {
          address: pubkey,
          amount,
          decimals,
          isAta,
        });
      } else if (existing && existing.decimals === 0 && decimals > 0) {
        result.set(mintStr, { ...existing, decimals });
      }
    }
  } catch (err) {
    console.warn('[token-accounts] bulk owner scan failed', err);
  }

  return result;
}
