import { NextResponse } from 'next/server';
import { createAliceSession } from '@/lib/alice-room/session';
import {
  ALICE_COINS_PER_SPENDABLE_CHIP,
  BOSS_LEVEL,
  MAX_ALICE_SPENDABLE_PAYOUT,
  PRE_BOSS_LEVELS,
  TOTAL_LEVELS,
} from '@/lib/alice-room/game';
import { blockIfEmergencyStopped } from '@/lib/security/emergency';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';

export async function POST(request: Request) {
  const stopped = blockIfEmergencyStopped();
  if (stopped) return stopped;

  const ip = getClientIp(request);
  const limited = checkRateLimit(`alice-start:${ip}`, 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: limited.error }, { status: 429 });
  }

  const { session, token } = createAliceSession();

  return NextResponse.json({
    ok: true,
    sessionId: session.sessionId,
    sessionToken: token,
    expiresAt: session.expiresAt,
    maxSpendable: session.maxSpendable,
    rules: {
      preBossLevels: PRE_BOSS_LEVELS,
      bossLevel: BOSS_LEVEL,
      totalLevels: TOTAL_LEVELS,
      aliceCoinsPerSpendableChip: ALICE_COINS_PER_SPENDABLE_CHIP,
      maxSpendablePayout: MAX_ALICE_SPENDABLE_PAYOUT,
      defense: 'three of current level entity',
      lovingLevels: [5, 6, 9],
      note: 'Mid-run Alice Coins are not cashier chips. Only the final tally after The Other (boss) converts (capped).',
    },
  });
}
