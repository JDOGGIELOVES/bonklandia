/**
 * Personality-matched psychedelic FX for Alice Room entities.
 * Drives CSS classes on ambient field + transition bursts.
 */

export type AliceTripFxMode = 'enter' | 'encounter' | 'clear' | 'eject' | 'ascend';

export type AliceEntityFxProfile = {
  entityId: string;
  /** CSS suffix: alice-vibe-{cssId} */
  cssId: string;
  label: string;
  /** Short vibe for logs / a11y */
  vibe: string;
  /** Default burst length ms */
  durationMs: number;
};

export const ENTITY_FX: Record<string, AliceEntityFxProfile> = {
  'machine-elf': {
    entityId: 'machine-elf',
    cssId: 'machine-elf',
    label: 'Machine Elf',
    vibe: 'hyperspace workshop — mosaic chrome',
    durationMs: 1100,
  },
  jester: {
    entityId: 'jester',
    cssId: 'jester',
    label: 'Jester',
    vibe: 'carnival spin — harlequin prank',
    durationMs: 1200,
  },
  mantis: {
    entityId: 'mantis',
    cssId: 'mantis',
    label: 'Mantis',
    vibe: 'compound green — predatory zoom',
    durationMs: 1150,
  },
  grey: {
    entityId: 'grey',
    cssId: 'grey',
    label: 'Grey',
    vibe: 'abduction beam — sterile scan',
    durationMs: 1250,
  },
  'light-being': {
    entityId: 'light-being',
    cssId: 'light-being',
    label: 'Light Being',
    vibe: 'soft nova — golden bloom',
    durationMs: 1400,
  },
  goddess: {
    entityId: 'goddess',
    cssId: 'goddess',
    label: 'Goddess',
    vibe: 'royal mandala — rose divinity',
    durationMs: 1400,
  },
  'fractal-being': {
    entityId: 'fractal-being',
    cssId: 'fractal-being',
    label: 'Fractal Architect',
    vibe: 'recursive tunnel — infinite geometry',
    durationMs: 1300,
  },
  serpent: {
    entityId: 'serpent',
    cssId: 'serpent',
    label: 'Serpent',
    vibe: 'ouroboros coil — emerald wave',
    durationMs: 1250,
  },
  ancestor: {
    entityId: 'ancestor',
    cssId: 'ancestor',
    label: 'Ancestor',
    vibe: 'ember smoke — lineage pulse',
    durationMs: 1350,
  },
  'the-other': {
    entityId: 'the-other',
    cssId: 'the-other',
    label: 'The Other',
    vibe: 'void spiral — reality tear',
    durationMs: 1600,
  },
};

export function getEntityFx(entityId: string | null | undefined): AliceEntityFxProfile {
  if (entityId && ENTITY_FX[entityId]) return ENTITY_FX[entityId]!;
  return ENTITY_FX['machine-elf']!;
}

export type AliceTripBurst = {
  key: number;
  entityId: string;
  mode: AliceTripFxMode;
};

let burstSeq = 0;

export function makeTripBurst(entityId: string, mode: AliceTripFxMode): AliceTripBurst {
  burstSeq += 1;
  return { key: burstSeq, entityId, mode };
}
