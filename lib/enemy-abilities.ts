import type { Enemy } from '@/lib/enemies';

export type EnemyAbilityContext = {
  playerHP: number;
  playerMaxHP: number;
  enemyHP: number;
  enemyMaxHP: number;
  blockActive: boolean;
};

export type EnemyAbilityResult = {
  name: string;
  flavor: string;
  counterMult: number;
  flatBonusDamage: number;
  vibeDrain: number;
  enemyHealPercent: number;
  ignoreBlock: boolean;
};

const DEFAULT_ABILITY: EnemyAbilityResult = {
  name: 'Standard Cope',
  flavor: '',
  counterMult: 1,
  flatBonusDamage: 0,
  vibeDrain: 0,
  enemyHealPercent: 0,
  ignoreBlock: false,
};

const ENEMY_ABILITIES: Record<string, (ctx: EnemyAbilityContext) => EnemyAbilityResult> = {
  fudder: () => ({
    name: 'FUD Barrage',
    flavor: 'Captain Fudder screams FUD — your vibe plummets!',
    counterMult: 1,
    flatBonusDamage: 0,
    vibeDrain: 12,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),
  jeeter: ctx => ({
    name: 'Panic Sell',
    flavor: ctx.playerHP < ctx.playerMaxHP * 0.35
      ? 'Sir Jeets-A-Lot smells blood — paper hands crit!'
      : 'Sir Jeets-A-Lot flinches and sells early.',
    counterMult: ctx.playerHP < ctx.playerMaxHP * 0.35 ? 1.45 : 1,
    flatBonusDamage: 0,
    vibeDrain: 0,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),
  scammer: () => ({
    name: 'Rug Pull',
    flavor: 'The Scammer bypasses your block with a fake audit!',
    counterMult: 1.1,
    flatBonusDamage: 0,
    vibeDrain: 0,
    enemyHealPercent: 0,
    ignoreBlock: true,
  }),
  'paper-hands': () => ({
    name: 'Trembling Hands',
    flavor: 'Paper Hands shakes — weak hit but steals your confidence.',
    counterMult: 0.85,
    flatBonusDamage: 0,
    vibeDrain: 8,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),
  ngmi: () => ({
    name: 'Doom Spiral',
    flavor: 'NGMI Ned drags you into the spiral. Extra counter damage!',
    counterMult: 1.3,
    flatBonusDamage: 0,
    vibeDrain: 5,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),
  leverage: () => ({
    name: 'Liquidation',
    flavor: 'Leverage Larry liquidates the whole chart!',
    counterMult: 1.5,
    flatBonusDamage: 5,
    vibeDrain: 0,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),
  copium: ctx => ({
    name: 'Cope Tank',
    flavor: 'Max Cope inhales hopium and patches his Cope HP!',
    counterMult: 1,
    flatBonusDamage: 0,
    vibeDrain: 0,
    enemyHealPercent: ctx.enemyHP < ctx.enemyMaxHP * 0.4 ? 0.08 : 0,
    ignoreBlock: false,
  }),
  shill: () => ({
    name: 'Shill Storm',
    flavor: 'Shillzilla floods the feed — counters hit twice as loud!',
    counterMult: 1.2,
    flatBonusDamage: 3,
    vibeDrain: 0,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),
  astrologer: () => ({
    name: 'Mercury Retrograde',
    flavor: 'Retrograde Rick blames the stars — random extra sting!',
    counterMult: 1,
    flatBonusDamage: Math.floor(Math.random() * 12) + 4,
    vibeDrain: 0,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),
  boomer: () => ({
    name: 'Boomer Lecture',
    flavor: 'Boomer Bob lectures you into submission. Slow but heavy.',
    counterMult: 1.15,
    flatBonusDamage: 0,
    vibeDrain: 10,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),
  'non-believer': () => ({
    name: 'Karen Complaint',
    flavor: 'Karen files a complaint with the SEC of your soul.',
    counterMult: 1.1,
    flatBonusDamage: 0,
    vibeDrain: 15,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),
  airdrop: () => ({
    name: 'Dust Dump',
    flavor: 'Airdrop Andy dumps worthless tokens on your head!',
    counterMult: 1,
    flatBonusDamage: 8,
    vibeDrain: 6,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),

  // ── Rival meme legion (Degen Depths) ──
  dooge: () => ({
    name: 'Much Copypasta',
    flavor: 'Sir Dooge floods the log with wow — your vibe melts!',
    counterMult: 0.9,
    flatBonusDamage: 0,
    vibeDrain: 14,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),
  'pepe-unbothered': () => ({
    name: 'Feels Nothing',
    flavor: 'Pepé shrugs through reality. Block? Never heard of her.',
    counterMult: 1.05,
    flatBonusDamage: 0,
    vibeDrain: 4,
    enemyHealPercent: 0,
    ignoreBlock: Math.random() < 0.45,
  }),
  hatdog: ctx => ({
    name: ctx.enemyHP > ctx.enemyMaxHP * 0.85 ? 'Hat Barrier' : 'Merch Fling',
    flavor:
      ctx.enemyHP > ctx.enemyMaxHP * 0.85
        ? "Walter's first hat absorbs the vibe — weak counter!"
        : 'Hatless Walter yeets coupons. They somehow hurt.',
    counterMult: ctx.enemyHP > ctx.enemyMaxHP * 0.85 ? 0.7 : 1.25,
    flatBonusDamage: 0,
    vibeDrain: 3,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),
  flokir: () => ({
    name: 'Valhalla Charge',
    flavor: 'Flokir full-sends into Valhalla (and your HP bar)!',
    counterMult: 1.45,
    flatBonusDamage: 4,
    vibeDrain: 0,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),
  popcatto: () => ({
    name: 'POP Spam',
    flavor: 'Popcatto POP POP POPs — small hits, maximum annoyance!',
    counterMult: 1,
    flatBonusDamage: 6 + Math.floor(Math.random() * 8),
    vibeDrain: 5,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),
  mewling: () => ({
    name: 'Cross-Chain Snipe',
    flavor: 'Mewling Max attacks from a chain that doesn’t exist here!',
    counterMult: 1.15,
    flatBonusDamage: 5,
    vibeDrain: 8,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),
  'based-brett': ctx => ({
    name: 'Based Stack',
    flavor:
      ctx.enemyHP < ctx.enemyMaxHP * 0.5
        ? 'Brett screams BASED until the mult goes silly!'
        : 'Brett tags the hit “based.” Mid, but it still lands.',
    counterMult: ctx.enemyHP < ctx.enemyMaxHP * 0.5 ? 1.4 : 1.15,
    flatBonusDamage: 0,
    vibeDrain: 0,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),
  mogger: () => ({
    name: 'Aura Check',
    flavor: 'Mogger Mike audits your aura. Vibe confiscated.',
    counterMult: 1.1,
    flatBonusDamage: 0,
    vibeDrain: 16,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),
  'giga-shiba': ctx => ({
    name: 'Identity Theft',
    flavor:
      ctx.playerHP < ctx.playerMaxHP * 0.4
        ? 'Impostor smells low conviction — heavy fake-bonk!'
        : 'Giga Shiba Impostor swings a counterfeit First Bonk!',
    counterMult: ctx.playerHP < ctx.playerMaxHP * 0.4 ? 1.5 : 1.2,
    flatBonusDamage: 6,
    vibeDrain: 6,
    enemyHealPercent: 0,
    ignoreBlock: false,
  }),
  'copycat-council': () => {
    const phase = Math.floor(Math.random() * 3);
    if (phase === 0) {
      return {
        name: 'Dog Motion',
        flavor: 'Council dog head: much committee, very bite!',
        counterMult: 1.2,
        flatBonusDamage: 4,
        vibeDrain: 8,
        enemyHealPercent: 0,
        ignoreBlock: false,
      };
    }
    if (phase === 1) {
      return {
        name: 'Frog Motion',
        flavor: 'Council frog head shrugs past your block.',
        counterMult: 1.1,
        flatBonusDamage: 2,
        vibeDrain: 4,
        enemyHealPercent: 0,
        ignoreBlock: true,
      };
    }
    return {
      name: 'Cat Motion',
      flavor: 'Council cat head POP-slaps the agenda!',
      counterMult: 1,
      flatBonusDamage: 10,
      vibeDrain: 6,
      enemyHealPercent: 0.04,
      ignoreBlock: false,
    };
  },
};

export function resolveEnemyAbility(enemy: Enemy, ctx: EnemyAbilityContext): EnemyAbilityResult {
  const fn = ENEMY_ABILITIES[enemy.id];
  if (!fn) return DEFAULT_ABILITY;
  return fn(ctx);
}