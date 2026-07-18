import type { CharacterAbility } from '@/lib/characters';
import type { Enemy } from '@/lib/enemies';
import type { DepthsRoomKind } from '@/lib/depths/rooms';

/**
 * Depths combat — tuned ~halfway between original easy spam and the prior hard pass.
 * Still needs kit variety; not a one-button steamroll.
 */
export const DEPTHS_PLAYER_DMG_MULT = 0.74;
export const DEPTHS_COUNTER_MULT = 1.18;
export const DEPTHS_CRIT_MULT = 1.85;

const ROOM_HP_MULT: Record<DepthsRoomKind, number> = {
  fight: 1.25,
  elite: 1.42,
  boss: 1.65,
  event: 1,
  rest: 1,
};

const ROOM_COUNTER_MULT: Record<DepthsRoomKind, number> = {
  fight: 1.08,
  elite: 1.15,
  boss: 1.22,
  event: 1,
  rest: 1,
};

/** Scale a rival for the Depths chamber. */
export function scaleDepthsEnemy(enemy: Enemy, roomKind: DepthsRoomKind): Enemy {
  const hpMult = ROOM_HP_MULT[roomKind] ?? 1.25;
  const dmgMult = ROOM_COUNTER_MULT[roomKind] ?? 1.08;
  return {
    ...enemy,
    hp: Math.round(enemy.hp * hpMult),
    counterDmg: Math.max(6, Math.round(enemy.counterDmg * dmgMult)),
  };
}

export function scaleDepthsPlayerDamage(base: number): number {
  return Math.max(1, Math.round(base * DEPTHS_PLAYER_DMG_MULT));
}

export function scaleDepthsCounter(base: number): number {
  return Math.max(1, Math.round(base * DEPTHS_COUNTER_MULT));
}

/**
 * Light cooldowns on true signature moves only — not every strong attack.
 */
export function depthsAbilityCooldownTurns(ability: CharacterAbility): number {
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
