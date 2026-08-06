/**
 * Rotating Depths event packs + rest camp choices.
 */

export type DepthsEventPick = {
  label: string;
  whisper: string;
  log: string;
  hpDelta: number;
  vibeDelta: number;
  chips: number;
};

export type DepthsEventPack = {
  id: string;
  label: string;
  blurb: string;
  a: DepthsEventPick;
  b: DepthsEventPick;
};

export const DEPTHS_EVENT_PACKS: DepthsEventPack[] = [
  {
    id: 'jeet-terminal',
    label: "Jeet's Fork",
    blurb: 'A glowing terminal offers two bad ideas.',
    a: {
      label: 'Take the free chips',
      whisper: 'Nothing free stays free.',
      log: 'You yoink the chips. Your vibe feels slightly scammed.',
      hpDelta: 0,
      vibeDelta: -8,
      chips: 25,
    },
    b: {
      label: 'Smash the terminal',
      whisper: 'Violence is a strategy.',
      log: 'Bonk energy floods the room. HP restored a bit.',
      hpDelta: 30,
      vibeDelta: 10,
      chips: 0,
    },
  },
  {
    id: 'rug-mirror',
    label: 'Rug Mirror',
    blurb: 'Your reflection offers a leveraged deal.',
    a: {
      label: 'Accept the leverage',
      whisper: 'Up only… until it isn’t.',
      log: 'Leverage juiced your vibe. HP took the margin call.',
      hpDelta: -22,
      vibeDelta: 22,
      chips: 15,
    },
    b: {
      label: 'Walk away from the glass',
      whisper: 'Self-control is rare down here.',
      log: 'You ignore the reflection. Calm returns. Small heal.',
      hpDelta: 18,
      vibeDelta: 6,
      chips: 0,
    },
  },
  {
    id: 'copium-vent',
    label: 'Copium Vent',
    blurb: 'Sweet pink fog leaks from a cracked pipe.',
    a: {
      label: 'Breathe deep',
      whisper: 'It tastes like hopium.',
      log: 'Copium heals the body. Clarity takes a hit.',
      hpDelta: 40,
      vibeDelta: -12,
      chips: 0,
    },
    b: {
      label: 'Hold your breath & loot',
      whisper: 'Someone left a bag in the fog.',
      log: 'You pocket loose chips without inhaling. Smart.',
      hpDelta: 0,
      vibeDelta: 4,
      chips: 18,
    },
  },
  {
    id: 'shill-choir',
    label: 'Shill Choir',
    blurb: 'A chorus of bots sings your ticker — wrong ticker.',
    a: {
      label: 'Join the chorus',
      whisper: 'Engagement is a resource.',
      log: 'You shill with them. Vibe up. Soul slightly sticky.',
      hpDelta: -8,
      vibeDelta: 18,
      chips: 12,
    },
    b: {
      label: 'Mute the channel',
      whisper: 'Silence is a flex.',
      log: 'Quiet restores focus. Modest heal.',
      hpDelta: 22,
      vibeDelta: 8,
      chips: 0,
    },
  },
  {
    id: 'paper-hands-altar',
    label: 'Paper Hands Altar',
    blurb: 'An altar accepts bags. Or blood. Same UI.',
    a: {
      label: 'Offer HP for chips',
      whisper: 'Pain converts to capital.',
      log: 'The altar drinks a little life. Coins rattle out.',
      hpDelta: -28,
      vibeDelta: 0,
      chips: 35,
    },
    b: {
      label: 'Meditate instead',
      whisper: 'Diamond is a posture.',
      log: 'You refuse the trade. HP and vibe tick up.',
      hpDelta: 16,
      vibeDelta: 14,
      chips: 0,
    },
  },
  {
    id: 'airdrop-trap',
    label: 'Airdrop Trap',
    blurb: 'A crate labeled “FREE SYBIL REWARDS” hums suspiciously.',
    a: {
      label: 'Claim the airdrop',
      whisper: 'Connect wallet energy, no wallet required.',
      log: 'You claim. Chips appear. Something also claims a nibble of HP.',
      hpDelta: -14,
      vibeDelta: -4,
      chips: 28,
    },
    b: {
      label: 'Kick the crate',
      whisper: 'Due diligence with a boot.',
      log: 'Bots scatter. You loot a clean handful of chips.',
      hpDelta: 0,
      vibeDelta: 5,
      chips: 14,
    },
  },
];

export function pickDepthsEventPack(seed: number): DepthsEventPack {
  const i = Math.abs(Math.floor(seed)) % DEPTHS_EVENT_PACKS.length;
  return DEPTHS_EVENT_PACKS[i]!;
}

export type DepthsRestChoiceId = 'heal' | 'vibe' | 'scavenge';

export type DepthsRestChoice = {
  id: DepthsRestChoiceId;
  label: string;
  whisper: string;
  /** Fraction of max HP healed (0–1). */
  healFrac: number;
  vibeGain: number;
  chips: number;
  hpRisk: number;
};

export function depthsRestChoices(difficulty: 'easy' | 'medium' | 'hard'): DepthsRestChoice[] {
  const healBase = difficulty === 'easy' ? 0.55 : difficulty === 'hard' ? 0.3 : 0.4;
  const vibeBase = difficulty === 'easy' ? 28 : 18;
  return [
    {
      id: 'heal',
      label: 'Deep rest',
      whisper: 'Full camp. Body first.',
      healFrac: healBase,
      vibeGain: Math.round(vibeBase * 0.45),
      chips: 0,
      hpRisk: 0,
    },
    {
      id: 'vibe',
      label: 'Tune the frequency',
      whisper: 'Meditation over bandages.',
      healFrac: healBase * 0.45,
      vibeGain: Math.round(vibeBase * 1.35),
      chips: 0,
      hpRisk: 0,
    },
    {
      id: 'scavenge',
      label: 'Scavenge the dark',
      whisper: 'Coins in the cracks. Teeth too.',
      healFrac: healBase * 0.2,
      vibeGain: 4,
      chips: difficulty === 'hard' ? 22 : 16,
      hpRisk: difficulty === 'easy' ? 8 : difficulty === 'hard' ? 18 : 12,
    },
  ];
}
