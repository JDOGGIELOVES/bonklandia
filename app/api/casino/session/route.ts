import { NextResponse } from 'next/server';
import type { Difficulty } from '@/lib/characters';
import { createCasinoSession } from '@/lib/security/casino-session';
import { blockIfEmergencyStopped } from '@/lib/security/emergency';
import { consumeCasinoNonce } from '@/lib/security/nonce-store';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import type { CasinoOutcome } from '@/lib/slot-machine';

const VALID_OUTCOMES: CasinoOutcome[] = ['victory', 'defeat'];
const VALID_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export async function POST(request: Request) {
  const stopped = blockIfEmergencyStopped();
  if (stopped) return stopped;

  const ip = getClientIp(request);
  const limited = checkRateLimit(`session:${ip}`, 25, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: limited.error }, { status: 429 });
  }

  let body: {
    nonce?: string;
    outcome?: CasinoOutcome;
    paytableWave?: number;
    difficulty?: Difficulty;
    chipMultiplier?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const nonce = body.nonce?.trim();
  if (!nonce) {
    return NextResponse.json({ error: 'Nonce required.' }, { status: 400 });
  }

  const consumed = consumeCasinoNonce(nonce);
  if (!consumed.ok) {
    return NextResponse.json({ error: consumed.error }, { status: 400 });
  }

  const outcome = body.outcome;
  const difficulty = body.difficulty;
  const paytableWave = Math.floor(Number(body.paytableWave));
  const chipMultiplier = Number(body.chipMultiplier);

  if (!outcome || !VALID_OUTCOMES.includes(outcome)) {
    return NextResponse.json({ error: 'Invalid outcome.' }, { status: 400 });
  }
  if (!difficulty || !VALID_DIFFICULTIES.includes(difficulty)) {
    return NextResponse.json({ error: 'Invalid difficulty.' }, { status: 400 });
  }
  if (!Number.isFinite(paytableWave) || paytableWave < 1 || paytableWave > 12) {
    return NextResponse.json({ error: 'Invalid paytable wave.' }, { status: 400 });
  }
  if (!Number.isFinite(chipMultiplier) || chipMultiplier < 1 || chipMultiplier > 2) {
    return NextResponse.json({ error: 'Invalid chip multiplier.' }, { status: 400 });
  }

  const { session, settleToken } = createCasinoSession({
    outcome,
    paytableWave,
    difficulty,
    chipMultiplier,
  });

  return NextResponse.json({
    sessionId: session.sessionId,
    settleToken,
    maxWinnings: session.maxWinnings,
    grantedSpins: session.grantedSpins,
    expiresAt: session.expiresAt,
  });
}