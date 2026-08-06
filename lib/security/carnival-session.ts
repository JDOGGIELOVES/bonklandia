/**
 * Carnival wheel sessions — HMAC-sealed commit-reveal outcomes.
 *
 * Flow:
 * 1. Player pays $0.25 BONGA to treasury (SPL transfer verified).
 * 2. Server creates session with commit = H(serverSeed), stores sealed payload.
 * 3. Spin: server derives wheel+dice from HMAC(serverSeed, sessionId), reveals seed.
 * 4. Credits spendable chips only (Cashier is sole token exit).
 *
 * Client-submitted outcomes are never trusted.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { getCasinoSessionSecret } from '@/lib/security/config';
import {
  coinForDice,
  getWheelSpaces,
  prizeUsdToChips,
  type PrizeTierId,
} from '@/lib/carnival/wheel';
import type { FamCoinId } from '@/lib/fam-tokens';

export const CARNIVAL_SESSION_TTL_MS = 15 * 60 * 1000;
export const CARNIVAL_MAX_CHIPS = 150;
export const CARNIVAL_COOLDOWN_MS = 8_000;

export type CarnivalOutcome = {
  wheelIndex: number;
  wheelLabel: string;
  tierId: PrizeTierId;
  prizeUsd: number;
  diceFace: number;
  coinId: FamCoinId;
  coinName: string;
  chips: number;
};

export type CarnivalSessionPayload = {
  v: 1;
  sessionId: string;
  wallet: string;
  paymentSig: string;
  commit: string;
  /** Only set after spin (reveal). */
  serverSeed?: string;
  outcome?: CarnivalOutcome;
  claimed: boolean;
  createdAt: number;
  expiresAt: number;
  entryBongaRaw: string;
  bongaUsd: number;
};

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

function hmac(data: string): Buffer {
  return createHmac('sha256', getCasinoSessionSecret()).update(data).digest();
}

export function sealCarnivalSession(payload: CarnivalSessionPayload): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = b64url(hmac(body));
  return `cw1.${body}.${sig}`;
}

export function openCarnivalSession(token: string): CarnivalSessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'cw1') return null;
  const [, body, sig] = parts;
  if (!body || !sig) return null;
  const expect = b64url(hmac(body));
  try {
    const a = fromB64url(sig);
    const b = fromB64url(expect);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as CarnivalSessionPayload;
    if (payload.v !== 1) return null;
    if (Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

export function makeServerSeed(): string {
  return randomBytes(32).toString('hex');
}

export function commitOf(serverSeed: string): string {
  return createHmac('sha256', getCasinoSessionSecret())
    .update(`carnival-commit:${serverSeed}`)
    .digest('hex');
}

/**
 * Derive wheel index (0–62) and dice (1–6) from server seed + session id.
 * Verifiable once seed is revealed: recompute HMAC and match outcome.
 */
export function deriveOutcome(serverSeed: string, sessionId: string): CarnivalOutcome {
  const digest = createHmac('sha256', serverSeed)
    .update(`carnival-outcome:${sessionId}`)
    .digest();
  const wheelIndex = digest.readUInt32BE(0) % 63;
  const diceFace = (digest.readUInt8(4) % 6) + 1;
  const spaces = getWheelSpaces();
  const space = spaces[wheelIndex]!;
  const coin = coinForDice(diceFace);
  const chips = prizeUsdToChips(space.prizeUsd);
  return {
    wheelIndex,
    wheelLabel: space.label,
    tierId: space.tierId,
    prizeUsd: space.prizeUsd,
    diceFace,
    coinId: coin.coinId,
    coinName: coin.name,
    chips: Math.min(CARNIVAL_MAX_CHIPS, chips),
  };
}

export function createCarnivalSession(opts: {
  wallet: string;
  paymentSig: string;
  entryBongaRaw: bigint;
  bongaUsd: number;
}): { token: string; payload: CarnivalSessionPayload; commit: string } {
  const serverSeed = makeServerSeed();
  const commit = commitOf(serverSeed);
  const sessionId = randomBytes(16).toString('hex');
  const now = Date.now();
  // Store seed sealed inside the token so spin doesn't need a DB —
  // client only receives commit until spin response reveals seed+outcome.
  const payload: CarnivalSessionPayload = {
    v: 1,
    sessionId,
    wallet: opts.wallet,
    paymentSig: opts.paymentSig,
    commit,
    serverSeed,
    claimed: false,
    createdAt: now,
    expiresAt: now + CARNIVAL_SESSION_TTL_MS,
    entryBongaRaw: opts.entryBongaRaw.toString(),
    bongaUsd: opts.bongaUsd,
  };
  return { token: sealCarnivalSession(payload), payload, commit };
}

export function resolveCarnivalSpin(token: string, wallet: string): {
  ok: true;
  token: string;
  payload: CarnivalSessionPayload;
  outcome: CarnivalOutcome;
  serverSeed: string;
} | { ok: false; error: string } {
  const payload = openCarnivalSession(token);
  if (!payload) return { ok: false, error: 'Invalid or expired carnival session.' };
  if (payload.wallet !== wallet) return { ok: false, error: 'Wallet does not match session.' };
  if (payload.claimed) return { ok: false, error: 'This spin was already claimed.' };
  if (!payload.serverSeed) return { ok: false, error: 'Session missing seed.' };
  if (payload.outcome) {
    // Idempotent re-read before claim finalize
    return {
      ok: true,
      token,
      payload,
      outcome: payload.outcome,
      serverSeed: payload.serverSeed,
    };
  }

  const outcome = deriveOutcome(payload.serverSeed, payload.sessionId);
  const next: CarnivalSessionPayload = {
    ...payload,
    outcome,
  };
  return {
    ok: true,
    token: sealCarnivalSession(next),
    payload: next,
    outcome,
    serverSeed: payload.serverSeed,
  };
}

export function markCarnivalClaimed(token: string): string | null {
  const payload = openCarnivalSession(token);
  if (!payload || !payload.outcome) return null;
  return sealCarnivalSession({ ...payload, claimed: true });
}
