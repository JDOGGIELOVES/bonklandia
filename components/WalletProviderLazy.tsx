'use client';

import dynamic from 'next/dynamic';

const WalletProviderWrapper = dynamic(
  () => import('@/components/WalletProvider').then((m) => m.WalletProviderWrapper),
  { ssr: false },
);

export function WalletProviderLazy({ children }: { children: React.ReactNode }) {
  return <WalletProviderWrapper>{children}</WalletProviderWrapper>;
}