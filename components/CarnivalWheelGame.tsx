'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import { PublicKey, Transaction } from '@solana/web3.js';
import { BRAND } from '@/lib/brand';
import { getFamToken, type FamCoinId } from '@/lib/fam-tokens';
import { loadChipLedgerToken, saveChipLedgerToken } from '@/lib/chip-ledger-client';
import { CARNIVAL_ENTRY_USD, type PrizeTierId } from '@/lib/carnival/wheel';
import { findWalletTokenAccount } from '@/lib/token-accounts';
import { sendSolTransferWithWallet } from '@/lib/wallet/send-sol-transfer';
import BoardwalkWheel, { TIER_COLORS, type BoardwalkSpace } from '@/components/BoardwalkWheel';
import CarnivalClown from '@/components/CarnivalClown';
import FamilyLogoDice from '@/components/FamilyLogoDice';
import {
  unlockBoardwalkAudio,
  playWheelStop,
  playDiceRoll,
} from '@/lib/carnival/boardwalk-audio';

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
  priceSource?: string;
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function walletErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'Payment failed.';
  const msg = err.message || 'Payment failed.';
  if (/User rejected|rejected the request|Approval Denied|denied by user|User canceled|cancelled/i.test(msg)) {
    return 'Wallet cancelled the payment.';
  }
  if (/insufficient|0x1/i.test(msg)) {
    return 'Not enough BONGA (or SOL for fees) for this spin.';
  }
  if (/blockhash|expired|Blockhash not found|block height exceeded/i.test(msg)) {
    return 'Network ticket expired — tap pay again.';
  }
  if (/403|429|Failed to fetch|timeout|timed out/i.test(msg)) {
    return 'Solana RPC is busy — wait a few seconds and try again.';
  }
  if (/WalletNotConnected|not connected/i.test(msg)) {
    return 'Wallet not connected — unlock your wallet, reconnect, then try again.';
  }
  return msg;
}

export default function CarnivalWheelGame() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected, wallet, connecting } = useWallet();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [spaces, setSpaces] = useState<BoardwalkSpace[]>([]);
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
  const quoteRef = useRef<Quote | null>(null);

  const walletName = wallet?.adapter?.name ?? 'Wallet';

  const loadQuote = useCallback(() => {
    fetch('/api/carnival/quote')
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Quote failed');
        const q = data.quote as Quote;
        quoteRef.current = q;
        setQuote(q);
        setSpaces((data.spaces as BoardwalkSpace[]) ?? []);
        setTiers(data.tiers ?? []);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Quote failed'));
  }, []);

  useEffect(() => {
    loadQuote();
    const t = window.setInterval(loadQuote, 45_000);
    return () => window.clearInterval(t);
  }, [loadQuote]);

  const segmentAngle = 360 / Math.max(1, spaces.length || 63);

  const fetchBlockhash = useCallback(async () => {
    try {
      const res = await fetch('/api/solana/blockhash', { cache: 'no-store' });
      const data = (await res.json()) as {
        blockhash?: string;
        lastValidBlockHeight?: number;
      };
      if (res.ok && data.blockhash && data.lastValidBlockHeight != null) {
        return {
          blockhash: data.blockhash,
          lastValidBlockHeight: data.lastValidBlockHeight,
        };
      }
    } catch {
      /* fall through */
    }
    return connection.getLatestBlockhash('confirmed');
  }, [connection]);

  const waitForConfirmation = useCallback(
    async (signature: string, blockhash: string, lastValidBlockHeight: number) => {
      try {
        await Promise.race([
          connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            'confirmed',
          ),
          sleep(18_000),
        ]);
      } catch {
        /* poll below */
      }
      for (let i = 0; i < 24; i++) {
        await sleep(600);
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

  const payAndOpen = async () => {
    await unlockBoardwalkAudio();
    if (!publicKey || !connected) {
      setError('Connect Solflare or Phantom first.');
      return;
    }
    if (connecting) {
      setError('Wallet still connecting — wait a second.');
      return;
    }
    const activeQuote = quoteRef.current ?? quote;
    if (!activeQuote) {
      setError('Price not loaded yet — wait a moment.');
      loadQuote();
      return;
    }

    setBusy(true);
    setError(null);
    setStatus('Preparing BONGA payment…');
    setOutcome(null);
    setServerSeed(null);
    setChipsCredited(0);

    try {
      const mint = new PublicKey(activeQuote.mint);
      const treasury = new PublicKey(activeQuote.treasuryPubkey);
      const raw = BigInt(activeQuote.bongaRaw);
      const treasuryAta = new PublicKey(activeQuote.treasuryAta);

      const userToken = await findWalletTokenAccount(connection, publicKey, mint);
      if (!userToken) {
        throw new Error('No BONGA token account found — receive some BONGA in this wallet first.');
      }
      if (userToken.amount < raw) {
        const need = activeQuote.bongaAmount.toLocaleString(undefined, { maximumFractionDigits: 2 });
        throw new Error(
          `Not enough BONGA. Need about ${need} BONGA (~$${CARNIVAL_ENTRY_USD.toFixed(2)}) plus a little SOL for fees.`,
        );
      }

      const tx = new Transaction();

      // Only create treasury ATA if truly missing (never on RPC blips)
      try {
        await getAccount(connection, treasuryAta, 'confirmed', TOKEN_PROGRAM_ID);
      } catch (err) {
        if (err instanceof TokenAccountNotFoundError) {
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
        } else {
          // Account likely exists; RPC glitch — proceed with transfer only
          console.warn('[carnival] treasury ATA check flaky, continuing', err);
        }
      }

      tx.add(
        createTransferCheckedInstruction(
          userToken.address,
          mint,
          treasuryAta,
          publicKey,
          raw,
          activeQuote.decimals,
          [],
          TOKEN_PROGRAM_ID,
        ),
      );

      setStatus('Getting network ticket…');
      const { blockhash, lastValidBlockHeight } = await fetchBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      setStatus(`Approve ~$${CARNIVAL_ENTRY_USD.toFixed(2)} BONGA in ${walletName}…`);
      const sig = await sendSolTransferWithWallet({
        transaction: tx,
        connection,
        expectedPayer: publicKey,
        adapterSendTransaction: sendTransaction,
        walletName,
      });

      setStatus('Payment sent — confirming on Solana…');
      await waitForConfirmation(sig, blockhash, lastValidBlockHeight);

      setStatus('Opening sealed spin session…');
      let startData: { error?: string; sessionToken?: string; commit?: string } | null = null;
      let startOk = false;
      for (let attempt = 0; attempt < 6; attempt++) {
        if (attempt > 0) {
          setStatus(`Finding payment on-chain — retry ${attempt + 1}/6…`);
          await sleep(900 * attempt);
        }
        const startRes = await fetch('/api/carnival/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: publicKey.toBase58(),
            signature: sig,
            // Hint so server can tolerate minor quote refresh drift
            paidRaw: activeQuote.bongaRaw,
          }),
        });
        startData = await startRes.json();
        if (startRes.ok) {
          startOk = true;
          break;
        }
        // Don't retry permanent failures
        if (
          startRes.status === 409 ||
          /already used|Insufficient BONGA|Payer wallet/i.test(startData?.error ?? '')
        ) {
          break;
        }
      }
      if (!startOk || !startData?.sessionToken) {
        throw new Error(startData?.error ?? 'Could not start carnival session.');
      }

      setSessionToken(startData.sessionToken);
      setCommit(startData.commit ?? null);
      setStatus('Session sealed. Give the wheel a spin — result is locked on the server.');
    } catch (e) {
      setError(walletErrorMessage(e));
      setStatus(null);
    }
    setBusy(false);
  };

  const spin = async () => {
    await unlockBoardwalkAudio();
    if (!publicKey || !sessionToken) return;
    setBusy(true);
    setError(null);
    setSpinning(true);
    setStatus('Wheel is spinning — flapper on the pins…');
    playDiceRoll();

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
      // Land the winning wedge under the top flapper (visual only)
      const land =
        360 * 7 + (360 - ((out.wheelIndex * segmentAngle + segmentAngle / 2) % 360));
      setWheelRot(r => {
        // keep accumulating so CSS transition always spins forward
        const base = r % 360;
        return r - base + land;
      });
      setDiceFace(out.diceFace);

      window.setTimeout(() => {
        playWheelStop();
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
      }, 5200);
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

  const displaySpaces =
    spaces.length === 63
      ? spaces
      : Array.from({ length: 63 }, (_, i) => ({
          index: i,
          label: String(i + 1),
          kind: 'number',
          tierId: 'dead' as PrizeTierId,
          prizeUsd: 0,
        }));

  return (
    <div className="carnival-shell">
      <header className="carnival-header">
        <div className="carnival-nav">
          <Link href={`${BRAND.homePath}${BRAND.homeAnchor}`} className="art-btn px-3 py-1.5 text-[#f0d878]">
            ← {BRAND.home}
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
          Boardwalk prize wheel · ${CARNIVAL_ENTRY_USD.toFixed(2)} in $BONGA · 63 colored spaces · family d6 ·
          prizes only via {BRAND.cashier}
        </p>
      </header>

      <div className="carnival-grid">
        <section className="carnival-panel carnival-wheel-panel">
          <div className="carnival-stage-row">
            <CarnivalClown spinning={spinning} active={busy && !!sessionToken && !outcome} />
            <div className="carnival-wheel-with-clown">
              <BoardwalkWheel spaces={displaySpaces} rotationDeg={wheelRot} spinning={spinning} />
            </div>
          </div>

          <FamilyLogoDice face={diceFace} rolling={spinning} />
        </section>

        <section className="carnival-panel carnival-controls">
          <h2>Play</h2>
          {quote && (
            <div className="carnival-quote">
              <p>
                Entry: <strong>${quote.usd.toFixed(2)}</strong> ≈{' '}
                <strong>
                  {quote.bongaAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} BONGA
                </strong>
              </p>
              <p className="carnival-muted">
                BONGA @ ${quote.bongaUsd < 0.0001 ? quote.bongaUsd.toExponential(2) : quote.bongaUsd.toPrecision(4)}
                {quote.priceStale ? ' (fallback price)' : ` (${quote.priceSource ?? 'live'})`}
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
                {spinning ? 'The Jester is spinning…' : 'Let the Jester spin the wheel'}
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
                Wheel: <strong>{outcome.wheelLabel}</strong> (space #{outcome.wheelIndex + 1}/63)
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
            <h3>Prize tiers (63 spaces)</h3>
            <ul>
              {tiers.map(t => (
                <li key={t.id}>
                  <span
                    className="carnival-tier-swatch"
                    style={{ background: TIER_COLORS[t.id]?.fill ?? '#666' }}
                    aria-hidden
                  />
                  <span style={{ color: TIER_COLORS[t.id]?.fill ?? '#ccc' }}>{t.label}</span> —{' '}
                  {t.spaces} spaces · ${t.prizeUsd.toFixed(2)}
                </li>
              ))}
            </ul>
          </div>

          <p className="carnival-security-note">
            Animations and peg ticks are cosmetic. Outcomes are sealed server-side (HMAC commit-reveal).
            No client balances are trusted. Family coins exit only through the Cashier.
          </p>
        </section>
      </div>
    </div>
  );
}
