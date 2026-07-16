import { NextResponse } from 'next/server';
import { claimSessionToWallet } from '@/lib/security/casino-session';
import { creditWalletChips } from '@/lib/security/chip-ledger';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limited = checkRateLimit(`claim:${ip}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: limited.error }, { status: 429 });
  }

  let body: { sessionId?: string; settleToken?: string; wallet?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  const settleToken = body.settleToken?.trim();
  const wallet = body.wallet?.trim();

  if (!sessionId || !settleToken || !wallet) {
    return NextResponse.json({ error: 'Session, token, and wallet required.' }, { status: 400 });
  }

  const claimed = claimSessionToWallet(sessionId, settleToken, wallet);
  if (!claimed.ok) {
    return NextResponse.json({ error: claimed.error }, { status: 400 });
  }

  const credited = creditWalletChips(wallet, claimed.chips);
  if (!credited.ok) {
    return NextResponse.json({ error: credited.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    chips: credited.record.chips,
    credited: claimed.chips,
  });
}