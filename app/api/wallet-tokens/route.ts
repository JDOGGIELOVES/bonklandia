import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { FAM_TOKENS, formatTokenBalance, getSolanaRpcUrl } from '@/lib/fam-tokens';
import { findWalletTokenAccount } from '@/lib/token-accounts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Server-side Fam token balance lookup (uses SOLANA_RPC_URL when set).
 * Avoids browser RPC rate-limits that falsely report "no token account".
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? '';
  if (!wallet) {
    return NextResponse.json({ error: 'Missing wallet query param.' }, { status: 400 });
  }

  let owner: PublicKey;
  try {
    owner = new PublicKey(wallet);
  } catch {
    return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 });
  }

  const endpoint = getSolanaRpcUrl();
  const connection = new Connection(endpoint, 'confirmed');

  try {
    const tokens = await Promise.all(
      FAM_TOKENS.map(async token => {
        const mint = new PublicKey(token.mint);
        let decimals = 9;
        try {
          const mintInfo = await getMint(connection, mint);
          decimals = mintInfo.decimals;
        } catch {
          // keep default
        }

        const found = await findWalletTokenAccount(connection, owner, mint);
        if (!found) {
          return {
            id: token.id,
            symbol: token.symbol,
            mint: token.mint,
            accountExists: false,
            balance: '0',
            raw: '0',
            decimals,
            tokenAccount: null as string | null,
            isAta: false,
          };
        }

        const dec = found.decimals > 0 ? found.decimals : decimals;
        return {
          id: token.id,
          symbol: token.symbol,
          mint: token.mint,
          accountExists: true,
          balance: formatTokenBalance(found.amount, dec),
          raw: found.amount.toString(),
          decimals: dec,
          tokenAccount: found.address.toBase58(),
          isAta: found.isAta,
        };
      }),
    );

    return NextResponse.json({
      wallet: owner.toBase58(),
      tokens,
      foundCount: tokens.filter(t => t.accountExists).length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[wallet-tokens]', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Failed to load wallet token accounts from Solana RPC.',
      },
      { status: 502 },
    );
  }
}
