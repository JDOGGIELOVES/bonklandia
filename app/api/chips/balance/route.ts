import { NextResponse } from 'next/server';
import { getWalletChipBalance } from '@/lib/security/chip-ledger';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet')?.trim();
  const ledgerToken = searchParams.get('ledgerToken')?.trim() ?? null;

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet address required.' }, { status: 400 });
  }

  const record = getWalletChipBalance(wallet, ledgerToken);
  return NextResponse.json({
    wallet,
    chips: record.chips,
    lifetimeWon: record.lifetimeWon,
    lifetimeExchanged: record.lifetimeExchanged,
    // Echo the sealed token for this balance (do not invent empty tokens when none provided)
    ledgerToken: ledgerToken && record.chips >= 0 ? record.ledgerToken : record.chips > 0 ? record.ledgerToken : null,
    serverVerified: true,
    portable: true,
  });
}

export async function POST(request: Request) {
  let body: { wallet?: string; ledgerToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const wallet = body.wallet?.trim();
  if (!wallet) {
    return NextResponse.json({ error: 'Wallet address required.' }, { status: 400 });
  }

  const incoming = body.ledgerToken?.trim() || null;
  const record = getWalletChipBalance(wallet, incoming);
  return NextResponse.json({
    wallet,
    chips: record.chips,
    lifetimeWon: record.lifetimeWon,
    lifetimeExchanged: record.lifetimeExchanged,
    // Only return a token when we actually have chips or client sent a prior token
    ledgerToken:
      record.chips > 0 || incoming
        ? record.ledgerToken
        : null,
    serverVerified: true,
    portable: true,
  });
}
