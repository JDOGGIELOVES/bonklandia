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

export function createSettleToken(sessionId: string, expiresAt: string): string {
  return sign(`${sessionId}|${expiresAt}|v1`);
}

export function verifySettleToken(sessionId: string, expiresAt: string, token: string): boolean {
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

  const sessions = loadSessions();
  sessions[sessionId] = session;
  saveSessions(sessions);

  return { session, settleToken: createSettleToken(sessionId, expiresAt) };
}

export function getCasinoSession(sessionId: string): CasinoSessionRecord | null {
  const session = loadSessions()[sessionId];
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  return session;
}

export function registerPaidSpinForSession(sessionId: string): { ok: true } | { ok: false; error: string } {
  const sessions = loadSessions();
  const session = sessions[sessionId];
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

  sessions[sessionId] = session;
  saveSessions(sessions);
  return { ok: true };
}

export function settleCasinoWinnings(
  sessionId: string,
  settleToken: string,
  totalWinnings: number,
): { ok: true; credited: number } | { ok: false; error: string } {
  const sessions = loadSessions();
  const session = sessions[sessionId];
  if (!session) return { ok: false, error: 'Casino session not found or expired.' };
  if (!verifySettleToken(sessionId, session.expiresAt, settleToken)) {
    return { ok: false, error: 'Invalid casino session token.' };
  }
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
  sessions[sessionId] = session;
  saveSessions(sessions);

  return { ok: true, credited: winnings };
}

export function claimSessionToWallet(
  sessionId: string,
  settleToken: string,
  wallet: string,
): { ok: true; chips: number } | { ok: false; error: string } {
  const sessions = loadSessions();
  const session = sessions[sessionId];
  if (!session) return { ok: false, error: 'Casino session not found or expired.' };
  if (!verifySettleToken(sessionId, session.expiresAt, settleToken)) {
    return { ok: false, error: 'Invalid casino session token.' };
  }
  if (session.claimed) return { ok: false, error: 'Session already claimed.' };
  if (session.creditedWinnings <= 0) {
    return { ok: false, error: 'No chips to claim for this session.' };
  }

  session.claimed = true;
  session.wallet = wallet;
  sessions[sessionId] = session;
  saveSessions(sessions);

  return { ok: true, chips: session.creditedWinnings };
}