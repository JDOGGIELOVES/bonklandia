import type { CharacterAbility, Difficulty } from '@/lib/characters';
import type { Enemy } from '@/lib/enemies';
import type { DepthsRoomKind } from '@/lib/depths/rooms';

/**
 * Depths combat — easy mode must be clearable with Bonnie (healer, lower DPS).
 * Medium / hard keep more teeth on elites and bosses.
 */

/** Global player damage before difficulty. */
export const DEPTHS_PLAYER_DMG_MULT = 0.95;
/** Global enemy counter after defense before difficulty. */
export const DEPTHS_COUNTER_MULT = 0.92;
export const DEPTHS_CRIT_MULT = 1.9;

const ROOM_HP_MULT: Record<DepthsRoomKind, number> = {
  fight: 1.05,
  elite: 1.18,
  boss: 1.28,
  event: 1,
  rest: 1,
};

const ROOM_COUNTER_MULT: Record<DepthsRoomKind, number> = {
  fight: 0.95,
  elite: 1.02,
  boss: 1.08,
  event: 1,
  rest: 1,
};

/** Easy champions hit harder / take less; hard mode is the real test. */
const DIFF_PLAYER_DMG: Record<Difficulty, number> = {
  easy: 1.12,
  medium: 1,
  hard: 0.9,
};

const DIFF_COUNTER: Record<Difficulty, number> = {
  easy: 0.78,
  medium: 0.95,
  hard: 1.12,
};

const DIFF_ENEMY_HP: Record<Difficulty, number> = {
  easy: 0.82,
  medium: 0.95,
  hard: 1.08,
};

/** Scale a rival for the Depths chamber (room kind + champion difficulty). */
export function scaleDepthsEnemy(
  enemy: Enemy,
  roomKind: DepthsRoomKind,
  difficulty: Difficulty = 'medium',
): Enemy {
  const hpMult = (ROOM_HP_MULT[roomKind] ?? 1.05) * DIFF_ENEMY_HP[difficulty];
  const dmgMult = (ROOM_COUNTER_MULT[roomKind] ?? 0.95) * DIFF_COUNTER[difficulty];
  return {
    ...enemy,
    hp: Math.max(40, Math.round(enemy.hp * hpMult)),
    counterDmg: Math.max(4, Math.round(enemy.counterDmg * dmgMult)),
  };
}

export function scaleDepthsPlayerDamage(
  base: number,
  difficulty: Difficulty = 'medium',
): number {
  return Math.max(
    1,
    Math.round(base * DEPTHS_PLAYER_DMG_MULT * DIFF_PLAYER_DMG[difficulty]),
  );
}

export function scaleDepthsCounter(
  base: number,
  difficulty: Difficulty = 'medium',
): number {
  return Math.max(1, Math.round(base * DEPTHS_COUNTER_MULT * DIFF_COUNTER[difficulty]));
}

/**
 * Light cooldowns on true signature moves only — not every strong attack.
 * Easy mode: no ability cooldowns (Bonnie / Beng should feel forgiving).
 */
export function depthsAbilityCooldownTurns(
  ability: CharacterAbility,
  difficulty: Difficulty = 'medium',
): number {
  if (difficulty === 'easy') return 0;

  if (
    ability.id === 'chaos-bonk' ||
    ability.id === 'send-it' ||
    ability.id === 'sonic-boom' ||
    ability.id === 'ground-pound'
  ) {
    return 1;
  }
  if (ability.dmg >= 70) {
    return 1;
  }
  return 0;
}

/** Rest camp heal fraction of max HP. */
export function depthsRestHealFraction(difficulty: Difficulty): number {
  switch (difficulty) {
    case 'easy':
      return 0.55;
    case 'hard':
      return 0.3;
    default:
      return 0.4;
  }
}

export function tickCooldowns(cds: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [id, turns] of Object.entries(cds)) {
    if (turns > 1) next[id] = turns - 1;
  }
  return next;
}

export function isAbilityOnCooldown(cds: Record<string, number>, abilityId: string): boolean {
  return (cds[abilityId] ?? 0) > 0;
}
