import { randomBytes } from 'crypto';
import { NONCE_TTL_MS } from '@/lib/security/config';
import { loadJsonStore, saveJsonStore } from '@/lib/security/persistent-store';

type NonceRecord = { createdAt: string; used: boolean };

type NonceStore = Record<string, NonceRecord>;

const STORE_FILE = 'casino-nonces.json';

function prune(store: NonceStore): NonceStore {
  const cutoff = Date.now() - NONCE_TTL_MS * 2;
  const pruned: NonceStore = {};
  for (const [nonce, record] of Object.entries(store)) {
    if (new Date(record.createdAt).getTime() > cutoff) pruned[nonce] = record;
  }
  return pruned;
}

export function issueCasinoNonce(): { nonce: string; expiresAt: string } {
  const nonce = randomBytes(16).toString('hex');
  const createdAt = new Date().toISOString();
  const store = prune(loadJsonStore<NonceStore>(STORE_FILE, {}));
  store[nonce] = { createdAt, used: false };
  saveJsonStore(STORE_FILE, store);
  return {
    nonce,
    expiresAt: new Date(Date.now() + NONCE_TTL_MS).toISOString(),
  };
}

export function consumeCasinoNonce(nonce: string): { ok: true } | { ok: false; error: string } {
  const store = prune(loadJsonStore<NonceStore>(STORE_FILE, {}));
  const record = store[nonce];
  if (!record) return { ok: false, error: 'Invalid or expired nonce.' };
  if (record.used) return { ok: false, error: 'Nonce already used.' };
  if (Date.now() - new Date(record.createdAt).getTime() > NONCE_TTL_MS) {
    return { ok: false, error: 'Nonce expired.' };
  }

  record.used = true;
  store[nonce] = record;
  saveJsonStore(STORE_FILE, store);
  return { ok: true };
}