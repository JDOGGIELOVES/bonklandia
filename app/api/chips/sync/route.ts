import { NextResponse } from 'next/server';
import { depositWalletChips } from '@/lib/security/chip-ledger';
import { blockIfEmergencyStopped } from '@/lib/security/emergency';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';

const MAX_IMPORT_PER_REQUEST = Number(process.env.MAX_CHIP_IMPORT_PER_REQUEST ?? '5000000');

/**
 * Move local-bank chips onto the portable cashier ledger.
 * Returns a sealed ledgerToken the browser must keep and resend.
 */
export async function POST(request: Request) {
  const stopped = blockIfEmergencyStopped();
  if (stopped) return stopped;

  const ip = getClientIp(request);
  const ipLimited = checkRateLimit(`chip-sync:ip:${ip}`, 40, 60 * 60 * 1000);
  if (!ipLimited.ok) {
    return NextResponse.json({ error: ipLimited.error }, { status: 429 });
  }

  let body: { wallet?: string; amount?: number; ledgerToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const wallet = body.wallet?.trim();
  const amount = Math.floor(Number(body.amount));
  const ledgerToken = body.ledgerToken?.trim() || null;

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet address required.' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Import amount must be a positive number.' }, { status: 400 });
  }
  if (amount > MAX_IMPORT_PER_REQUEST) {
    return NextResponse.json(
      {
        error: `Import too large (max ${MAX_IMPORT_PER_REQUEST.toLocaleString()} chips per sync).`,
      },
      { status: 400 },
    );
  }

  const walletReqLimited = checkRateLimit(`chip-sync:wallet-req:${wallet}`, 30, 60 * 60 * 1000);
  if (!walletReqLimited.ok) {
    return NextResponse.json({ error: walletReqLimited.error }, { status: 429 });
  }

  const deposited = depositWalletChips(wallet, amount, ledgerToken);
  if (!deposited.ok) {
    return NextResponse.json({ error: deposited.error }, { status: 400 });
  }

  // Always return the sealed token from the deposit result (source of truth).
  return NextResponse.json({
    ok: true,
    deposited: deposited.deposited,
    chips: deposited.record.chips,
    ledgerToken: deposited.record.ledgerToken,
    wallet,
  });
}
