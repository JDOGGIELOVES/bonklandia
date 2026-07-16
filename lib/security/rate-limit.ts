import { loadJsonStore, saveJsonStore } from '@/lib/security/persistent-store';

type Bucket = { count: number; windowStart: number };

type RateLimitStore = Record<string, Bucket>;

const STORE_FILE = 'rate-limits.json';

function getStore(): RateLimitStore {
  return loadJsonStore<RateLimitStore>(STORE_FILE, {});
}

function saveStore(store: RateLimitStore): void {
  const pruned: RateLimitStore = {};
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  for (const [key, bucket] of Object.entries(store)) {
    if (bucket.windowStart > cutoff) pruned[key] = bucket;
  }
  saveJsonStore(STORE_FILE, pruned);
}

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): { ok: true } | { ok: false; error: string } {
  const store = getStore();
  const now = Date.now();
  const bucket = store[key];

  if (!bucket || now - bucket.windowStart > windowMs) {
    store[key] = { count: 1, windowStart: now };
    saveStore(store);
    return { ok: true };
  }

  if (bucket.count >= max) {
    return { ok: false, error: 'Rate limit exceeded — try again later.' };
  }

  bucket.count += 1;
  store[key] = bucket;
  saveStore(store);
  return { ok: true };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}