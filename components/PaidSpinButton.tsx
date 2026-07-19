'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import type { PaidSpinQuote } from '@/lib/sol-payment';

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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function walletErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'Payment failed.';
  const msg = err.message || 'Payment failed.';

  if (/User rejected|rejected the request|Approval Denied|denied by user|User canceled/i.test(msg)) {
    return 'Wallet cancelled the payment.';
  }
  if (/insufficient|0x1|insufficient funds/i.test(msg)) {
    return 'Not enough SOL for the 25¢ spin plus network fees.';
  }
  if (/WalletNotConnected|not connected|WalletConnectionError/i.test(msg)) {
    return 'Wallet not connected — connect Solflare, unlock it, then try again.';
  }
  if (/WalletSignTransactionError|WalletSendTransactionError|Unexpected error/i.test(msg)) {
    return 'Solflare did not complete signing. Unlock the Solflare extension, keep this tab focused, and try again.';
  }
  if (/blockhash|expired|not valid|block height exceeded|Blockhash not found/i.test(msg)) {
    return 'Network ticket expired before Solflare opened. Unlock Solflare first, then tap Quarter Slot again.';
  }
  if (/403|429|Failed to fetch|timeout|timed out/i.test(msg)) {
    return 'Solana RPC is busy — wait a few seconds and try again.';
  }
  return msg;
}

function isRetryableSendError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message || '';
  if (/User rejected|rejected the request|Approval Denied|denied by user|insufficient|0x1/i.test(msg)) {
    return false;
  }
  return /blockhash|expired|not valid|block height exceeded|Blockhash not found|timeout|timed out|429|403|Failed to fetch|Node is behind|slot|WalletSendTransactionError|Unexpected error/i.test(
    msg,
  );
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

  const walletName = wallet?.adapter?.name ?? 'wallet';

  const loadQuote = useCallback(() => {
    setQuoteLoading(true);
    setError(null);
    fetch('/api/casino/paid-spin')
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Could not load spin price.');
        setQuote(data as PaidSpinQuote);
      })
      .catch(err => {
        setQuote(null);
        setError(err instanceof Error ? err.message : 'Could not load spin price.');
      })
      .finally(() => setQuoteLoading(false));
  }, []);

  useEffect(() => {
    loadQuote();
  }, [loadQuote]);

  /** Soft confirm — never fail the spin if we already have a signature. */
  const waitForConfirmation = useCallback(
    async (signature: string, blockhash: string, lastValidBlockHeight: number) => {
      try {
        await Promise.race([
          connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            'confirmed',
          ),
          sleep(25_000),
        ]);
      } catch {
        // ignore — poll below
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

  /**
   * Solflare: use sendTransaction only (signTransaction often never opens a popup).
   * Get blockhash immediately before calling the wallet so the popup is the next step.
   */
  const sendQuarterPayment = useCallback(
    async (activeQuote: PaidSpinQuote): Promise<string> => {
      if (!publicKey) {
        throw new Error('Connect your wallet for the Quarter Slot Machine.');
      }
      if (!connected) {
        throw new Error('Wallet not connected — connect Solflare, unlock it, then try again.');
      }
      if (!sendTransaction) {
        throw new Error('This wallet cannot send transactions. Try Solflare or Phantom.');
      }

      const treasury = new PublicKey(activeQuote.treasuryPubkey);
      let lastErr: unknown = new Error('Payment failed.');

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) {
            setStatus(`Retry ${attempt + 1}/3 — watch for the ${walletName} popup…`);
            await sleep(600 * attempt);
          }

          setStatus(`Opening ${walletName}…`);

          // Blockhash immediately before wallet UI — critical for Solflare.
          const { blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash('confirmed');

          const tx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: treasury,
              lamports: activeQuote.lamports,
            }),
          );
          tx.recentBlockhash = blockhash;
          tx.feePayer = publicKey;

          // Standard adapter path — Solflare reliably shows approve UI here.
          // Do NOT use signTransaction first (Solflare often never pops).
          const signature = await sendTransaction(tx, connection, {
            skipPreflight: true,
            preflightCommitment: 'processed',
            maxRetries: 3,
          });

          if (!signature || typeof signature !== 'string') {
            throw new Error(
              `${walletName} did not return a transaction. Unlock the extension and try again.`,
            );
          }

          setStatus('Payment sent — confirming…');
          await waitForConfirmation(signature, blockhash, lastValidBlockHeight);
          return signature;
        } catch (err) {
          lastErr = err;
          if (!isRetryableSendError(err) || attempt >= 2) {
            throw err;
          }
        }
      }

      throw lastErr;
    },
    [publicKey, connected, connection, sendTransaction, waitForConfirmation, walletName],
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
            `${lastError} (tx ${signature.slice(0, 12)}… — if SOL left your wallet, wait and contact support with this id.)`,
          );
        }
      }

      throw new Error(
        `${lastError} (tx ${signature.slice(0, 12)}… — payment may have landed; try again in a few seconds.)`,
      );
    },
    [publicKey, sessionId, settleToken, onSpinGranted],
  );

  const buySpin = useCallback(async () => {
    if (!connected || !publicKey || !quote) {
      setError('Connect Solflare or Phantom for the Quarter Slot.');
      return;
    }
    if (connecting) {
      setError('Wallet still connecting — wait a second, then try again.');
      return;
    }

    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      // Refresh quote first so the wallet call is the next thing after the click.
      let activeQuote = quote;
      try {
        const r = await fetch('/api/casino/paid-spin');
        const data = await r.json();
        if (r.ok) {
          activeQuote = data as PaidSpinQuote;
          setQuote(activeQuote);
        }
      } catch {
        // keep quote
      }

      const signature = await sendQuarterPayment(activeQuote);
      await redeemSignature(signature);
      setStatus(null);
      setError(null);
    } catch (err) {
      setError(walletErrorMessage(err));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [connected, connecting, publicKey, quote, sendQuarterPayment, redeemSignature]);

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
        SOL goes to the shared treasury. Unlock Solflare before tapping — the approve popup should open next.
      </p>

      {!connected && (
        <div className="paid-spin-wallet">
          <p className="paid-spin-wallet-label">Connect wallet to buy spins</p>
          <WalletMultiButton />
        </div>
      )}

      {connected && publicKey && (
        <p className="paid-spin-connected">
          {walletName} · {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
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
            ? status ?? 'Waiting for wallet…'
            : connected
              ? 'Quarter Slot · 25¢ SOL'
              : 'Connect wallet above first'}
        </button>
      )}
    </div>
  );
}
