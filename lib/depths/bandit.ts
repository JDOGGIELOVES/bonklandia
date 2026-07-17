import type { Difficulty } from '@/lib/characters';
import type { DepthsRoomKind } from '@/lib/depths/rooms';
import {
  TOTAL_WAVES,
  VICTORY_CHIP_MULTIPLIER,
  buildCasinoSession,
  getCasinoTier,
  getVictorySpins,
  type CasinoSession,
} from '@/lib/slot-machine';

/** Paytable wave used for room-clear Bandit (higher = better chip lines). */
export function depthsRoomPaytableWave(kind: DepthsRoomKind): number {
  switch (kind) {
    case 'boss':
      return 8;
    case 'elite':
      return 5;
    case 'fight':
    default:
      return 3;
  }
}

/**
 * Room-clear Bandit: no free spins — pull via quarter slots (grows treasury).
 * Player can keep buying quarters or continue the Depths.
 */
export function buildDepthsRoomBanditSession(
  roomKind: DepthsRoomKind,
  difficulty: Difficulty,
): CasinoSession {
  const paytableWave = depthsRoomPaytableWave(roomKind);
  const baseTier = getCasinoTier(paytableWave, 'defeat');

  return {
    outcome: 'defeat',
    spins: 0,
    paytableWave,
    tier: {
      ...baseTier,
      id: `depths-quarter-${roomKind}`,
      name:
        roomKind === 'boss'
          ? 'Depths Boss — Quarter Bandit'
          : roomKind === 'elite'
            ? 'Depths Elite — Quarter Bandit'
            : 'Depths Win — Quarter Bandit',
      jackpotBias: roomKind === 'boss' ? 0.1 : roomKind === 'elite' ? 0.07 : 0.05,
      transitionMs: 600,
      tagline:
        'Chamber cleared. Drop a quarter (25¢ SOL) into the Bonklandia Bandit to pull — treasury grows, you spin. Keep feeding quarters or continue the Depths.',
    },
    chipMultiplier: 1,
    difficulty,
  };
}

/** Floor-clear victory Bandit — free champion pulls + optional more quarters. */
export function buildDepthsClearBanditSession(difficulty: Difficulty): CasinoSession {
  const session = buildCasinoSession('victory', TOTAL_WAVES, difficulty);
  return {
    ...session,
    tier: {
      ...session.tier,
      id: 'depths-victory-hall',
      name: 'Bonklandia Bandit — Depths Clear',
      tagline: `Floor conquered. ${getVictorySpins(difficulty)} free victory pulls at champion rates — then keep spinning quarters if you want.`,
      transitionMs: 1200,
    },
    chipMultiplier: VICTORY_CHIP_MULTIPLIER,
  };
}

/** Defeat consolation in the Depths. */
export function buildDepthsDefeatBanditSession(
  chambersCleared: number,
  difficulty: Difficulty,
): CasinoSession {
  const wave = Math.max(1, Math.min(TOTAL_WAVES, chambersCleared + 1));
  return buildCasinoSession('defeat', wave, difficulty);
}
