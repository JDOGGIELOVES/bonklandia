/**
 * BONGA entry fee for carnival wheel — verify SPL transfer into treasury.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { FAM_TOKEN_MINTS, getSolanaRpcUrl } from '@/lib/fam-tokens';
import { getTreasuryPublicKey } from '@/lib/treasury';
import { getTokenUsdPrice } from '@/lib/security/token-usd';
import { CARNIVAL_ENTRY_USD } from '@/lib/carnival/wheel';

export type CarnivalEntryQuote = {
  usd: number;
  bongaUsd: number;
  bongaAmount: number;
  bongaRaw: string;
  decimals: number;
  mint: string;
  treasuryPubkey: string;
  treasuryAta: string;
  priceStale: boolean;
};

const FALLBACK_BONGA_USD = Number(process.env.TOKEN_USD_BONGA ?? '0.0001');

export async function getCarnivalEntryQuote(): Promise<CarnivalEntryQuote> {
  const mint = FAM_TOKEN_MINTS.bonga;
  const treasury = getTreasuryPublicKey();
  const mintPk = new PublicKey(mint);
  const connection = new Connection(getSolanaRpcUrl(), 'confirmed');

  let decimals = 9;
  try {
    const info = await connection.getParsedAccountInfo(mintPk);
    const parsed = info.value?.data;
    if (parsed && typeof parsed === 'object' && 'parsed' in parsed) {
      const d = (parsed as { parsed?: { info?: { decimals?: number } } }).parsed?.info?.decimals;
      if (typeof d === 'number') decimals = d;
    }
  } catch {
    /* keep 9 */
  }

  let bongaUsd = FALLBACK_BONGA_USD;
  let priceStale = true;
  try {
    const p = await getTokenUsdPrice('bonga');
    if (p?.usd && p.usd > 0) {
      bongaUsd = p.usd;
      priceStale = p.source === 'fallback';
    }
  } catch {
    /* fallback */
  }

  // Guardrails: refuse absurd prices
  if (bongaUsd < 1e-9 || bongaUsd > 100) {
    bongaUsd = FALLBACK_BONGA_USD;
    priceStale = true;
  }

  const bongaAmount = CARNIVAL_ENTRY_USD / bongaUsd;
  const factor = 10 ** decimals;
  const bongaRaw = BigInt(Math.max(1, Math.ceil(bongaAmount * factor)));

  const treasuryAta = getAssociatedTokenAddressSync(mintPk, new PublicKey(treasury), false);

  return {
    usd: CARNIVAL_ENTRY_USD,
    bongaUsd,
    bongaAmount: Number(bongaRaw) / factor,
    bongaRaw: bongaRaw.toString(),
    decimals,
    mint,
    treasuryPubkey: treasury,
    treasuryAta: treasuryAta.toBase58(),
    priceStale,
  };
}

/**
 * Verify player sent at least `minRaw` BONGA to treasury ATA in `signature`.
 */
export async function verifyBongaEntryPayment(opts: {
  signature: string;
  payer: string;
  minRaw: bigint;
  treasuryAta: string;
}): Promise<{ ok: true; rawReceived: bigint } | { ok: false; error: string }> {
  const connection = new Connection(getSolanaRpcUrl(), 'confirmed');
  let tx;
  try {
    tx = await connection.getParsedTransaction(opts.signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });
  } catch {
    return { ok: false, error: 'Could not fetch payment transaction.' };
  }
  if (!tx?.meta || tx.meta.err) {
    return { ok: false, error: 'Payment transaction failed or not found.' };
  }

  const pre = tx.meta.preTokenBalances ?? [];
  const post = tx.meta.postTokenBalances ?? [];
  const mint = FAM_TOKEN_MINTS.bonga;

  // Find treasury ATA balance delta for BONGA
  const preT = pre.find(
    b => b.mint === mint && b.owner === getTreasuryPublicKey(),
  );
  const postT = post.find(
    b => b.mint === mint && b.owner === getTreasuryPublicKey(),
  );

  // Also match by account index if owner missing
  let rawReceived = BigInt(0);
  if (postT?.uiTokenAmount?.amount) {
    const postRaw = BigInt(postT.uiTokenAmount.amount);
    const preRaw = preT?.uiTokenAmount?.amount ? BigInt(preT.uiTokenAmount.amount) : BigInt(0);
    rawReceived = postRaw - preRaw;
  }

  if (rawReceived <= BigInt(0)) {
    // Fallback: scan transfer instructions
    rawReceived = scanTransferDelta(tx, opts.treasuryAta, mint);
  }

  if (rawReceived < opts.minRaw) {
    // Allow 2% slippage on amount due to UI rounding
    const min95 = (opts.minRaw * BigInt(98)) / BigInt(100);
    if (rawReceived < min95) {
      return {
        ok: false,
        error: `Insufficient BONGA received (got ${rawReceived}, need ~${opts.minRaw}).`,
      };
    }
  }

  // Payer must sign
  const keys = tx.transaction.message.accountKeys;
  const payerOk = keys.some(k => {
    const pk = typeof k.pubkey === 'string' ? k.pubkey : k.pubkey.toBase58();
    return k.signer && pk === opts.payer;
  });
  if (!payerOk) {
    return { ok: false, error: 'Payer wallet does not match payment transaction.' };
  }

  return { ok: true, rawReceived };
}

function scanTransferDelta(
  tx: NonNullable<Awaited<ReturnType<Connection['getParsedTransaction']>>>,
  treasuryAta: string,
  mint: string,
): bigint {
  if (!tx?.meta) return BigInt(0);
  const pre = tx.meta.preTokenBalances ?? [];
  const post = tx.meta.postTokenBalances ?? [];
  for (const p of post) {
    if (p.mint !== mint) continue;
    const accountIndex = p.accountIndex;
    const preRow = pre.find(x => x.accountIndex === accountIndex);
    const postRaw = BigInt(p.uiTokenAmount.amount);
    const preRaw = preRow ? BigInt(preRow.uiTokenAmount.amount) : BigInt(0);
    const delta = postRaw - preRaw;
    if (delta > BigInt(0)) {
      // Prefer treasury-owned
      if (p.owner === getTreasuryPublicKey()) return delta;
    }
  }
  void treasuryAta;
  return BigInt(0);
}
