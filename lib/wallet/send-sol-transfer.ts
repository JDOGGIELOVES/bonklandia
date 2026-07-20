import {
  Connection,
  type PublicKey,
  type Transaction,
  type TransactionSignature,
} from '@solana/web3.js';

/** Minimal injected provider (Solflare / Phantom). */
export type InjectedProvider = {
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

export function getSolflareProvider(): InjectedProvider | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    solflare?: InjectedProvider;
    SolflareApp?: InjectedProvider;
    solana?: InjectedProvider;
  };
  if (w.solflare?.isSolflare) return w.solflare;
  if (w.SolflareApp) return w.SolflareApp;
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

export function detectInjectedWalletLabel(): string {
  if (getSolflareProvider()) return 'Solflare extension detected';
  if (getPhantomProvider()) return 'Phantom extension detected';
  return 'No browser extension detected (use Solflare desktop extension or Solflare in-app browser)';
}

function normalizeSig(
  result: TransactionSignature | { signature: TransactionSignature },
): TransactionSignature {
  const sig = typeof result === 'string' ? result : result?.signature;
  if (!sig) throw new Error('Wallet did not return a signature.');
  return sig;
}

/**
 * Send SOL transfer. Call with a pre-built transaction that already has
 * recentBlockhash set. The FIRST await in the click handler should be this function
 * so Solflare still treats it as a user gesture.
 */
export async function sendSolTransferWithWallet(opts: {
  transaction: Transaction;
  connection: Connection;
  expectedPayer: PublicKey;
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
  const preferSolflare = name.includes('solflare') || Boolean(getSolflareProvider());

  // —— Path A: Solflare inject (desktop extension) ——
  if (preferSolflare) {
    const solflare = getSolflareProvider();
    if (!solflare) {
      throw new Error(
        'Solflare extension not found in this browser. Install Solflare, or open bonklandia.com inside the Solflare mobile app browser.',
      );
    }

    // Connect if needed — this may open Solflare (still OK as first interaction).
    if (!solflare.publicKey && solflare.connect) {
      await solflare.connect();
    }

    const addr = providerAddress(solflare);
    if (addr && addr !== expected) {
      throw new Error(
        `Solflare account ${addr.slice(0, 4)}…${addr.slice(-4)} does not match the app connection ${expected.slice(0, 4)}…${expected.slice(-4)}. Disconnect in the site wallet button and reconnect with the right account.`,
      );
    }

    if (typeof solflare.signAndSendTransaction === 'function') {
      try {
        const result = await solflare.signAndSendTransaction(transaction, {
          skipPreflight: true,
          preflightCommitment: 'processed',
          maxRetries: 5,
        });
        return normalizeSig(result);
      } catch (err) {
        // Fall through to signTransaction / adapter
        const msg = err instanceof Error ? err.message : String(err);
        if (/reject|cancel|denied/i.test(msg)) throw err;
      }
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

  // —— Path B: Phantom inject ——
  if (name.includes('phantom') || getPhantomProvider()) {
    const phantom = getPhantomProvider();
    if (phantom) {
      if (!phantom.publicKey && phantom.connect) await phantom.connect();
      if (typeof phantom.signAndSendTransaction === 'function') {
        const result = await phantom.signAndSendTransaction(transaction, {
          skipPreflight: true,
          preflightCommitment: 'processed',
          maxRetries: 5,
        });
        return normalizeSig(result);
      }
    }
  }

  // —— Path C: wallet-adapter ——
  if (adapterSendTransaction) {
    return adapterSendTransaction(transaction, connection, {
      skipPreflight: true,
      preflightCommitment: 'processed',
      maxRetries: 5,
    });
  }

  throw new Error(
    'Could not open a wallet to sign. Install the Solflare browser extension, unlock it, reconnect on this page, and try again.',
  );
}
