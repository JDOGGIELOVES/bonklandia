'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import type { PaidSpinQuote } from '@/lib/sol-payment';
import { sendSolTransferWithWallet } from '@/lib/wallet/send-sol-transfer';

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

  if (/User rejected|rejected the request|Approval Denied|denied by user|User canceled|cancelled/i.test(msg)) {
    return 'Wallet cancelled the payment.';
  }
  if (/insufficient|0x1|insufficient funds/i.test(msg)) {
    return 'Not enough SOL for the 25¢ spin plus network fees.';
  }
  if (/WalletNotConnected|not connected|WalletConnectionError|reconnect/i.test(msg)) {
    return msg.includes('Disconnect')
      ? msg
      : 'Wallet not connected — unlock Solflare, reconnect on this page, then try again.';
  }
  if (/blockhash|expired|not valid|block height exceeded|Blockhash not found/i.test(msg)) {
    return 'Network ticket expired. Unlock Solflare first, then tap Quarter Slot again immediately.';
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

  const walletName = wallet?.adapter?.name ?? 'Wallet';

  // Keep quote warm so a click does NOT await fetch before opening the wallet
  // (awaiting fetch breaks the user-gesture → popup chain, especially Solflare).
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
    const id = window.setInterval(loadQuote, 45_000);
    return () => window.clearInterval(id);
  }, [loadQuote]);

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
        // poll below
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
   * CRITICAL: no fetch/await before wallet call except getLatestBlockhash.
   * Quote must already be loaded so the click still counts as a user gesture for Solflare.
   */
  const buySpin = useCallback(async () => {
    if (!connected || !publicKey || !quote) {
      setError('Connect Solflare or Phantom first, then tap Quarter Slot.');
      return;
    }
    if (connecting) {
      setError('Wallet still connecting — wait a second.');
      return;
    }

    setLoading(true);
    setError(null);
    setStatus(`Opening ${walletName}…`);

    try {
      // Only await needed for a valid tx — keep this as short as possible after the click.
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');

      const treasury = new PublicKey(quote.treasuryPubkey);
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: treasury,
          lamports: quote.lamports,
        }),
      );
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      setStatus(`Approve in ${walletName}…`);

      const signature = await sendSolTransferWithWallet({
        transaction: tx,
        connection,
        expectedPayer: publicKey,
        adapterSendTransaction: sendTransaction,
        walletName,
      });

      if (!signature) {
        throw new Error(`${walletName} did not return a signature. Unlock the extension and try again.`);
      }

      setStatus('Payment sent — confirming…');
      await waitForConfirmation(signature, blockhash, lastValidBlockHeight);
      await redeemSignature(signature);
      setStatus(null);
    } catch (err) {
      setError(walletErrorMessage(err));
      setStatus(null);
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
  ]);

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
        Unlock Solflare <strong>before</strong> tapping. The approve window should open right away (no extra network
        wait).
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
          disabled={disabled || loading || !connected || connecting || quoteLoading}
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
