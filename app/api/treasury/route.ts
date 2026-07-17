import { NextResponse } from 'next/server';
import { fetchTreasurySnapshot } from '@/lib/treasury-balances';
import { treasuryPayoutsAllowed, treasuryPayoutsBlockedReason } from '@/lib/security/payout-guard';
import {
  getTreasuryKeyStatus,
  isTreasuryPayoutsReady,
  treasuryKeyMismatchError,
} from '@/lib/treasury';

export async function GET() {
  try {
    const snapshot = await fetchTreasurySnapshot();
    const keyStatus = getTreasuryKeyStatus();
    const payoutsReady = keyStatus.ready && treasuryPayoutsAllowed();
    const keyMismatch = treasuryKeyMismatchError();

    return NextResponse.json({
      ...snapshot,
      payoutsReady,
      quarterSlotReady: true,
      payoutsBlockedReason:
        treasuryPayoutsBlockedReason() ??
        keyMismatch ??
        (isTreasuryPayoutsReady() ? null : 'Treasury signing key not configured on server.'),
      signingKey: {
        envPresent: keyStatus.envPresent,
        envName: keyStatus.envName,
        rawLength: keyStatus.rawLength,
        parseOk: keyStatus.parseOk,
        byteLength: keyStatus.byteLength,
        keypairOk: keyStatus.keypairOk,
        matchesTreasury: keyStatus.matchesTreasury,
        derivedPubkey: keyStatus.derivedPubkey,
        expectedPubkey: keyStatus.expectedPubkey,
        ready: keyStatus.ready,
      },
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