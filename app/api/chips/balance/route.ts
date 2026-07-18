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
    ledgerToken: record.ledgerToken,
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

  const record = getWalletChipBalance(wallet, body.ledgerToken ?? null);
  return NextResponse.json({
    wallet,
    chips: record.chips,
    lifetimeWon: record.lifetimeWon,
    lifetimeExchanged: record.lifetimeExchanged,
    ledgerToken: record.ledgerToken,
    serverVerified: true,
    portable: true,
  });
}
