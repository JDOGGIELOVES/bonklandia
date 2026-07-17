import { NextResponse } from 'next/server';
import { PAID_SPIN_USD } from '@/lib/casino-extras';
import { registerPaidSpinForSession } from '@/lib/security/casino-session';
import { MAX_PAID_SPINS_PER_WALLET_PER_HOUR } from '@/lib/security/config';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { isSignatureUsed, markSignatureUsed } from '@/lib/security/signature-store';
import { getPaidSpinQuote, verifyPaidSpinTransaction } from '@/lib/sol-payment';

export async function GET() {
  const quote = await getPaidSpinQuote(PAID_SPIN_USD);
  return NextResponse.json(quote);
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  let body: { signature?: string; payerWallet?: string; sessionId?: string; settleToken?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const signature = body.signature?.trim();
  const payerWallet = body.payerWallet?.trim();
  const sessionId = body.sessionId?.trim();
  const settleToken = body.settleToken?.trim();

  if (!signature) {
    return NextResponse.json({ error: 'Transaction signature required.' }, { status: 400 });
  }
  if (!payerWallet) {
    return NextResponse.json({ error: 'Connected wallet address required.' }, { status: 400 });
  }
  if (!sessionId) {
    return NextResponse.json({ error: 'Active casino session required.' }, { status: 400 });
  }

  const ipLimited = checkRateLimit(`paid-spin:ip:${ip}`, 80, 60 * 60 * 1000);
  if (!ipLimited.ok) {
    return NextResponse.json({ error: ipLimited.error }, { status: 429 });
  }

  const walletLimited = checkRateLimit(
    `paid-spin:wallet:${payerWallet}`,
    MAX_PAID_SPINS_PER_WALLET_PER_HOUR,
    60 * 60 * 1000,
  );
  if (!walletLimited.ok) {
    return NextResponse.json({ error: walletLimited.error }, { status: 429 });
  }

  if (isSignatureUsed(signature)) {
    return NextResponse.json({ error: 'This payment was already redeemed.' }, { status: 400 });
  }

  const quote = await getPaidSpinQuote(PAID_SPIN_USD);
  const verified = await verifyPaidSpinTransaction(signature, quote.lamports, payerWallet);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  // Local consolation sessions are client-only; still verify SOL payment, skip server ledger.
  const isLocalSession = sessionId.startsWith('local-');
  let nextSettleToken: string | undefined;
  let maxWinnings: number | undefined;

  if (!isLocalSession) {
    if (!settleToken) {
      return NextResponse.json(
        { error: 'Casino vault token required for Quarter Slot (re-enter casino if this persists).' },
        { status: 400 },
      );
    }
    const sessionUpdate = registerPaidSpinForSession(sessionId, settleToken);
    if (!sessionUpdate.ok) {
      return NextResponse.json({ error: sessionUpdate.error }, { status: 400 });
    }
    nextSettleToken = sessionUpdate.settleToken;
    maxWinnings = sessionUpdate.maxWinnings;
  }

  markSignatureUsed(signature, 'quarter-slot');

  return NextResponse.json({
    ok: true,
    spinsGranted: 1,
    paidUsd: quote.usd,
    lamports: quote.lamports,
    localSession: isLocalSession,
    settleToken: nextSettleToken,
    maxWinnings,
  });
}