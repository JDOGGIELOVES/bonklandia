import { Connection } from '@solana/web3.js';
import { NextResponse } from 'next/server';
import { getSolanaRpcUrl } from '@/lib/fam-tokens';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Fresh blockhash from server-side RPC (avoids browser → public mainnet 429s
 * that break Quarter Slot before Solflare can even open).
 */
export async function GET() {
  const endpoints = [
    getSolanaRpcUrl(),
    'https://solana-rpc.publicnode.com',
    'https://rpc.ankr.com/solana',
    'https://api.mainnet-beta.solana.com',
  ];

  // De-dupe while keeping order
  const seen = new Set<string>();
  const list = endpoints.filter(u => {
    if (!u || seen.has(u)) return false;
    seen.add(u);
    return true;
  });

  let lastError = 'Unknown RPC error';
  for (const endpoint of list) {
    try {
      const connection = new Connection(endpoint, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 30_000,
      });
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');
      return NextResponse.json({
        blockhash,
        lastValidBlockHeight,
        source: endpoint.includes('helius')
          ? 'helius'
          : endpoint.includes('publicnode')
            ? 'publicnode'
            : endpoint.includes('ankr')
              ? 'ankr'
              : 'solana',
        fetchedAt: Date.now(),
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json(
    { error: `Could not fetch blockhash from any RPC: ${lastError}` },
    { status: 502 },
  );
}
