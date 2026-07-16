'use client';

import Link from 'next/link';
import { useBonkBank } from '@/hooks/useBonkBank';
import { BRAND } from '@/lib/brand';

export default function BonkBankBadge() {
  const { chips } = useBonkBank();

  return (
    <Link href="/cashier" className="bonk-bank-badge">
      <span className="bonk-bank-badge-label">{BRAND.bank}</span>
      <span className="bonk-bank-badge-chips">{chips.toLocaleString()} chips</span>
    </Link>
  );
}