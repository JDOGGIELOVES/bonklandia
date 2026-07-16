import { NextResponse } from 'next/server';
import { fetchTreasurySnapshot } from '@/lib/treasury-balances';
import { treasuryPayoutsAllowed, treasuryPayoutsBlockedReason } from '@/lib/security/payout-guard';
import { isTreasuryPayoutsReady, treasuryKeyMismatchError } from '@/lib/treasury';

export async function GET() {
  try {
    const snapshot = await fetchTreasurySnapshot();
    const payoutsReady = isTreasuryPayoutsReady() && treasuryPayoutsAllowed();
    const keyMismatch = treasuryKeyMismatchError();

    return NextResponse.json({
      ...snapshot,
      payoutsReady,
      quarterSlotReady: true,
      payoutsBlockedReason:
        treasuryPayoutsBlockedReason() ??
        keyMismatch ??
        (isTreasuryPayoutsReady() ? null : 'Treasury signing key not configured on server.'),
      security: {
        treasuryNeverPaysSol: true,
        treasuryNeverCreatesTokenAccounts: true,
        chipsServerVerified: true,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load treasury.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}