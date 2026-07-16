export type LoreTimelineEntry = {
  era: string;
  title: string;
  text: string;
};

export type CharacterLore = {
  id: string;
  epithet: string;
  backstory: string;
  legend: string;
  quote: string;
};

export const BONK_FAM_ORIGIN = {
  title: 'The First Bonk',
  subtitle: 'How conviction became Bonklandia',
  passages: [
    'Before charts, before cope, before the degens crawled out of Degen Valley, there was only silence — and then the sound of something righteous hitting something wrong.',
    'Legend says the First Bonk rang out when a single Shiba stood against the FUD that swallowed whole villages. The impact did not kill doubt. It shattered it. Golden light spilled from the strike, and from that fracture the Bonk Fam was born — not as an army, but as a promise: we bonk together, or not at all.',
    'The Fam raised Bonklandia on the ridge above Degen Valley, crowned by Bonk Hall where the air still hums with old frequency. Six bloodlines emerged from the First Bonk, each carrying a different virtue: leadership, rhythm, chaos, patience, mercy, and strength.',
    'Now the degens multiply. Jeeters circle. Scammers bloom like mold. The Gallery of Champions opens again in Bonklandia — pick your kin, descend into the valley, and bonk until the cope runs dry.',
  ],
};

export const BONK_TIMELINE: LoreTimelineEntry[] = [
  {
    era: 'Age Zero',
    title: 'The First Bonk',
    text: 'A single strike against endless FUD splits reality. The Bonk Fam bloodlines awaken.',
  },
  {
    era: 'Year of the Frequency',
    title: 'Bonga Tunes the Valley',
    text: 'Bonga discovers the valley resonates at 69 BPM. She tunes every bonk after that to carry rhythm.',
  },
  {
    era: 'The Cope Wars',
    title: 'Bink Holds the Line',
    text: 'While others panicked, she read the room for forty days and blocked every counter-attack. Bink\'s diamond hands become doctrine.',
  },
  {
    era: 'Chaos Moon',
    title: 'Bong Sends It',
    text: 'Nobody planned the Chaos Moon. Bong caused it. Degen Valley still has a crater shaped like a paw.',
  },
  {
    era: 'Healing Accord',
    title: 'Bonnie\'s Fam Hug',
    text: 'After the bloodiest wave, Bonnie bonked the squad back to standing. Her Fam Hug becomes sacred law.',
  },
  {
    era: 'Present Day',
    title: 'The Gallery Opens',
    text: 'Bonk calls champions from every bloodline across Bonklandia. Twelve waves of degens await. WAGMI — or bonk trying.',
  },
];

export const DEGEN_VALLEY_LORE = {
  title: 'Degen Valley',
  text: 'A sunken basin beneath Bonklandia where bad takes ferment into living creatures. Fudders spawn at dusk. Jeeters migrate in herds. The air tastes like expired hopium. The Bonk Fam descends here because someone must — and because the valley drops legendary cope when bonked hard enough.',
};

export const CHARACTER_LORE: Record<string, CharacterLore> = {
  bonk: {
    id: 'bonk',
    epithet: 'The Head Honcho',
    backstory:
      'Bonk is the eldest spark of the First Bonk — born with the hammer-swing already in his bones. He does not strategize from the back; he leads from the front because that is where the degens are thickest. Every rally cry he shouts echoes off Bonk Hall and reminds the Fam why they fight.',
    legend:
      'At the Siege of Cope Castle, Bonk bonked the main gate so hard the scammers inside thought the devs had finally shipped.',
    quote: '"A Fam that bonks together holds together."',
  },
  bonga: {
    id: 'bonga',
    epithet: 'Keeper of the Frequency',
    backstory:
      'Bonga hears what others miss — the vibration beneath FUD, the beat under jeet tears. She tuned the Bonk Hall bells to a frequency that restores vibe and melts cope. When the valley gets loud, she gets louder.',
    legend:
      'Her Sonic Boom once shattered a Fudder\'s twelve-part Twitter thread mid-draft. The thread was never posted. Historians call it mercy.',
    quote: '"Feel the frequency. The chart is just dancing."',
  },
  bong: {
    id: 'bong',
    epithet: 'Agent of Beautiful Chaos',
    backstory:
      'Nobody chose Bong. Bong happened. The Fam keeps him because every plan needs a paw that ignores the plan entirely. His damage is unpredictable, his courage unquestionable, and his regard for safety beautifully absent.',
    legend:
      'During the Chaos Moon, Bong sent a counter-attack back at himself and still won the wave. The log entry simply reads: "acceptable."',
    quote: '"No plan. Just bonk. Trust the process."',
  },
  bink: {
    id: 'bink',
    epithet: 'The Room Reader',
    backstory:
      'Bink bonks last and bonks right. She charted the valley before maps existed, memorized every degen tell, and developed diamond-handed blocking techniques the Fam still studies. Patience is her weapon; precision is her art.',
    legend:
      'She once defeated Sir Jeets-A-Lot by waiting. Jeets sold. Bink bonked. The timeline corrected itself.',
    quote: '"I\'ve read the room. You\'re already cooked."',
  },
  bonnie: {
    id: 'bonnie',
    epithet: 'Heart of the Fam',
    backstory:
      'Bonnie bonks with compassion and somehow it hurts more. She joined after the Cope Wars, when the Fam was fractured and tired. Her hugs restore HP. Her pep talks restore vibe. Her comfort bonks restore faith.',
    legend:
      'The Fam Hug ended a feud between Bong and a mirror. Only Bonnie could bonk someone into self-acceptance.',
    quote: '"We bonk with love. Even degens need it."',
  },
  beng: {
    id: 'beng',
    epithet: 'The Wall',
    backstory:
      'Beng stands where others fall. Built like Bonk Hall\'s front door, she absorbs counter-attacks that would bonk anyone else out of the valley. Slow, steady, immovable — the guardian every bloodline trusts at their back.',
    legend:
      'At the Bridge of Paper Hands, she took seventeen counter-attacks in a row and bonked once. The bridge collapsed from shame.',
    quote: '"Stand behind me. I bonk first."',
  },
};

export const BONGACHILL_LORE: CharacterLore = {
  id: 'bongachill',
  epithet: 'Spirit of the Afterlife Slots',
  backstory:
      'When a champion falls in Degen Valley, the valley does not let them leave empty-pawed. Bonga Chill — the Fam\'s eternal groove — greets them at the Bonklandia Casino with peace signs and a one-armed bandit. She is not defeat. She is the consolation groove.',
  legend:
      'Rumor says three BONKs on the jackpot line resurrects your vibe for the next run. Bonga Chill has never confirmed this. She just smiles.',
  quote: '"Bonked out? Chill. Pull the lever."',
};

export function getCharacterLore(id: string): CharacterLore | undefined {
  return CHARACTER_LORE[id];
}

export const FAM_BLOODLINES = [
  { name: 'Bonk', virtue: 'Conviction', color: '#f0d878' },
  { name: 'Bonga', virtue: 'Rhythm', color: '#c084fc' },
  { name: 'Bong', virtue: 'Chaos', color: '#f87171' },
  { name: 'Bink', virtue: 'Patience', color: '#60a5fa' },
  { name: 'Bonnie', virtue: 'Mercy', color: '#4ade80' },
  { name: 'Beng', virtue: 'Strength', color: '#fb923c' },
];