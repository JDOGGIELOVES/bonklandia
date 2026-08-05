import { BRAND } from '@/lib/brand';

/** Bump when coach copy changes so returning players see updated tips. */
export const ALICE_COACH_KEY = `${BRAND.storagePrefix}-alice-coach-v2`;

export type AliceCoachTip = {
  id: string;
  title: string;
  body: string;
};

export const ALICE_COACH_TIPS: AliceCoachTip[] = [
  {
    id: 'pull',
    title: 'Pull for coins',
    body: 'Each layer starts with a prize pull for Alice Coins. Enjoy the lever — you pull it yourself.',
  },
  {
    id: 'shield',
    title: 'Pull again for shield',
    body: 'After the prize, pull a second time. Land three of that layer’s being to skip the doors.',
  },
  {
    id: 'doors',
    title: 'Strategy doors',
    body: 'If the shield fails, four paths open. One is safe. Labels mislead — read the whisper.',
  },
  {
    id: 'bank',
    title: 'Bank only at the end',
    body: 'Only the final tally after The Other can become spendable chips. Dream coins alone do not cash out.',
  },
];

export function isAliceCoachDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(ALICE_COACH_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissAliceCoach(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ALICE_COACH_KEY, '1');
  } catch {
    /* */
  }
}
