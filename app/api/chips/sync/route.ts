import { NextResponse } from 'next/server';

/**
 * DISABLED — importing browser/localStorage chips would let players mint spendable
 * balances. Spendable chips only come from /api/chips/earn and /api/chips/claim.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Client chip import is disabled. Only chips earned in-game (Bandit / Depths with a connected wallet) can be cashed at the cashier.',
      code: 'CLIENT_IMPORT_DISABLED',
    },
    { status: 403 },
  );
}
