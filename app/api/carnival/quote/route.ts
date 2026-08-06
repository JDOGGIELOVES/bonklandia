import { NextResponse } from 'next/server';
import { getCarnivalEntryQuote } from '@/lib/carnival/bonga-payment';
import { getWheelSpaces, PRIZE_TIERS, DICE_FAMILY_COINS, ENTRY_SPLIT } from '@/lib/carnival/wheel';
import { blockIfEmergencyStopped } from '@/lib/security/emergency';

export async function GET() {
  const stopped = blockIfEmergencyStopped();
  if (stopped) return stopped;
  try {
    const quote = await getCarnivalEntryQuote();
    const spaces = getWheelSpaces().map(s => ({
      index: s.index,
      label: s.label,
      kind: s.kind,
      tierId: s.tierId,
      prizeUsd: s.prizeUsd,
    }));
    return NextResponse.json({
      quote,
      tiers: PRIZE_TIERS,
      dice: DICE_FAMILY_COINS,
      split: ENTRY_SPLIT,
      spaceCount: spaces.length,
      spaces,
      security: {
        randomness: 'server-hmac-commit-reveal',
        tokenExit: 'cashier-only',
        clientOutcomeIgnored: true,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Quote failed.' },
      { status: 500 },
    );
  }
}
