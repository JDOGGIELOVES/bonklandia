import { BRAND } from '@/lib/brand';

export const ALICE_COACH_KEY = `${BRAND.storagePrefix}-alice-coach-v1`;

export type AliceCoachTip = {
  id: string;
  title: string;
  body: string;
};

export const ALICE_COACH_TIPS: AliceCoachTip[] = [
  {
    id: 'pull',
    title: 'Pull the lever',
    body: 'Each layer starts with one prize pull for Alice Coins. Defense runs automatically after.',
  },
  {
    id: 'shield',
    title: 'Auto shield',
    body: 'You need three of that layer’s being on the line. Hit it and you skip the doors.',
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
