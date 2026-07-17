/** Bump when enemy portraits in public/assets/enemies/ are replaced */
export const ENEMY_ASSET_VERSION = '20260717r';

export function enemyImage(file: string): string {
  return `/assets/enemies/${file}?v=${ENEMY_ASSET_VERSION}`;
}

export type Enemy = {
  id: string;
  name: string;
  title: string;
  hp: number;
  img: string;
  taunt: string;
  hitReaction: string[];
  defeatLine: string;
  counterAttack: string;
  counterDmg: number;
};

export const DEGEN_ENEMIES: Enemy[] = [
  {
    id: 'fudder',
    name: 'Captain Fudder',
    title: 'Spreads FUD at 3am',
    hp: 280,
    img: enemyImage('fudder.svg'),
    taunt: '"Guys it\'s literally going to zero. I read it on Discord."',
    hitReaction: [
      'Captain Fudder drops his "IT\'S A SCAM" sign!',
      'Fudder screams "RUG INCOMING" for no reason!',
      'He hides behind a fake audit PDF!',
    ],
    defeatLine: 'Captain Fudder logs off in shame. WAGMI.',
    counterAttack: 'Fudder spam-posts FUD in general chat',
    counterDmg: 12,
  },
  {
    id: 'jeeter',
    name: 'Sir Jeets-A-Lot',
    title: 'Sells the bottom every time',
    hp: 240,
    img: enemyImage('jeeter.svg'),
    taunt: '"I\'m just taking profits bro" *sells at -40%*',
    hitReaction: [
      'Sir Jeets-A-Lot panic-sells his lunch money!',
      'He trips over his own stop-loss!',
      'Paper hands flapping at maximum velocity!',
    ],
    defeatLine: 'Sir Jeets-A-Lot jeeted himself out of existence.',
    counterAttack: 'Jeeter dumps 3 tokens and blames the devs',
    counterDmg: 18,
  },
  {
    id: 'non-believer',
    name: 'Karen the Non-Believer',
    title: 'Still waiting for BTC to die',
    hp: 300,
    img: enemyImage('non-believer.svg'),
    taunt: '"Crypto is a ponzi. My cousin\'s friend lost everything."',
    hitReaction: [
      'Karen adjusts her "I told you so" glasses!',
      'She waves a 2018 Forbes article!',
      'Non-Believer energy weakens slightly!',
    ],
    defeatLine: 'Karen blocks the whole Fam on Facebook.',
    counterAttack: 'Karen sends a 47-paragraph skeptic essay',
    counterDmg: 15,
  },
  {
    id: 'scammer',
    name: 'Ruggy McPull',
    title: 'Your funds are now his funds',
    hp: 350,
    img: enemyImage('scammer.svg'),
    taunt: '"Trust me bro, liquidity is locked forever* (*not locked)"',
    hitReaction: [
      'Ruggy\'s fake Rolex falls off!',
      'His "verified" checkmark was drawn in crayon!',
      'He tries to refund you in exposure!',
    ],
    defeatLine: 'Ruggy McPull got rugged by the Bonk Fam.',
    counterAttack: 'Scammer launches Fake Airdrop Phishing Attack',
    counterDmg: 22,
  },
  {
    id: 'paper-hands',
    name: 'Paper Hands Pete',
    title: 'Holds for 4 minutes max',
    hp: 200,
    img: enemyImage('paper-hands.svg'),
    taunt: '"Chart dipped 0.3%, I\'m out, I\'m OUT!"',
    hitReaction: [
      'Paper Hands Pete\'s hands literally dissolve!',
      'He folds into a origami crane of regret!',
      'Pete refreshes DexScreener 900 times!',
    ],
    defeatLine: 'Paper Hands Pete folded harder than a lawn chair.',
    counterAttack: 'Pete spreads panic in the Telegram',
    counterDmg: 14,
  },
  {
    id: 'ngmi',
    name: 'NGMI Nigel',
    title: 'Professional vibe killer',
    hp: 260,
    img: enemyImage('ngmi.svg'),
    taunt: '"We\'re all gonna make it? Nah. I make spreadsheets."',
    hitReaction: [
      'Nigel\'s Excel chart crashes!',
      'His "real job" badge falls off!',
      'NGMI energy backfires on himself!',
    ],
    defeatLine: 'NGMI Nigel updated his LinkedIn to "Former Crypto Skeptic".',
    counterAttack: 'Nigel posts a doom thread with 12 ratio\'d replies',
    counterDmg: 16,
  },
  {
    id: 'boomer',
    name: 'Grandpa Boomer',
    title: 'Still bragging about his 0.5% savings account',
    hp: 310,
    img: enemyImage('boomer.svg'),
    taunt: '"Back in my day we had pensions. This internet money is Monopoly cash."',
    hitReaction: [
      'Grandpa Boomer drops his 2013 "Bitcoin is Dead" newspaper!',
      'He waves his passbook savings like a weapon!',
      'Boomer mumbles about buying a house for $12!',
    ],
    defeatLine: 'Grandpa Boomer went back to watching cable news.',
    counterAttack: 'Boomer lectures the Fam for 20 minutes about "real jobs"',
    counterDmg: 13,
  },
  {
    id: 'shill',
    name: 'Shilliam Shillson',
    title: 'Paid promotion disguised as alpha',
    hp: 270,
    img: enemyImage('shill.svg'),
    taunt: '"This gem is gonna 1000x! *not financial advice* (it is)"',
    hitReaction: [
      'Shilliam\'s fake laser eyes fall off!',
      'His rented Lambo backdrop collapses!',
      'The #AD hashtag was there the whole time!',
    ],
    defeatLine: 'Shilliam Shillson got ratio\'d into oblivion.',
    counterAttack: 'Shill drops a sponsored FUD thread',
    counterDmg: 17,
  },
  {
    id: 'astrologer',
    name: 'Crystal Charta',
    title: 'Technical analysis via horoscope',
    hp: 290,
    img: enemyImage('astrologer.svg'),
    taunt: '"Mercury is in retrograde. The chart says dump. Trust the stars."',
    hitReaction: [
      'Crystal Charta\'s crystal ball shows a red candle!',
      'Her zodiac prediction was wrong again!',
      'The tarot cards scatter everywhere!',
    ],
    defeatLine: 'Crystal Charta blamed Saturn and logged off.',
    counterAttack: 'Charta predicts a bear market based on moon phase',
    counterDmg: 15,
  },
  {
    id: 'copium',
    name: 'Copium Carl',
    title: 'Mainlines hopium derivatives',
    hp: 230,
    img: enemyImage('copium.svg'),
    taunt: '"It\'s just a healthy correction. Recovery any day now. Any day..."',
    hitReaction: [
      'Carl\'s copium tank springs a leak!',
      'He inhales even harder. It doesn\'t help!',
      'His "recovery soon" chart ages another year!',
    ],
    defeatLine: 'Copium Carl ran out of copium and hope.',
    counterAttack: 'Carl posts "we\'re still early" for the 400th time',
    counterDmg: 11,
  },
  {
    id: 'leverage',
    name: 'Leverage Lenny',
    title: '100x or homeless',
    hp: 320,
    img: enemyImage('leverage.svg'),
    taunt: '"I only need a 1% move. What could go wrong with 100x?"',
    hitReaction: [
      'Leverage Lenny gets liquidated mid-sentence!',
      'His 100x badge explodes!',
      'Margin call from $4.20 destroys him!',
    ],
    defeatLine: 'Leverage Lenny got rekt by a 0.1% wick.',
    counterAttack: 'Lenny rage-quits and FUDs leverage on CT',
    counterDmg: 20,
  },
  {
    id: 'airdrop',
    name: 'Airdrop Andy',
    title: '47 wallets, zero loyalty',
    hp: 250,
    img: enemyImage('airdrop.svg'),
    taunt: '"I\'m not a sybil, these are all my cousins. Free money!"',
    hitReaction: [
      'Airdrop Andy\'s 47 wallets get flagged!',
      'He drops W4 and pretends it\'s not his!',
      'The free airdrop was worth $0.003!',
    ],
    defeatLine: 'Airdrop Andy farmed himself into irrelevance.',
    counterAttack: 'Andy dumps his airdrop on the Fam instantly',
    counterDmg: 19,
  },
];

/** Per-run scaling applied when you clear all 12 waves and Run It Back. */
export const RUN_DIFFICULTY_SCALE = {
  hpPerRun: 0.15,
  counterDmgPerRun: 0.12,
} as const;

export type RunScalingInfo = {
  run: number;
  hpBonusPercent: number;
  counterBonusPercent: number;
};

export function getRunScalingInfo(run: number): RunScalingInfo | null {
  if (run <= 1) return null;
  return {
    run,
    hpBonusPercent: Math.round((run - 1) * RUN_DIFFICULTY_SCALE.hpPerRun * 100),
    counterBonusPercent: Math.round((run - 1) * RUN_DIFFICULTY_SCALE.counterDmgPerRun * 100),
  };
}

export function scaleEnemyForRun(template: Enemy, run: number): Enemy {
  if (run <= 1) return { ...template };

  const hpMult = 1 + (run - 1) * RUN_DIFFICULTY_SCALE.hpPerRun;
  const dmgMult = 1 + (run - 1) * RUN_DIFFICULTY_SCALE.counterDmgPerRun;

  return {
    ...template,
    hp: Math.round(template.hp * hpMult),
    counterDmg: Math.max(1, Math.round(template.counterDmg * dmgMult)),
  };
}

export function pickRandomEnemy(run = 1): Enemy {
  const template = DEGEN_ENEMIES[Math.floor(Math.random() * DEGEN_ENEMIES.length)];
  return scaleEnemyForRun(template, run);
}

export function pickEnemyByWave(wave: number, run = 1): Enemy {
  const template = DEGEN_ENEMIES[(wave - 1) % DEGEN_ENEMIES.length];
  return scaleEnemyForRun(template, run);
}

const ENEMY_ATTACK_SHOUTS: Record<string, string> = {
  fudder: 'FUD!',
  jeeter: 'JEET!',
  'non-believer': 'PONZI!',
  scammer: 'RUG!',
  'paper-hands': 'PANIC!',
  ngmi: 'NGMI!',
  boomer: 'BOOMER!',
  shill: 'SHILL!',
  astrologer: 'DUMP!',
  copium: 'COPE!',
  leverage: 'REKT!',
  airdrop: 'DUMP!',
  // Rival meme legion (Depths)
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

export function getEnemyAttackShout(enemy: Enemy): string {
  return ENEMY_ATTACK_SHOUTS[enemy.id] ?? 'COPE!';
}