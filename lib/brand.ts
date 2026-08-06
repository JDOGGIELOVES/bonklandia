/** Central branding — Bonklandia @ bonklandia.com */
export const BRAND = {
  name: 'Bonklandia',
  domain: 'bonklandia.com',
  url: 'https://bonklandia.com',
  tagline: 'Raise the Frequency in the realm of Bonklandia',
  selectSubtitle: 'Choose thy champion — each bonks with distinct artistry',
  selectHero:
    'Six bloodlines. One First Bonk. Descend into Degen Valley and bonk the cope from history itself.',
  chronicle: 'The Bonklandia Chronicle',
  tutorialTitle: 'How to Play — Bonklandia 101',
  cashier: 'Bonklandia Cashier',
  bank: 'Bonklandia Bank',
  casino: 'Bonklandia Casino',
  slotMachine: 'BONKLANDIA BANDIT',
  depths: 'Degen Depths',
  /**
   * Universal hub label — champion select + realm paths.
   * Use this on every page so players always know how to get back.
   */
  home: 'Home',
  /** Anchor on the home page for champion select. */
  homeAnchor: '#home',
  homePath: '/',
  /** Wave-combat mode after you pick a champion (not the whole site). */
  degenValley: 'Degen Valley',
  degenValleyNav: 'Degen Valley',
  degenValleyCta: 'Enter the Valley →',
  /** Clear gallery heading (was “Hall of Champions”). */
  championSelect: 'Choose Your Champion',
  championSelectSub:
    'Pick a bloodline, then start Degen Valley — the main wave fight on this home screen.',
  /** In-world name of the Wonderland side game. */
  aliceRoom: 'The Alice Room',
  /** Home nav plaque — how players open the rabbit hole. */
  aliceRoomNav: 'Eat the Mushroom',
  storagePrefix: 'bonklandia',
  /** Bump on each production ship so you can confirm the live build. */
  buildId: '2026-07-30s',
} as const;

export const LEGACY_STORAGE_KEYS = {
  tutorial: 'bonk-famquest-tutorial-dismissed',
  bank: 'bonk-famquest-bank',
} as const;