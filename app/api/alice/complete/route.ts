import { NextResponse } from 'next/server';
import { evaluateAlicePayout } from '@/lib/alice-room/session';
import { creditWalletChips } from '@/lib/security/chip-ledger';
import { assertEarnAllowed, recordEarn } from '@/lib/security/earn-limits';
import { blockIfEmergencyStopped } from '@/lib/security/emergency';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { isSignatureUsed, markSignatureUsed } from '@/lib/security/signature-store';

/**
 * Cash only the post-boss final Alice tally into spendable Bonk Chips.
 * Session must be valid and not already completed; amount is hard-capped.
 */
export async function POST(request: Request) {
  const stopped = blockIfEmergencyStopped();
  if (stopped) return stopped;

  const ip = getClientIp(request);
  const limited = checkRateLimit(`alice-complete:${ip}`, 20, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: limited.error }, { status: 429 });
  }

  let body: {
    wallet?: string;
    sessionToken?: string;
    aliceCoins?: number;
    ledgerToken?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const wallet = body.wallet?.trim();
  const sessionToken = body.sessionToken?.trim();
  const aliceCoins = Math.floor(Number(body.aliceCoins) || 0);
  const ledgerToken = body.ledgerToken?.trim() || null;

  if (!wallet) {
    return NextResponse.json(
      { error: 'Connect a wallet to bank your final Alice tally as spendable chips.' },
      { status: 400 },
    );
  }
  if (!sessionToken) {
    return NextResponse.json({ error: 'Missing Alice Room session.' }, { status: 400 });
  }

  const evaluated = evaluateAlicePayout(sessionToken, aliceCoins);
  if (!evaluated.ok) {
    return NextResponse.json({ error: evaluated.error }, { status: 400 });
  }

  const claimKey = `alice-complete:${evaluated.sessionId}`;
  if (isSignatureUsed(claimKey)) {
    return NextResponse.json({ error: 'This Alice Room run was already claimed.' }, { status: 400 });
  }

  if (evaluated.spendable <= 0) {
    markSignatureUsed(claimKey, 'alice-complete');
    return NextResponse.json({
      ok: true,
      spendable: 0,
      message: 'Run complete — no spendable chips from this tally. Dive again!',
    });
  }

  const allowed = assertEarnAllowed(wallet, evaluated.spendable, 'alice-room');
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error, code: allowed.code }, { status: 429 });
  }

  const credited = creditWalletChips(wallet, evaluated.spendable, ledgerToken);
  if (!credited.ok) {
    return NextResponse.json({ error: credited.error }, { status: 400 });
  }

  markSignatureUsed(claimKey, 'alice-complete');
  recordEarn(wallet, evaluated.spendable, 'alice-room');

  return NextResponse.json({
    ok: true,
    spendable: evaluated.spendable,
    aliceCoins,
    chips: credited.record.chips,
    ledgerToken: credited.record.ledgerToken,
    message: `Banked ${evaluated.spendable.toLocaleString()} spendable Bonk Chips from the Alice Room.`,
  });
}
