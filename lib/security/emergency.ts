import { NextResponse } from 'next/server';

/**
 * Emergency kill switch — set any of these env vars to true/1/yes/on to stop
 * all money and game APIs (cashier, casino, claims, paid spins).
 *
 *   EMERGENCY_STOP=true
 *   BONGA_EMERGENCY_STOP=true
 *   KILL_SWITCH=true
 *
 * Flip in Vercel → Redeploy (or restart) to take effect.
 * Unset / set to false to restore service.
 */
const EMERGENCY_ENV_KEYS = [
  'EMERGENCY_STOP',
  'BONGA_EMERGENCY_STOP',
  'KILL_SWITCH',
] as const;

function parseTruthy(value: string | undefined): boolean {
  if (value == null) return false;
  const v = value.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

export function isEmergencyStopActive(): boolean {
  for (const key of EMERGENCY_ENV_KEYS) {
    if (parseTruthy(process.env[key])) return true;
  }
  return false;
}

/** Which env key tripped the switch (for diagnostics; never secrets). */
export function emergencyStopEnvKey(): string | null {
  for (const key of EMERGENCY_ENV_KEYS) {
    if (parseTruthy(process.env[key])) return key;
  }
  return null;
}

export function emergencyStopMessage(): string {
  return (
    process.env.EMERGENCY_STOP_MESSAGE?.trim() ||
    'Emergency stop is active. All cashier, casino, and claim operations are offline.'
  );
}

/** 503 response for API routes when the kill switch is on. */
export function emergencyStopResponse(): NextResponse {
  return NextResponse.json(
    {
      error: emergencyStopMessage(),
      code: 'EMERGENCY_STOP',
      emergencyStop: true,
      envKey: emergencyStopEnvKey(),
    },
    { status: 503 },
  );
}

/** Returns a 503 NextResponse if stopped, otherwise null (continue). */
export function blockIfEmergencyStopped(): NextResponse | null {
  if (!isEmergencyStopActive()) return null;
  return emergencyStopResponse();
}
