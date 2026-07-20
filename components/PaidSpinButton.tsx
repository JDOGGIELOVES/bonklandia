'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import type { PaidSpinQuote } from '@/lib/sol-payment';
import {
  detectInjectedWalletLabel,
  getSolflareProvider,
  sendSolTransferWithWallet,
} from '@/lib/wallet/send-sol-transfer';

type PaidSpinGranted = {
  settleToken?: string;
  maxWinnings?: number;
};

type PaidSpinButtonProps = {
  disabled?: boolean;
  sessionId: string;
  settleToken?: string;
  onSpinGranted: (update?: PaidSpinGranted) => void;
};

type PrefetchedBlockhash = {
  blockhash: string;
  lastValidBlockHeight: number;
  fetchedAt: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function walletErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'Payment failed.';
  const msg = err.message || 'Payment failed.';

  if (/User rejected|rejected the request|Approval Denied|denied by user|User canceled|cancelled/i.test(msg)) {
    return 'Wallet cancelled the payment.';
  }
  if (/insufficient|0x1|insufficient funds/i.test(msg)) {
    return 'Not enough SOL for the 25¢ spin plus network fees.';
  }
  if (/extension not found|Could not open a wallet|No browser extension/i.test(msg)) {
    return msg;
  }
  if (/does not match the app connection/i.test(msg)) {
    return msg;
  }
  if (/WalletNotConnected|not connected|WalletConnectionError|reconnect/i.test(msg)) {
    return 'Wallet not connected — unlock Solflare, reconnect with the wallet button, then try again.';
  }
  if (/blockhash|expired|not valid|block height exceeded|Blockhash not found/i.test(msg)) {
    return 'Network ticket expired. Wait a second and tap Quarter Slot again.';
  }
  if (/403|429|Failed to fetch|timeout|timed out/i.test(msg)) {
    return 'Solana RPC is busy — wait a few seconds and try again.';
  }
  return msg;
}

export default function PaidSpinButton({
  disabled,
  sessionId,
  settleToken,
  onSpinGranted,
}: PaidSpinButtonProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected, wallet, connecting } = useWallet();
  const [quote, setQuote] = useState<PaidSpinQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [injectLabel, setInjectLabel] = useState('Checking wallet extension…');
  const [blockhashReady, setBlockhashReady] = useState(false);

  const quoteRef = useRef<PaidSpinQuote | null>(null);
  const blockhashRef = useRef<PrefetchedBlockhash | null>(null);

  const walletName = wallet?.adapter?.name ?? 'Wallet';

  // Keep quote warm (never fetch on click — that kills Solflare popups).
  const loadQuote = useCallback(() => {
    fetch('/api/casino/paid-spin')
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Could not load spin price.');
        const q = data as PaidSpinQuote;
        quoteRef.current = q;
        setQuote(q);
        setQuoteLoading(false);
      })
      .catch(err => {
        setQuote(null);
        quoteRef.current = null;
        setError(err instanceof Error ? err.message : 'Could not load spin price.');
        setQuoteLoading(false);
      });
  }, []);

  /** Prefer our server RPC — browser → public mainnet often returns 429. */
  const fetchBlockhash = useCallback(async (): Promise<PrefetchedBlockhash> => {
    // 1) Server-side RPC (Helius / SOLANA_RPC_URL when configured)
    try {
      const res = await fetch('/api/solana/blockhash', { cache: 'no-store' });
      const data = (await res.json()) as {
        blockhash?: string;
        lastValidBlockHeight?: number;
        error?: string;
      };
      if (res.ok && data.blockhash && data.lastValidBlockHeight != null) {
        return {
          blockhash: data.blockhash,
          lastValidBlockHeight: data.lastValidBlockHeight,
          fetchedAt: Date.now(),
        };
      }
    } catch {
      // fall through
    }

    // 2) Browser connection (publicnode or configured endpoint)
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash('confirmed');
    return { blockhash, lastValidBlockHeight, fetchedAt: Date.now() };
  }, [connection]);

  // Prefetch blockhash so the click path's FIRST await can be Solflare itself.
  const refreshBlockhash = useCallback(async () => {
    try {
      const bh = await fetchBlockhash();
      blockhashRef.current = bh;
      setBlockhashReady(true);
    } catch {
      setBlockhashReady(false);
    }
  }, [fetchBlockhash]);

  useEffect(() => {
    loadQuote();
    void refreshBlockhash();
    setInjectLabel(detectInjectedWalletLabel());

    const quoteId = window.setInterval(loadQuote, 40_000);
    const bhId = window.setInterval(() => void refreshBlockhash(), 12_000);
    const injectId = window.setInterval(() => setInjectLabel(detectInjectedWalletLabel()), 3000);

    return () => {
      window.clearInterval(quoteId);
      window.clearInterval(bhId);
      window.clearInterval(injectId);
    };
  }, [loadQuote, refreshBlockhash]);

  const waitForConfirmation = useCallback(
    async (signature: string, blockhash: string, lastValidBlockHeight: number) => {
      try {
        await Promise.race([
          connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            'confirmed',
          ),
          sleep(20_000),
        ]);
      } catch {
        // poll
      }

      for (let i = 0; i < 20; i++) {
        await sleep(750);
        try {
          const st = await connection.getSignatureStatus(signature, {
            searchTransactionHistory: true,
          });
          if (st.value?.err) throw new Error('Transaction failed on-chain.');
          const conf = st.value?.confirmationStatus;
          if (conf === 'confirmed' || conf === 'finalized') return;
        } catch (err) {
          if (err instanceof Error && /failed on-chain/i.test(err.message)) throw err;
        }
      }
    },
    [connection],
  );

  const redeemSignature = useCallback(
    async (signature: string) => {
      setStatus('Unlocking your spin…');

      let lastError = 'Payment verification failed.';
      for (let attempt = 0; attempt < 6; attempt++) {
        if (attempt > 0) {
          setStatus(`Finding payment on-chain — retry ${attempt + 1}/6…`);
          await sleep(1000 * attempt);
        }

        let res: Response;
        try {
          res = await fetch('/api/casino/paid-spin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              signature,
              payerWallet: publicKey?.toBase58(),
              sessionId,
              settleToken,
            }),
          });
        } catch {
          lastError = 'Could not reach server to unlock spin.';
          continue;
        }

        const raw = await res.text();
        let data: { error?: string; settleToken?: string; maxWinnings?: number } = {};
        try {
          data = raw ? (JSON.parse(raw) as typeof data) : {};
        } catch {
          lastError = `Server error (${res.status}).`;
          continue;
        }

        if (res.ok) {
          onSpinGranted({
            settleToken: data.settleToken,
            maxWinnings: data.maxWinnings,
          });
          return;
        }

        lastError = data.error ?? 'Payment verification failed.';
        if (!/not found|wait a moment|not found yet|busy|timeout|try again/i.test(lastError)) {
          throw new Error(
            `${lastError} (tx ${signature.slice(0, 12)}… — if SOL left your wallet, save this id.)`,
          );
        }
      }

      throw new Error(
        `${lastError} (tx ${signature.slice(0, 12)}… — payment may have landed; try again shortly.)`,
      );
    },
    [publicKey, sessionId, settleToken, onSpinGranted],
  );

  /**
   * Click handler: minimize awaits before wallet.
   * Prefetched quote + blockhash so first real await is Solflare signAndSend.
   */
  const buySpin = useCallback(async () => {
    if (!connected || !publicKey) {
      setError('Connect Solflare first (wallet button above), then tap Quarter Slot.');
      return;
    }
    if (connecting) {
      setError('Wallet still connecting — wait a second.');
      return;
    }

    const activeQuote = quoteRef.current ?? quote;
    if (!activeQuote) {
      setError('Price not loaded yet — wait a moment and try again.');
      loadQuote();
      return;
    }

    // Prefer prefetched hash; only hit network if missing/stale.
    let bh = blockhashRef.current;
    const bhAge = bh ? Date.now() - bh.fetchedAt : Infinity;
    if (!bh || bhAge > 40_000) {
      setLoading(true);
      setStatus('Getting network ticket…');
      try {
        bh = await fetchBlockhash();
        blockhashRef.current = bh;
        setBlockhashReady(true);
      } catch {
        setLoading(false);
        setError(
          'Could not reach Solana network. Wait a few seconds and try again (or set SOLANA_RPC_URL / NEXT_PUBLIC_SOLANA_RPC_URL to a private RPC like Helius).',
        );
        return;
      }
    }

    setLoading(true);
    setError(null);
    setStatus(`Opening ${walletName}…`);

    try {
      const treasury = new PublicKey(activeQuote.treasuryPubkey);
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: treasury,
          lamports: activeQuote.lamports,
        }),
      );
      tx.recentBlockhash = bh.blockhash;
      tx.feePayer = publicKey;

      // Prefer wallet interaction ASAP after we have a blockhash.
      const signature = await sendSolTransferWithWallet({
        transaction: tx,
        connection,
        expectedPayer: publicKey,
        adapterSendTransaction: sendTransaction,
        walletName,
      });

      setStatus('Payment sent — confirming…');
      await waitForConfirmation(signature, bh.blockhash, bh.lastValidBlockHeight);
      void refreshBlockhash();
      await redeemSignature(signature);
      setStatus(null);
    } catch (err) {
      setError(walletErrorMessage(err));
      setStatus(null);
      void refreshBlockhash();
    } finally {
      setLoading(false);
    }
  }, [
    connected,
    connecting,
    publicKey,
    quote,
    connection,
    sendTransaction,
    walletName,
    waitForConfirmation,
    redeemSignature,
    refreshBlockhash,
    fetchBlockhash,
    loadQuote,
  ]);

  const solflareInjected = Boolean(getSolflareProvider());

  return (
    <div className="paid-spin-panel">
      <div className="paid-spin-header">
        <span className="paid-spin-title">Quarter Slot Machine</span>
        <span className="paid-spin-price">25¢</span>
      </div>
      <p className="paid-spin-detail">
        {quoteLoading
          ? 'Loading live SOL price…'
          : quote
            ? `25 cents of Solana = 1 spin (~${quote.solAmount.toFixed(4)} SOL @ $${quote.solUsdPrice.toFixed(0)}/SOL)`
            : 'Pay 25¢ in SOL for one extra pull.'}
      </p>
      <p className="paid-spin-detail">
        SOL goes to the shared treasury. Desktop: use the Solflare <strong>browser extension</strong> (not only the
        mobile app). Open Solflare and make sure you&apos;re logged in, then tap below.
      </p>
      <p className="paid-spin-detail" style={{ fontSize: '0.85rem', opacity: 0.75 }}>
        {injectLabel}
        {blockhashReady ? ' · network ready' : ' · preparing network…'}
      </p>

      {!connected && (
        <div className="paid-spin-wallet">
          <p className="paid-spin-wallet-label">Connect Solflare or Phantom</p>
          <WalletMultiButton />
        </div>
      )}

      {connected && publicKey && (
        <p className="paid-spin-connected">
          {walletName} · {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
          {solflareInjected ? ' · extension OK' : ' · extension not seen'}
        </p>
      )}

      {connected && !solflareInjected && /solflare/i.test(walletName) && (
        <p className="paid-spin-error">
          Connected as Solflare but the browser extension is not injected. Install/enable the Solflare Chrome/Firefox
          extension, or open this site in the Solflare mobile in-app browser.
        </p>
      )}

      {error && <p className="paid-spin-error">{error}</p>}
      {loading && status && <p className="paid-spin-detail">{status}</p>}

      {!quote && !quoteLoading && (
        <button
          type="button"
          className="art-btn paid-spin-btn w-full py-2.5 text-[#f0d878]"
          onClick={loadQuote}
        >
          Retry price load
        </button>
      )}

      {quote && (
        <button
          type="button"
          className="art-btn paid-spin-btn w-full py-2.5 text-[#f0d878]"
          onClick={() => void buySpin()}
          disabled={disabled || loading || !connected || connecting}
        >
          {loading
            ? status ?? 'Waiting for Solflare…'
            : connected
              ? 'Quarter Slot · 25¢ SOL'
              : 'Connect wallet above first'}
        </button>
      )}
    </div>
  );
}
