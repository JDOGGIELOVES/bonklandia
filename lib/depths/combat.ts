import type { CharacterAbility } from '@/lib/characters';
import type { Enemy } from '@/lib/enemies';
import type { DepthsRoomKind } from '@/lib/depths/rooms';

/** Depths hits harder on the player and softer from spam-heavy abilities. */
export const DEPTHS_PLAYER_DMG_MULT = 0.48;
export const DEPTHS_COUNTER_MULT = 1.4;
export const DEPTHS_CRIT_MULT = 1.65; // was flat 2× in free-for-all spam

const ROOM_HP_MULT: Record<DepthsRoomKind, number> = {
  fight: 1.55,
  elite: 1.9,
  boss: 2.35,
  event: 1,
  rest: 1,
};

const ROOM_COUNTER_MULT: Record<DepthsRoomKind, number> = {
  fight: 1.2,
  elite: 1.35,
  boss: 1.5,
  event: 1,
  rest: 1,
};

/** Scale a rival for the Depths chamber so fights last more than a few blasts. */
export function scaleDepthsEnemy(enemy: Enemy, roomKind: DepthsRoomKind): Enemy {
  const hpMult = ROOM_HP_MULT[roomKind] ?? 1.55;
  const dmgMult = ROOM_COUNTER_MULT[roomKind] ?? 1.2;
  return {
    ...enemy,
    hp: Math.round(enemy.hp * hpMult),
    counterDmg: Math.max(8, Math.round(enemy.counterDmg * dmgMult)),
  };
}

export function scaleDepthsPlayerDamage(base: number): number {
  return Math.max(1, Math.round(base * DEPTHS_PLAYER_DMG_MULT));
}

export function scaleDepthsCounter(base: number): number {
  return Math.max(1, Math.round(base * DEPTHS_COUNTER_MULT));
}

/**
 * Turns you must wait after using this ability before it can be used again.
 * Heavy / signature moves cannot be held-spam.
 */
export function depthsAbilityCooldownTurns(ability: CharacterAbility): number {
  if (
    ability.id === 'chaos-bonk' ||
    ability.id === 'send-it' ||
    ability.id === 'sonic-boom' ||
    ability.id === 'ground-pound'
  ) {
    return 2;
  }
  if (ability.dmg >= 60 || (ability.critChance && ability.critChance >= 0.4)) {
    return 1;
  }
  if (ability.blockNextHit) return 1;
  return 0;
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
