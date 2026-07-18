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

/** Free bonus pulls for winning a chamber (before optional quarter spins). */
export function depthsRoomBonusSpins(kind: DepthsRoomKind): number {
  switch (kind) {
    case 'boss':
      return 2;
    case 'elite':
      return 2;
    case 'fight':
    default:
      return 1;
  }
}

/**
 * Room-clear Bandit: free bonus spin(s) for the win, then optional quarter spins.
 * Uses victory outcome so the cabinet reads as a win reward, not a consolation.
 */
export function buildDepthsRoomBanditSession(
  roomKind: DepthsRoomKind,
  difficulty: Difficulty,
): CasinoSession {
  const paytableWave = depthsRoomPaytableWave(roomKind);
  const freeSpins = depthsRoomBonusSpins(roomKind);
  const baseTier = getCasinoTier(paytableWave, 'victory');
  const chipMult = roomKind === 'boss' ? 1.15 : roomKind === 'elite' ? 1.1 : 1.05;

  return {
    outcome: 'victory',
    spins: freeSpins,
    paytableWave,
    tier: {
      ...baseTier,
      id: `depths-win-${roomKind}`,
      name:
        roomKind === 'boss'
          ? 'Depths Boss Bonus — Bonklandia Bandit'
          : roomKind === 'elite'
            ? 'Depths Elite Bonus — Bonklandia Bandit'
            : 'Depths Win Bonus — Bonklandia Bandit',
      jackpotBias: roomKind === 'boss' ? 0.12 : roomKind === 'elite' ? 0.09 : 0.07,
      transitionMs: 700,
      tagline:
        `Chamber cleared! ${freeSpins} free bonus pull${freeSpins === 1 ? '' : 's'} on the ${'Bonklandia Bandit'}. ` +
        'Yank the lever, then keep spinning with 25¢ quarters if you want — or continue the Depths.',
    },
    chipMultiplier: chipMult,
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
