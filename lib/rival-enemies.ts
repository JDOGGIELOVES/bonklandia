import { enemyImage, scaleEnemyForRun, type Enemy } from '@/lib/enemies';

/**
 * Rival meme-coin legion — parody mascots for Degen Depths.
 * Same comedy format as Gallery degens; separate pool so the valley stays psychology-themed.
 */
export const RIVAL_MEME_ENEMIES: Enemy[] = [
  {
    id: 'dooge',
    name: 'Sir Dooge of Much Wow',
    title: 'Still thinks 2013 is alpha',
    hp: 380,
    img: enemyImage('dooge.svg'),
    taunt: '"Much rival. Very bonk. Such jealousy. Wow."',
    hitReaction: [
      'Sir Dooge drops his ancient "wow" speech bubble!',
      'His 2013 sunglasses crack in half!',
      'Much damage. Very oof. Wow.',
    ],
    defeatLine: 'Sir Dooge went to zero. Still wow.',
    counterAttack: 'Dooge spams much-wow copypasta in the chat',
    counterDmg: 18,
  },
  {
    id: 'pepe-unbothered',
    name: 'Pepé the Unbothered',
    title: 'Feels nothing. Posts anyway.',
    hp: 400,
    img: enemyImage('pepe-unbothered.svg'),
    taunt: '"feels nothing. chart is whatever."',
    hitReaction: [
      'Pepé does not blink. A single sweat drop appears… then leaves.',
      'His expression stays at 0 vibe. Rude.',
      'He shrugs so hard your block feels judged.',
    ],
    defeatLine: 'Pepé is still unbothered. He logs off though.',
    counterAttack: 'Pepé shrugs through your guard with pure apathy',
    counterDmg: 20,
  },
  {
    id: 'hatdog',
    name: 'Wifless Walter',
    title: "Dog with a hat he didn't pay for",
    hp: 360,
    img: enemyImage('hatdog.svg'),
    taunt: '"The hat is the product. The dog is free."',
    hitReaction: [
      'Walter’s hat yeets into the void!',
      'He panic-buys another hat mid-fight!',
      'The merch table collapses behind him!',
    ],
    defeatLine: 'Wifless Walter was only here for the merch.',
    counterAttack: 'Walter flings free-hat coupons at your face',
    counterDmg: 19,
  },
  {
    id: 'flokir',
    name: 'Flokir the Loud',
    title: 'Valhalla or zero',
    hp: 440,
    img: enemyImage('flokir.svg'),
    taunt: '"TO VALHALLA! Or the next candle. Same thing!"',
    hitReaction: [
      'Flokir’s cardboard viking helmet flies off!',
      'His war horn plays the Windows error sound!',
      'He charges… into a support beam!',
    ],
    defeatLine: 'Flokir found Valhalla. It was a stop-loss.',
    counterAttack: 'Flokir overcommits with a full-send charge',
    counterDmg: 28,
  },
  {
    id: 'popcatto',
    name: 'Popcatto Supremo',
    title: 'Only knows one animation',
    hp: 340,
    img: enemyImage('popcatto.svg'),
    taunt: '"POP. POP. POP. That is the whole thesis."',
    hitReaction: [
      'Popcatto’s mouth freezes mid-POP!',
      'The animation desyncs. Chaos.',
      'He pops so hard the UI shakes!',
    ],
    defeatLine: 'Popcatto ran out of frames.',
    counterAttack: 'Popcatto POP-spams the entire arena',
    counterDmg: 17,
  },
  {
    id: 'mewling',
    name: 'Mewling Max',
    title: 'Cat-coin tourist on Solana',
    hp: 350,
    img: enemyImage('mewling.svg'),
    taunt: '"I\'m multi-chain actually. This is just a layover."',
    hitReaction: [
      'Max tries to bridge mid-combo and fails!',
      'His other-chain bag is empty. Awkward.',
      'He hisses something about gas fees!',
    ],
    defeatLine: 'Mewling Max bridged himself out of the fight.',
    counterAttack: 'Max flees to another chain and snipes from afar',
    counterDmg: 21,
  },
  {
    id: 'based-brett',
    name: 'Brett the Based',
    title: 'Says “based” until it isn’t',
    hp: 460,
    img: enemyImage('based-brett.svg'),
    taunt: '"Based. Based. Based. Wait — was that cringe?"',
    hitReaction: [
      'Brett’s based-o-meter dips into cringe!',
      'He high-fives nobody. Nobody high-fives back!',
      'His blue aura flickers like bad Wi‑Fi!',
    ],
    defeatLine: 'Brett admitted one take was mid. Society healed.',
    counterAttack: 'Brett stacks “based” buffs and swings harder',
    counterDmg: 23,
  },
  {
    id: 'mogger',
    name: 'Mogger Mike',
    title: 'Professional aura farmer',
    hp: 400,
    img: enemyImage('mogger.svg'),
    taunt: '"Check the aura. You wouldn’t get it."',
    hitReaction: [
      'Mike’s aura bar drops 40%!',
      'His mirror selfie filter glitches!',
      'Someone unfollowed him mid-fight!',
    ],
    defeatLine: 'Mogger Mike got mogged by the Bonk Fam.',
    counterAttack: 'Mike drains your vibe with an aura check',
    counterDmg: 20,
  },
  {
    id: 'giga-shiba',
    name: 'Giga Shiba Impostor',
    title: 'Claims he invented bonking',
    hp: 580,
    img: enemyImage('giga-shiba.svg'),
    taunt: '"I\'m the original bonker. You\'re just frequency LARPers."',
    hitReaction: [
      'Knockoff gold paint chips off his coat!',
      'His fake First Bonk certificate tears!',
      'The impostor badge starts blinking red!',
    ],
    defeatLine: 'Giga Shiba admits it: your First Bonk was cooler.',
    counterAttack: 'Impostor mocks your conviction and swings harder',
    counterDmg: 32,
  },
  {
    id: 'copycat-council',
    name: 'The Copycat Council',
    title: 'Three mascots. One original idea.',
    hp: 720,
    img: enemyImage('copycat-council.svg'),
    taunt: '"We voted. Your meme is derivative of our derivative."',
    hitReaction: [
      'The dog head argues with the frog head!',
      'The cat head pops out of sync!',
      'Their shared whiteboard says “TODO: originality”!',
    ],
    defeatLine: 'The Copycat Council dissolved into three group chats.',
    counterAttack: 'The Council rotates dog → frog → cat assaults',
    counterDmg: 34,
  },
];

export const DEPTHS_BOSS_ID = 'giga-shiba';
export const DEPTHS_FINAL_BOSS_ID = 'copycat-council';

const RIVAL_BY_ID = Object.fromEntries(RIVAL_MEME_ENEMIES.map(e => [e.id, e])) as Record<
  string,
  Enemy
>;

export function getRivalEnemy(id: string): Enemy | undefined {
  return RIVAL_BY_ID[id];
}

export function pickRandomRival(run = 1): Enemy {
  const regulars = RIVAL_MEME_ENEMIES.filter(
    e => e.id !== DEPTHS_FINAL_BOSS_ID && e.id !== DEPTHS_BOSS_ID,
  );
  const template = regulars[Math.floor(Math.random() * regulars.length)] ?? RIVAL_MEME_ENEMIES[0];
  return scaleEnemyForRun(template, run);
}

export function pickRivalByIndex(index: number, run = 1): Enemy {
  const regulars = RIVAL_MEME_ENEMIES.filter(
    e => e.id !== DEPTHS_FINAL_BOSS_ID && e.id !== DEPTHS_BOSS_ID,
  );
  const template = regulars[index % regulars.length];
  return scaleEnemyForRun(template, run);
}

export function pickDepthsBoss(floor: number, run = 1): Enemy {
  const id = floor >= 2 ? DEPTHS_FINAL_BOSS_ID : DEPTHS_BOSS_ID;
  const template = RIVAL_BY_ID[id] ?? RIVAL_MEME_ENEMIES[RIVAL_MEME_ENEMIES.length - 1];
  return scaleEnemyForRun(template, run);
}

export function isRivalEnemyId(id: string): boolean {
  return id in RIVAL_BY_ID;
}

export const RIVAL_ATTACK_SHOUTS: Record<string, string> = {
  dooge: 'WOW!',
  'pepe-unbothered': 'MEH!',
  hatdog: 'HAT!',
  flokir: 'VALHALLA!',
  popcatto: 'POP!',
  mewling: 'MEW!',
  'based-brett': 'BASED!',
  mogger: 'AURA!',
  'giga-shiba': 'FAKE!',
  'copycat-council': 'COPY!',
};

export const DEPTHS_LORE = {
  title: 'Degen Depths',
  subtitle: 'Where copycat mascots hoard stolen frequency',
  intro:
    'Under Degen Valley, rival meme cultures dig for the roots of the First Bonk. Chart the Depths, bonk the copycats, and reclaim the frequency before they rebrand it.',
  banditHook:
    'Every chamber win opens the Bonklandia Bandit — drop a quarter (25¢ SOL) to pull the lever and grow the Bonga treasury. Clear the floor for free champion spins.',
};
