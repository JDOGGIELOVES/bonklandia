/**
 * Alice Machine reel / encounter entities (DMT trip archetypes).
 * Art lives in public/assets/alice/entities/ as real RGBA PNGs.
 *
 * Canva note: downloads named .png are often JPEG + black bg (no alpha).
 * We convert with black→alpha so they behave like Bonk Fam portraits (RGBA PNG).
 */

export const ALICE_ASSET_VERSION = '2026-07-28a';

export type AliceSymbolKind = 'elf' | 'entity' | 'guide' | 'wild' | 'loving';

export type AliceSymbol = {
  id: string;
  label: string;
  emoji: string;
  kind: AliceSymbolKind;
  /** Path under /public */
  image: string | null;
  /** Trip level 1–10 (defense needs 3 of this entity). */
  level: number;
};

function entityImage(file: string): string {
  return `/assets/alice/entities/${file}?v=${ALICE_ASSET_VERSION}`;
}

/**
 * One hero entity per trip level (order matches design doc).
 * Defense pull: land three of the current level's entity.
 */
export const LEVEL_ENTITIES: AliceSymbol[] = [
  {
    level: 1,
    id: 'machine-elf',
    label: 'Machine Elf',
    emoji: '🧝',
    kind: 'elf',
    image: entityImage('machine-elf.png'),
  },
  {
    level: 2,
    id: 'jester',
    label: 'Jester',
    emoji: '🃏',
    kind: 'entity',
    image: entityImage('jester.png'),
  },
  {
    level: 3,
    id: 'mantis',
    label: 'Mantis',
    emoji: '🦗',
    kind: 'entity',
    image: entityImage('mantis.png'),
  },
  {
    level: 4,
    id: 'grey',
    label: 'Grey',
    emoji: '👽',
    kind: 'entity',
    image: entityImage('grey.png'),
  },
  {
    level: 5,
    id: 'light-being',
    label: 'Light Being',
    emoji: '✨',
    kind: 'loving',
    image: entityImage('light-being.png'),
  },
  {
    level: 6,
    id: 'goddess',
    label: 'Goddess',
    emoji: '👑',
    kind: 'loving',
    image: entityImage('goddess.png'),
  },
  {
    level: 7,
    id: 'fractal-being',
    label: 'Fractal Architect',
    emoji: '🔷',
    kind: 'entity',
    image: entityImage('fractal-being.png'),
  },
  {
    level: 8,
    id: 'serpent',
    label: 'Serpent',
    emoji: '🐍',
    kind: 'entity',
    image: entityImage('serpent.png'),
  },
  {
    level: 9,
    id: 'ancestor',
    label: 'Ancestor',
    emoji: '🕯️',
    kind: 'loving',
    image: entityImage('ancestor.png'),
  },
  {
    level: 10,
    id: 'the-other',
    label: 'The Other',
    emoji: '🌀',
    kind: 'wild',
    image: entityImage('the-other.png'),
  },
];

export function getEntityForLevel(level: number): AliceSymbol {
  const found = LEVEL_ENTITIES.find(e => e.level === level);
  return found ?? LEVEL_ENTITIES[0]!;
}

/** Full reel pool = all trip entities. */
export const ALL_ALICE_SYMBOLS: AliceSymbol[] = [...LEVEL_ENTITIES];

/** @deprecated — prefer LEVEL_ENTITIES / getEntityForLevel */
export const ELF_SYMBOLS = LEVEL_ENTITIES.filter(e => e.level === 1);
export const GUIDE_SYMBOLS = LEVEL_ENTITIES.filter(e => e.kind === 'loving' || e.kind === 'guide');
export const ENTITY_SYMBOLS = LEVEL_ENTITIES.filter(
  e => e.kind === 'entity' || e.kind === 'elf',
);
export const WILD_SYMBOL = LEVEL_ENTITIES.find(e => e.id === 'the-other')!;
export const FAM_SYMBOLS = GUIDE_SYMBOLS;
export const WONDER_SYMBOLS = ENTITY_SYMBOLS;

export function isElf(s: AliceSymbol): boolean {
  return s.kind === 'elf' || s.id === 'machine-elf';
}

/** True if reel symbol matches the entity required to block this level. */
export function matchesDefenseEntity(symbol: AliceSymbol, level: number): boolean {
  const need = getEntityForLevel(level);
  return symbol.id === need.id;
}

export const ALICE_ENTITY_ASSET_FILES = [
  'machine-elf.png',
  'jester.png',
  'mantis.png',
  'grey.png',
  'light-being.png',
  'goddess.png',
  'fractal-being.png',
  'serpent.png',
  'ancestor.png',
  'the-other.png',
] as const;
