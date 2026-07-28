import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PublicKey } from '@solana/web3.js';
import {
  MAX_ALICE_SPENDABLE_PAYOUT,
  TOTAL_LEVELS,
  aliceCoinsToSpendable,
} from '@/lib/alice-room/game';
import { getCasinoSessionSecret } from '@/lib/security/config';

export type AliceSessionPayload = {
  v: 2;
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  maxSpendable: number;
  completed: boolean;
  /** Bound wallet (base58) when known at start — complete must match. */
  wallet: string | null;
  /** Minimum milliseconds of real time before banking (anti-instant farm). */
  minPlayMs: number;
};

const TTL_MS = 2 * 60 * 60 * 1000;
/** ~90s minimum run before bank — same spirit as casino session not being free mint. */
export const ALICE_MIN_PLAY_MS = Number(process.env.ALICE_MIN_PLAY_MS ?? '90000');

function sign(payload: string): string {
  return createHmac('sha256', getCasinoSessionSecret()).update(payload).digest('base64url');
}

export function sealAliceSession(session: AliceSessionPayload): string {
  const body = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  return `${body}.${sign(body)}`;
}

export function openAliceSession(token: string | null | undefined): AliceSessionPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const expected = sign(body);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      v?: number;
      sessionId?: string;
      createdAt?: string;
      expiresAt?: string;
      maxSpendable?: number;
      completed?: boolean;
      wallet?: string | null;
      minPlayMs?: number;
    };
    if ((parsed?.v !== 1 && parsed?.v !== 2) || !parsed.sessionId || !parsed.createdAt || !parsed.expiresAt) {
      return null;
    }
    if (new Date(parsed.expiresAt).getTime() < Date.now()) return null;
    // Normalize v1 sessions
    return {
      v: 2,
      sessionId: parsed.sessionId,
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
      maxSpendable: parsed.maxSpendable ?? MAX_ALICE_SPENDABLE_PAYOUT,
      completed: Boolean(parsed.completed),
      wallet: parsed.wallet ?? null,
      minPlayMs: parsed.minPlayMs ?? ALICE_MIN_PLAY_MS,
    };
  } catch {
    return null;
  }
}

export function isValidWalletAddress(wallet: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(wallet);
    return true;
  } catch {
    return false;
  }
}

export function createAliceSession(wallet: string | null = null): {
  session: AliceSessionPayload;
  token: string;
} {
  const now = Date.now();
  const bound =
    wallet && isValidWalletAddress(wallet) ? wallet : null;
  const session: AliceSessionPayload = {
    v: 2,
    sessionId: `alice-${randomBytes(12).toString('hex')}`,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString(),
    maxSpendable: MAX_ALICE_SPENDABLE_PAYOUT,
    completed: false,
    wallet: bound,
    minPlayMs: ALICE_MIN_PLAY_MS,
  };
  return { session, token: sealAliceSession(session) };
}

export function evaluateAlicePayout(
  token: string,
  aliceCoins: number,
  claimWallet: string,
):
  | { ok: true; spendable: number; sessionId: string; maxSpendable: number }
  | { ok: false; error: string; code?: string } {
  const session = openAliceSession(token);
  if (!session) {
    return { ok: false, error: 'Alice Room session missing or expired. Start a new dive.', code: 'SESSION' };
  }
  if (session.completed) {
    return { ok: false, error: 'This Alice Room run was already cashed out.', code: 'ALREADY_CLAIMED' };
  }
  if (!isValidWalletAddress(claimWallet)) {
    return { ok: false, error: 'Invalid wallet address.', code: 'WALLET' };
  }
  if (session.wallet && session.wallet !== claimWallet) {
    return {
      ok: false,
      error: 'This dive is bound to a different wallet. Connect the same wallet you started with.',
      code: 'WALLET_MISMATCH',
    };
  }

  const created = new Date(session.createdAt).getTime();
  const elapsed = Date.now() - created;
  if (elapsed < session.minPlayMs) {
    const waitSec = Math.ceil((session.minPlayMs - elapsed) / 1000);
    return {
      ok: false,
      error: `Finish the voyage first — bank opens in ~${waitSec}s (anti-instant claim).`,
      code: 'TOO_FAST',
    };
  }

  const coins = Math.max(0, Math.floor(aliceCoins));
  if (!Number.isFinite(coins)) {
    return { ok: false, error: 'Invalid Alice Coins amount.', code: 'AMOUNT' };
  }

  // Hard ceiling — same spirit as casino maxWinnings.
  const spendable = Math.min(session.maxSpendable, aliceCoinsToSpendable(coins));

  return {
    ok: true,
    spendable,
    sessionId: session.sessionId,
    maxSpendable: session.maxSpendable,
  };
}

export { TOTAL_LEVELS };
