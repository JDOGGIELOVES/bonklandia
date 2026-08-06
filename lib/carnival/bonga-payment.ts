/**
 * BONGA entry fee for carnival wheel — verify SPL transfer into treasury.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
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
  priceSource: string;
};

const FALLBACK_BONGA_USD = Number(process.env.TOKEN_USD_BONGA ?? '0.00005');

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  let priceSource = 'fallback';
  try {
    const p = await getTokenUsdPrice('bonga');
    if (p?.usd && p.usd > 0) {
      bongaUsd = p.usd;
      priceStale = p.source === 'fallback';
      priceSource = p.source;
    }
  } catch {
    /* fallback */
  }

  // Guardrails: refuse absurd prices
  if (bongaUsd < 1e-9 || bongaUsd > 100) {
    bongaUsd = FALLBACK_BONGA_USD;
    priceStale = true;
    priceSource = 'fallback';
  }

  const bongaAmount = CARNIVAL_ENTRY_USD / bongaUsd;
  const factor = 10 ** decimals;
  // ceil so $0.25 is never under-collected due to float rounding
  const bongaRaw = BigInt(Math.max(1, Math.ceil(bongaAmount * factor)));

  const treasuryAta = getAssociatedTokenAddressSync(
    mintPk,
    new PublicKey(treasury),
    false,
    TOKEN_PROGRAM_ID,
  );

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
    priceSource,
  };
}

/**
 * Verify player sent at least `minRaw` BONGA to treasury ATA in `signature`.
 * Retries fetch briefly — RPC lag is the #1 false "payment failed" cause.
 */
export async function verifyBongaEntryPayment(opts: {
  signature: string;
  payer: string;
  minRaw: bigint;
  treasuryAta: string;
}): Promise<{ ok: true; rawReceived: bigint } | { ok: false; error: string }> {
  const connection = new Connection(getSolanaRpcUrl(), 'confirmed');
  const treasuryOwner = getTreasuryPublicKey();
  const mint = FAM_TOKEN_MINTS.bonga;

  let tx: Awaited<ReturnType<Connection['getParsedTransaction']>> = null;
  let lastErr = 'Payment transaction not found yet.';

  for (let attempt = 0; attempt < 8; attempt++) {
    if (attempt > 0) await sleep(700 * attempt);
    try {
      tx = await connection.getParsedTransaction(opts.signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
    } catch {
      lastErr = 'Could not fetch payment transaction from RPC.';
      continue;
    }
    if (tx?.meta?.err) {
      return { ok: false, error: 'Payment transaction failed on-chain.' };
    }
    if (tx?.meta) break;
  }

  if (!tx?.meta) {
    return {
      ok: false,
      error: `${lastErr} Wait a few seconds and try again — if BONGA already left your wallet, contact support with the tx signature.`,
    };
  }

  const pre = tx.meta.preTokenBalances ?? [];
  const post = tx.meta.postTokenBalances ?? [];

  let rawReceived = BigInt(0);

  // Match treasury by owner and/or by account pubkey when available
  for (const p of post) {
    if (p.mint !== mint) continue;
    const ownerOk = p.owner === treasuryOwner;
    // accountIndex maps into message account keys
    let ataOk = false;
    try {
      const keys = tx.transaction.message.accountKeys;
      const key = keys[p.accountIndex];
      const pk =
        typeof key === 'string'
          ? key
          : key && typeof key === 'object' && 'pubkey' in key
            ? typeof key.pubkey === 'string'
              ? key.pubkey
              : key.pubkey.toBase58()
            : null;
      ataOk = pk === opts.treasuryAta;
    } catch {
      ataOk = false;
    }
    if (!ownerOk && !ataOk) continue;

    const postRaw = BigInt(p.uiTokenAmount.amount);
    const preRow = pre.find(x => x.accountIndex === p.accountIndex && x.mint === mint);
    const preRaw = preRow?.uiTokenAmount?.amount ? BigInt(preRow.uiTokenAmount.amount) : BigInt(0);
    const delta = postRaw - preRaw;
    if (delta > rawReceived) rawReceived = delta;
  }

  if (rawReceived <= BigInt(0)) {
    rawReceived = scanTransferInstructions(tx, opts.treasuryAta, mint);
  }

  if (rawReceived <= BigInt(0)) {
    return {
      ok: false,
      error:
        'No BONGA credit to treasury found in that transaction. Make sure you paid the quoted amount to the treasury.',
    };
  }

  // Allow ~5% shortfall for quote drift between pay and verify (price refresh)
  const min95 = (opts.minRaw * BigInt(95)) / BigInt(100);
  if (rawReceived < min95) {
    return {
      ok: false,
      error: `Insufficient BONGA received (got ${rawReceived.toString()}, need ~${opts.minRaw.toString()}). Refresh the page for a new quote and try again.`,
    };
  }

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

function scanTransferInstructions(
  tx: NonNullable<Awaited<ReturnType<Connection['getParsedTransaction']>>>,
  treasuryAta: string,
  mint: string,
): bigint {
  const message = tx.transaction.message;
  type Ix = {
    program?: string;
    programId?: PublicKey | string;
    parsed?: {
      type?: string;
      info?: {
        mint?: string;
        destination?: string;
        amount?: string;
        tokenAmount?: { amount?: string };
      };
    };
  };

  const allIxs: Ix[] = [];
  const inner = tx.meta?.innerInstructions ?? [];
  for (const group of inner) {
    for (const ix of group.instructions) allIxs.push(ix as Ix);
  }
  for (const ix of message.instructions) allIxs.push(ix as Ix);

  let total = BigInt(0);
  for (const ix of allIxs) {
    const parsed = ix.parsed;
    if (!parsed || (parsed.type !== 'transfer' && parsed.type !== 'transferChecked')) continue;
    const info = parsed.info;
    if (!info) continue;
    if (info.mint && info.mint !== mint) continue;
    if (info.destination !== treasuryAta) continue;
    const amt = info.tokenAmount?.amount ?? info.amount;
    if (!amt) continue;
    try {
      total += BigInt(amt);
    } catch {
      /* skip */
    }
  }
  return total;
}
