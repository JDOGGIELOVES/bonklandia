let autoPausedUntilMs = 0;
let autoPauseReason = '';
let recentPayoutCount = 0;
let recentPayoutWindowStart = 0;

const VELOCITY_WINDOW_MS = 5 * 60 * 1000;
const VELOCITY_MAX_PAYOUTS = Number(process.env.TREASURY_VELOCITY_MAX_PAYOUTS ?? '50');
const AUTO_PAUSE_MS = 15 * 60 * 1000;

export function treasuryPayoutsAllowed(): boolean {
  if (process.env.CLAIMS_PAUSED === 'true') return false;
  if (process.env.CASHIER_PAYOUTS_ENABLED === 'false') return false;
  if (Date.now() < autoPausedUntilMs) return false;
  return true;
}

export function treasuryPayoutsBlockedReason(): string | undefined {
  if (process.env.CLAIMS_PAUSED === 'true') {
    return 'Cashier payouts are temporarily paused.';
  }
  if (process.env.CASHIER_PAYOUTS_ENABLED === 'false') {
    return 'Cashier payouts are disabled.';
  }
  if (Date.now() < autoPausedUntilMs) {
    return autoPauseReason || `Treasury auto-paused until ${new Date(autoPausedUntilMs).toISOString()}.`;
  }
  return undefined;
}

export function recordPayoutAttempt(): void {
  const now = Date.now();
  if (now - recentPayoutWindowStart > VELOCITY_WINDOW_MS) {
    recentPayoutWindowStart = now;
    recentPayoutCount = 0;
  }
  recentPayoutCount += 1;
  if (recentPayoutCount > VELOCITY_MAX_PAYOUTS) {
    autoPausedUntilMs = now + AUTO_PAUSE_MS;
    autoPauseReason = 'Anomalous cashier payout velocity detected.';
    recentPayoutCount = 0;
    recentPayoutWindowStart = now;
    console.error('[TREASURY AUTO-PAUSE]', autoPauseReason);
  }
}