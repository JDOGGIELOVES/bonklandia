import type { ReactNode } from 'react';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';

type Props = {
  className?: string;
  /** Show a leading arrow (default true on “back” style bars). */
  arrow?: boolean;
  children?: ReactNode;
};

/**
 * Always-available path back to the Bonklandia hub (champion select + realm doors).
 */
export default function HomeNavLink({ className, arrow = true, children }: Props) {
  const label = children ?? BRAND.home;
  return (
    <Link href={`${BRAND.homePath}${BRAND.homeAnchor}`} className={className} title="Back to Bonklandia Home">
      {arrow ? <>← {label}</> : label}
    </Link>
  );
}
