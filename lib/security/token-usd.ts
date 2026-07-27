import { FAM_TOKEN_MINTS, type FamCoinId } from '@/lib/fam-tokens';

/**
 * USD valuation for cashier caps.
 *
 * Policy: micro cashouts only — anything about $1+ is treated as high-risk.
 * Prices are intentionally conservative (slightly high) so we under-allow tokens
 * when markets are uncertain. Override with env:
 *   TOKEN_USD_BONK=0.000012
 *   TOKEN_USD_BONGA=0.0001
 *   …
 */

/** Fallback USD per 1 whole token when live price is unavailable (conservative). */
const FALLBACK_USD_PER_TOKEN: Record<FamCoinId, number> = {
  // BONK is listed; keep a modest overestimate if API fails.
  bonk: Number(process.env.TOKEN_USD_BONK ?? '0.00002'),
  // Fam coins are often illiquid — assume non-trivial value until proven otherwise.
  bonga: Number(process.env.TOKEN_USD_BONGA ?? '0.001'),
  bong: Number(process.env.TOKEN_USD_BONG ?? '0.0001'),
  bink: Number(process.env.TOKEN_USD_BINK ?? '0.00005'),
  bonnie: Number(process.env.TOKEN_USD_BONNIE ?? '0.01'),
  beng: Number(process.env.TOKEN_USD_BENG ?? '0.001'),
};

type PriceCache = { at: number; byMint: Map<string, number> };
let cache: PriceCache | null = null;
const CACHE_MS = 5 * 60 * 1000;

function envUsd(coinId: FamCoinId): number | null {
  const key = `TOKEN_USD_${coinId.toUpperCase()}`;
  const raw = process.env[key];
  if (raw == null || !String(raw).trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchJupiterPrices(mints: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (mints.length === 0) return out;

  // Try Jupiter price API variants (best-effort).
  const urls = [
    `https://price.jup.ag/v6/price?ids=${mints.join(',')}`,
    `https://api.jup.ag/price/v2?ids=${mints.join(',')}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        data?: Record<string, { price?: number | string } | undefined>;
      };
      const rows = data.data ?? {};
      for (const mint of mints) {
        const p = rows[mint]?.price;
        const n = typeof p === 'string' ? Number(p) : p;
        if (typeof n === 'number' && Number.isFinite(n) && n > 0) {
          out.set(mint, n);
        }
      }
      if (out.size > 0) return out;
    } catch {
      // try next
    }
  }
  return out;
}

async function fetchCoingeckoBonk(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bonk&vs_currencies=usd',
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { bonk?: { usd?: number } };
    const n = data.bonk?.usd;
    return typeof n === 'number' && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** USD price for 1 whole token unit. */
export async function getTokenUsdPrice(coinId: FamCoinId): Promise<{
  usd: number;
  source: 'env' | 'jupiter' | 'coingecko' | 'fallback';
}> {
  const fromEnv = envUsd(coinId);
  if (fromEnv != null) return { usd: fromEnv, source: 'env' };

  const now = Date.now();
  if (!cache || now - cache.at > CACHE_MS) {
    const mints = Object.values(FAM_TOKEN_MINTS);
    const byMint = await fetchJupiterPrices(mints);
    const bonkUsd = await fetchCoingeckoBonk();
    if (bonkUsd != null) byMint.set(FAM_TOKEN_MINTS.bonk, bonkUsd);
    cache = { at: now, byMint };
  }

  const mint = FAM_TOKEN_MINTS[coinId];
  const live = cache.byMint.get(mint);
  if (live != null && live > 0) {
    // Prefer live, but never use a price that is absurdly below fallback for illiquid coins
    // if it would open a huge token flood (price ≈ 0).
    if (live < FALLBACK_USD_PER_TOKEN[coinId] * 0.01 && coinId !== 'bonk') {
      return { usd: FALLBACK_USD_PER_TOKEN[coinId], source: 'fallback' };
    }
    return {
      usd: live,
      source: coinId === 'bonk' ? 'coingecko' : 'jupiter',
    };
  }

  return { usd: FALLBACK_USD_PER_TOKEN[coinId], source: 'fallback' };
}

export async function estimateCashoutUsd(
  coinId: FamCoinId,
  tokenAmount: number,
): Promise<{ usd: number; unitPrice: number; source: string }> {
  const { usd: unitPrice, source } = await getTokenUsdPrice(coinId);
  const usd = Math.max(0, tokenAmount) * unitPrice;
  return { usd, unitPrice, source };
}

export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0';
  if (n > 0 && n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
