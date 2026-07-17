import { getMaxJackpot, type CasinoSession } from '@/lib/slot-machine';

export type CasinoSecureSession = {
  sessionId: string;
  settleToken: string;
  maxWinnings: number;
  localOnly?: boolean;
};

export function buildLocalSecureSession(session: CasinoSession): CasinoSecureSession {
  const maxJackpot = getMaxJackpot(session.paytableWave, session.chipMultiplier);
  return {
    sessionId: `local-${Date.now()}`,
    settleToken: 'local',
    maxWinnings: Math.ceil(maxJackpot * 8) * session.spins,
    localOnly: true,
  };
}

export async function fetchServerCasinoSession(
  session: CasinoSession,
  timeoutMs = 4000,
): Promise<CasinoSecureSession | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('/api/casino/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outcome: session.outcome,
        paytableWave: session.paytableWave,
        difficulty: session.difficulty,
        chipMultiplier: session.chipMultiplier,
      }),
      signal: controller.signal,
    });

    const data = await res.json() as {
      sessionId?: string;
      settleToken?: string;
      maxWinnings?: number;
    };

    if (!res.ok || !data.sessionId || !data.settleToken) return null;

    return {
      sessionId: data.sessionId,
      settleToken: data.settleToken,
      maxWinnings: data.maxWinnings ?? 0,
      localOnly: false,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}