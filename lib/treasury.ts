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
  simulateTreasuryTransfer,
} from '@/lib/security/treasury-transfer';
import { findWalletTokenAccount } from '@/lib/token-accounts';
import { TREASURY_PUBLIC_KEY } from '@/lib/wallet/config';

const TREASURY_SECRET_ENV_KEYS = [
  'BONGA_TREASURY_SECRET_KEY',
  'TREASURY_PRIVATE_KEY',
  'TREASURY_SECRET_KEY',
] as const;

export type TreasuryKeyStatus = {
  /** True when a secret env var is present (value never returned). */
  envPresent: boolean;
  envName: string | null;
  /** Character length of the raw secret (for format debugging). */
  rawLength: number;
  parseOk: boolean;
  byteLength: number | null;
  keypairOk: boolean;
  matchesTreasury: boolean;
  derivedPubkey: string | null;
  expectedPubkey: string;
  ready: boolean;
  reason: string | null;
};

function stripWrappingQuotes(value: string): string {
  let s = value.trim();
  // Vercel / dashboards sometimes store values with extra quote layers.
  for (let i = 0; i < 3; i++) {
    if (
      (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
      (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
    ) {
      s = s.slice(1, -1).trim();
      continue;
    }
    break;
  }
  return s;
}

/** Accept base58 secret (64 bytes), base58 seed (32 bytes), JSON byte array, or hex. */
function parseSecretKey(raw: string): Uint8Array | null {
  const trimmed = stripWrappingQuotes(raw);
  if (!trimmed) return null;

  // JSON number array — keep structure, only normalize whitespace lightly
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        const bytes = Uint8Array.from(parsed.map(n => Number(n)));
        if (bytes.length === 64 || bytes.length === 32) return bytes;
      }
    } catch {
      // fall through
    }
  }

  const compact = trimmed.replace(/\s+/g, '');

  // Hex (64 or 128 hex chars = 32 or 64 bytes)
  if (/^(0x)?[0-9a-fA-F]+$/.test(compact)) {
    const hex = compact.replace(/^0x/i, '');
    if (hex.length === 64 || hex.length === 128) {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      return bytes;
    }
  }

  // Base58 secret key or seed
  try {
    const decoded = bs58.decode(compact);
    if (decoded.length === 64 || decoded.length === 32) return decoded;
  } catch {
    // fall through
  }

  return null;
}

function keypairFromSecretBytes(secret: Uint8Array): Keypair | null {
  try {
    if (secret.length === 64) return Keypair.fromSecretKey(secret);
    if (secret.length === 32) return Keypair.fromSeed(secret);
  } catch {
    return null;
  }
  return null;
}

export function loadTreasuryKeypair(): Keypair | null {
  for (const envKey of TREASURY_SECRET_ENV_KEYS) {
    const raw = process.env[envKey];
    if (raw == null || !String(raw).trim()) continue;

    const secret = parseSecretKey(String(raw));
    if (!secret) continue;

    const keypair = keypairFromSecretBytes(secret);
    if (keypair) return keypair;
  }

  return null;
}

/** Safe diagnostics for /api/treasury — never returns secret material. */
export function getTreasuryKeyStatus(): TreasuryKeyStatus {
  const expected = resolveTreasuryPublicKey().toBase58();
  let envName: string | null = null;
  let raw = '';

  for (const key of TREASURY_SECRET_ENV_KEYS) {
    const value = process.env[key];
    if (value != null && String(value).trim()) {
      envName = key;
      raw = String(value);
      break;
    }
  }

  if (!envName) {
    return {
      envPresent: false,
      envName: null,
      rawLength: 0,
      parseOk: false,
      byteLength: null,
      keypairOk: false,
      matchesTreasury: false,
      derivedPubkey: null,
      expectedPubkey: expected,
      ready: false,
      reason: 'Treasury signing key not configured on server. Set BONGA_TREASURY_SECRET_KEY in Vercel and redeploy.',
    };
  }

  const secret = parseSecretKey(raw);
  if (!secret) {
    return {
      envPresent: true,
      envName,
      rawLength: stripWrappingQuotes(raw).length,
      parseOk: false,
      byteLength: null,
      keypairOk: false,
      matchesTreasury: false,
      derivedPubkey: null,
      expectedPubkey: expected,
      ready: false,
      reason:
        'BONGA_TREASURY_SECRET_KEY is set but could not be parsed. Use base58 secret key (64 bytes), 32-byte seed, hex, or a JSON array of 64 numbers — not a seed phrase.',
    };
  }

  const keypair = keypairFromSecretBytes(secret);
  if (!keypair) {
    return {
      envPresent: true,
      envName,
      rawLength: stripWrappingQuotes(raw).length,
      parseOk: true,
      byteLength: secret.length,
      keypairOk: false,
      matchesTreasury: false,
      derivedPubkey: null,
      expectedPubkey: expected,
      ready: false,
      reason: 'Secret bytes parsed but could not build a Solana keypair.',
    };
  }

  const derived = keypair.publicKey.toBase58();
  const matches = derived === expected;
  return {
    envPresent: true,
    envName,
    rawLength: stripWrappingQuotes(raw).length,
    parseOk: true,
    byteLength: secret.length,
    keypairOk: true,
    matchesTreasury: matches,
    derivedPubkey: derived,
    expectedPubkey: expected,
    ready: matches,
    reason: matches
      ? null
      : `Treasury secret derives ${derived} but expected ${expected}. Use the Bonk Miner / GrokSight treasury private key for that wallet.`,
  };
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
  const status = getTreasuryKeyStatus();
  if (status.ready) return null;
  return status.reason;
}

export function isTreasuryPayoutsReady(): boolean {
  return getTreasuryKeyStatus().ready;
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

  // Accept any existing token account for this mint (not only the derived ATA).
  const recipientToken = await findWalletTokenAccount(connection, recipient, mint);
  if (!recipientToken) {
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
    recipientToken.address,
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