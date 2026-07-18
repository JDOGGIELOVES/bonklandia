import { Connection, PublicKey } from '@solana/web3.js';
import { NextResponse } from 'next/server';
import {
  calculateChipCost,
  getFamToken,
  getSolanaRpcUrl,
  type FamCoinId,
} from '@/lib/fam-tokens';
import { blockIfEmergencyStopped } from '@/lib/security/emergency';
import { checkWalletExchangeLimit } from '@/lib/security/exchange-limits';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { executeTokenExchange } from '@/lib/treasury';
import { walletHasTokenAccount } from '@/lib/token-accounts';

const VALID_IDS: FamCoinId[] = ['bonk', 'bonga', 'bong', 'bink', 'bonnie', 'beng'];

/**
 * Cashier exchange: send SPL from treasury → player wallet.
 * Bonk Chips are debited in the browser bank after success (player-facing source of truth).
 * Server enforces rate limits + on-chain checks only — no separate "cashier ledger" gate.
 */
export async function POST(request: Request) {
  const stopped = blockIfEmergencyStopped();
  if (stopped) return stopped;

  const ip = getClientIp(request);

  let body: {
    coinId?: string;
    tokenAmount?: number;
    walletAddress?: string;
    chipCost?: number;
    /** Client bank balance — for validation messaging only. */
    bankChips?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const coinId = body.coinId as FamCoinId;
  if (!coinId || !VALID_IDS.includes(coinId)) {
    return NextResponse.json({ error: 'Invalid Fam token.' }, { status: 400 });
  }

  const token = getFamToken(coinId);
  if (!token) {
    return NextResponse.json({ error: 'Unknown Fam token.' }, { status: 400 });
  }

  const tokenAmount = Number(body.tokenAmount);
  const chipCost = Number(body.chipCost);
  const walletAddress = body.walletAddress?.trim();
  const bankChips = Math.max(0, Math.floor(Number(body.bankChips) || 0));

  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address is required.' }, { status: 400 });
  }

  if (!Number.isFinite(tokenAmount) || tokenAmount < token.minTokens) {
    return NextResponse.json(
      { error: `Minimum exchange is ${token.minTokens.toLocaleString()} ${token.symbol}.` },
      { status: 400 },
    );
  }

  const expectedCost = calculateChipCost(coinId, tokenAmount);
  if (!Number.isFinite(chipCost) || chipCost !== expectedCost || chipCost <= 0) {
    return NextResponse.json(
      { error: 'Chip cost mismatch — refresh the cashier and try again.' },
      { status: 400 },
    );
  }

  // Soft check: client must report enough bank chips (actual debit happens client-side after success).
  if (bankChips < chipCost) {
    return NextResponse.json(
      {
        error: `Not enough Bonk Chips. Need ${chipCost.toLocaleString()}, your bank shows ${bankChips.toLocaleString()}. (Wallet ${token.symbol} balance is separate from Bonk Chips.)`,
        code: 'INSUFFICIENT_CHIPS',
        chipCost,
        bankChips,
      },
      { status: 400 },
    );
  }

  const ipLimited = checkRateLimit(`exchange:ip:${ip}`, 60, 60 * 60 * 1000);
  if (!ipLimited.ok) {
    return NextResponse.json({ error: ipLimited.error }, { status: 429 });
  }

  const walletLimited = checkRateLimit(`exchange:wallet:${walletAddress}`, 30, 60 * 60 * 1000);
  if (!walletLimited.ok) {
    return NextResponse.json({ error: walletLimited.error }, { status: 429 });
  }

  const dailyLimit = checkWalletExchangeLimit(walletAddress);
  if (!dailyLimit.ok) {
    return NextResponse.json({ error: dailyLimit.error }, { status: 429 });
  }

  const connection = new Connection(getSolanaRpcUrl(), 'confirmed');
  try {
    const recipient = new PublicKey(walletAddress);
    const mint = new PublicKey(token.mint);
    const exists = await walletHasTokenAccount(connection, recipient, mint);
    if (!exists) {
      return NextResponse.json(
        {
          error: `This connected wallet (${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}) has no ${token.symbol} token account. Open Solflare/Phantom on this same address and hold a little ${token.symbol} first.`,
          code: 'NO_TOKEN_ACCOUNT',
        },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 });
  }

  const result = await executeTokenExchange(connection, {
    coinId,
    tokenAmount,
    recipientWallet: walletAddress,
    chipCost,
  });

  if (!result.ok) {
    const status =
      result.code === 'TREASURY_MISSING' || result.code === 'PAYOUTS_PAUSED' ? 503 : 400;
    let error = result.error;
    if (result.code === 'INSUFFICIENT_TREASURY') {
      error = `Treasury is low on ${token.symbol}. Try a smaller amount.`;
    } else if (result.code === 'NO_TOKEN_ACCOUNT') {
      error = `Your wallet needs a ${token.symbol} account before we can send more ${token.symbol}.`;
    }
    return NextResponse.json({ error, code: result.code }, { status });
  }

  return NextResponse.json({
    signature: result.signature,
    chipCost: result.chipCost,
    tokenAmount: result.tokenAmount,
    symbol: result.symbol,
    chipsRemaining: Math.max(0, bankChips - chipCost),
  });
}

export async function GET() {
  const {
    getTreasuryPublicKey,
    isTreasuryPayoutsReady,
    treasuryKeyMismatchError,
  } = await import('@/lib/treasury');
  const { treasuryPayoutsAllowed, treasuryPayoutsBlockedReason } = await import(
    '@/lib/security/payout-guard'
  );

  return NextResponse.json({
    treasury: getTreasuryPublicKey(),
    treasuryConfigured: isTreasuryPayoutsReady(),
    payoutsReady: isTreasuryPayoutsReady() && treasuryPayoutsAllowed(),
    payoutsBlockedReason: treasuryPayoutsBlockedReason() ?? treasuryKeyMismatchError(),
    security: {
      treasuryNeverPaysSol: true,
      treasuryNeverCreatesTokenAccounts: true,
      bankChipsClientSide: true,
    },
  });
}
