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
  storagePrefix: 'bonklandia',
  /** Bump on each production ship so you can confirm the live build. */
  buildId: '2026-07-18v',
} as const;

export const LEGACY_STORAGE_KEYS = {
  tutorial: 'bonk-famquest-tutorial-dismissed',
  bank: 'bonk-famquest-bank',
} as const;