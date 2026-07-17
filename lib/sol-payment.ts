import {
  Connection,
  PublicKey,
  SystemProgram,
  type ParsedTransactionWithMeta,
} from '@solana/web3.js';
import { getSolanaRpcUrl } from '@/lib/fam-tokens';
import { getTreasuryPublicKey } from '@/lib/treasury';

export const LAMPORTS_PER_SOL = 1_000_000_000;

/** Fallback SOL/USD when price API is unavailable (~$150). */
const FALLBACK_SOL_USD = 150;

export async function fetchSolUsdPrice(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { cache: 'no-store' },
    );
    if (!res.ok) return FALLBACK_SOL_USD;
    const data = await res.json() as { solana?: { usd?: number } };
    const price = data.solana?.usd;
    return price && price > 0 ? price : FALLBACK_SOL_USD;
  } catch {
    return FALLBACK_SOL_USD;
  }
}

export function lamportsForUsd(usd: number, solUsdPrice: number): number {
  const sol = usd / solUsdPrice;
  return Math.max(1, Math.round(sol * LAMPORTS_PER_SOL));
}

export type PaidSpinQuote = {
  usd: number;
  solUsdPrice: number;
  lamports: number;
  solAmount: number;
  treasuryPubkey: string;
};

export async function getPaidSpinQuote(usd = 0.25): Promise<PaidSpinQuote> {
  const solUsdPrice = await fetchSolUsdPrice();
  const lamports = lamportsForUsd(usd, solUsdPrice);
  return {
    usd,
    solUsdPrice,
    lamports,
    solAmount: lamports / LAMPORTS_PER_SOL,
    treasuryPubkey: getTreasuryPublicKey(), // shared Bonk Miner / GrokSight treasury
  };
}

function getLamportsFromParsedTx(
  tx: ParsedTransactionWithMeta,
  treasury: PublicKey,
): number {
  const accountKeys = tx.transaction.message.accountKeys.map(k => k.pubkey.toBase58());
  const treasuryIndex = accountKeys.indexOf(treasury.toBase58());
  if (treasuryIndex < 0 || !tx.meta) return 0;

  const pre = tx.meta.preBalances[treasuryIndex] ?? 0;
  const post = tx.meta.postBalances[treasuryIndex] ?? 0;
  return Math.max(0, post - pre);
}

function getTxSigner(tx: ParsedTransactionWithMeta): string | null {
  const keys = tx.transaction.message.accountKeys;
  const signer = keys.find(k => k.signer);
  return signer?.pubkey.toBase58() ?? null;
}

const COMPUTE_BUDGET_PROGRAM = 'ComputeBudget111111111111111111111111111111';

/** Wallets often inject ComputeBudget ixs — allow those, require exactly one SOL transfer. */
function txOnlyTransfersSolToTreasury(
  tx: ParsedTransactionWithMeta,
  treasury: PublicKey,
): { ok: true } | { ok: false; error: string } {
  // Inner ixs can appear for unrelated runtime bookkeeping; still require balance proof below.
  const instructions = tx.transaction.message.instructions;
  if (instructions.length < 1 || instructions.length > 6) {
    return { ok: false, error: 'Quarter Slot payment must be a simple SOL transfer.' };
  }

  let transferCount = 0;
  for (const ix of instructions) {
    const programId =
      'programId' in ix && ix.programId
        ? typeof ix.programId === 'string'
          ? ix.programId
          : (ix.programId as { toBase58?: () => string }).toBase58?.() ?? ''
        : '';

    if (programId === COMPUTE_BUDGET_PROGRAM || programId.startsWith('ComputeBudget')) {
      continue;
    }

    const program = 'program' in ix ? String((ix as { program?: string }).program ?? '') : '';
    if (program === 'spl-memo' || program === 'compute-budget') {
      continue;
    }

    if (!('parsed' in ix) || !ix.parsed || typeof ix.parsed !== 'object') {
      return { ok: false, error: 'Quarter Slot payment must be a parsed SOL transfer.' };
    }

    const parsed = ix.parsed as {
      type?: string;
      info?: { destination?: string; lamports?: number };
    };

    if (parsed.type !== 'transfer' && parsed.type !== 'transferChecked') {
      return { ok: false, error: 'Only SOL transfer instructions are accepted.' };
    }

    transferCount += 1;
    if (parsed.info?.destination && parsed.info.destination !== treasury.toBase58()) {
      return { ok: false, error: 'Payment must be sent to the shared treasury wallet.' };
    }
  }

  if (transferCount !== 1) {
    return { ok: false, error: 'Quarter Slot payment must include exactly one SOL transfer.' };
  }

  return { ok: true };
}

export async function verifyPaidSpinTransaction(
  signature: string,
  minLamports: number,
  expectedPayer?: string,
): Promise<{ ok: true; payer: string | null } | { ok: false; error: string }> {
  const connection = new Connection(getSolanaRpcUrl(), 'confirmed');
  const treasury = new PublicKey(getTreasuryPublicKey());

  let tx: ParsedTransactionWithMeta | null = null;
  for (let i = 0; i < 8; i++) {
    tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });
    if (tx) break;
    await new Promise(r => setTimeout(r, 750));
  }

  if (!tx) {
    return { ok: false, error: 'Transaction not found yet — wait a moment and retry.' };
  }

  if (tx.meta?.err) {
    return { ok: false, error: 'Transaction failed on-chain.' };
  }

  const transferCheck = txOnlyTransfersSolToTreasury(tx, treasury);
  if (!transferCheck.ok) return transferCheck;

  const payer = getTxSigner(tx);
  if (expectedPayer && payer && payer !== expectedPayer) {
    return { ok: false, error: 'Payment signer does not match connected wallet.' };
  }

  const received = getLamportsFromParsedTx(tx, treasury);
  const threshold = Math.floor(minLamports * 0.98);

  if (received < threshold) {
    return {
      ok: false,
      error: `Payment too low. Expected ~${minLamports} lamports, received ${received}.`,
    };
  }

  const treasuryOutflow = (tx.meta?.postBalances ?? []).map((post, i) => {
    const pre = tx.meta?.preBalances?.[i] ?? 0;
    return post - pre;
  });
  const treasuryIndex = tx.transaction.message.accountKeys.findIndex(
    k => k.pubkey.equals(treasury),
  );
  if (treasuryIndex >= 0 && (treasuryOutflow[treasuryIndex] ?? 0) < 0) {
    return { ok: false, error: 'Treasury cannot send SOL in Quarter Slot payments.' };
  }

  return { ok: true, payer };
}