/**
 * In-memory rate limits (safe on Vercel). Best-effort only — not shared across
 * instances, but never crashes with EROFS.
 */
type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): { ok: true } | { ok: false; error: string } {
  try {
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.windowStart > windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return { ok: true };
    }

    if (bucket.count >= max) {
      return { ok: false, error: 'Rate limit exceeded — try again later.' };
    }

    bucket.count += 1;
    buckets.set(key, bucket);
    return { ok: true };
  } catch {
    // Fail open — never block exchanges because of limiter bugs.
    return { ok: true };
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}
