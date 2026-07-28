import { NextResponse } from 'next/server';
import { createAliceSession, isValidWalletAddress } from '@/lib/alice-room/session';
import {
  ALICE_COINS_PER_SPENDABLE_CHIP,
  BOSS_LEVEL,
  MAX_ALICE_SPENDABLE_PAYOUT,
  PRE_BOSS_LEVELS,
  TOTAL_LEVELS,
} from '@/lib/alice-room/game';
import { blockIfEmergencyStopped } from '@/lib/security/emergency';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';

/**
 * Start a sealed Alice Room dive (HMAC session — same family as casino settle tokens).
 * Optional wallet bind: if provided, complete must use the same wallet.
 */
export async function POST(request: Request) {
  const stopped = blockIfEmergencyStopped();
  if (stopped) return stopped;

  const ip = getClientIp(request);
  const limited = checkRateLimit(`alice-start:ip:${ip}`, 20, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: limited.error }, { status: 429 });
  }

  let wallet: string | null = null;
  try {
    const body = (await request.json()) as { wallet?: string };
    const w = body.wallet?.trim();
    if (w) {
      if (!isValidWalletAddress(w)) {
        return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 });
      }
      wallet = w;
      const walletLimited = checkRateLimit(`alice-start:wallet:${wallet}`, 15, 60 * 60 * 1000);
      if (!walletLimited.ok) {
        return NextResponse.json({ error: walletLimited.error }, { status: 429 });
      }
    }
  } catch {
    // empty body OK
  }

  const { session, token } = createAliceSession(wallet);

  return NextResponse.json({
    ok: true,
    sessionId: session.sessionId,
    sessionToken: token,
    expiresAt: session.expiresAt,
    maxSpendable: session.maxSpendable,
    walletBound: session.wallet,
    minPlayMs: session.minPlayMs,
    security: {
      hmacSession: true,
      spendableOnlyViaComplete: true,
      midRunNotCashable: true,
      emergencyStopHonored: true,
      maxSpendableCap: MAX_ALICE_SPENDABLE_PAYOUT,
    },
    rules: {
      preBossLevels: PRE_BOSS_LEVELS,
      bossLevel: BOSS_LEVEL,
      totalLevels: TOTAL_LEVELS,
      aliceCoinsPerSpendableChip: ALICE_COINS_PER_SPENDABLE_CHIP,
      maxSpendablePayout: MAX_ALICE_SPENDABLE_PAYOUT,
      defense: 'three of current level entity',
      lovingLevels: [5, 6, 9],
      note: 'Mid-run Alice Coins are not cashier chips. Only final tally after The Other converts (capped).',
    },
  });
}
