import { NextResponse } from 'next/server';
import { fetchTreasurySnapshot } from '@/lib/treasury-balances';
import {
  emergencyStopEnvKey,
  emergencyStopMessage,
  isEmergencyStopActive,
} from '@/lib/security/emergency';
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
    const emergencyStop = isEmergencyStopActive();
    const payoutsReady = !emergencyStop && keyStatus.ready && treasuryPayoutsAllowed();
    const keyMismatch = treasuryKeyMismatchError();

    return NextResponse.json({
      ...snapshot,
      emergencyStop,
      emergencyStopEnvKey: emergencyStop ? emergencyStopEnvKey() : null,
      emergencyStopMessage: emergencyStop ? emergencyStopMessage() : null,
      payoutsReady,
      quarterSlotReady: !emergencyStop,
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
        treasuryNeverSendsSolTransfers: true,
        treasuryPaysBaseNetworkFeeOnly: true,
        treasuryNeverCreatesTokenAccounts: true,
        chipsServerVerified: true,
        emergencyStopSupported: true,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load treasury.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
