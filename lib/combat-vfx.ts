/** CSS motion class per player ability for varied attack feel. */
export function getAbilityMotionClass(abilityId: string): string {
  switch (abilityId) {
    case 'sonic-boom':
      return 'motion-sonic';
    case 'send-it':
      return 'motion-send';
    case 'chaos-bonk':
      return 'motion-chaos';
    case 'read-the-room':
      return 'motion-read';
    case 'diamond-hands':
      return 'motion-shield';
    default:
      return 'motion-bonk';
  }
}

export function getEnemyMotionClass(enemyId: string): string {
  switch (enemyId) {
    case 'fudder':
      return 'motion-fud';
    case 'leverage':
      return 'motion-liquidate';
    case 'scammer':
      return 'motion-rug';
    default:
      return 'motion-degen';
  }
}