'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import type { PaidSpinQuote } from '@/lib/sol-payment';

type PaidSpinButtonProps = {
  disabled?: boolean;
  sessionId: string;
  onSpinGranted: () => void;
};

export default function PaidSpinButton({ disabled, sessionId, onSpinGranted }: PaidSpinButtonProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [quote, setQuote] = useState<PaidSpinQuote | null>(null);
  const [loading, setLoading] = useState(false);
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

  const buySpin = useCallback(async () => {
    if (!connected || !publicKey || !quote) {
      setError('Connect your wallet for the Quarter Slot Machine.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const treasury = new PublicKey(quote.treasuryPubkey);
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: treasury,
          lamports: quote.lamports,
        }),
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

      const res = await fetch('/api/casino/paid-spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature,
          payerWallet: publicKey.toBase58(),
          sessionId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Payment verification failed.');
        return;
      }

      onSpinGranted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed.');
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, quote, connection, sendTransaction, onSpinGranted, sessionId]);

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
            ? 'Confirming on Solana…'
            : connected
              ? 'Quarter Slot · 25¢ SOL'
              : 'Connect wallet above first'}
        </button>
      )}
    </div>
  );
}
