'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/casino/paid-spin')
      .then(r => r.json())
      .then(data => setQuote(data as PaidSpinQuote))
      .catch(() => setError('Could not load spin price.'));
  }, []);

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

  if (!quote) return null;

  return (
    <div className="paid-spin-panel">
      <div className="paid-spin-header">
        <span className="paid-spin-title">Quarter Slot Machine</span>
        <span className="paid-spin-price">25¢</span>
      </div>
      <p className="paid-spin-detail">
        25 cents of Solana = 1 Spin (~{quote.solAmount.toFixed(4)} SOL @ ${quote.solUsdPrice.toFixed(0)}/SOL)
      </p>
      <p className="paid-spin-detail">
        SOL goes to the shared treasury — treasury never pays SOL out.
      </p>
      {error && <p className="paid-spin-error">{error}</p>}
      <button
        type="button"
        className="art-btn paid-spin-btn w-full py-2.5 text-[#f0d878]"
        onClick={() => void buySpin()}
        disabled={disabled || loading || !connected}
      >
        {loading ? 'Confirming…' : connected ? 'Quarter Slot · 25¢ SOL' : 'Connect wallet — 25¢ = 1 Spin'}
      </button>
    </div>
  );
}