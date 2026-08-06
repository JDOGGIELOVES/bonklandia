import { NextResponse } from 'next/server';
import {
  markCarnivalClaimed,
  resolveCarnivalSpin,
  CARNIVAL_MAX_CHIPS,
} from '@/lib/security/carnival-session';
import { creditWalletChips } from '@/lib/security/chip-ledger';
import { assertEarnAllowed, recordEarn } from '@/lib/security/earn-limits';
import { isSignatureUsed, markSignatureUsed } from '@/lib/security/signature-store';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { blockIfEmergencyStopped } from '@/lib/security/emergency';
import { isValidWalletAddress } from '@/lib/alice-room/session';

/**
 * Resolve wheel + dice from sealed session seed, credit spendable chips.
 * Client-submitted outcome fields are ignored.
 */
export async function POST(request: Request) {
  const stopped = blockIfEmergencyStopped();
  if (stopped) return stopped;

  const ip = getClientIp(request);
  const limited = checkRateLimit(`carnival-spin:${ip}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: limited.error }, { status: 429 });
  }

  let body: { wallet?: string; sessionToken?: string; ledgerToken?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const wallet = body.wallet?.trim() ?? '';
  const sessionToken = body.sessionToken?.trim() ?? '';
  if (!isValidWalletAddress(wallet) || !sessionToken) {
    return NextResponse.json({ error: 'Wallet and session required.' }, { status: 400 });
  }

  const resolved = resolveCarnivalSpin(sessionToken, wallet);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const { outcome, serverSeed, payload } = resolved;
  const claimKey = `carnival-claim:${payload.sessionId}`;

  if (isSignatureUsed(claimKey) || payload.claimed) {
    return NextResponse.json({
      alreadyClaimed: true,
      outcome,
      serverSeed,
      commit: payload.commit,
      verifyHint:
        'Recompute HMAC-SHA256(serverSeed, carnival-outcome:{sessionId}) to verify wheel+dice.',
    });
  }

  let ledgerToken: string | undefined;
  let chipsCredited = 0;
  if (outcome.chips > 0) {
    const chips = Math.min(CARNIVAL_MAX_CHIPS, Math.floor(outcome.chips));
    const allowed = assertEarnAllowed(wallet, chips, 'carnival-wheel');
    if (!allowed.ok) {
      return NextResponse.json({ error: allowed.error, code: allowed.code }, { status: 400 });
    }
    const credit = creditWalletChips(wallet, chips, body.ledgerToken ?? null);
    if (!credit.ok) {
      return NextResponse.json({ error: credit.error ?? 'Could not credit chips.' }, { status: 400 });
    }
    recordEarn(wallet, chips, 'carnival-wheel');
    chipsCredited = chips;
    ledgerToken = credit.record.ledgerToken;
  }

  markSignatureUsed(claimKey, 'carnival-claim');
  const claimedToken = markCarnivalClaimed(resolved.token);

  return NextResponse.json({
    outcome,
    serverSeed,
    commit: payload.commit,
    sessionId: payload.sessionId,
    chipsCredited,
    ledgerToken,
    sessionToken: claimedToken,
    cashierPath: '/cashier',
    coinHint: outcome.coinId,
    message:
      chipsCredited > 0
        ? `You won ~$${outcome.prizeUsd.toFixed(2)} (${chipsCredited} spendable chips) toward ${outcome.coinName}. Cash out only at the Cashier.`
        : 'Dead spin — no prize chips. Treasury still received your BONGA entry.',
    security: {
      tokenExit: 'cashier-only',
      noDirectSplPrize: true,
      clientOutcomeIgnored: true,
      verify: {
        method: 'HMAC-SHA256(serverSeed, "carnival-outcome:"+sessionId)',
        wheelIndex: outcome.wheelIndex,
        diceFace: outcome.diceFace,
      },
    },
  });
}
