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
  if (/User rejected|rejected the request|Approval Denied|denied by user/i.test(msg)) {
    return 'Wallet cancelled the payment.';
  }
  if (/insufficient|0x1|insufficient funds/i.test(msg)) {
    return 'Not enough SOL for the 25¢ spin plus network fees.';
  }
  if (/blockhash|expired|not valid|block height exceeded|Blockhash not found/i.test(msg)) {
    return 'Solflare/RPC took too long (blockhash expired). Tap Quarter Slot again and approve quickly.';
  }
  if (/403|429|fetch|Failed to fetch|timeout|timed out|network/i.test(msg)) {
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
  return /blockhash|expired|not valid|block height exceeded|Blockhash not found|timeout|timed out|429|403|fetch|network|Failed to fetch|Node is behind|slot/i.test(
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
  const { publicKey, sendTransaction, signTransaction, connected } = useWallet();
  const [quote, setQuote] = useState<PaidSpinQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          'confirmed',
        );
        return;
      } catch {
        // Solflare + public RPC often times out here even when the tx lands.
      }

      for (let i = 0; i < 24; i++) {
        await sleep(700);
        try {
          const st = await connection.getSignatureStatus(signature, {
            searchTransactionHistory: true,
          });
          if (st.value?.err) {
            throw new Error('Transaction failed on-chain.');
          }
          const conf = st.value?.confirmationStatus;
          if (conf === 'confirmed' || conf === 'finalized') {
            return;
          }
        } catch (err) {
          if (err instanceof Error && /failed on-chain/i.test(err.message)) throw err;
        }
      }
      // Soft success — redeem API will poll for the tx.
    },
    [connection],
  );

  const sendQuarterPayment = useCallback(
    async (activeQuote: PaidSpinQuote): Promise<string> => {
      if (!publicKey) {
        throw new Error('Connect your wallet for the Quarter Slot Machine.');
      }

      const treasury = new PublicKey(activeQuote.treasuryPubkey);
      let lastErr: unknown = new Error('Payment failed.');

      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          if (attempt > 0) {
            setStatus(`Retry ${attempt + 1}/4 — approve quickly in your wallet…`);
            await sleep(400 * attempt);
          } else {
            setStatus('Getting a fresh network ticket…');
          }

          // Fresh blockhash immediately before signing (Solflare users often take long to approve).
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

          setStatus('Approve in Solflare/Phantom…');

          let signature: string;

          // Prefer sign + raw send — Solflare is more reliable with skipPreflight this way.
          if (signTransaction) {
            const signed = await signTransaction(tx);
            setStatus('Broadcasting payment…');
            signature = await connection.sendRawTransaction(signed.serialize(), {
              skipPreflight: true,
              maxRetries: 5,
              preflightCommitment: 'processed',
            });
          } else {
            signature = await sendTransaction(tx, connection, {
              skipPreflight: true,
              preflightCommitment: 'processed',
              maxRetries: 5,
            });
          }

          setStatus('Confirming on Solana…');
          await waitForConfirmation(signature, blockhash, lastValidBlockHeight);
          return signature;
        } catch (err) {
          lastErr = err;
          // Only retry if the wallet didn't reject and the error looks like lag/blockhash.
          if (!isRetryableSendError(err) || attempt >= 3) {
            throw err;
          }
        }
      }

      throw lastErr;
    },
    [publicKey, connection, sendTransaction, signTransaction, waitForConfirmation],
  );

  const redeemSignature = useCallback(
    async (signature: string) => {
      setStatus('Unlocking your spin…');

      let lastError = 'Payment verification failed.';
      for (let attempt = 0; attempt < 6; attempt++) {
        if (attempt > 0) {
          setStatus(`Still finding payment on-chain — retry ${attempt + 1}/6…`);
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
        // Retry when chain/RPC hasn't indexed the tx yet.
        if (!/not found|wait a moment|not found yet|busy|timeout|try again/i.test(lastError)) {
          throw new Error(
            `${lastError} (tx ${signature.slice(0, 12)}… — if SOL left your wallet, wait 10s and tap again with the same payment or contact support.)`,
          );
        }
      }

      throw new Error(
        `${lastError} (tx ${signature.slice(0, 12)}… — payment may have landed; wait and try unlocking again.)`,
      );
    },
    [publicKey, sessionId, settleToken, onSpinGranted],
  );

  const buySpin = useCallback(async () => {
    if (!connected || !publicKey || !quote) {
      setError('Connect your wallet for the Quarter Slot Machine.');
      return;
    }

    setLoading(true);
    setError(null);
    setStatus(null);

    try {
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
    } catch (err) {
      setError(walletErrorMessage(err));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, quote, sendQuarterPayment, redeemSignature]);

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
        SOL goes to the shared treasury. Solflare: approve promptly so the network ticket stays valid.
      </p>

      {!connected && (
        <div className="paid-spin-wallet">
          <p className="paid-spin-wallet-label">Connect wallet to buy spins</p>
          <WalletMultiButton />
        </div>
      )}

      {connected && publicKey && (
        <p className="paid-spin-connected">
          Wallet ready · {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
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
          disabled={disabled || loading || !connected}
        >
          {loading
            ? status ?? 'Confirming on Solana…'
            : connected
              ? 'Quarter Slot · 25¢ SOL'
              : 'Connect wallet above first'}
        </button>
      )}
    </div>
  );
}
