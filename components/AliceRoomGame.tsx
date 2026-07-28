'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  ALICE_COINS_PER_SPENDABLE_CHIP,
  BOSS_LEVEL,
  ELF_LEVELS,
  TOTAL_LEVELS,
  aliceCoinsToSpendable,
  applyTrickLoss,
  buildTrickChoices,
  getLevelInfo,
  spinBlockReels,
  spinPlayerReels,
  type AlicePhase,
  type TrickChoice,
} from '@/lib/alice-room/game';
import type { AliceSymbol } from '@/lib/alice-room/symbols';
import { BRAND } from '@/lib/brand';
import { loadChipLedgerToken, saveChipLedgerToken } from '@/lib/chip-ledger-client';

type LogLine = { id: number; text: string };

export default function AliceRoomGame() {
  const { publicKey, connected } = useWallet();
  const [phase, setPhase] = useState<AlicePhase>('intro');
  const [level, setLevel] = useState(1);
  const [aliceCoins, setAliceCoins] = useState(0);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [reels, setReels] = useState<[AliceSymbol, AliceSymbol, AliceSymbol] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [choices, setChoices] = useState<TrickChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [spendableEarned, setSpendableEarned] = useState<number | null>(null);
  const [logId, setLogId] = useState(0);

  const levelInfo = getLevelInfo(level);
  const projectedSpendable = aliceCoinsToSpendable(aliceCoins);

  const pushLog = useCallback((text: string) => {
    setLogId(n => {
      const id = n + 1;
      setLog(prev => [{ id, text }, ...prev].slice(0, 12));
      return id;
    });
  }, []);

  const startDive = async () => {
    setBusy(true);
    setClaimMsg(null);
    setSpendableEarned(null);
    try {
      const res = await fetch('/api/alice/start', { method: 'POST' });
      const data = (await res.json()) as { sessionToken?: string; error?: string };
      if (!res.ok || !data.sessionToken) {
        setMessage(data.error ?? 'Could not open the Alice Room.');
        setBusy(false);
        return;
      }
      setSessionToken(data.sessionToken);
      setLevel(1);
      setAliceCoins(0);
      setReels(null);
      setChoices([]);
      setLog([]);
      setPhase('player-spin');
      pushLog('You tumble down the rabbit hole. Seven Machine Elves… then the Queen.');
      pushLog('Alice Coins pile up easily — only the final tally after the boss is cashable.');
    } catch {
      setMessage('Network error opening Alice Room.');
    }
    setBusy(false);
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const doPlayerSpin = async () => {
    if (busy || phase !== 'player-spin') return;
    setBusy(true);
    setPhase('spinning');
    setMessage('Reels whirl through the looking glass…');
    await sleep(700);
    const result = spinPlayerReels();
    setReels(result.reels);
    setAliceCoins(c => c + result.aliceCoins);
    setMessage(result.message);
    pushLog(`+${result.aliceCoins.toLocaleString()} Alice Coins — ${result.message}`);
    setPhase('player-result');
    setBusy(false);
  };

  const beginElfTurn = () => {
    if (phase !== 'player-result') return;
    setPhase('elf-attack');
    setMessage(
      levelInfo.isBoss
        ? 'The Red Machine Queen attacks! Pull the lever — three elves blocks her wrath.'
        : `${levelInfo.name} attacks! Pull once: three Machine Elves blocks the hit.`,
    );
    pushLog('── Elf turn ── Pull for a triple-elf shield.');
  };

  const doBlockSpin = async () => {
    if (busy || phase !== 'elf-attack') return;
    setBusy(true);
    setPhase('block-spinning');
    setMessage('Defense lever — hunting three elves…');
    await sleep(750);
    const result = spinBlockReels(levelInfo.isBoss);
    setReels(result.reels);
    setMessage(result.message);
    pushLog(result.message);

    if (result.blocked) {
      setPhase('block-result');
      setBusy(false);
      return;
    }

    const trick = buildTrickChoices(levelInfo.isBoss);
    setChoices(trick);
    setPhase('trick-choices');
    pushLog('The elves offer four doors. One is safe. They will try to trick you.');
    setBusy(false);
  };

  const afterDefenseContinue = () => {
    if (level >= TOTAL_LEVELS) {
      setPhase('victory');
      setMessage('You clear the deepest layer. Final Alice Coins become the only cashable tally.');
      pushLog('Boss defeated. Final tally ready for the cashier (if wallet connected).');
      return;
    }
    setLevel(l => l + 1);
    setPhase('level-clear');
    const next = getLevelInfo(level + 1);
    setMessage(`Deeper… ${next.depthLabel}: ${next.name}`);
    pushLog(`Layer cleared. Descending to ${next.name}.`);
  };

  const onBlockSuccessContinue = () => {
    afterDefenseContinue();
  };

  const onPickTrick = (choice: TrickChoice) => {
    if (phase !== 'trick-choices') return;
    const { nextCoins, lost, flavor } = applyTrickLoss(aliceCoins, choice);
    setAliceCoins(nextCoins);
    setMessage(`${choice.label}: ${flavor}`);
    pushLog(
      lost > 0
        ? `Chose “${choice.label}” — lost ${lost.toLocaleString()} Alice Coins (${choice.tier}).`
        : `Chose “${choice.label}” — safe path! Coins untouched.`,
    );
    setChoices([]);
    afterDefenseContinue();
  };

  const continueToNextLevel = () => {
    setPhase('player-spin');
    setMessage(null);
    setReels(null);
  };

  const bankFinalTally = async () => {
    if (!sessionToken) {
      setClaimMsg('Missing session — start a new dive.');
      return;
    }
    const wallet = publicKey?.toBase58();
    if (!wallet) {
      setClaimMsg('Connect Solflare or Phantom to bank spendable chips.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/alice/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          sessionToken,
          aliceCoins,
          ledgerToken: loadChipLedgerToken(wallet),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        spendable?: number;
        chips?: number;
        ledgerToken?: string;
        message?: string;
      };
      if (!res.ok) {
        setClaimMsg(data.error ?? 'Could not bank final tally.');
        setBusy(false);
        return;
      }
      if (data.ledgerToken) {
        saveChipLedgerToken(wallet, data.ledgerToken, data.chips ?? 0, { force: true });
      }
      setSpendableEarned(data.spendable ?? 0);
      setClaimMsg(data.message ?? 'Banked.');
      setSessionToken(null);
    } catch {
      setClaimMsg('Network error banking tally.');
    }
    setBusy(false);
  };

  return (
    <div className="alice-room">
      <div className="alice-room-bg" aria-hidden />
      <div className="alice-room-content">
        <header className="alice-room-header">
          <div className="alice-room-nav">
            <Link href="/" className="alice-nav-link">
              ← {BRAND.name}
            </Link>
            <Link href="/cashier" className="alice-nav-link">
              {BRAND.cashier}
            </Link>
            <Link href="/depths" className="alice-nav-link">
              {BRAND.depths}
            </Link>
          </div>
          <p className="alice-eyebrow">Side game · Bonklandia Bandit family</p>
          <h1 className="alice-title">The Alice Room</h1>
          <p className="alice-sub">
            Dive seven layers of Machine Elves, then face the Red Machine Queen. Mid-run Alice Coins are
            dream-wealth only — <strong>only your final tally after the boss</strong> can become spendable
            Bonk Chips at the cashier.
          </p>
        </header>

        <div className="alice-status-bar">
          <div className="alice-stat">
            <span className="alice-stat-label">Depth</span>
            <span className="alice-stat-value">
              {phase === 'intro' ? '—' : `${level}/${TOTAL_LEVELS}`}
            </span>
          </div>
          <div className="alice-stat">
            <span className="alice-stat-label">Alice Coins</span>
            <span className="alice-stat-value alice-coins">{aliceCoins.toLocaleString()}</span>
          </div>
          <div className="alice-stat">
            <span className="alice-stat-label">If cashed now*</span>
            <span className="alice-stat-value">~{projectedSpendable} chips</span>
          </div>
          <div className="alice-stat alice-wallet">
            <WalletMultiButton />
          </div>
        </div>
        <p className="alice-footnote">
          *{ALICE_COINS_PER_SPENDABLE_CHIP} Alice Coins → 1 spendable chip, cap after boss. Elf levels: {ELF_LEVELS} +
          boss.
        </p>

        {phase === 'intro' && (
          <section className="alice-panel alice-intro">
            <h2>How the hole works</h2>
            <ol className="alice-rules">
              <li>
                <strong>Your spin</strong> — pull for Alice Coins (easy big points). They do not cash out yet.
              </li>
              <li>
                <strong>Elf turn</strong> — pull again. Land <strong>three Machine Elves</strong> to block and keep
                everything.
              </li>
              <li>
                <strong>If you fail the block</strong> — four Wonderland doors appear. One costs nothing; others
                take moderate, most, or all Alice Coins. Labels lie.
              </li>
              <li>
                Clear <strong>{ELF_LEVELS} elf layers</strong>, then the <strong>boss</strong>. Final Alice Coins →
                spendable chips (wallet required).
              </li>
            </ol>
            <button type="button" className="alice-btn alice-btn-primary" disabled={busy} onClick={() => void startDive()}>
              {busy ? 'Opening the door…' : 'Drink Me — Enter the Alice Room'}
            </button>
          </section>
        )}

        {phase !== 'intro' && phase !== 'victory' && (
          <section className="alice-panel alice-stage">
            <div className="alice-level-banner">
              <span className="alice-depth">{levelInfo.depthLabel}</span>
              <h2>{levelInfo.name}</h2>
              <p>{levelInfo.blurb}</p>
              {levelInfo.isBoss && <span className="alice-boss-tag">BOSS LAYER</span>}
            </div>

            <div className={`alice-reels ${phase.includes('spin') ? 'alice-reels-spin' : ''}`}>
              {(reels ?? [null, null, null]).map((sym, i) => (
                <div key={i} className={`alice-reel ${sym?.kind === 'elf' ? 'alice-reel-elf' : ''}`}>
                  <span className="alice-reel-emoji">{sym?.emoji ?? '❔'}</span>
                  <span className="alice-reel-label">{sym?.label ?? '…'}</span>
                </div>
              ))}
            </div>

            {message && <p className="alice-message">{message}</p>}

            <div className="alice-actions">
              {phase === 'player-spin' && (
                <button type="button" className="alice-btn alice-btn-primary" disabled={busy} onClick={() => void doPlayerSpin()}>
                  Pull the Alice Lever
                </button>
              )}
              {phase === 'player-result' && (
                <button type="button" className="alice-btn alice-btn-danger" onClick={beginElfTurn}>
                  Face the Elf Attack →
                </button>
              )}
              {phase === 'elf-attack' && (
                <button type="button" className="alice-btn alice-btn-primary" disabled={busy} onClick={() => void doBlockSpin()}>
                  Defense Pull — Need 3 Elves
                </button>
              )}
              {phase === 'block-result' && (
                <button type="button" className="alice-btn alice-btn-primary" onClick={onBlockSuccessContinue}>
                  {level >= BOSS_LEVEL ? 'Claim the Looking Glass' : 'Descend Deeper →'}
                </button>
              )}
              {phase === 'level-clear' && (
                <button type="button" className="alice-btn alice-btn-primary" onClick={continueToNextLevel}>
                  Enter {getLevelInfo(level).name}
                </button>
              )}
            </div>

            {phase === 'trick-choices' && (
              <div className="alice-tricks">
                <h3>The elves offer four paths</h3>
                <p className="alice-tricks-hint">
                  One path costs nothing. The others take moderate, most, or all of your Alice Coins. Choose wisely —
                  labels are meant to mislead.
                </p>
                <div className="alice-trick-grid">
                  {choices.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="alice-trick-card"
                      onClick={() => onPickTrick(c)}
                    >
                      <span className="alice-trick-label">{c.label}</span>
                      <span className="alice-trick-whisper">{c.whisper}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {phase === 'victory' && (
          <section className="alice-panel alice-victory">
            <h2>Through the looking glass</h2>
            <p className="alice-final-tally">
              Final Alice Coins: <strong>{aliceCoins.toLocaleString()}</strong>
            </p>
            <p>
              Spendable estimate:{' '}
              <strong>{aliceCoinsToSpendable(aliceCoins).toLocaleString()} Bonk Chips</strong> (server-capped)
            </p>
            {!connected && (
              <p className="alice-warn">Connect your wallet to bank this tally as spendable chips.</p>
            )}
            <div className="alice-actions">
              <button
                type="button"
                className="alice-btn alice-btn-primary"
                disabled={busy || !sessionToken}
                onClick={() => void bankFinalTally()}
              >
                {busy ? 'Banking…' : 'Bank Final Tally → Spendable Chips'}
              </button>
              <Link href="/cashier" className="alice-btn alice-btn-ghost">
                {BRAND.cashier}
              </Link>
              <button type="button" className="alice-btn alice-btn-ghost" onClick={() => void startDive()}>
                Dive Again
              </button>
            </div>
            {claimMsg && <p className="alice-claim-msg">{claimMsg}</p>}
            {spendableEarned != null && spendableEarned > 0 && (
              <p className="alice-claim-ok">+{spendableEarned} spendable Bonk Chips on your server ledger.</p>
            )}
          </section>
        )}

        {log.length > 0 && (
          <aside className="alice-log" aria-label="Run log">
            <h3>Looking-glass log</h3>
            <ul>
              {log.map(line => (
                <li key={line.id}>{line.text}</li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
