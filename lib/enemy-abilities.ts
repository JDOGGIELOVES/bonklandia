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
};

export function resolveEnemyAbility(enemy: Enemy, ctx: EnemyAbilityContext): EnemyAbilityResult {
  const fn = ENEMY_ABILITIES[enemy.id];
  if (!fn) return DEFAULT_ABILITY;
  return fn(ctx);
}