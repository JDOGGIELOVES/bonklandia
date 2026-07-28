/**
 * DMT trip encounter content: 10 levels × 5 rotating option sets.
 * Labels/whispers rooted in commonly reported entity experiences.
 */

export type ChoiceTier = 'none' | 'moderate' | 'heavy' | 'wipe' | 'double';

export type EncounterChoice = {
  label: string;
  whisper: string;
  tier: ChoiceTier;
};

/** One pack of 4 doors (shuffled at runtime). Loving floors add a 5th double. */
export type OptionSet = [EncounterChoice, EncounterChoice, EncounterChoice, EncounterChoice];

export type LevelEncounter = {
  level: number;
  entityId: string;
  name: string;
  /** Opening line when encounter starts after win spin */
  attackLine: string;
  /** Shown on defense fail before doors */
  failLine: string;
  loving: boolean;
  /** Max loss fraction on any single non-double choice (1 = full wipe allowed) */
  maxLossFraction: number;
  sets: OptionSet[];
};

function S(label: string, whisper: string): EncounterChoice {
  return { label, whisper, tier: 'none' };
}
function M(label: string, whisper: string): EncounterChoice {
  return { label, whisper, tier: 'moderate' };
}
function H(label: string, whisper: string): EncounterChoice {
  return { label, whisper, tier: 'heavy' };
}
function W(label: string, whisper: string): EncounterChoice {
  return { label, whisper, tier: 'wipe' };
}
function D(label: string, whisper: string): EncounterChoice {
  return { label, whisper, tier: 'double' };
}

const LOVING_DOUBLE_POOL: EncounterChoice[] = [
  D('Open completely', 'Drop every defense. Receive without measuring.'),
  D('Become the welcome', 'You are already home. Let it rewrite you.'),
  D('Offer the whole heart', 'Nothing held back — pure reception.'),
  D('Dissolve into the gift', 'Stop being a visitor. Be the light.'),
  D('Accept the lineage', 'You were always part of this. Soften fully.'),
];

export const LEVEL_ENCOUNTERS: LevelEncounter[] = [
  // ── 1 Machine Elves ────────────────────────────────────────────
  {
    level: 1,
    entityId: 'machine-elf',
    name: 'Machine Elves',
    attackLine:
      'They swarm, delighted — building impossible toys mid-air. Look. Look at this.',
    failLine: 'You failed the triple-elf shield. They offer four doors. One is kind.',
    loving: false,
    maxLossFraction: 1,
    sets: [
      [
        S('Accept the impossible toy', 'Play along. They love an audience.'),
        M('Try to name what they built', 'Language is slow here.'),
        H('Grab the object for yourself', 'Possession is a human habit.'),
        W('Look away — “this isn’t real”', 'Denial empties the satchel.'),
      ],
      [
        S('Let them demo the machinery', 'Watch the show they prepared.'),
        M('Ask them to slow down', 'Time is optional for them.'),
        H('Interrupt their work', 'They do not like broken rhythms.'),
        W('Smash the construct', 'The workshop takes everything back.'),
      ],
      [
        S('Laugh and mirror their excitement', 'Play is the password.'),
        M('Demand English words', 'They speak in objects, not sentences.'),
        H('Steal a machine part', 'Theft has a cost in hyperspace.'),
        W('Run from the workshop', 'Fleeing drops every coin.'),
      ],
      [
        S('Hold still for the next presentation', 'Patience is participation.'),
        M('Compare it to Earth tech', 'Left-brain tax.'),
        H('Bargain to take one home', 'Export is expensive.'),
        W('Deny they exist', 'The elves unmake your fortune.'),
      ],
      [
        S('Clap for the impossible geometry', 'Applause keeps the gifts coming.'),
        M('Take mental notes', 'Analysis dilutes the gift.'),
        H('Hide your Alice Coins from them', 'They notice hoarding.'),
        W('Close your eyes through the show', 'You miss the point — and the pile.'),
      ],
    ],
  },

  // ── 2 Jesters ──────────────────────────────────────────────────
  {
    level: 2,
    entityId: 'jester',
    name: 'Jesters / Tricksters',
    attackLine: 'Laughter without cruelty — or with it. The cosmic prank has found you.',
    failLine: 'No triple Jester shield. Four pranks wait. Choose carefully.',
    loving: false,
    maxLossFraction: 1,
    sets: [
      [
        S('Laugh with them', 'Join the joke before it joins you.'),
        M('Demand they be serious', 'Seriousness is funny here.'),
        H('Defend your ego out loud', 'Pride is the punchline.'),
        W('Insult them and flee', 'The circus keeps the ticket price.'),
      ],
      [
        S('Accept the prank as teaching', 'Humiliation can be a key.'),
        M('Ask “what’s the joke?”', 'They prefer you figure it out.'),
        H('Get angry', 'Anger feeds the bells.'),
        W('Beg them to stop laughing', 'Begging empties pockets.'),
      ],
      [
        S('Bow like a willing fool', 'The stage loves humility.'),
        M('Stand proud and rigid', 'Stiffness cracks.'),
        H('Throw something at them', 'Bad audience manners.'),
        W('Panic that you’re the eternal joke', 'Identity freefall — coins gone.'),
      ],
      [
        S('Play along with the bit', 'Improv survives the ring.'),
        M('Correct their mockery', 'Debating jesters is a trap.'),
        H('Try to out-trick them', 'They invented the rules.'),
        W('Collapse into shame', 'The tent folds with your fortune.'),
      ],
      [
        S('Smile and stay curious', 'Curiosity is armor.'),
        M('Analyze the prank', 'Analysis is half a laugh.'),
        H('Demand respect', 'Respect is not the currency here.'),
        W('Storm out of the circus', 'Exit fee: everything.'),
      ],
    ],
  },

  // ── 3 Mantis ───────────────────────────────────────────────────
  {
    level: 3,
    entityId: 'mantis',
    name: 'Insectoids / Mantis',
    attackLine: 'Calm compound eyes. A clinical lean. Something is being examined.',
    failLine: 'Shield failed. Four procedure doors. One is pure surrender.',
    loving: false,
    maxLossFraction: 1,
    sets: [
      [
        S('Surrender to the exam', 'Stillness is consent.'),
        M('Ask what they’re doing', 'Questions are allowed — briefly.'),
        H('Struggle on the table', 'Resistance frays the field.'),
        W('Panic-fight the procedure', 'Ejection protocol — coins zero.'),
      ],
      [
        S('Breathe and allow the scan', 'Breath keeps you intact.'),
        M('Watch instruments only', 'Detachment costs a little.'),
        H('Negotiate “be gentle”', 'Bargaining confuses the process.'),
        W('Thrash free', 'You leave empty.'),
      ],
      [
        S('Consent telepathically', 'They prefer non-words.'),
        M('Focus only on their eyes', 'Staring contests tax you.'),
        H('Cover your body/energy', 'Hiding invites deeper probe.'),
        W('Scream rejection', 'The lab takes payment.'),
      ],
      [
        S('Trust the calm presence', 'Surgeons of the subtle.'),
        M('Count the seconds', 'Timekeeping is human noise.'),
        H('Bargain for early release', 'Release has a fee.'),
        W('Assume they’re killing you', 'Fear completes the drain.'),
      ],
      [
        S('Go limp and open', 'Soft body, soft loss of fear.'),
        M('Intellectualize the surgery', 'Mind chatter dilutes coins.'),
        H('Clench and resist energy', 'Clenching leaks fortune.'),
        W('Escape mid-procedure', 'Incomplete exams cost everything.'),
      ],
    ],
  },

  // ── 4 Greys ────────────────────────────────────────────────────
  {
    level: 4,
    entityId: 'grey',
    name: 'Greys',
    attackLine: 'Sterile light. A table. Observation without warmth.',
    failLine: 'No triple Grey. Four abduction doors open.',
    loving: false,
    maxLossFraction: 1,
    sets: [
      [
        S('Calm consent — “I’m ready”', 'Cooperation steadies the field.'),
        M('Study the room details', 'Curiosity is half a shield.'),
        H('Negotiate “send me home”', 'Homesickness is expensive.'),
        W('Full abduction terror thrash', 'Panic pays the full toll.'),
      ],
      [
        S('Soften and observe with them', 'Shared gaze, shared calm.'),
        M('Ask only clinical questions', 'Data has a small fee.'),
        H('Bargain memories for exit', 'Memory trades cut deep.'),
        W('Fight the restraints', 'Struggle empties you.'),
      ],
      [
        S('Accept non-verbal contact', 'Telepathy is free if open.'),
        M('Focus on one device', 'Tunnel vision costs.'),
        H('Demand identity of reality', 'Bureaucracy of the soul fails.'),
        W('Refuse all contact', 'Rejection triggers full drain.'),
      ],
      [
        S('Stay still on the table', 'Stillness is currency.'),
        M('Map every grey face', 'Cataloging takes a cut.'),
        H('Trade Alice Coins for freedom', 'They accept — poorly for you.'),
        W('Deny the memory as it forms', 'Denial deletes the pile.'),
      ],
      [
        S('Open mind for telepathy', 'Bandwidth without fear.'),
        M('Stay emotionally blank', 'Blankness is a light tax.'),
        H('Plead with Earth logic', 'Logic is not local here.'),
        W('Black out in fear', 'Wake with nothing.'),
      ],
    ],
  },

  // ── 5 Light Beings (loving) ────────────────────────────────────
  {
    level: 5,
    entityId: 'light-being',
    name: 'Light Beings',
    attackLine: 'Warmth that could unmake fear. Love so bright it asks everything.',
    failLine: 'Shield failed. Four paths — and a fifth gift of total reception.',
    loving: true,
    maxLossFraction: 0.5,
    sets: [
      [
        S('Open and receive', 'Let the light land.'),
        M('Hold onto “I must stay me”', 'Identity grips the purse.'),
        H('Bargain for power', 'Power-seeking dims the gift.'),
        W('Reject “too bright”', 'Turning away costs half.'),
      ],
      [
        S('Let love move through', 'You are a conduit, not a vault.'),
        M('Ask for proof', 'Proof is a small fee here.'),
        H('Clutch identity hard', 'Clutching leaks light-coins.'),
        W('Filter the welcome out', 'Half the satchel cools.'),
      ],
      [
        S('Rest in the radiance', 'Rest is acceptance.'),
        M('Stay polite but guarded', 'Guards have a toll.'),
        H('Demand control of the gift', 'Control halves the pile.'),
        W('Turn away from warmth', 'Cold takes up to half.'),
      ],
      [
        S('Soften fear completely', 'Fear leaving makes room for coins.'),
        M('Analyze the vision', 'Analysis taxes benevolence.'),
        H('Hold a secret from the light', 'Secrets cost moderate-heavy.'),
        W('Refuse the overwhelm', 'Refusal caps at half.'),
      ],
      [
        S('Breathe the benevolence', 'Breath welcomes the host.'),
        M('Stay half-open', 'Halfway reception, halfway tax.'),
        H('Name conditions for love', 'Conditions cut deep (to half).'),
        W('Push the light back', 'Pushback costs half the dream.'),
      ],
    ],
  },

  // ── 6 Goddess (loving) ─────────────────────────────────────────
  {
    level: 6,
    entityId: 'goddess',
    name: 'Goddess / Divine Feminine',
    attackLine: 'A mother-presence that knows the wound. She will not flinch.',
    failLine: 'No triple Goddess. Four heart doors — plus one total softening.',
    loving: true,
    maxLossFraction: 0.5,
    sets: [
      [
        S('Let her hold the wound', 'Comfort is free when allowed.'),
        M('Intellectualize the feeling', 'Mind talk costs a little.'),
        H('Hide the trauma', 'Hiding costs more.'),
        W('Push her away — “I’m fine”', 'Armor costs half.'),
      ],
      [
        S('Cry / feel fully', 'Tears clear the channel.'),
        M('Ask only “why me?”', 'Victim questions tax.'),
        H('Cover the memory', 'Covering leaks fortune.'),
        W('Refuse the intimacy', 'Half the coins cool.'),
      ],
      [
        S('Accept comfort without story', 'Storyless soft landing.'),
        M('Divert to small talk', 'Avoidance fee.'),
        H('Compare her to Earth mothers', 'Comparison cuts.'),
        W('Shut the heart door', 'Closed heart = half loss.'),
      ],
      [
        S('Show the buried memory', 'Revelation is the gift.'),
        M('Narrate without feeling', 'Numb narration tax.'),
        H('Perform strength', 'Performance costs.'),
        W('Deny the wound exists', 'Denial takes up to half.'),
      ],
      [
        S('Rest against her presence', 'Rest multiplies peace.'),
        M('Stay polite and distant', 'Distance has a toll.'),
        H('Bargain for specific healing', 'Bargains cut deep (≤ half).'),
        W('Reject the mother-field', 'Rejection caps at half.'),
      ],
    ],
  },

  // ── 7 Fractal Architects ───────────────────────────────────────
  {
    level: 7,
    entityId: 'fractal-being',
    name: 'Fractal Architects',
    attackLine: 'Space folds. Living math constructs and deconstructs the room.',
    failLine: 'Shield failed. Four geometry doors.',
    loving: false,
    maxLossFraction: 1,
    sets: [
      [
        S('Watch geometry rebuild', 'Witness is enough.'),
        M('Try to solve the math', 'Solving taxes the lattice.'),
        H('Force a preferred shape', 'Forcing warps your fortune.'),
        W('Panic as space dissolves', 'Panic zeros the pile.'),
      ],
      [
        S('Let dimensions fold', 'Fold with them.'),
        M('Sketch patterns in mind', 'Sketching has a fee.'),
        H('Grab a fractal edge', 'Touching cuts deep.'),
        W('Flee the lattice', 'Flight empties you.'),
      ],
      [
        S('Witness without controlling', 'No hands on the code.'),
        M('Count symmetries', 'Counting is a small tax.'),
        H('Rewrite the diagram', 'Unauthorized edits cost.'),
        W('Deny higher dimensions', 'Denial collapses coins.'),
      ],
      [
        S('Float inside the structure', 'Belong to the build.'),
        M('Name every polyhedron', 'Naming has a toll.'),
        H('Pin space still', 'Stillness forced is expensive.'),
        W('Shatter the pattern', 'Shattering takes all.'),
      ],
      [
        S('Accept the demonstration', 'They are teaching structure.'),
        M('Compare to human science', 'Comparison fee.'),
        H('Steal a blueprint', 'Theft of form is costly.'),
        W('Close perception of structure', 'Blindness = empty satchel.'),
      ],
    ],
  },

  // ── 8 Serpent ──────────────────────────────────────────────────
  {
    level: 8,
    entityId: 'serpent',
    name: 'Serpent / Ouroboros',
    attackLine: 'Coiled energy rises. Ancient, initiatory, not interested in small talk.',
    failLine: 'No triple Serpent. Four initiation doors.',
    loving: false,
    maxLossFraction: 1,
    sets: [
      [
        S('Breathe with rising energy', 'Breath rides the coil.'),
        M('Observe without moving', 'Still watchfulness costs a little.'),
        H('Clamp down / resist the coil', 'Resistance burns coins.'),
        W('Fight — “get it off me”', 'War with the serpent zeros you.'),
      ],
      [
        S('Allow the shed', 'Skins fall; fortune stays.'),
        M('Watch the scales only', 'Partial attention tax.'),
        H('Push energy back down', 'Suppression costs heavy.'),
        W('Panic thrash the serpent', 'Thrashing empties the bag.'),
      ],
      [
        S('Soften spine / open channel', 'Open channel, open grace.'),
        M('Name the sensation', 'Naming is a fee.'),
        H('Brace every muscle', 'Bracing leaks fortune.'),
        W('Reject the initiation', 'Rejection takes all.'),
      ],
      [
        S('Ride the coil upward', 'Ride, don’t drive.'),
        M('Stay curious but tight', 'Tightness taxes.'),
        H('Bargain to stop halfway', 'Halfway bargains cut deep.'),
        W('Cut the ouroboros', 'Severing the circle zeros you.'),
      ],
      [
        S('Trust the ancient process', 'Older than fear.'),
        M('Catalog fear', 'Cataloging has a cost.'),
        H('Hold breath against the rise', 'Breath-holding burns pile.'),
        W('Eject from the body violently', 'Ejection fee: everything.'),
      ],
    ],
  },

  // ── 9 Ancestors (loving) ───────────────────────────────────────
  {
    level: 9,
    entityId: 'ancestor',
    name: 'Ancestors / Guides',
    attackLine: 'Familiar faces. Lineage. Less alien — more personal.',
    failLine: 'Shield failed. Four family doors — plus one total blessing.',
    loving: true,
    maxLossFraction: 0.5,
    sets: [
      [
        S('Receive love / forgiveness', 'Reception is free.'),
        M('Ask only for answers', 'Utility questions tax.'),
        H('Cling and won’t let go', 'Clinging costs more.'),
        W('Reject them as illusion', 'Rejection caps at half.'),
      ],
      [
        S('Speak honestly to them', 'Truth softens the field.'),
        M('Stay polite and distant', 'Distance fee.'),
        H('Beg them to stay forever', 'Begging cuts (≤ half).'),
        W('Guilt spiral', 'Guilt takes up to half.'),
      ],
      [
        S('Accept guidance on life', 'Guidance lands clean.'),
        M('Demand lottery-style facts', 'Greed for data taxes.'),
        H('Hide unfinished business', 'Secrets cost.'),
        W('Slam the lineage door', 'Closed lineage = half loss.'),
      ],
      [
        S('Share love both ways', 'Reciprocity is the gift.'),
        M('Intellectualize the visit', 'Mind talk fee.'),
        H('Compare faces carefully', 'Doubt cuts.'),
        W('Deny the familiar bond', 'Denial to half.'),
      ],
      [
        S('Rest in familiarity', 'Home is here.'),
        M('Stay half-present', 'Halfway presence tax.'),
        H('Demand they fix Earth problems', 'Demands cut deep (≤ half).'),
        W('Walk away from the table', 'Walking away costs half.'),
      ],
    ],
  },

  // ── 10 The Other (boss) ────────────────────────────────────────
  {
    level: 10,
    entityId: 'the-other',
    name: 'The Other',
    attackLine: 'No face. No edge. A vast intelligence that contains the room — and you.',
    failLine: 'Shield failed. Four dissolve doors. There is no fifth mercy here.',
    loving: false,
    maxLossFraction: 1,
    sets: [
      [
        S('Allow dissolve / non-self', 'Stop being a visitor.'),
        M('Anchor on one “I” memory', 'Anchors cost.'),
        H('Demand a face / form', 'Forms are expensive here.'),
        W('Full ego-death panic', 'Panic zeros the satchel.'),
      ],
      [
        S('Rest as pure awareness', 'Awareness needs no coins — and keeps them.'),
        M('Keep a name/story', 'Story has a fee.'),
        H('Negotiate with infinity', 'Negotiation fails loudly.'),
        W('Reject being seen', 'Rejection empties you.'),
      ],
      [
        S('Soften into the vastness', 'Softness is survival.'),
        M('Hold one human image', 'Images tax the infinite.'),
        H('Build a wall of identity', 'Walls crack — coins spill.'),
        W('Fragment in terror', 'Fragments hold no fortune.'),
      ],
      [
        S('Consent to be observed', 'Seen without fear.'),
        M('Ask only tiny questions', 'Tiny questions, tiny tax.'),
        H('Steal “power” from the void', 'Theft of infinity is costly.'),
        W('Deny the Other exists', 'Denial deletes everything.'),
      ],
      [
        S('Become quiet presence', 'Quiet keeps the pile.'),
        M('Measure the infinite', 'Measurement fails for a fee.'),
        H('Force a peer conversation', 'Peers do not exist here.'),
        W('Flee violently back to body', 'Ejection fee: all Alice Coins.'),
      ],
    ],
  },
];

export function getEncounter(level: number): LevelEncounter {
  const found = LEVEL_ENCOUNTERS.find(e => e.level === level);
  return found ?? LEVEL_ENCOUNTERS[0]!;
}

/** Pick set index 0–4 for a level from run seed (stable per dive). */
export function pickSetIndex(level: number, runSeed: number): number {
  const enc = getEncounter(level);
  const n = enc.sets.length;
  // simple mix
  const x = Math.abs((runSeed * 1103515245 + level * 12345) >>> 0);
  return x % n;
}

export function buildChoicesForLevel(
  level: number,
  runSeed: number,
  doubleAlreadyUsed: boolean,
): EncounterChoice[] {
  const enc = getEncounter(level);
  const setIdx = pickSetIndex(level, runSeed);
  const base = [...enc.sets[setIdx]!];

  // Shuffle the four
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j]!, base[i]!];
  }

  if (enc.loving && !doubleAlreadyUsed) {
    const d = LOVING_DOUBLE_POOL[setIdx % LOVING_DOUBLE_POOL.length]!;
    // Insert double at random position among 5
    const insertAt = Math.floor(Math.random() * (base.length + 1));
    base.splice(insertAt, 0, d);
  }

  return base;
}

export const LOSS_FRACTION: Record<ChoiceTier, number> = {
  none: 0,
  moderate: 0.28,
  heavy: 0.65,
  wipe: 1,
  double: 0, // handled separately
};
