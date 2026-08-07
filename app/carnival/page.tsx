import CarnivalWheelGame from '@/components/CarnivalWheelGame';
import { BRAND } from '@/lib/brand';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: `Carnival Wheel · ${BRAND.name}`,
  description: `$${0.25} BONGA carnival wheel — 32 spaces, family logo d6, Cashier-only exits.`,
};

export default function CarnivalPage() {
  return <CarnivalWheelGame />;
}
