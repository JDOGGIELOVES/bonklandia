import { loadJsonStore, saveJsonStore } from '@/lib/security/persistent-store';

type SignatureEntry = { usedAt: string; kind: string };

type SignatureStore = Record<string, SignatureEntry>;

const STORE_FILE = 'used-signatures.json';

function pruneStore(store: SignatureStore): SignatureStore {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const pruned: SignatureStore = {};
  for (const [sig, entry] of Object.entries(store)) {
    if (new Date(entry.usedAt).getTime() > cutoff) pruned[sig] = entry;
  }
  return pruned;
}

export function isSignatureUsed(signature: string): boolean {
  const store = loadJsonStore<SignatureStore>(STORE_FILE, {});
  return Boolean(store[signature]);
}

export function markSignatureUsed(signature: string, kind: string): void {
  const store = pruneStore(loadJsonStore<SignatureStore>(STORE_FILE, {}));
  store[signature] = { usedAt: new Date().toISOString(), kind };
  saveJsonStore(STORE_FILE, store);
}