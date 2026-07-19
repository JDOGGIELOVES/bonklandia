import {
  Connection,
  type PublicKey,
  type Transaction,
  type TransactionSignature,
} from '@solana/web3.js';

/** Minimal Solflare / multi-wallet injected provider surface. */
type InjectedProvider = {
  isSolflare?: boolean;
  isPhantom?: boolean;
  publicKey?: { toBase58?: () => string; toString?: () => string };
  connect?: (opts?: { onlyIfTrusted?: boolean }) => Promise<void>;
  signAndSendTransaction?: (
    transaction: Transaction,
    opts?: { skipPreflight?: boolean; preflightCommitment?: string; maxRetries?: number },
  ) => Promise<TransactionSignature | { signature: TransactionSignature }>;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
};

function providerAddress(provider: InjectedProvider): string | null {
  const pk = provider.publicKey;
  if (!pk) return null;
  if (typeof pk.toBase58 === 'function') return pk.toBase58();
  if (typeof pk.toString === 'function') return pk.toString();
  return null;
}

/** Prefer Solflare's own inject, then generic solana if it is Solflare. */
export function getSolflareProvider(): InjectedProvider | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    solflare?: InjectedProvider;
    solana?: InjectedProvider;
  };
  if (w.solflare?.isSolflare) return w.solflare;
  if (w.solana?.isSolflare) return w.solana;
  return null;
}

export function getPhantomProvider(): InjectedProvider | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    phantom?: { solana?: InjectedProvider };
    solana?: InjectedProvider;
  };
  if (w.phantom?.solana?.isPhantom) return w.phantom.solana;
  if (w.solana?.isPhantom) return w.solana;
  return null;
}

/**
 * Send a SOL transfer with the best path for the connected wallet.
 * Call this as soon as possible after a user click (no long awaits before this).
 */
export async function sendSolTransferWithWallet(opts: {
  transaction: Transaction;
  connection: Connection;
  expectedPayer: PublicKey;
  /** From wallet-adapter useWallet().sendTransaction */
  adapterSendTransaction?: (
    transaction: Transaction,
    connection: Connection,
    options?: {
      skipPreflight?: boolean;
      preflightCommitment?: 'processed' | 'confirmed' | 'finalized';
      maxRetries?: number;
    },
  ) => Promise<TransactionSignature>;
  walletName?: string;
}): Promise<TransactionSignature> {
  const { transaction, connection, expectedPayer, adapterSendTransaction, walletName } = opts;
  const expected = expectedPayer.toBase58();
  const name = (walletName ?? '').toLowerCase();

  // 1) Solflare injected provider (most reliable popup on desktop extension)
  if (name.includes('solflare') || getSolflareProvider()) {
    const solflare = getSolflareProvider();
    if (solflare) {
      if (!solflare.publicKey && solflare.connect) {
        await solflare.connect();
      }
      const addr = providerAddress(solflare);
      if (addr && addr !== expected) {
        throw new Error(
          `Solflare is on ${addr.slice(0, 4)}…${addr.slice(-4)} but the app is connected as ${expected.slice(0, 4)}…${expected.slice(-4)}. Disconnect and reconnect Solflare.`,
        );
      }

      if (typeof solflare.signAndSendTransaction === 'function') {
        const result = await solflare.signAndSendTransaction(transaction, {
          skipPreflight: true,
          preflightCommitment: 'processed',
          maxRetries: 5,
        });
        const sig = typeof result === 'string' ? result : result.signature;
        if (!sig) throw new Error('Solflare did not return a signature.');
        return sig;
      }

      if (typeof solflare.signTransaction === 'function') {
        const signed = await solflare.signTransaction(transaction);
        return connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: true,
          maxRetries: 5,
          preflightCommitment: 'processed',
        });
      }
    }
  }

  // 2) Phantom injected provider
  if (name.includes('phantom') || getPhantomProvider()) {
    const phantom = getPhantomProvider();
    if (phantom?.signAndSendTransaction) {
      if (!phantom.publicKey && phantom.connect) await phantom.connect();
      const result = await phantom.signAndSendTransaction(transaction, {
        skipPreflight: true,
        preflightCommitment: 'processed',
        maxRetries: 5,
      });
      const sig = typeof result === 'string' ? result : result.signature;
      if (sig) return sig;
    }
  }

  // 3) Wallet-adapter fallback
  if (adapterSendTransaction) {
    return adapterSendTransaction(transaction, connection, {
      skipPreflight: true,
      preflightCommitment: 'processed',
      maxRetries: 5,
    });
  }

  throw new Error(
    'No wallet provider available to send the payment. Install/unlock Solflare or Phantom and reconnect.',
  );
}
