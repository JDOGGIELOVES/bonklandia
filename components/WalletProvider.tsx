'use client';

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { useMemo } from 'react';
import { WALLET_ENDPOINT, WALLET_NETWORK } from '@/lib/wallet/config';

export function WalletProviderWrapper({ children }: { children: React.ReactNode }) {
  const network = WALLET_NETWORK;
  const endpoint = useMemo(() => WALLET_ENDPOINT, []);

  // Solflare first — users primarily use Solflare; order affects default selection.
  const wallets = useMemo(
    () => [
      new SolflareWalletAdapter({ network }),
      new PhantomWalletAdapter(),
    ],
    [network],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}