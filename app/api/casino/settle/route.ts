import { NextResponse } from 'next/server';
import { settleCasinoWinnings } from '@/lib/security/casino-session';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limited = checkRateLimit(`settle:${ip}`, 120, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: limited.error }, { status: 429 });
  }

  let body: { sessionId?: string; settleToken?: string; totalWinnings?: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  const settleToken = body.settleToken?.trim();
  const totalWinnings = Number(body.totalWinnings);

  if (!sessionId || !settleToken) {
    return NextResponse.json({ error: 'Session id and settle token required.' }, { status: 400 });
  }
  if (!Number.isFinite(totalWinnings) || totalWinnings < 0) {
    return NextResponse.json({ error: 'Invalid winnings amount.' }, { status: 400 });
  }

  const result = settleCasinoWinnings(sessionId, settleToken, totalWinnings);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    credited: result.credited,
    settleToken: result.settleToken,
  });
}