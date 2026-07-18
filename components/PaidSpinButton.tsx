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
  if (/User rejected|rejected the request|Approval Denied/i.test(msg)) {
    return 'Wallet cancelled the payment.';
  }
  if (/blockhash|expired|not valid|block height exceeded/i.test(msg)) {
    return 'Network was slow — try the Quarter Slot again.';
  }
  if (/403|429|fetch|network|Failed to fetch|timeout|timed out/i.test(msg)) {
    return 'Solana RPC is busy — wait a moment and try again.';
  }
  if (/insufficient|0x1/i.test(msg)) {
    return 'Not enough SOL for the 25¢ spin plus network fees.';
  }
  return msg;
}

function isRetryableSendError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message || '';
  if (/User rejected|rejected the request|Approval Denied|insufficient|0x1/i.test(msg)) {
    return false;
  }
  return /blockhash|expired|not valid|block height exceeded|timeout|timed out|429|403|fetch|network|Failed to fetch/i.test(
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
  const { publicKey, sendTransaction, connected } = useWallet();
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

  /** Wait until signature is confirmed, or give up soft so server can still verify. */
  const waitForConfirmation = useCallback(
    async (signature: string, blockhash: string, lastValidBlockHeight: number) => {
      try {
        await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          'confirmed',
        );
        return;
      } catch {
        // Slow RPC / timeout — poll status before giving up
      }

      for (let i = 0; i < 20; i++) {
        await sleep(800);
        const status = await connection.getSignatureStatus(signature, {
          searchTransactionHistory: true,
        });
        const conf = status.value?.confirmationStatus;
        if (status.value?.err) {
          throw new Error('Transaction failed on-chain.');
        }
        if (conf === 'confirmed' || conf === 'finalized') {
          return;
        }
      }
      // Soft success: tx may still be landing; server verify will poll again.
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

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) {
            setStatus(`Network lag — retry ${attempt + 1}/3…`);
            await sleep(500 * attempt);
          } else {
            setStatus('Approve in your wallet…');
          }

          // Fresh blockhash on every attempt (stale hash is the usual "network was slow" cause).
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

          const signature = await sendTransaction(tx, connection, {
            preflightCommitment: 'confirmed',
            skipPreflight: false,
            maxRetries: 5,
          });

          setStatus('Confirming on Solana…');
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
    [publicKey, connection, sendTransaction, waitForConfirmation],
  );

  const redeemSignature = useCallback(
    async (signature: string) => {
      setStatus('Unlocking your spin…');

      let lastError = 'Payment verification failed.';
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) {
          setStatus(`Still confirming — retry ${attempt + 1}/4…`);
          await sleep(1200 * attempt);
        }

        const res = await fetch('/api/casino/paid-spin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signature,
            payerWallet: publicKey?.toBase58(),
            sessionId,
            settleToken,
          }),
        });

        const data = (await res.json()) as {
          error?: string;
          settleToken?: string;
          maxWinnings?: number;
        };

        if (res.ok) {
          onSpinGranted({
            settleToken: data.settleToken,
            maxWinnings: data.maxWinnings,
          });
          return;
        }

        lastError = data.error ?? 'Payment verification failed.';
        // Retry only when the chain/RPC is still catching up.
        if (!/not found|wait a moment|not found yet|busy|timeout/i.test(lastError)) {
          throw new Error(
            `${lastError} (tx ${signature.slice(0, 8)}… — payment may have landed; retry in a few seconds or contact support with the signature.)`,
          );
        }
      }

      throw new Error(
        `${lastError} (tx ${signature.slice(0, 8)}… — payment may have landed; try again in a few seconds.)`,
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
      // Refresh price right before pay so quote matches server verify threshold.
      let activeQuote = quote;
      try {
        const r = await fetch('/api/casino/paid-spin');
        const data = await r.json();
        if (r.ok) {
          activeQuote = data as PaidSpinQuote;
          setQuote(activeQuote);
        }
      } catch {
        // Keep existing quote if refresh fails.
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
        SOL goes to the shared treasury — treasury never pays SOL out.
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
