import { NextResponse } from 'next/server';
import { creditWalletChips } from '@/lib/security/chip-ledger';
import {
  assertEarnAllowed,
  recordEarn,
  type EarnSource,
} from '@/lib/security/earn-limits';
import { blockIfEmergencyStopped } from '@/lib/security/emergency';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';

const VALID_SOURCES: EarnSource[] = [
  'depths-event',
  'depths-bandit',
  'depths-clear',
  'other',
];

/**
 * Credit spendable chips earned in-game onto the portable server ledger.
 * Casino winnings use /api/chips/claim (session-capped) instead.
 */
export async function POST(request: Request) {
  const stopped = blockIfEmergencyStopped();
  if (stopped) return stopped;

  const ip = getClientIp(request);
  const ipLimited = checkRateLimit(`chip-earn:ip:${ip}`, 60, 60 * 60 * 1000);
  if (!ipLimited.ok) {
    return NextResponse.json({ error: ipLimited.error }, { status: 429 });
  }

  let body: {
    wallet?: string;
    amount?: number;
    ledgerToken?: string;
    source?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const wallet = body.wallet?.trim();
  const amount = Math.floor(Number(body.amount));
  const ledgerToken = body.ledgerToken?.trim() || null;
  const source = (body.source?.trim() || 'other') as EarnSource;

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet address required to earn spendable chips.' }, { status: 400 });
  }
  if (!VALID_SOURCES.includes(source)) {
    return NextResponse.json({ error: 'Invalid earn source.' }, { status: 400 });
  }

  const walletLimited = checkRateLimit(`chip-earn:wallet:${wallet}`, 40, 60 * 60 * 1000);
  if (!walletLimited.ok) {
    return NextResponse.json({ error: walletLimited.error }, { status: 429 });
  }

  const allowed = assertEarnAllowed(wallet, amount, source);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error, code: allowed.code }, { status: 429 });
  }

  const credited = creditWalletChips(wallet, amount, ledgerToken);
  if (!credited.ok) {
    return NextResponse.json({ error: credited.error }, { status: 400 });
  }

  recordEarn(wallet, amount, source);

  return NextResponse.json({
    ok: true,
    credited: amount,
    chips: credited.record.chips,
    lifetimeWon: credited.record.lifetimeWon,
    ledgerToken: credited.record.ledgerToken,
    source,
    spendable: true,
  });
}
