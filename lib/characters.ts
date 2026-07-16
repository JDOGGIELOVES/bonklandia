/** Bump when character portraits in public/assets/characters/ are replaced */
export const CHARACTER_ASSET_VERSION = '20260715e';

export function characterImage(file: string): string {
  return `/assets/characters/${file}?v=${CHARACTER_ASSET_VERSION}`;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_META: Record<
  Difficulty,
  { label: string; color: string; bg: string; border: string; description: string }
> = {
  easy: {
    label: 'Easy',
    color: '#4ade80',
    bg: 'rgba(20,83,45,0.5)',
    border: '#166534',
    description: 'Forgiving HP or healing. Great first pick.',
  },
  medium: {
    label: 'Medium',
    color: '#fbbf24',
    bg: 'rgba(120,53,15,0.5)',
    border: '#b45309',
    description: 'Balanced risk. Learn the mechanics.',
  },
  hard: {
    label: 'Hard',
    color: '#f87171',
    bg: 'rgba(127,29,29,0.5)',
    border: '#dc2626',
    description: 'High risk, high reward. Degens only.',
  },
};

export type CharacterAbility = {
  id: string;
  name: string;
  dmg: number;
  description: string;
  flavor: string;
  healHp?: number;
  healVibe?: number;
  blockNextHit?: boolean;
  critChance?: number;
};

export type PlayableCharacter = {
  id: string;
  name: string;
  role: string;
  tagline: string;
  img: string;
  hp: number;
  power: number;
  defense: number;
  vibe: number;
  speed: number;
  abilities: CharacterAbility[];
  selectLine: string;
  difficulty: Difficulty;
  difficultyTip: string;
};

export const PLAYABLE_CHARACTERS: PlayableCharacter[] = [
  {
    id: 'bonk',
    name: 'Bonk',
    role: 'Head Honcho',
    tagline: 'Leads from the front. Heavy hits, pure conviction.',
    img: characterImage('bonk.png'),
    hp: 180,
    power: 9,
    defense: 7,
    vibe: 8,
    speed: 6,
    selectLine: '"Time to bonk some degens into enlightenment."',
    difficulty: 'medium',
    difficultyTip: 'Balanced stats and crit chance. Solid all-rounder.',
    abilities: [
      {
        id: 'bonk-blitz',
        name: 'Bonk Blitz',
        dmg: 70,
        description: 'A devastating bonk. Bonk\'s signature move.',
        flavor: 'Bonk launches himself like a golden missile!',
      },
      {
        id: 'rally-cry',
        name: 'Rally Cry',
        dmg: 35,
        description: 'Damage + restore vibe.',
        flavor: 'Bonk screams WAGMI at 140 decibels!',
        healVibe: 20,
      },
      {
        id: 'head-bonk',
        name: 'Head Bonk',
        dmg: 45,
        description: '50% chance to crit for double damage.',
        flavor: 'Bonk uses his forehead. Science calls it effective.',
        critChance: 0.5,
      },
    ],
  },
  {
    id: 'bonga',
    name: 'Bonga',
    role: 'Sister of the Frequency',
    tagline: 'She keeps the rhythm. Vibe specialist.',
    img: characterImage('bonga.png'),
    hp: 150,
    power: 6,
    defense: 6,
    vibe: 10,
    speed: 8,
    selectLine: '"Feel the frequency. Let\'s melt their cope."',
    difficulty: 'medium',
    difficultyTip: 'Her Sonic Boom hits hard but costs 15 vibe — manage her meter carefully.',
    abilities: [
      {
        id: 'frequency-flow',
        name: 'Frequency Flow',
        dmg: 55,
        description: 'Steady rhythmic damage. Never misses the beat.',
        flavor: 'Bonga drops a beat so hard the chart vibrates!',
      },
      {
        id: 'hype-mixtape',
        name: 'Hype Mixtape',
        dmg: 20,
        description: 'Light damage + big vibe restore.',
        flavor: 'Bonga drops fire tracks. Morale skyrockets!',
        healVibe: 35,
      },
      {
        id: 'sonic-boom',
        name: 'Sonic Boom',
        dmg: 80,
        description: 'Massive hit but costs 15 vibe.',
        flavor: 'Bonga shatters glass and FUD in one note!',
      },
    ],
  },
  {
    id: 'bong',
    name: 'Bong',
    role: 'Chaos Agent',
    tagline: 'Unpredictable. Fast. Absolutely unhinged.',
    img: characterImage('bong.png'),
    hp: 140,
    power: 7,
    defense: 5,
    vibe: 7,
    speed: 10,
    selectLine: '"No plan. Just bonk. Send it."',
    difficulty: 'hard',
    difficultyTip: 'Lowest HP. Random damage and self-harm moves.',
    abilities: [
      {
        id: 'chaos-bonk',
        name: 'Chaos Bonk',
        dmg: 40,
        description: 'Deals 25–90 random damage. Pure chaos.',
        flavor: 'Bong bonks... somehow it works?!',
      },
      {
        id: 'send-it',
        name: 'Send It',
        dmg: 95,
        description: 'Huge damage. Bong takes 20 recoil.',
        flavor: 'Bong sends it with zero regard for safety!',
      },
      {
        id: 'vibe-check',
        name: 'Vibe Check',
        dmg: 50,
        description: 'Fast strike. Low enemy counter damage.',
        flavor: 'Bong speed-runs this degen\'s entire personality.',
      },
    ],
  },
  {
    id: 'bink',
    name: 'Bink',
    role: 'Strategist Sister',
    tagline: 'She bonks with patience — calculated and diamond-handed.',
    img: characterImage('bink.png'),
    hp: 200,
    power: 6,
    defense: 10,
    vibe: 6,
    speed: 5,
    selectLine: '"I\'ve read the chart. They\'re cooked."',
    difficulty: 'medium',
    difficultyTip: 'Her high defense and block timing reward patience. Slow but steady.',
    abilities: [
      {
        id: 'calculated-strike',
        name: 'Calculated Strike',
        dmg: 48,
        description: 'Reliable damage. She never whiffs.',
        flavor: 'Bink executes a perfectly planned bonk.',
      },
      {
        id: 'diamond-hands',
        name: 'Diamond Hands',
        dmg: 30,
        description: 'Damage + block next enemy counter.',
        flavor: 'Bink grips so hard counter-attacks bounce off!',
        blockNextHit: true,
      },
      {
        id: 'read-the-room',
        name: 'Read the Room',
        dmg: 60,
        description: 'Bonus damage when enemy is below 50% HP.',
        flavor: 'Bink spotted the weakness. Exploiting it.',
      },
    ],
  },
  {
    id: 'bonnie',
    name: 'Bonnie',
    role: 'Heart of the Fam',
    tagline: 'She heals the squad. Keeps everyone in the fight.',
    img: characterImage('bonnie.png'),
    hp: 160,
    power: 5,
    defense: 7,
    vibe: 9,
    speed: 6,
    selectLine: '"We bonk with love. Degens need it most."',
    difficulty: 'easy',
    difficultyTip: 'Best healer in the Fam. Lower damage, but she keeps the squad standing.',
    abilities: [
      {
        id: 'comfort-bonk',
        name: 'Comfort Bonk',
        dmg: 35,
        description: 'Gentle bonk + heal 25 HP.',
        flavor: 'Bonnie bonks with compassion. Somehow it hurts more.',
        healHp: 25,
      },
      {
        id: 'fam-hug',
        name: 'Fam Hug',
        dmg: 15,
        description: 'Minimal damage. Heal 50 HP + 20 vibe.',
        flavor: 'Bonnie reminds you why we\'re gonna make it.',
        healHp: 50,
        healVibe: 20,
      },
      {
        id: 'pep-talk',
        name: 'Pep Talk',
        dmg: 45,
        description: 'Solid damage + vibe restore.',
        flavor: 'Bonnie\'s pep talk bonks the soul!',
        healVibe: 15,
      },
    ],
  },
  {
    id: 'beng',
    name: 'Beng',
    role: 'Guardian Sister',
    tagline: 'The tank. She absorbs hits and crushes degens.',
    img: characterImage('beng.png'),
    hp: 220,
    power: 8,
    defense: 9,
    vibe: 5,
    speed: 4,
    selectLine: '"Stand behind me. I bonk first."',
    difficulty: 'easy',
    difficultyTip: 'Highest HP tank. She absorbs counters like a champ.',
    abilities: [
      {
        id: 'guardian-strike',
        name: 'Guardian Strike',
        dmg: 65,
        description: 'Heavy tank bonk. High damage.',
        flavor: 'Beng bonks like a vault door swinging shut!',
      },
      {
        id: 'shield-up',
        name: 'Shield Up',
        dmg: 25,
        description: 'Light hit + block next counter + heal 15 HP.',
        flavor: 'Beng raises the shield. Nothing gets through.',
        blockNextHit: true,
        healHp: 15,
      },
      {
        id: 'ground-pound',
        name: 'Ground Pound',
        dmg: 85,
        description: 'Slow but devastating. Beng needs a breather after.',
        flavor: 'The ground shakes. The degen\'s cope crumbles.',
      },
    ],
  },
];

export function getCharacterById(id: string): PlayableCharacter | undefined {
  return PLAYABLE_CHARACTERS.find(c => c.id === id);
}

export function calcCounterDamage(baseDmg: number, defense: number): number {
  return Math.max(1, Math.round(baseDmg * (1 - defense * 0.06)));
}