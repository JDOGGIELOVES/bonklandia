import { NextResponse } from 'next/server';
import { evaluateAlicePayout, isValidWalletAddress } from '@/lib/alice-room/session';
import { creditWalletChips } from '@/lib/security/chip-ledger';
import { assertEarnAllowed, recordEarn } from '@/lib/security/earn-limits';
import { blockIfEmergencyStopped } from '@/lib/security/emergency';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { isSignatureUsed, markSignatureUsed } from '@/lib/security/signature-store';

/**
 * Bank post-boss Alice tally → spendable server ledger.
 * Parity with casino claim:
 * - emergency stop
 * - HMAC session
 * - one claim per sessionId (signature store)
 * - hard max spendable (session maxSpendable)
 * - earn rate limits
 * - wallet rate limits
 * - optional wallet bind from start
 * - min play duration
 */
export async function POST(request: Request) {
  const stopped = blockIfEmergencyStopped();
  if (stopped) return stopped;

  const ip = getClientIp(request);
  const ipLimited = checkRateLimit(`alice-complete:ip:${ip}`, 15, 60 * 60 * 1000);
  if (!ipLimited.ok) {
    return NextResponse.json({ error: ipLimited.error }, { status: 429 });
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

  if (!wallet || !isValidWalletAddress(wallet)) {
    return NextResponse.json(
      {
        error: 'Connect a valid wallet to bank your final Alice tally as spendable chips.',
        code: 'WALLET',
      },
      { status: 400 },
    );
  }
  if (!sessionToken) {
    return NextResponse.json({ error: 'Missing Alice Room session.', code: 'SESSION' }, { status: 400 });
  }

  const walletLimited = checkRateLimit(`alice-complete:wallet:${wallet}`, 10, 60 * 60 * 1000);
  if (!walletLimited.ok) {
    return NextResponse.json({ error: walletLimited.error }, { status: 429 });
  }

  const evaluated = evaluateAlicePayout(sessionToken, aliceCoins, wallet);
  if (!evaluated.ok) {
    return NextResponse.json(
      { error: evaluated.error, code: evaluated.code },
      { status: evaluated.code === 'TOO_FAST' ? 429 : 400 },
    );
  }

  const claimKey = `alice-complete:${evaluated.sessionId}`;
  if (isSignatureUsed(claimKey)) {
    return NextResponse.json(
      { error: 'This Alice Room run was already claimed.', code: 'ALREADY_CLAIMED' },
      { status: 400 },
    );
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

  // One-shot claim (same pattern as casino claim keys).
  markSignatureUsed(claimKey, 'alice-complete');
  recordEarn(wallet, evaluated.spendable, 'alice-room');

  return NextResponse.json({
    ok: true,
    spendable: evaluated.spendable,
    maxSpendable: evaluated.maxSpendable,
    aliceCoinsReported: aliceCoins,
    chips: credited.record.chips,
    lifetimeWon: credited.record.lifetimeWon,
    ledgerToken: credited.record.ledgerToken,
    security: {
      serverLedgerOnly: true,
      sessionCapped: true,
      oneClaimPerSession: true,
    },
    message: `Banked ${evaluated.spendable.toLocaleString()} spendable Bonk Chips from the Alice Room.`,
  });
}
