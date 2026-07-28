/**
 * Alice Machine reel entities — DMT / hyperspace beings.
 * Drop transparent PNGs in public/assets/alice/entities/ matching each `file` name.
 * Until art is present, the UI falls back to emoji.
 */

export const ALICE_ASSET_VERSION = '2026-07-27a';

export type AliceSymbolKind = 'elf' | 'entity' | 'guide' | 'wild';

export type AliceSymbol = {
  id: string;
  label: string;
  emoji: string;
  kind: AliceSymbolKind;
  /** Path under /public — e.g. /assets/alice/entities/machine-elf.png */
  image: string | null;
};

function entityImage(file: string): string {
  return `/assets/alice/entities/${file}?v=${ALICE_ASSET_VERSION}`;
}

/** Machine Elves — need three of these on the defense pull to block. */
export const ELF_SYMBOLS: AliceSymbol[] = [
  {
    id: 'elf-self-transforming',
    label: 'Self-Transforming Elf',
    emoji: '🧝',
    kind: 'elf',
    image: entityImage('machine-elf.png'),
  },
  {
    id: 'elf-clockwork',
    label: 'Clockwork Elf',
    emoji: '⚙️',
    kind: 'elf',
    image: entityImage('clockwork-elf.png'),
  },
  {
    id: 'elf-fractal',
    label: 'Fractal Elf',
    emoji: '🔮',
    kind: 'elf',
    image: entityImage('fractal-elf.png'),
  },
  {
    id: 'elf-jester',
    label: 'Hyperspace Jester',
    emoji: '🃏',
    kind: 'elf',
    image: entityImage('jester-elf.png'),
  },
];

/** Benevolent / guide entities (score like Fam lines). */
export const GUIDE_SYMBOLS: AliceSymbol[] = [
  {
    id: 'guide-mother',
    label: 'Hyperspace Mother',
    emoji: '🌌',
    kind: 'guide',
    image: entityImage('hyperspace-mother.png'),
  },
  {
    id: 'guide-serpent',
    label: 'Rainbow Serpent',
    emoji: '🐍',
    kind: 'guide',
    image: entityImage('rainbow-serpent.png'),
  },
  {
    id: 'guide-mantis',
    label: 'Mantis Teacher',
    emoji: '🦗',
    kind: 'guide',
    image: entityImage('mantis.png'),
  },
  {
    id: 'guide-octopus',
    label: 'Octopus Mind',
    emoji: '🐙',
    kind: 'guide',
    image: entityImage('octopus-mind.png'),
  },
];

/** Other trip entities (wonder scoring). */
export const ENTITY_SYMBOLS: AliceSymbol[] = [
  {
    id: 'entity-insectoid',
    label: 'Insectoid',
    emoji: '🪲',
    kind: 'entity',
    image: entityImage('insectoid.png'),
  },
  {
    id: 'entity-glyph',
    label: 'Living Glyph',
    emoji: '✦',
    kind: 'entity',
    image: entityImage('living-glyph.png'),
  },
  {
    id: 'entity-cathedral',
    label: 'Jewel Cathedral',
    emoji: '🏛️',
    kind: 'entity',
    image: entityImage('jewel-cathedral.png'),
  },
  {
    id: 'entity-clown',
    label: 'Cosmic Clown',
    emoji: '🤡',
    kind: 'entity',
    image: entityImage('cosmic-clown.png'),
  },
  {
    id: 'entity-eye',
    label: 'All-Seeing Lattice',
    emoji: '👁️',
    kind: 'entity',
    image: entityImage('all-seeing-lattice.png'),
  },
  {
    id: 'entity-mushroom',
    label: 'Gate Mushroom',
    emoji: '🍄',
    kind: 'entity',
    image: entityImage('gate-mushroom.png'),
  },
];

export const WILD_SYMBOL: AliceSymbol = {
  id: 'wild-glass',
  label: 'Looking Glass',
  emoji: '🌀',
  kind: 'wild',
  image: entityImage('looking-glass.png'),
};

/** @deprecated use GUIDE_SYMBOLS */
export const FAM_SYMBOLS = GUIDE_SYMBOLS;
/** @deprecated use ENTITY_SYMBOLS */
export const WONDER_SYMBOLS = ENTITY_SYMBOLS;

export const ALL_ALICE_SYMBOLS: AliceSymbol[] = [
  ...ELF_SYMBOLS,
  ...GUIDE_SYMBOLS,
  ...ENTITY_SYMBOLS,
  WILD_SYMBOL,
];

export function isElf(s: AliceSymbol): boolean {
  return s.kind === 'elf';
}

export function isGuide(s: AliceSymbol): boolean {
  return s.kind === 'guide' || s.kind === 'wild';
}

/** Expected PNG filenames for artists (drop into public/assets/alice/entities/). */
export const ALICE_ENTITY_ASSET_FILES = [
  'machine-elf.png',
  'clockwork-elf.png',
  'fractal-elf.png',
  'jester-elf.png',
  'hyperspace-mother.png',
  'rainbow-serpent.png',
  'mantis.png',
  'octopus-mind.png',
  'insectoid.png',
  'living-glyph.png',
  'jewel-cathedral.png',
  'cosmic-clown.png',
  'all-seeing-lattice.png',
  'gate-mushroom.png',
  'looking-glass.png',
] as const;
