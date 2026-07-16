import { getAccount, getAssociatedTokenAddressSync, getMint, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import {
  calculateChipCost,
  getFamToken,
  humanAmountToRaw,
  type FamCoinId,
} from '@/lib/fam-tokens';
import { treasuryPayoutsAllowed, treasuryPayoutsBlockedReason, recordPayoutAttempt } from '@/lib/security/payout-guard';
import {
  buildTreasurySplTransferOnly,
  checkTreasuryTxSafety,
  recipientTokenAccountExists,
  simulateTreasuryTransfer,
} from '@/lib/security/treasury-transfer';
import { TREASURY_PUBLIC_KEY } from '@/lib/wallet/config';

const TREASURY_SECRET_ENV_KEYS = [
  'BONGA_TREASURY_SECRET_KEY',
  'TREASURY_PRIVATE_KEY',
  'TREASURY_SECRET_KEY',
] as const;

function parseSecretKey(raw: string): Uint8Array | null {
  const trimmed = raw.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith('[')) {
      const bytes = Uint8Array.from(JSON.parse(trimmed) as number[]);
      return bytes.length === 64 ? bytes : null;
    }
    const decoded = bs58.decode(trimmed);
    return decoded.length === 64 ? decoded : null;
  } catch {
    return null;
  }
}

export function loadTreasuryKeypair(): Keypair | null {
  for (const envKey of TREASURY_SECRET_ENV_KEYS) {
    const raw = process.env[envKey]?.trim();
    if (!raw) continue;

    const secret = parseSecretKey(raw);
    if (!secret) continue;

    try {
      return Keypair.fromSecretKey(secret);
    } catch {
      continue;
    }
  }

  return null;
}

export function resolveTreasuryPublicKey(): PublicKey {
  const fromEnv =
    process.env.TREASURY_PUBLIC_KEY?.trim() ??
    process.env.NEXT_PUBLIC_TREASURY_PUBLIC_KEY?.trim();

  if (fromEnv) {
    return new PublicKey(fromEnv);
  }

  const keypair = loadTreasuryKeypair();
  if (keypair) {
    return keypair.publicKey;
  }

  return new PublicKey(TREASURY_PUBLIC_KEY);
}

export function getTreasuryPublicKey(): string {
  return resolveTreasuryPublicKey().toBase58();
}

export function treasuryKeyMismatchError(): string | null {
  const keypair = loadTreasuryKeypair();
  if (!keypair) return null;

  const expected = resolveTreasuryPublicKey();
  if (!keypair.publicKey.equals(expected)) {
    return `Treasury secret key does not match ${expected.toBase58()}. Use the Bonk Miner / GrokSight treasury key.`;
  }

  return null;
}

export function isTreasuryPayoutsReady(): boolean {
  const keypair = loadTreasuryKeypair();
  if (!keypair) return false;
  return keypair.publicKey.equals(resolveTreasuryPublicKey());
}

export function isTreasuryConfigured(): boolean {
  return isTreasuryPayoutsReady();
}

export type ExchangeParams = {
  coinId: FamCoinId;
  tokenAmount: number;
  recipientWallet: string;
  chipCost: number;
};

export type ExchangeResult =
  | { ok: true; signature: string; chipCost: number; tokenAmount: number; symbol: string }
  | { ok: false; error: string; code?: string };

export async function executeTokenExchange(
  connection: Connection,
  params: ExchangeParams,
): Promise<ExchangeResult> {
  if (!treasuryPayoutsAllowed()) {
    return {
      ok: false,
      error: treasuryPayoutsBlockedReason() ?? 'Cashier payouts are paused.',
      code: 'PAYOUTS_PAUSED',
    };
  }

  const mismatch = treasuryKeyMismatchError();
  if (mismatch) {
    return { ok: false, error: mismatch, code: 'TREASURY_KEY_MISMATCH' };
  }

  const treasury = loadTreasuryKeypair();
  if (!treasury) {
    return {
      ok: false,
      error:
        'Cashier treasury signing key is not configured. Set BONGA_TREASURY_SECRET_KEY (same key as Bonk Miner / GrokSight).',
      code: 'TREASURY_MISSING',
    };
  }

  const token = getFamToken(params.coinId);
  if (!token) return { ok: false, error: 'Unknown Fam token.' };

  if (!Number.isFinite(params.tokenAmount) || params.tokenAmount < token.minTokens) {
    return {
      ok: false,
      error: `Minimum exchange is ${token.minTokens.toLocaleString()} ${token.symbol}.`,
    };
  }

  const expectedChipCost = calculateChipCost(params.coinId, params.tokenAmount);
  if (params.chipCost !== expectedChipCost) {
    return { ok: false, error: 'Chip cost mismatch — refresh and try again.' };
  }

  let recipient: PublicKey;
  let mint: PublicKey;
  try {
    recipient = new PublicKey(params.recipientWallet);
    mint = new PublicKey(token.mint);
  } catch {
    return { ok: false, error: 'Invalid wallet or mint address.' };
  }

  const mintInfo = await getMint(connection, mint);
  const rawAmount = humanAmountToRaw(params.tokenAmount, mintInfo.decimals);
  if (rawAmount <= BigInt(0)) {
    return { ok: false, error: 'Token amount is too small for this mint.' };
  }

  const treasuryAta = getAssociatedTokenAddressSync(mint, treasury.publicKey, false, TOKEN_PROGRAM_ID);
  const recipientAta = getAssociatedTokenAddressSync(mint, recipient, false, TOKEN_PROGRAM_ID);

  const recipientReady = await recipientTokenAccountExists(connection, recipientAta);
  if (!recipientReady) {
    return {
      ok: false,
      error: `Your wallet has no ${token.symbol} token account. Hold at least 1 ${token.symbol} first — the treasury never creates accounts or pays SOL rent.`,
      code: 'NO_TOKEN_ACCOUNT',
    };
  }

  let treasuryBalance: bigint;
  try {
    const account = await getAccount(connection, treasuryAta);
    treasuryBalance = account.amount;
  } catch {
    return {
      ok: false,
      error: `Treasury has no ${token.symbol} token account. Fund the shared treasury wallet first.`,
      code: 'TREASURY_EMPTY',
    };
  }

  if (treasuryBalance < rawAmount) {
    return {
      ok: false,
      error: `Cashier is low on ${token.symbol}. Try a smaller amount.`,
      code: 'INSUFFICIENT_TREASURY',
    };
  }

  const built = buildTreasurySplTransferOnly(
    treasury.publicKey,
    recipient,
    mint,
    rawAmount,
    mintInfo.decimals,
  );

  const safety = checkTreasuryTxSafety(
    built.transaction,
    treasury.publicKey,
    built.treasuryAta,
    built.recipientAta,
    mint,
  );
  if (safety.shouldBlock) {
    return { ok: false, error: safety.message ?? 'Treasury safety check failed.', code: 'TX_BLOCKED' };
  }

  const simulation = await simulateTreasuryTransfer(connection, built.transaction, treasury);
  if (!simulation.ok) {
    return { ok: false, error: simulation.error, code: 'SIMULATION_FAILED' };
  }

  try {
    const signature = await sendAndConfirmTransaction(connection, built.transaction, [treasury], {
      commitment: 'confirmed',
    });

    recordPayoutAttempt();

    return {
      ok: true,
      signature,
      chipCost: expectedChipCost,
      tokenAmount: params.tokenAmount,
      symbol: token.symbol,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transfer failed.';
    return { ok: false, error: message, code: 'TRANSFER_FAILED' };
  }
}