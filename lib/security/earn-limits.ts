/**
 * Caps on how many chips can be *earned onto the server ledger* per wallet/day.
 * Prevents spam of /api/chips/earn while still allowing normal play.
 */

export const MAX_EARN_PER_REQUEST = Number(process.env.MAX_EARN_PER_REQUEST ?? '25000');

/** Soft daily ceiling for depths/event earns (casino claims use session max instead). */
export const MAX_EARN_PER_WALLET_PER_DAY = Number(
  process.env.MAX_EARN_PER_WALLET_PER_DAY ?? '75000',
);

export type EarnSource =
  | 'depths-event'
  | 'depths-bandit'
  | 'depths-clear'
  | 'casino-claim'
  | 'alice-room'
  | 'carnival-wheel'
  | 'other';

const SOURCE_MAX: Record<EarnSource, number> = {
  'depths-event': Number(process.env.MAX_EARN_DEPTHS_EVENT ?? '500'),
  'depths-bandit': Number(process.env.MAX_EARN_DEPTHS_BANDIT ?? '25000'),
  'depths-clear': Number(process.env.MAX_EARN_DEPTHS_CLEAR ?? '25000'),
  'casino-claim': Number(process.env.MAX_EARN_CASINO_CLAIM ?? '500000'),
  /** Final Alice Room tally only (post-boss), micro-prize aligned. */
  'alice-room': Number(process.env.MAX_EARN_ALICE_ROOM ?? '90'),
  /** Carnival wheel jackpot max 150 chips; one claim per paid spin. */
  'carnival-wheel': Number(process.env.MAX_EARN_CARNIVAL_WHEEL ?? '150'),
  other: Number(process.env.MAX_EARN_OTHER ?? '1000'),
};

type DayBucket = { date: string; chips: number };

const walletEarn = new Map<string, DayBucket>();

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function bucket(wallet: string): DayBucket {
  const today = utcDate();
  const existing = walletEarn.get(wallet);
  if (!existing || existing.date !== today) {
    const fresh = { date: today, chips: 0 };
    walletEarn.set(wallet, fresh);
    return fresh;
  }
  return existing;
}

export function assertEarnAllowed(
  wallet: string,
  amount: number,
  source: EarnSource,
): { ok: true } | { ok: false; error: string; code: string } {
  const chips = Math.floor(amount);
  if (!Number.isFinite(chips) || chips <= 0) {
    return { ok: false, error: 'Invalid earn amount.', code: 'INVALID_AMOUNT' };
  }
  if (chips > MAX_EARN_PER_REQUEST) {
    return {
      ok: false,
      error: `Earn amount too large (max ${MAX_EARN_PER_REQUEST.toLocaleString()} per request).`,
      code: 'MAX_PER_REQUEST',
    };
  }
  const srcMax = SOURCE_MAX[source] ?? SOURCE_MAX.other;
  if (chips > srcMax) {
    return {
      ok: false,
      error: `Earn amount exceeds cap for ${source} (${srcMax.toLocaleString()} chips).`,
      code: 'SOURCE_CAP',
    };
  }

  // Casino claims already bounded by session maxWinnings — skip daily bucket
  // so a legitimate long session can claim fully once.
  if (source === 'casino-claim') {
    return { ok: true };
  }

  const b = bucket(wallet);
  if (b.chips + chips > MAX_EARN_PER_WALLET_PER_DAY) {
    const rem = Math.max(0, MAX_EARN_PER_WALLET_PER_DAY - b.chips);
    return {
      ok: false,
      error:
        rem <= 0
          ? `Daily earn limit reached (${MAX_EARN_PER_WALLET_PER_DAY.toLocaleString()} chips). Resets midnight UTC.`
          : `Only ${rem.toLocaleString()} earnable chips left today.`,
      code: 'DAILY_EARN_CAP',
    };
  }

  return { ok: true };
}

export function recordEarn(wallet: string, amount: number, source: EarnSource): void {
  if (source === 'casino-claim') return;
  try {
    const chips = Math.max(0, Math.floor(amount));
    const b = bucket(wallet);
    b.chips += chips;
    walletEarn.set(wallet, b);
  } catch {
    // best-effort
  }
}
