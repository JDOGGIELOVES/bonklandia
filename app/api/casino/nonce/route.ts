import { NextResponse } from 'next/server';
import { issueCasinoNonce } from '@/lib/security/nonce-store';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limited = checkRateLimit(`nonce:${ip}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: limited.error }, { status: 429 });
  }

  const { nonce, expiresAt } = issueCasinoNonce();
  return NextResponse.json({ nonce, expiresAt });
}