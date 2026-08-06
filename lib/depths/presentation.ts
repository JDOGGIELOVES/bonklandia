import type { CharacterAbility } from '@/lib/characters';
import type { DepthsRoomKind } from '@/lib/depths/rooms';

/** Visual role for ability buttons (color + compact UI). */
export type AbilityRole = 'damage' | 'block' | 'heal' | 'special';

export function abilityRole(ab: CharacterAbility): AbilityRole {
  if (ab.blockNextHit && ab.dmg <= 45) return 'block';
  if (ab.healHp && ab.healHp >= 20 && ab.dmg <= 45) return 'heal';
  if (
    ab.id === 'sonic-boom' ||
    ab.id === 'chaos-bonk' ||
    ab.id === 'send-it' ||
    ab.id === 'ground-pound' ||
    ab.dmg >= 70
  ) {
    return 'special';
  }
  if (ab.healHp && ab.healHp > 0) return 'heal';
  if (ab.blockNextHit) return 'block';
  return 'damage';
}

export function abilityRoleLabel(role: AbilityRole): string {
  switch (role) {
    case 'block':
      return 'Guard';
    case 'heal':
      return 'Heal';
    case 'special':
      return 'Signature';
    default:
      return 'Strike';
  }
}

/** Map node icon + accent for chamber path UI. */
export function roomKindMeta(kind: DepthsRoomKind): {
  icon: string;
  label: string;
  className: string;
} {
  switch (kind) {
    case 'fight':
      return { icon: '⚔', label: 'Fight', className: 'depths-kind-fight' };
    case 'elite':
      return { icon: '★', label: 'Elite', className: 'depths-kind-elite' };
    case 'event':
      return { icon: '◈', label: 'Event', className: 'depths-kind-event' };
    case 'rest':
      return { icon: '⛺', label: 'Rest', className: 'depths-kind-rest' };
    case 'boss':
      return { icon: '👑', label: 'Boss', className: 'depths-kind-boss' };
    default:
      return { icon: '·', label: kind, className: '' };
  }
}

export function roomThreatLine(kind: DepthsRoomKind): string {
  switch (kind) {
    case 'fight':
      return 'Standard rival · free Bandit pull(s) on win';
    case 'elite':
      return 'Elite · harder counter · bigger free Bandit pull';
    case 'boss':
      return 'Boss · heavy · floor clear victory spins after';
    case 'event':
      return 'Choice chamber · risk & reward';
    case 'rest':
      return 'Camp · recover before the deep';
    default:
      return '';
  }
}
