import { Connection, PublicKey } from '@solana/web3.js';
import { NextResponse } from 'next/server';
import {
  calculateChipCost,
  getFamToken,
  getSolanaRpcUrl,
  type FamCoinId,
} from '@/lib/fam-tokens';
import {
  CHIPS_PER_BONGA,
  MAX_BONGA_EQUIVALENT_PER_EXCHANGE,
  MAX_BONGA_EQUIVALENT_PER_WALLET_PER_DAY,
  MAX_CHIP_COST_PER_EXCHANGE,
  MAX_CHIPS_EXCHANGED_PER_IP_PER_DAY,
  MAX_CHIPS_EXCHANGED_PER_WALLET_PER_DAY,
  MAX_EXCHANGES_PER_IP_PER_HOUR,
  MAX_EXCHANGES_PER_WALLET_PER_DAY,
  MAX_USD_PER_EXCHANGE,
  MAX_USD_PER_IP_PER_DAY,
  MAX_USD_PER_WALLET_PER_DAY,
  USD_CONCERN_THRESHOLD,
  chipsToBongaEquivalent,
} from '@/lib/security/config';
import {
  debitWalletChips,
  getWalletChipBalance,
  refundWalletChips,
} from '@/lib/security/chip-ledger';
import { blockIfEmergencyStopped } from '@/lib/security/emergency';
import {
  assertExchangeWithinLimits,
  getWalletExchangeQuota,
  recordSuccessfulExchange,
} from '@/lib/security/exchange-limits';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { estimateCashoutUsd, formatUsd } from '@/lib/security/token-usd';
import { executeTokenExchange } from '@/lib/treasury';
import { walletHasTokenAccount } from '@/lib/token-accounts';

const VALID_IDS: FamCoinId[] = ['bonk', 'bonga', 'bong', 'bink', 'bonnie', 'beng'];

/**
 * Sole Bonklandia exit for treasury SPL → player wallets.
 * Spendable chips = server ledger only (HMAC). Client bankChips ignored for payment.
 */
export async function POST(request: Request) {
  try {
    const stopped = blockIfEmergencyStopped();
    if (stopped) return stopped;

    const ip = getClientIp(request);

    let body: {
      coinId?: string;
      tokenAmount?: number;
      walletAddress?: string;
      chipCost?: number;
      /** @deprecated ignored — spendable balance is server ledger only */
      bankChips?: number;
      ledgerToken?: string;
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
    const ledgerToken = body.ledgerToken?.trim() || null;

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

    // Spendable chips: sealed server ledger only (earned via claim/earn APIs).
    const ledger = getWalletChipBalance(walletAddress, ledgerToken);
    if (ledger.chips < chipCost) {
      return NextResponse.json(
        {
          error: `Not enough spendable Bonk Chips. Need ${chipCost.toLocaleString()}, server balance is ${ledger.chips.toLocaleString()}. Play Depths/Bandit with this wallet connected to earn chips — localStorage chips cannot be cashed.`,
          code: 'INSUFFICIENT_SPENDABLE_CHIPS',
          chipCost,
          spendableChips: ledger.chips,
        },
        { status: 400 },
      );
    }

    const valuation = await estimateCashoutUsd(coinId, tokenAmount);
    const fairness = assertExchangeWithinLimits({
      wallet: walletAddress,
      ip,
      chipCost,
      usdValue: valuation.usd,
    });

    if (!fairness.ok) {
      return NextResponse.json(
        {
          error: fairness.error,
          code: fairness.code,
          estimatedUsd: valuation.usd,
          unitPriceUsd: valuation.unitPrice,
          priceSource: valuation.source,
          quota: getWalletExchangeQuota(walletAddress),
        },
        { status: 429 },
      );
    }

    if (fairness.concern) {
      console.warn('[exchange:CONCERN]', {
        wallet: walletAddress.slice(0, 8) + '…',
        coinId,
        tokenAmount,
        estimatedUsd: valuation.usd,
        chipCost,
        threshold: USD_CONCERN_THRESHOLD,
      });
    }

    const ipLimited = checkRateLimit(
      `exchange:ip:${ip}`,
      MAX_EXCHANGES_PER_IP_PER_HOUR,
      60 * 60 * 1000,
    );
    if (!ipLimited.ok) {
      return NextResponse.json({ error: ipLimited.error }, { status: 429 });
    }

    const walletLimited = checkRateLimit(
      `exchange:wallet:${walletAddress}`,
      15,
      60 * 60 * 1000,
    );
    if (!walletLimited.ok) {
      return NextResponse.json({ error: walletLimited.error }, { status: 429 });
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

    // Debit spendable ledger before on-chain send; refund if transfer fails.
    const debited = debitWalletChips(walletAddress, chipCost, ledgerToken ?? ledger.ledgerToken);
    if (!debited.ok) {
      return NextResponse.json(
        {
          error: debited.error,
          code: 'INSUFFICIENT_SPENDABLE_CHIPS',
          spendableChips: getWalletChipBalance(walletAddress, ledgerToken).chips,
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
      refundWalletChips(walletAddress, chipCost, debited.record.ledgerToken);
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

    recordSuccessfulExchange(walletAddress, ip, chipCost, valuation.usd);

    return NextResponse.json({
      signature: result.signature,
      chipCost: result.chipCost,
      tokenAmount: result.tokenAmount,
      symbol: result.symbol,
      chipsRemaining: debited.record.chips,
      spendableChips: debited.record.chips,
      ledgerToken: debited.record.ledgerToken,
      bongaEquivalent: chipsToBongaEquivalent(chipCost),
      estimatedUsd: valuation.usd,
      estimatedUsdLabel: formatUsd(valuation.usd),
      quota: getWalletExchangeQuota(walletAddress),
    });
  } catch (err) {
    console.error('[exchange]', err);
    const message = err instanceof Error ? err.message : 'Exchange failed.';
    return NextResponse.json(
      {
        error: `Cashier error: ${message}`,
        code: 'EXCHANGE_CRASH',
      },
      { status: 500 },
    );
  }
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
    fairness: {
      policy: 'micro-prize',
      maxUsdPerExchange: MAX_USD_PER_EXCHANGE,
      maxUsdPerWalletPerDay: MAX_USD_PER_WALLET_PER_DAY,
      maxUsdPerIpPerDay: MAX_USD_PER_IP_PER_DAY,
      usdConcernThreshold: USD_CONCERN_THRESHOLD,
      chipsPerBonga: CHIPS_PER_BONGA,
      maxChipCostPerExchange: MAX_CHIP_COST_PER_EXCHANGE,
      maxChipsExchangedPerWalletPerDay: MAX_CHIPS_EXCHANGED_PER_WALLET_PER_DAY,
      maxChipsExchangedPerIpPerDay: MAX_CHIPS_EXCHANGED_PER_IP_PER_DAY,
      maxBongaEquivalentPerExchange: MAX_BONGA_EQUIVALENT_PER_EXCHANGE,
      maxBongaEquivalentPerWalletPerDay: MAX_BONGA_EQUIVALENT_PER_WALLET_PER_DAY,
      maxExchangesPerWalletPerDay: MAX_EXCHANGES_PER_WALLET_PER_DAY,
      appliesToAllFamCoins: true,
      spendableChipsServerOnly: true,
      note: 'Only server-ledger chips (earned in-game) can be cashed. Fake localStorage chips cannot. Micro-prize USD caps apply.',
    },
    security: {
      treasuryNeverPaysSol: true,
      treasuryNeverCreatesTokenAccounts: true,
      bankChipsClientSide: false,
      spendableChipsServerLedger: true,
      clientChipImportDisabled: true,
      cashOutCapped: true,
      soleTreasurySplExit: 'POST /api/exchange',
    },
  });
}
