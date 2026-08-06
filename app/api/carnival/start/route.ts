import { NextResponse } from 'next/server';
import { getCarnivalEntryQuote, verifyBongaEntryPayment } from '@/lib/carnival/bonga-payment';
import { splitEntryAmount } from '@/lib/carnival/wheel';
import { createCarnivalSession } from '@/lib/security/carnival-session';
import { isSignatureUsed, markSignatureUsed } from '@/lib/security/signature-store';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { blockIfEmergencyStopped } from '@/lib/security/emergency';
import { isValidWalletAddress } from '@/lib/alice-room/session';

export async function POST(request: Request) {
  const stopped = blockIfEmergencyStopped();
  if (stopped) return stopped;

  const ip = getClientIp(request);
  const limited = checkRateLimit(`carnival-start:${ip}`, 20, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: limited.error }, { status: 429 });
  }

  let body: { wallet?: string; signature?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const wallet = body.wallet?.trim() ?? '';
  const signature = body.signature?.trim() ?? '';
  if (!isValidWalletAddress(wallet) || !signature || signature.length < 32) {
    return NextResponse.json({ error: 'Wallet and payment signature required.' }, { status: 400 });
  }

  if (isSignatureUsed(signature)) {
    return NextResponse.json({ error: 'Payment signature already used.' }, { status: 409 });
  }

  const quote = await getCarnivalEntryQuote();
  const minRaw = BigInt(quote.bongaRaw);

  const verified = await verifyBongaEntryPayment({
    signature,
    payer: wallet,
    minRaw,
    treasuryAta: quote.treasuryAta,
  });
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  markSignatureUsed(signature, 'carnival-entry');

  const split = splitEntryAmount(verified.rawReceived);
  const { token, payload, commit } = createCarnivalSession({
    wallet,
    paymentSig: signature,
    entryBongaRaw: verified.rawReceived,
    bongaUsd: quote.bongaUsd,
  });

  return NextResponse.json({
    sessionToken: token,
    sessionId: payload.sessionId,
    commit,
    expiresAt: payload.expiresAt,
    accounting: {
      note: 'All BONGA received by treasury. 55/30/15 split recorded for transparency. Full on-chain PDAs require program deploy — see docs/carnival-wheel-security.md.',
      rawReceived: verified.rawReceived.toString(),
      treasuryBpsShare: split.treasury.toString(),
      prizePoolBpsShare: split.prizePool.toString(),
      opsBpsShare: split.ops.toString(),
    },
    security: {
      randomness: 'hmac-commit-reveal',
      commit,
      seedRevealedAfterSpin: true,
      tokenExit: 'cashier-only',
    },
  });
}
