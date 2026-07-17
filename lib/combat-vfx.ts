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
    case 'dooge':
      return 'motion-fud';
    case 'leverage':
    case 'flokir':
      return 'motion-liquidate';
    case 'scammer':
    case 'giga-shiba':
    case 'hatdog':
      return 'motion-rug';
    case 'popcatto':
    case 'copycat-council':
    case 'mewling':
      return 'motion-chaos';
    case 'pepe-unbothered':
    case 'mogger':
    case 'based-brett':
      return 'motion-read';
    default:
      return 'motion-degen';
  }
}