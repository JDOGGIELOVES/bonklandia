import { Connection, PublicKey } from '@solana/web3.js';
import { NextResponse } from 'next/server';
import { getFamToken, getSolanaRpcUrl, type FamCoinId } from '@/lib/fam-tokens';
import { creditWalletChips, debitWalletChips } from '@/lib/security/chip-ledger';
import { blockIfEmergencyStopped } from '@/lib/security/emergency';
import { checkWalletExchangeLimit } from '@/lib/security/exchange-limits';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { executeTokenExchange } from '@/lib/treasury';
import { walletHasTokenAccount } from '@/lib/token-accounts';

const VALID_IDS: FamCoinId[] = ['bonk', 'bonga', 'bong', 'bink', 'bonnie', 'beng'];

export async function POST(request: Request) {
  const stopped = blockIfEmergencyStopped();
  if (stopped) return stopped;

  const ip = getClientIp(request);

  let body: {
    coinId?: string;
    tokenAmount?: number;
    walletAddress?: string;
    chipCost?: number;
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

  const tokenAmount = Number(body.tokenAmount);
  const chipCost = Number(body.chipCost);
  const walletAddress = body.walletAddress?.trim();

  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address is required.' }, { status: 400 });
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

  const token = getFamToken(coinId);
  if (token) {
    const connection = new Connection(getSolanaRpcUrl(), 'confirmed');
    try {
      const recipient = new PublicKey(walletAddress);
      const mint = new PublicKey(token.mint);
      const exists = await walletHasTokenAccount(connection, recipient, mint);
      if (!exists) {
        return NextResponse.json(
          {
            error: `Your wallet has no ${token.symbol} token account for mint ${token.mint.slice(0, 8)}…. Hold at least 1 ${token.symbol} in this connected wallet — the treasury never creates accounts or pays SOL.`,
            code: 'NO_TOKEN_ACCOUNT',
          },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 });
    }
  }

  const debit = debitWalletChips(walletAddress, chipCost);
  if (!debit.ok) {
    return NextResponse.json(
      { error: debit.error, code: 'INSUFFICIENT_CHIPS' },
      { status: 400 },
    );
  }

  const connection = new Connection(getSolanaRpcUrl(), 'confirmed');
  const result = await executeTokenExchange(connection, {
    coinId,
    tokenAmount,
    recipientWallet: walletAddress,
    chipCost,
  });

  if (!result.ok) {
    creditWalletChips(walletAddress, chipCost);
    const status =
      result.code === 'TREASURY_MISSING' || result.code === 'PAYOUTS_PAUSED' ? 503 : 400;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({
    signature: result.signature,
    chipCost: result.chipCost,
    tokenAmount: result.tokenAmount,
    symbol: result.symbol,
    chipsRemaining: debit.record.chips,
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
      chipsServerVerified: true,
    },
  });
}