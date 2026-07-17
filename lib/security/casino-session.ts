import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Difficulty } from '@/lib/characters';
import { JACKPOT_LADDER_PAYOUT_MULT } from '@/lib/casino-extras';
import {
  DEATH_SPIN_COUNT,
  getMaxJackpot,
  getVictorySpins,
  type CasinoOutcome,
} from '@/lib/slot-machine';
import { getCasinoSessionSecret, MAX_PAID_SPINS_PER_SESSION, SESSION_TTL_MS } from '@/lib/security/config';
import { loadJsonStore, saveJsonStore } from '@/lib/security/persistent-store';
import { isSignatureUsed, markSignatureUsed } from '@/lib/security/signature-store';

export type CasinoSessionRecord = {
  sessionId: string;
  outcome: CasinoOutcome;
  paytableWave: number;
  difficulty: Difficulty;
  grantedSpins: number;
  chipMultiplier: number;
  maxWinnings: number;
  creditedWinnings: number;
  paidSpinsGranted: number;
  wallet: string | null;
  claimed: boolean;
  createdAt: string;
  expiresAt: string;
};

type SessionStore = Record<string, CasinoSessionRecord>;

const STORE_FILE = 'casino-sessions.json';

function sign(payload: string): string {
  return createHmac('sha256', getCasinoSessionSecret()).update(payload).digest('hex');
}

function signBase64Url(payload: string): string {
  return createHmac('sha256', getCasinoSessionSecret()).update(payload).digest('base64url');
}

/** Portable session token — works across serverless instances (no shared disk). */
export function sealSession(session: CasinoSessionRecord): string {
  const payload = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  return `${payload}.${signBase64Url(payload)}`;
}

export function openSession(token: string): CasinoSessionRecord | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig) return null;

  const expected = signBase64Url(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as CasinoSessionRecord;
    if (!session?.sessionId || !session.expiresAt) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function createSettleToken(sessionId: string, expiresAt: string): string {
  return sign(`${sessionId}|${expiresAt}|v1`);
}

export function verifySettleToken(sessionId: string, expiresAt: string, token: string): boolean {
  // Sealed tokens carry the full session; verify by open + id match.
  const sealed = openSession(token);
  if (sealed) {
    return sealed.sessionId === sessionId && sealed.expiresAt === expiresAt;
  }

  const expected = createSettleToken(sessionId, expiresAt);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

const MAX_BET_MULT = 2;

export function computeMaxSessionWinnings(
  outcome: CasinoOutcome,
  paytableWave: number,
  difficulty: Difficulty,
  chipMultiplier: number,
  grantedSpins: number,
  extraPaidSpins = 0,
): number {
  const maxJackpot = getMaxJackpot(paytableWave, chipMultiplier);
  const perSpinCeiling = Math.ceil(
    maxJackpot * MAX_BET_MULT * JACKPOT_LADDER_PAYOUT_MULT,
  );
  const spinBudget = grantedSpins + Math.min(extraPaidSpins, MAX_PAID_SPINS_PER_SESSION);
  return perSpinCeiling * spinBudget;
}

function loadSessions(): SessionStore {
  return loadJsonStore<SessionStore>(STORE_FILE, {});
}

function saveSessions(sessions: SessionStore): void {
  const pruned: SessionStore = {};
  const now = Date.now();
  for (const [id, session] of Object.entries(sessions)) {
    if (new Date(session.expiresAt).getTime() > now) pruned[id] = session;
  }
  saveJsonStore(STORE_FILE, pruned);
}

function persistSession(session: CasinoSessionRecord): void {
  try {
    const sessions = loadSessions();
    sessions[session.sessionId] = session;
    saveSessions(sessions);
  } catch {
    // Best-effort only — sealed tokens are the source of truth on serverless.
  }
}

/**
 * Resolve a session from a portable sealed token (preferred) or local file cache.
 */
export function resolveSession(
  sessionId: string,
  settleToken?: string | null,
): CasinoSessionRecord | null {
  if (settleToken) {
    const sealed = openSession(settleToken);
    if (sealed && sealed.sessionId === sessionId) return sealed;
  }

  const session = loadSessions()[sessionId];
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;

  // Legacy HMAC settle tokens must still match.
  if (settleToken && !openSession(settleToken)) {
    if (!verifySettleToken(sessionId, session.expiresAt, settleToken)) return null;
  }

  return session;
}

export function createCasinoSession(params: {
  outcome: CasinoOutcome;
  paytableWave: number;
  difficulty: Difficulty;
  chipMultiplier: number;
}): { session: CasinoSessionRecord; settleToken: string } {
  const grantedSpins =
    params.outcome === 'victory'
      ? getVictorySpins(params.difficulty)
      : DEATH_SPIN_COUNT;

  const sessionId = randomBytes(16).toString('hex');
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const session: CasinoSessionRecord = {
    sessionId,
    outcome: params.outcome,
    paytableWave: params.paytableWave,
    difficulty: params.difficulty,
    grantedSpins,
    chipMultiplier: params.chipMultiplier,
    maxWinnings: computeMaxSessionWinnings(
      params.outcome,
      params.paytableWave,
      params.difficulty,
      params.chipMultiplier,
      grantedSpins,
      0,
    ),
    creditedWinnings: 0,
    paidSpinsGranted: 0,
    wallet: null,
    claimed: false,
    createdAt,
    expiresAt,
  };

  persistSession(session);
  return { session, settleToken: sealSession(session) };
}

export function getCasinoSession(sessionId: string): CasinoSessionRecord | null {
  const session = loadSessions()[sessionId];
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  return session;
}

export function registerPaidSpinForSession(
  sessionId: string,
  settleToken?: string | null,
): { ok: true; settleToken: string; maxWinnings: number } | { ok: false; error: string } {
  const session = resolveSession(sessionId, settleToken);
  if (!session) return { ok: false, error: 'Casino session not found or expired.' };
  if (session.claimed) return { ok: false, error: 'Casino session already claimed.' };

  if (session.paidSpinsGranted >= MAX_PAID_SPINS_PER_SESSION) {
    return { ok: false, error: 'Paid spin limit reached for this casino session.' };
  }

  session.paidSpinsGranted += 1;
  session.maxWinnings = computeMaxSessionWinnings(
    session.outcome,
    session.paytableWave,
    session.difficulty,
    session.chipMultiplier,
    session.grantedSpins,
    session.paidSpinsGranted,
  );

  persistSession(session);
  return {
    ok: true,
    settleToken: sealSession(session),
    maxWinnings: session.maxWinnings,
  };
}

export function settleCasinoWinnings(
  sessionId: string,
  settleToken: string,
  totalWinnings: number,
): { ok: true; credited: number; settleToken: string } | { ok: false; error: string } {
  const session = resolveSession(sessionId, settleToken);
  if (!session) return { ok: false, error: 'Casino session not found or expired.' };
  if (session.claimed) return { ok: false, error: 'Casino session already claimed to wallet.' };

  const winnings = Math.max(0, Math.floor(totalWinnings));
  if (winnings < session.creditedWinnings) {
    return { ok: false, error: 'Winnings cannot decrease.' };
  }
  if (winnings > session.maxWinnings) {
    return {
      ok: false,
      error: `Winnings exceed session cap (${session.maxWinnings.toLocaleString()} chips).`,
    };
  }

  session.creditedWinnings = winnings;
  persistSession(session);

  return { ok: true, credited: winnings, settleToken: sealSession(session) };
}

export function claimSessionToWallet(
  sessionId: string,
  settleToken: string,
  wallet: string,
): { ok: true; chips: number } | { ok: false; error: string } {
  const session = resolveSession(sessionId, settleToken);
  if (!session) return { ok: false, error: 'Casino session not found or expired.' };
  if (session.claimed) return { ok: false, error: 'Session already claimed.' };
  if (session.creditedWinnings <= 0) {
    return { ok: false, error: 'No chips to claim for this session.' };
  }

  // Best-effort anti-replay across warm instances.
  const claimKey = `casino-claim:${sessionId}`;
  if (isSignatureUsed(claimKey)) {
    return { ok: false, error: 'Session already claimed.' };
  }

  session.claimed = true;
  session.wallet = wallet;
  persistSession(session);
  markSignatureUsed(claimKey, 'casino-claim');

  return { ok: true, chips: session.creditedWinnings };
}
