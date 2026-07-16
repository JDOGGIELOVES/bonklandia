import { NextResponse } from 'next/server';
import { getWalletChipBalance } from '@/lib/security/chip-ledger';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet')?.trim();

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet address required.' }, { status: 400 });
  }

  const record = getWalletChipBalance(wallet);
  return NextResponse.json({
    wallet,
    chips: record.chips,
    lifetimeWon: record.lifetimeWon,
    lifetimeExchanged: record.lifetimeExchanged,
    serverVerified: true,
  });
}