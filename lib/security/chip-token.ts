import { createHmac, timingSafeEqual } from 'crypto';
import { getCasinoSessionSecret } from '@/lib/security/config';

/**
 * Portable chip ledger — HMAC-sealed so balances work across Vercel
 * serverless instances (disk under /tmp is not shared).
 */
export type ChipLedgerPayload = {
  v: 1;
  wallet: string;
  chips: number;
  lifetimeWon: number;
  lifetimeExchanged: number;
  updatedAt: string;
};

function signBase64Url(payload: string): string {
  return createHmac('sha256', getCasinoSessionSecret()).update(payload).digest('base64url');
}

export function sealChipLedger(record: ChipLedgerPayload): string {
  const payload = Buffer.from(JSON.stringify(record), 'utf8').toString('base64url');
  return `${payload}.${signBase64Url(payload)}`;
}

export function openChipLedger(token: string | null | undefined): ChipLedgerPayload | null {
  if (!token || typeof token !== 'string') return null;
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
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as ChipLedgerPayload;
    if (parsed?.v !== 1 || typeof parsed.wallet !== 'string') return null;
    if (!Number.isFinite(parsed.chips) || parsed.chips < 0) return null;
    return {
      v: 1,
      wallet: parsed.wallet,
      chips: Math.floor(parsed.chips),
      lifetimeWon: Math.max(0, Math.floor(parsed.lifetimeWon ?? 0)),
      lifetimeExchanged: Math.max(0, Math.floor(parsed.lifetimeExchanged ?? 0)),
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function emptyChipLedger(wallet: string): ChipLedgerPayload {
  return {
    v: 1,
    wallet,
    chips: 0,
    lifetimeWon: 0,
    lifetimeExchanged: 0,
    updatedAt: new Date().toISOString(),
  };
}
