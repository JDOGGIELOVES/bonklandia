import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import {
  MAX_ALICE_SPENDABLE_PAYOUT,
  TOTAL_LEVELS,
  aliceCoinsToSpendable,
} from '@/lib/alice-room/game';
import { getCasinoSessionSecret } from '@/lib/security/config';

export type AliceSessionPayload = {
  v: 1;
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  maxSpendable: number;
  completed: boolean;
};

const TTL_MS = 2 * 60 * 60 * 1000;

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
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AliceSessionPayload;
    if (parsed?.v !== 1 || !parsed.sessionId) return null;
    if (new Date(parsed.expiresAt).getTime() < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createAliceSession(): { session: AliceSessionPayload; token: string } {
  const now = Date.now();
  const session: AliceSessionPayload = {
    v: 1,
    sessionId: `alice-${randomBytes(12).toString('hex')}`,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString(),
    maxSpendable: MAX_ALICE_SPENDABLE_PAYOUT,
    completed: false,
  };
  return { session, token: sealAliceSession(session) };
}

export function evaluateAlicePayout(
  token: string,
  aliceCoins: number,
):
  | { ok: true; spendable: number; sessionId: string; maxSpendable: number }
  | { ok: false; error: string } {
  const session = openAliceSession(token);
  if (!session) return { ok: false, error: 'Alice Room session missing or expired. Start a new dive.' };
  if (session.completed) return { ok: false, error: 'This Alice Room run was already cashed out.' };

  const coins = Math.max(0, Math.floor(aliceCoins));
  const spendable = Math.min(session.maxSpendable, aliceCoinsToSpendable(coins));

  return {
    ok: true,
    spendable,
    sessionId: session.sessionId,
    maxSpendable: session.maxSpendable,
  };
}

export { TOTAL_LEVELS };
