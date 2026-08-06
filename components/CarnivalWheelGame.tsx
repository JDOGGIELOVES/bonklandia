'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { PublicKey, Transaction } from '@solana/web3.js';
import { BRAND } from '@/lib/brand';
import { getFamToken, type FamCoinId } from '@/lib/fam-tokens';
import { loadChipLedgerToken, saveChipLedgerToken } from '@/lib/chip-ledger-client';
import { CARNIVAL_ENTRY_USD, type PrizeTierId } from '@/lib/carnival/wheel';

type Quote = {
  usd: number;
  bongaUsd: number;
  bongaAmount: number;
  bongaRaw: string;
  decimals: number;
  mint: string;
  treasuryPubkey: string;
  treasuryAta: string;
  priceStale: boolean;
};

type Space = {
  index: number;
  label: string;
  kind: string;
  tierId: PrizeTierId;
  prizeUsd: number;
};

type Outcome = {
  wheelIndex: number;
  wheelLabel: string;
  tierId: PrizeTierId;
  prizeUsd: number;
  diceFace: number;
  coinId: FamCoinId;
  coinName: string;
  chips: number;
};

const TIER_COLOR: Record<string, string> = {
  dead: '#4b5563',
  low: '#6b7280',
  small: '#22c55e',
  medium: '#3b82f6',
  big: '#a855f7',
  jackpot: '#f0d878',
};

export default function CarnivalWheelGame() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [tiers, setTiers] = useState<{ id: string; label: string; prizeUsd: number; spaces: number }[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [commit, setCommit] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [serverSeed, setServerSeed] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [wheelRot, setWheelRot] = useState(0);
  const [diceFace, setDiceFace] = useState(1);
  const [chipsCredited, setChipsCredited] = useState(0);

  const loadQuote = useCallback(() => {
    fetch('/api/carnival/quote')
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Quote failed');
        setQuote(data.quote as Quote);
        setSpaces((data.spaces as Space[]) ?? []);
        setTiers(data.tiers ?? []);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Quote failed'));
  }, []);

  useEffect(() => {
    loadQuote();
    const t = window.setInterval(loadQuote, 60_000);
    return () => window.clearInterval(t);
  }, [loadQuote]);

  const segmentAngle = 360 / Math.max(1, spaces.length || 63);

  const payAndOpen = async () => {
    if (!publicKey || !quote || !connected) {
      setError('Connect Solflare or Phantom first.');
      return;
    }
    setBusy(true);
    setError(null);
    setStatus('Preparing BONGA payment…');
    setOutcome(null);
    setServerSeed(null);
    setChipsCredited(0);

    try {
      const mint = new PublicKey(quote.mint);
      const treasury = new PublicKey(quote.treasuryPubkey);
      const raw = BigInt(quote.bongaRaw);
      const userAta = getAssociatedTokenAddressSync(mint, publicKey);
      const treasuryAta = getAssociatedTokenAddressSync(mint, treasury, false);

      const tx = new Transaction();
      try {
        await getAccount(connection, userAta);
      } catch {
        throw new Error('No BONGA token account — receive some BONGA first.');
      }
      try {
        await getAccount(connection, treasuryAta);
      } catch {
        tx.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            treasuryAta,
            treasury,
            mint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
        );
      }

      tx.add(
        createTransferCheckedInstruction(
          userAta,
          mint,
          treasuryAta,
          publicKey,
          raw,
          quote.decimals,
        ),
      );

      setStatus('Approve BONGA entry in your wallet…');
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });

      setStatus('Opening sealed spin session…');
      const startRes = await fetch('/api/carnival/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: publicKey.toBase58(), signature: sig }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error ?? 'Could not start carnival session.');

      setSessionToken(startData.sessionToken as string);
      setCommit(startData.commit as string);
      setStatus('Session sealed. Spin when ready — result is locked on the server.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed.');
      setStatus(null);
    }
    setBusy(false);
  };

  const spin = async () => {
    if (!publicKey || !sessionToken) return;
    setBusy(true);
    setError(null);
    setSpinning(true);
    setStatus('Resolving on-chain-sealed outcome…');

    try {
      const ledgerToken = loadChipLedgerToken(publicKey.toBase58());
      const res = await fetch('/api/carnival/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          sessionToken,
          ledgerToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Spin failed.');

      const out = data.outcome as Outcome;
      // Animate toward server result (visual only)
      const target = 360 * 6 + (360 - out.wheelIndex * segmentAngle - segmentAngle / 2);
      setWheelRot(r => r + target);
      setDiceFace(out.diceFace);

      window.setTimeout(() => {
        setOutcome(out);
        setServerSeed(data.serverSeed as string);
        setChipsCredited(data.chipsCredited ?? 0);
        setSpinning(false);
        setStatus(data.message ?? 'Done.');
        if (data.ledgerToken) {
          saveChipLedgerToken(publicKey.toBase58(), data.ledgerToken, data.chipsCredited ?? 0, {
            force: true,
          });
        }
        setSessionToken(null);
      }, 4200);
    } catch (e) {
      setSpinning(false);
      setError(e instanceof Error ? e.message : 'Spin failed.');
      setStatus(null);
    }
    setBusy(false);
  };

  const coinImg = useMemo(() => {
    if (!outcome) return null;
    return getFamToken(outcome.coinId)?.img ?? null;
  }, [outcome]);

  return (
    <div className="carnival-shell">
      <header className="carnival-header">
        <div className="carnival-nav">
          <Link href="/#hall-of-champions" className="art-btn px-3 py-1.5 text-[#f0d878]">
            ← {BRAND.degenValley}
          </Link>
          <Link href="/depths" className="art-btn px-3 py-1.5 text-[#f0d878]">
            {BRAND.depths}
          </Link>
          <Link href="/alice" className="art-btn px-3 py-1.5 text-[#f0abfc]">
            {BRAND.aliceRoomNav}
          </Link>
          <Link href="/cashier" className="art-btn px-3 py-1.5 text-[#f0d878]">
            {BRAND.cashier}
          </Link>
          <WalletMultiButton />
        </div>
        <h1 className="carnival-title">Bonklandia Carnival Wheel</h1>
        <p className="carnival-sub">
          ${CARNIVAL_ENTRY_USD.toFixed(2)} in $BONGA · 63-space wheel · d6 family coin · prizes only via{' '}
          {BRAND.cashier}
        </p>
      </header>

      <div className="carnival-grid">
        <section className="carnival-panel carnival-wheel-panel">
          <div
            className={`carnival-wheel ${spinning ? 'carnival-wheel-spinning' : ''}`}
            style={{ transform: `rotate(${wheelRot}deg)` }}
            aria-hidden
          >
            {spaces.slice(0, 63).map((s, i) => (
              <div
                key={s.index}
                className="carnival-segment"
                style={{
                  transform: `rotate(${i * segmentAngle}deg)`,
                  borderColor: TIER_COLOR[s.tierId] ?? '#666',
                }}
                title={`${s.label} · $${s.prizeUsd}`}
              >
                <span>{s.label.length > 6 ? s.label.slice(0, 5) : s.label}</span>
              </div>
            ))}
            <div className="carnival-hub">SPIN</div>
          </div>
          <div className="carnival-pointer" aria-hidden />

          <div className="carnival-dice" aria-label={`Dice ${diceFace}`}>
            <span className="carnival-dice-face">{diceFace}</span>
            <span className="carnival-dice-label">Family d6</span>
          </div>
        </section>

        <section className="carnival-panel carnival-controls">
          <h2>Play</h2>
          {quote && (
            <div className="carnival-quote">
              <p>
                Entry: <strong>${quote.usd.toFixed(2)}</strong> ≈{' '}
                <strong>{quote.bongaAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} BONGA</strong>
              </p>
              <p className="carnival-muted">
                BONGA @ ${quote.bongaUsd.toPrecision(4)}
                {quote.priceStale ? ' (fallback price)' : ''}
              </p>
              <p className="carnival-split">
                Split on entry (accounting): 55% treasury · 30% prize pool · 15% ops
              </p>
            </div>
          )}

          {!sessionToken && !outcome && (
            <button
              type="button"
              className="art-btn carnival-pay-btn"
              disabled={busy || !connected || !quote}
              onClick={() => void payAndOpen()}
            >
              {busy ? 'Working…' : `Pay $${CARNIVAL_ENTRY_USD.toFixed(2)} BONGA & open spin`}
            </button>
          )}

          {sessionToken && !outcome && (
            <>
              <p className="carnival-commit">
                Commit: <code>{commit?.slice(0, 18)}…</code>
              </p>
              <button
                type="button"
                className="art-btn carnival-spin-btn"
                disabled={busy || spinning}
                onClick={() => void spin()}
              >
                {spinning ? 'Spinning…' : 'Spin wheel + roll d6'}
              </button>
            </>
          )}

          {outcome && (
            <div className="carnival-result">
              <h3>
                {outcome.tierId === 'dead' || outcome.prizeUsd === 0
                  ? 'Dead spin'
                  : `${outcome.tierId.toUpperCase()} · $${outcome.prizeUsd.toFixed(2)}`}
              </h3>
              <p>
                Wheel: <strong>{outcome.wheelLabel}</strong> (#{outcome.wheelIndex})
              </p>
              <p>
                Dice: <strong>{outcome.diceFace}</strong> → {outcome.coinName}
              </p>
              {coinImg && (
                <Image src={coinImg} alt={outcome.coinName} width={72} height={72} unoptimized />
              )}
              <p className="carnival-chips">
                Spendable chips credited: <strong>{chipsCredited}</strong>
              </p>
              <p className="carnival-muted">
                Tokens leave only via the Cashier — exchange chips for {outcome.coinName} there.
              </p>
              <div className="carnival-result-actions">
                <Link href="/cashier" className="art-btn carnival-cashier-btn">
                  Open {BRAND.cashier} →
                </Link>
                <button
                  type="button"
                  className="art-btn"
                  onClick={() => {
                    setOutcome(null);
                    setServerSeed(null);
                    setStatus(null);
                    loadQuote();
                  }}
                >
                  Play again
                </button>
              </div>
              {serverSeed && (
                <details className="carnival-verify">
                  <summary>Verify randomness (commit-reveal)</summary>
                  <p>
                    Seed: <code className="break-all">{serverSeed}</code>
                  </p>
                  <p>
                    Commit: <code className="break-all">{commit}</code>
                  </p>
                </details>
              )}
            </div>
          )}

          {status && <p className="carnival-status">{status}</p>}
          {error && <p className="carnival-error">{error}</p>}

          <div className="carnival-tiers">
            <h3>Prize tiers</h3>
            <ul>
              {tiers.map(t => (
                <li key={t.id}>
                  <span style={{ color: TIER_COLOR[t.id] }}>{t.label}</span> — {t.spaces} spaces · $
                  {t.prizeUsd.toFixed(2)}
                </li>
              ))}
            </ul>
          </div>

          <p className="carnival-security-note">
            Animations are cosmetic. Outcomes are sealed server-side (HMAC commit-reveal). No client
            balances are trusted. Family coins exit only through the Cashier.
          </p>
        </section>
      </div>
    </div>
  );
}
