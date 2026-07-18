import { Connection, PublicKey } from '@solana/web3.js';
import { NextResponse } from 'next/server';
import {
  calculateChipCost,
  getFamToken,
  getSolanaRpcUrl,
  type FamCoinId,
} from '@/lib/fam-tokens';
import {
  creditWalletChips,
  debitWalletChips,
  depositWalletChips,
  getWalletChipBalance,
} from '@/lib/security/chip-ledger';
import { blockIfEmergencyStopped } from '@/lib/security/emergency';
import { checkWalletExchangeLimit } from '@/lib/security/exchange-limits';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { executeTokenExchange } from '@/lib/treasury';
import { walletHasTokenAccount } from '@/lib/token-accounts';

const VALID_IDS: FamCoinId[] = ['bonk', 'bonga', 'bong', 'bink', 'bonnie', 'beng'];
const MAX_IMPORT_PER_REQUEST = Number(process.env.MAX_CHIP_IMPORT_PER_REQUEST ?? '5000000');

export async function POST(request: Request) {
  const stopped = blockIfEmergencyStopped();
  if (stopped) return stopped;

  const ip = getClientIp(request);

  let body: {
    coinId?: string;
    tokenAmount?: number;
    walletAddress?: string;
    chipCost?: number;
    ledgerToken?: string;
    /** Chips currently in the player bank (localStorage) — imported before spend. */
    importLocalAmount?: number;
    /** Total chips the client thinks it has (local + ledger) — used only for clearer errors. */
    clientChipBalance?: number;
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
  let ledgerToken = body.ledgerToken?.trim() || null;
  let importLocal = Math.max(0, Math.floor(Number(body.importLocalAmount) || 0));
  const clientChipBalance = Math.max(0, Math.floor(Number(body.clientChipBalance) || 0));

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
  if (!Number.isFinite(chipCost) || chipCost !== expectedCost) {
    return NextResponse.json(
      { error: 'Chip cost mismatch — refresh the cashier and try again.' },
      { status: 400 },
    );
  }

  // If client has bank chips but forgot importLocal, still accept clientChipBalance as import.
  if (importLocal <= 0 && clientChipBalance > 0) {
    const existing = getWalletChipBalance(walletAddress, ledgerToken);
    if (existing.chips < chipCost) {
      importLocal = Math.min(clientChipBalance, MAX_IMPORT_PER_REQUEST);
    }
  }

  if (importLocal > 0) {
    if (importLocal > MAX_IMPORT_PER_REQUEST) {
      return NextResponse.json(
        { error: `Import too large (max ${MAX_IMPORT_PER_REQUEST.toLocaleString()} chips).` },
        { status: 400 },
      );
    }
    const deposited = depositWalletChips(walletAddress, importLocal, ledgerToken);
    if (!deposited.ok) {
      return NextResponse.json({ error: deposited.error, code: 'IMPORT_FAILED' }, { status: 400 });
    }
    ledgerToken = deposited.record.ledgerToken;
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
          error: `Your connected wallet has no ${token.symbol} token account (mint ${token.mint.slice(0, 6)}…). Holding ${token.symbol} in Phantom is required to receive more — chips and ${token.symbol} are different. Make sure the same wallet is connected.`,
          code: 'NO_TOKEN_ACCOUNT',
        },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 });
  }

  const before = getWalletChipBalance(walletAddress, ledgerToken);
  const debit = debitWalletChips(walletAddress, chipCost, ledgerToken);
  if (!debit.ok) {
    return NextResponse.json(
      {
        error: `Not enough Bonk Chips for this exchange. Need ${chipCost.toLocaleString()} chips, balance is ${before.chips.toLocaleString()}. (Having ${token.symbol} in your wallet is separate from Bonk Chips — win chips in Depths/Bandit first.)`,
        code: 'INSUFFICIENT_CHIPS',
        chips: before.chips,
        chipCost,
      },
      { status: 400 },
    );
  }

  const result = await executeTokenExchange(connection, {
    coinId,
    tokenAmount,
    recipientWallet: walletAddress,
    chipCost,
  });

  if (!result.ok) {
    creditWalletChips(walletAddress, chipCost, debit.record.ledgerToken);
    const status =
      result.code === 'TREASURY_MISSING' || result.code === 'PAYOUTS_PAUSED' ? 503 : 400;
    // Rewrite vague treasury messages
    let error = result.error;
    if (result.code === 'INSUFFICIENT_TREASURY') {
      error = `The shared treasury is low on ${token.symbol} right now. Try a smaller amount later.`;
    } else if (result.code === 'NO_TOKEN_ACCOUNT') {
      error = `Your wallet still needs a ${token.symbol} token account before the cashier can send ${token.symbol}.`;
    }
    return NextResponse.json({ error, code: result.code }, { status });
  }

  return NextResponse.json({
    signature: result.signature,
    chipCost: result.chipCost,
    tokenAmount: result.tokenAmount,
    symbol: result.symbol,
    chipsRemaining: debit.record.chips,
    ledgerToken: debit.record.ledgerToken,
    importedLocal: importLocal,
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
