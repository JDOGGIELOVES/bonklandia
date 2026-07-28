import { PLAYABLE_CHARACTERS } from '@/lib/characters';

export type AliceSymbolKind = 'fam' | 'elf' | 'wonder' | 'wild';

export type AliceSymbol = {
  id: string;
  label: string;
  emoji: string;
  kind: AliceSymbolKind;
};

/** Machine Elves — the antagonists of the Alice Room. */
export const ELF_SYMBOLS: AliceSymbol[] = [
  { id: 'elf-tick', label: 'Tick-Tock Elf', emoji: '🧝', kind: 'elf' },
  { id: 'elf-glitch', label: 'Glitch Elf', emoji: '👾', kind: 'elf' },
  { id: 'elf-mirror', label: 'Mirror Elf', emoji: '🪞', kind: 'elf' },
  { id: 'elf-smoke', label: 'Smoke Elf', emoji: '💨', kind: 'elf' },
];

/** Bonk Fam siblings on the Alice reels. */
export const FAM_SYMBOLS: AliceSymbol[] = PLAYABLE_CHARACTERS.map(c => ({
  id: `fam-${c.id}`,
  label: c.name,
  emoji: c.id === 'bonk' ? '🐕' : c.id === 'bonga' ? '😎' : c.id === 'bong' ? '🌿' : c.id === 'bink' ? '✨' : c.id === 'bonnie' ? '💖' : '🐻',
  kind: 'fam' as const,
}));

/** Wonderland flavor (points, not block). */
export const WONDER_SYMBOLS: AliceSymbol[] = [
  { id: 'rabbit', label: 'White Rabbit', emoji: '🐇', kind: 'wonder' },
  { id: 'tea', label: 'Mad Tea', emoji: '🍵', kind: 'wonder' },
  { id: 'key', label: 'Tiny Key', emoji: '🔑', kind: 'wonder' },
  { id: 'mushroom', label: 'Mushroom', emoji: '🍄', kind: 'wonder' },
  { id: 'hat', label: 'Mad Hat', emoji: '🎩', kind: 'wonder' },
  { id: 'card', label: 'Queen Card', emoji: '🃏', kind: 'wonder' },
];

export const WILD_SYMBOL: AliceSymbol = {
  id: 'wild-alice',
  label: 'Looking Glass',
  emoji: '🌀',
  kind: 'wild',
};

export const ALL_ALICE_SYMBOLS: AliceSymbol[] = [
  ...FAM_SYMBOLS,
  ...ELF_SYMBOLS,
  ...WONDER_SYMBOLS,
  WILD_SYMBOL,
];

export function isElf(s: AliceSymbol): boolean {
  return s.kind === 'elf';
}

export function isFam(s: AliceSymbol): boolean {
  return s.kind === 'fam' || s.kind === 'wild';
}
