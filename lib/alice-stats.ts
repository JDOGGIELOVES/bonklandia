/**
 * Device-local Alice run memory — retention without accounts.
 */

import { BRAND } from '@/lib/brand';

export const ALICE_STATS_KEY = `${BRAND.storagePrefix}-alice-stats-v1`;

export type AliceLocalStats = {
  bestAliceCoins: number;
  bestSpendable: number;
  bestLayers: number;
  lastBankedSpendable: number;
  lastBankedAliceCoins: number;
  lastLayers: number;
  lastRunAt: string | null;
  runsCompleted: number;
  divesStarted: number;
};

const EMPTY: AliceLocalStats = {
  bestAliceCoins: 0,
  bestSpendable: 0,
  bestLayers: 0,
  lastBankedSpendable: 0,
  lastBankedAliceCoins: 0,
  lastLayers: 0,
  lastRunAt: null,
  runsCompleted: 0,
  divesStarted: 0,
};

export function loadAliceStats(): AliceLocalStats {
  if (typeof window === 'undefined') return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(ALICE_STATS_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<AliceLocalStats>;
    return {
      bestAliceCoins: Math.max(0, Math.floor(Number(parsed.bestAliceCoins) || 0)),
      bestSpendable: Math.max(0, Math.floor(Number(parsed.bestSpendable) || 0)),
      bestLayers: Math.max(0, Math.min(10, Math.floor(Number(parsed.bestLayers) || 0))),
      lastBankedSpendable: Math.max(0, Math.floor(Number(parsed.lastBankedSpendable) || 0)),
      lastBankedAliceCoins: Math.max(0, Math.floor(Number(parsed.lastBankedAliceCoins) || 0)),
      lastLayers: Math.max(0, Math.min(10, Math.floor(Number(parsed.lastLayers) || 0))),
      lastRunAt: typeof parsed.lastRunAt === 'string' ? parsed.lastRunAt : null,
      runsCompleted: Math.max(0, Math.floor(Number(parsed.runsCompleted) || 0)),
      divesStarted: Math.max(0, Math.floor(Number(parsed.divesStarted) || 0)),
    };
  } catch {
    return { ...EMPTY };
  }
}

function saveAliceStats(stats: AliceLocalStats): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ALICE_STATS_KEY, JSON.stringify(stats));
  } catch {
    /* private mode */
  }
}

export function noteAliceDiveStarted(): AliceLocalStats {
  const cur = loadAliceStats();
  const next = { ...cur, divesStarted: cur.divesStarted + 1 };
  saveAliceStats(next);
  return next;
}

/** Voyage finished (victory or trip-kill) — updates bests once per run. */
export function noteAliceVoyageEnd(opts: {
  aliceCoins: number;
  layersCleared: number;
}): AliceLocalStats {
  const cur = loadAliceStats();
  const layers = Math.max(0, Math.min(10, Math.floor(opts.layersCleared)));
  const ac = Math.max(0, Math.floor(opts.aliceCoins));
  const next: AliceLocalStats = {
    ...cur,
    bestAliceCoins: Math.max(cur.bestAliceCoins, ac),
    bestLayers: Math.max(cur.bestLayers, layers),
    lastLayers: layers,
    lastRunAt: new Date().toISOString(),
    runsCompleted: cur.runsCompleted + 1,
  };
  saveAliceStats(next);
  return next;
}

/** After successful bank — spendable chips recorded. */
export function noteAliceBanked(opts: {
  aliceCoins: number;
  spendable: number;
}): AliceLocalStats {
  const cur = loadAliceStats();
  const ac = Math.max(0, Math.floor(opts.aliceCoins));
  const spend = Math.max(0, Math.floor(opts.spendable));
  const next: AliceLocalStats = {
    ...cur,
    bestAliceCoins: Math.max(cur.bestAliceCoins, ac),
    bestSpendable: Math.max(cur.bestSpendable, spend),
    lastBankedSpendable: spend,
    lastBankedAliceCoins: ac,
    lastRunAt: new Date().toISOString(),
  };
  saveAliceStats(next);
  return next;
}
