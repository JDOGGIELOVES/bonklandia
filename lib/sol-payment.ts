import {
  Connection,
  PublicKey,
  type ParsedTransactionWithMeta,
  type PartiallyDecodedInstruction,
  type ParsedInstruction,
} from '@solana/web3.js';
import { getSolanaRpcUrl } from '@/lib/fam-tokens';
import { getTreasuryPublicKey } from '@/lib/treasury';

export const LAMPORTS_PER_SOL = 1_000_000_000;

/** Fallback SOL/USD when price API is unavailable (~$150). */
const FALLBACK_SOL_USD = 150;

const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const COMPUTE_BUDGET_PROGRAM = 'ComputeBudget111111111111111111111111111111';
const MEMO_PROGRAMS = new Set([
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
  'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo',
]);

export async function fetchSolUsdPrice(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { cache: 'no-store' },
    );
    if (!res.ok) return FALLBACK_SOL_USD;
    const data = (await res.json()) as { solana?: { usd?: number } };
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
    treasuryPubkey: getTreasuryPublicKey(),
  };
}

function accountKeysBase58(tx: ParsedTransactionWithMeta): string[] {
  return tx.transaction.message.accountKeys.map(k =>
    typeof k.pubkey === 'string' ? k.pubkey : k.pubkey.toBase58(),
  );
}

function getLamportsFromParsedTx(tx: ParsedTransactionWithMeta, treasury: PublicKey): number {
  const accountKeys = accountKeysBase58(tx);
  const treasuryIndex = accountKeys.indexOf(treasury.toBase58());
  if (treasuryIndex < 0 || !tx.meta) return 0;

  const pre = tx.meta.preBalances[treasuryIndex] ?? 0;
  const post = tx.meta.postBalances[treasuryIndex] ?? 0;
  return Math.max(0, post - pre);
}

function getTxSigner(tx: ParsedTransactionWithMeta): string | null {
  const keys = tx.transaction.message.accountKeys;
  const signer = keys.find(k => k.signer);
  if (!signer) return null;
  return typeof signer.pubkey === 'string' ? signer.pubkey : signer.pubkey.toBase58();
}

function ixProgramId(ix: ParsedInstruction | PartiallyDecodedInstruction): string {
  if ('programId' in ix && ix.programId) {
    if (typeof ix.programId === 'string') return ix.programId;
    return (ix.programId as { toBase58?: () => string }).toBase58?.() ?? '';
  }
  return '';
}

/**
 * Solflare (and some other wallets) inject ComputeBudget + extra non-parsed ixs
 * (e.g. telemetry/hooks). Accept the payment if we can prove:
 *  - tx succeeded
 *  - treasury SOL balance increased by ~expected amount
 *  - payer matches
 * Prefer finding a parsed System transfer to treasury when present.
 */
function validateQuarterPaymentShape(
  tx: ParsedTransactionWithMeta,
  treasury: PublicKey,
): { ok: true } | { ok: false; error: string } {
  const treasuryStr = treasury.toBase58();
  const instructions = tx.transaction.message.instructions;
  if (!instructions?.length) {
    return { ok: false, error: 'Quarter Slot payment has no instructions.' };
  }

  let solTransfersToTreasury = 0;
  let solTransfersElsewhere = 0;

  for (const ix of instructions) {
    const programId = ixProgramId(ix);
    const program = 'program' in ix ? String((ix as ParsedInstruction).program ?? '') : '';

    // Always ignore compute budget + memos (parsed or not).
    if (
      programId === COMPUTE_BUDGET_PROGRAM ||
      programId.startsWith('ComputeBudget') ||
      program === 'compute-budget' ||
      program === 'spl-memo' ||
      MEMO_PROGRAMS.has(programId)
    ) {
      continue;
    }

    // Parsed System transfer — the real payment.
    if ('parsed' in ix && ix.parsed && typeof ix.parsed === 'object') {
      const parsed = ix.parsed as {
        type?: string;
        info?: { destination?: string; lamports?: number; source?: string };
      };
      if (parsed.type === 'transfer' || parsed.type === 'transferChecked') {
        if (parsed.info?.destination === treasuryStr) {
          solTransfersToTreasury += 1;
        } else {
          solTransfersElsewhere += 1;
        }
      }
      // Other parsed types (e.g. advanceNonce) — ignore for wallet flexibility
      continue;
    }

    // Unparsed System program: decode not available; balance proof still validates payment.
    if (programId === SYSTEM_PROGRAM || program === 'system') {
      // Count as possible transfer; balance check is authoritative.
      solTransfersToTreasury += 1;
      continue;
    }

    // Solflare / other wallets append unknown unparsed programs (e.g. L2TEx…).
    // Ignore them — balance proof ensures treasury received SOL.
  }

  if (solTransfersElsewhere > 0 && solTransfersToTreasury === 0) {
    return { ok: false, error: 'Payment must be sent to the shared treasury wallet.' };
  }

  // Balance proof is required in verifyPaidSpinTransaction; shape only soft-checks.
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
  for (let i = 0; i < 20; i++) {
    try {
      tx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
      if (tx) break;
    } catch {
      // rate-limit / transient
    }
    await new Promise(r => setTimeout(r, 800 + i * 100));
  }

  if (!tx) {
    return { ok: false, error: 'Transaction not found yet — wait a moment and retry.' };
  }

  if (tx.meta?.err) {
    return { ok: false, error: 'Transaction failed on-chain.' };
  }

  const shape = validateQuarterPaymentShape(tx, treasury);
  if (!shape.ok) return shape;

  const payer = getTxSigner(tx);
  if (expectedPayer && payer && payer !== expectedPayer) {
    return { ok: false, error: 'Payment signer does not match connected wallet.' };
  }

  // Authoritative: treasury SOL increased enough (covers Solflare-wrapped txs).
  const received = getLamportsFromParsedTx(tx, treasury);
  const threshold = Math.floor(minLamports * 0.95);

  if (received < threshold) {
    return {
      ok: false,
      error: `Payment too low. Expected ~${minLamports} lamports to treasury, received ${received}.`,
    };
  }

  const keys = accountKeysBase58(tx);
  const treasuryIndex = keys.indexOf(treasury.toBase58());
  if (treasuryIndex >= 0 && tx.meta) {
    const delta =
      (tx.meta.postBalances[treasuryIndex] ?? 0) - (tx.meta.preBalances[treasuryIndex] ?? 0);
    if (delta < 0) {
      return { ok: false, error: 'Treasury cannot send SOL in Quarter Slot payments.' };
    }
  }

  return { ok: true, payer };
}
