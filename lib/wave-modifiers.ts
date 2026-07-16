export type WaveModifierId =
  | 'bonk-rush'
  | 'fud-storm'
  | 'vibe-surge'
  | 'cope-fog'
  | 'degen-frenzy'
  | 'diamond-wind'
  | 'chaos-night'
  | 'healing-mist';

export type WaveModifier = {
  id: WaveModifierId;
  name: string;
  emoji: string;
  description: string;
  playerDamageMult: number;
  enemyCounterMult: number;
  vibeOnWaveStart: number;
  playerRegenPerTurn: number;
};

export const WAVE_MODIFIERS: WaveModifier[] = [
  {
    id: 'bonk-rush',
    name: 'Bonk Rush',
    emoji: '⚡',
    description: 'Your attacks deal +20% damage this wave.',
    playerDamageMult: 1.2,
    enemyCounterMult: 1,
    vibeOnWaveStart: 0,
    playerRegenPerTurn: 0,
  },
  {
    id: 'fud-storm',
    name: 'FUD Storm',
    emoji: '🌩️',
    description: 'Enemy counters hit +25% harder. Stay blocking.',
    playerDamageMult: 1,
    enemyCounterMult: 1.25,
    vibeOnWaveStart: 0,
    playerRegenPerTurn: 0,
  },
  {
    id: 'vibe-surge',
    name: 'Vibe Surge',
    emoji: '🎵',
    description: '+15 vibe when the wave begins. Frequency rises.',
    playerDamageMult: 1,
    enemyCounterMult: 1,
    vibeOnWaveStart: 15,
    playerRegenPerTurn: 0,
  },
  {
    id: 'cope-fog',
    name: 'Cope Fog',
    emoji: '🌫️',
    description: 'Degens cope harder — their counters are +15% stronger.',
    playerDamageMult: 1,
    enemyCounterMult: 1.15,
    vibeOnWaveStart: 0,
    playerRegenPerTurn: 0,
  },
  {
    id: 'degen-frenzy',
    name: 'Degen Frenzy',
    emoji: '🔥',
    description: 'Both sides hit harder (+15% player dmg, +15% counter).',
    playerDamageMult: 1.15,
    enemyCounterMult: 1.15,
    vibeOnWaveStart: 0,
    playerRegenPerTurn: 0,
  },
  {
    id: 'diamond-wind',
    name: 'Diamond Wind',
    emoji: '💎',
    description: 'Regenerate 8 HP at the start of each of your turns.',
    playerDamageMult: 1,
    enemyCounterMult: 1,
    vibeOnWaveStart: 0,
    playerRegenPerTurn: 8,
  },
  {
    id: 'chaos-night',
    name: 'Chaos Night',
    emoji: '🎲',
    description: 'Wild energy — +25% player damage but +20% counter damage.',
    playerDamageMult: 1.25,
    enemyCounterMult: 1.2,
    vibeOnWaveStart: 0,
    playerRegenPerTurn: 0,
  },
  {
    id: 'healing-mist',
    name: 'Healing Mist',
    emoji: '💗',
    description: '+10 vibe on wave start and +5 HP each player turn.',
    playerDamageMult: 1,
    enemyCounterMult: 1,
    vibeOnWaveStart: 10,
    playerRegenPerTurn: 5,
  },
];

export function pickWaveModifier(wave: number, run: number): WaveModifier {
  const pool = [...WAVE_MODIFIERS];
  const seed = wave * 17 + run * 31;
  return pool[seed % pool.length];
}

export function getWaveModifierById(id: WaveModifierId): WaveModifier | undefined {
  return WAVE_MODIFIERS.find(m => m.id === id);
}