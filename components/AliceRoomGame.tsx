'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  ALICE_COINS_PER_SPENDABLE_CHIP,
  BOSS_LEVEL,
  ELF_LEVELS,
  TOTAL_LEVELS,
  aliceCoinsToSpendable,
  applyTrickLoss,
  buildAliceReelStrip,
  buildTrickChoices,
  getLevelInfo,
  spinBlockReels,
  spinPlayerReels,
  type AlicePhase,
  type TrickChoice,
} from '@/lib/alice-room/game';
import { ALL_ALICE_SYMBOLS, type AliceSymbol } from '@/lib/alice-room/symbols';
import { BRAND } from '@/lib/brand';
import { loadChipLedgerToken, saveChipLedgerToken } from '@/lib/chip-ledger-client';
import { CASINO_SPIN_DURATION_MS, CASINO_SPIN_START_DELAY_MS } from '@/lib/casino-audio';

const REEL_ITEM_HEIGHT = 160;
const REEL_SPIN_MS = CASINO_SPIN_DURATION_MS;
const LEVER_PULL_MS = CASINO_SPIN_START_DELAY_MS;

type LogLine = { id: number; text: string };

function AliceSymbolCell({ symbol }: { symbol: AliceSymbol }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = Boolean(symbol.image) && !imgFailed;

  return (
    <div className={`slot-symbol slot-symbol-${symbol.kind === 'elf' ? 'enemy' : symbol.kind === 'wild' ? 'jackpot' : 'fam'}`}>
      {showImg ? (
        <div className="slot-symbol-frame">
          <Image
            src={symbol.image!}
            alt={symbol.label}
            width={100}
            height={100}
            className="character-img slot-symbol-img object-contain"
            unoptimized
            onError={() => setImgFailed(true)}
          />
        </div>
      ) : (
        <span className="alice-symbol-emoji-fallback" aria-hidden>
          {symbol.emoji}
        </span>
      )}
      <span className="slot-symbol-label">{symbol.label}</span>
    </div>
  );
}

function AliceReel({
  result,
  spinning,
  stopDelay,
  spinKey,
}: {
  result: AliceSymbol;
  spinning: boolean;
  stopDelay: number;
  spinKey: number;
}) {
  const strip = useMemo(
    () => buildAliceReelStrip(result, ALL_ALICE_SYMBOLS),
    [result, spinKey],
  );
  const stopAt = (strip.length - 1) * REEL_ITEM_HEIGHT;

  return (
    <div className="slot-reel-column">
      <div className="slot-reel-window">
        <div className="slot-reel-drum-shadow slot-reel-drum-shadow-top" />
        <div className="slot-reel-drum-shadow slot-reel-drum-shadow-bottom" />
        <div
          className={`slot-reel-strip ${spinning ? 'slot-reel-spinning' : 'slot-reel-stopped'}`}
          style={{
            ['--reel-stop' as string]: `-${stopAt}px`,
            ['--reel-duration' as string]: `${REEL_SPIN_MS}ms`,
            animationDelay: spinning ? `${stopDelay}ms` : '0ms',
          }}
        >
          {strip.map((sym, i) => (
            <AliceSymbolCell key={`${spinKey}-${i}-${sym.id}`} symbol={sym} />
          ))}
        </div>
        <div className="slot-reel-glass" />
        <div className="slot-reel-shine" />
      </div>
    </div>
  );
}

const IDLE_REEL: AliceSymbol = ALL_ALICE_SYMBOLS[0]!;

export default function AliceRoomGame() {
  const { publicKey, connected } = useWallet();
  const [phase, setPhase] = useState<AlicePhase>('intro');
  const [level, setLevel] = useState(1);
  const [aliceCoins, setAliceCoins] = useState(0);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [results, setResults] = useState<[AliceSymbol, AliceSymbol, AliceSymbol] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [choices, setChoices] = useState<TrickChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [leverPulled, setLeverPulled] = useState(false);
  const [spinKey, setSpinKey] = useState(0);
  const [justLanded, setJustLanded] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [spendableEarned, setSpendableEarned] = useState<number | null>(null);
  const [logId, setLogId] = useState(0);

  const levelInfo = getLevelInfo(level);
  const projectedSpendable = aliceCoinsToSpendable(aliceCoins);
  const displayReels = results ?? [IDLE_REEL, IDLE_REEL, IDLE_REEL];

  const pushLog = useCallback((text: string) => {
    setLogId(n => {
      const id = n + 1;
      setLog(prev => [{ id, text }, ...prev].slice(0, 12));
      return id;
    });
  }, []);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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
      setResults(null);
      setChoices([]);
      setLog([]);
      setPhase('player-spin');
      setMessage('Yank the Alice Machine lever — dream-wealth only until the boss falls.');
      pushLog('You tumble down the rabbit hole. Seven Machine Elves… then the Queen.');
      pushLog('Alice Coins pile up easily — only the final tally after the boss is cashable.');
    } catch {
      setMessage('Network error opening Alice Room.');
    }
    setBusy(false);
  };

  const runReelSpin = async (
    getResult: () => {
      reels: [AliceSymbol, AliceSymbol, AliceSymbol];
      message: string;
      aliceCoins?: number;
      blocked?: boolean;
    },
  ) => {
    setSpinning(true);
    setLeverPulled(true);
    setJustLanded(false);
    setSpinKey(k => k + 1);
    await sleep(LEVER_PULL_MS);
    const result = getResult();
    setResults(result.reels);
    setMessage(result.message);
    await sleep(REEL_SPIN_MS + 200);
    setSpinning(false);
    setLeverPulled(false);
    setJustLanded(true);
    return result;
  };

  const doPlayerSpin = async () => {
    if (busy || spinning || phase !== 'player-spin') return;
    setBusy(true);
    setPhase('spinning');
    const result = await runReelSpin(() => {
      const r = spinPlayerReels();
      return { reels: r.reels, message: r.message, aliceCoins: r.aliceCoins };
    });
    if (result.aliceCoins) {
      setAliceCoins(c => c + result.aliceCoins!);
      pushLog(`+${result.aliceCoins.toLocaleString()} Alice Coins — ${result.message}`);
    }
    setPhase('player-result');
    setBusy(false);
  };

  const beginElfTurn = () => {
    if (phase !== 'player-result') return;
    setPhase('elf-attack');
    const need = levelInfo.name;
    setMessage(
      levelInfo.isBoss
        ? 'The Other presses in. Pull — three of The Other / sigil line blocks the dissolve.'
        : `${need} engages. Pull once: land three matching entities to shield your Alice Coins.`,
    );
    pushLog(`── Encounter turn ── Defense: three of this level’s being.`);
  };

  const doBlockSpin = async () => {
    if (busy || spinning || phase !== 'elf-attack') return;
    setBusy(true);
    setPhase('block-spinning');
    const result = await runReelSpin(() => {
      const r = spinBlockReels(level, levelInfo.isBoss);
      return { reels: r.reels, message: r.message, blocked: r.blocked };
    });
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
    setResults(null);
    setJustLanded(false);
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

  const canPullPlayer = phase === 'player-spin' && !busy && !spinning;
  const canPullBlock = phase === 'elf-attack' && !busy && !spinning;
  const statusLed =
    spinning || phase === 'spinning' || phase === 'block-spinning'
      ? 'SPINNING'
      : phase === 'trick-choices'
        ? 'CHOOSE'
        : phase === 'victory'
          ? 'CLEARED'
          : phase === 'elf-attack' || phase === 'block-result'
            ? 'DEFEND'
            : phase === 'intro'
              ? 'READY'
              : 'INSERT BONK';

  return (
    <div className="alice-room alice-machine-scene">
      <div className="alice-room-bg" aria-hidden />
      <div className="casino-scene-vignette alice-vignette" />
      <div className="alice-room-content">
        <header className="casino-header alice-machine-header">
          <div className="casino-top-bar">
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
            <div className="casino-wallet-bar">
              <div className="casino-wallet-connect">
                <WalletMultiButton />
              </div>
              <p className="casino-wallet-status">
                {connected && publicKey
                  ? `Connected · ${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
                  : 'Connect wallet to bank final tally'}
              </p>
            </div>
          </div>
          <p className="casino-eyebrow alice-eyebrow-line">
            {phase === 'intro'
              ? 'Eat the Mushroom — Wonderland Bandit side game'
              : `${levelInfo.depthLabel} · ${levelInfo.name}`}
          </p>
          <h1 className="casino-title alice-page-title">{BRAND.aliceRoom}</h1>
          <p className="casino-tagline">
            Same one-armed machine as the {BRAND.slotMachine} — Alice in Wonderland decor, hyperspace reels.
            Mid-run Alice Coins are dream-wealth; only the post-boss tally is spendable.
          </p>
        </header>

        {phase === 'intro' && (
          <section className="alice-panel alice-intro">
            <h2>How the hole works</h2>
            <ol className="alice-rules">
              <li>
                <strong>Your spin</strong> on the Alice Machine — Alice Coins (not cashable yet).
              </li>
              <li>
                <strong>Elf turn</strong> — pull again. Land <strong>three Machine Elves</strong> to block.
              </li>
              <li>
                <strong>Fail the block</strong> — four lying Wonderland doors (none / moderate / most / all loss).
              </li>
              <li>
                Clear <strong>{ELF_LEVELS} elf layers</strong> + <strong>boss</strong>, then bank the final tally.
              </li>
            </ol>
            <button
              type="button"
              className="alice-btn alice-btn-primary"
              disabled={busy}
              onClick={() => void startDive()}
            >
              {busy ? 'Opening the door…' : 'Eat the Mushroom — Enter'}
            </button>
          </section>
        )}

        {phase !== 'intro' && (
          <div className="slot-stage-layout alice-stage-layout">
            <div className="casino-side-column alice-side-column">
              <aside className="slot-paytable alice-paytable" aria-label="Alice Machine key">
                <div className="slot-paytable-header">
                  <h3 className="slot-paytable-title">Looking-Glass Key</h3>
                  <p className="slot-paytable-sub">
                    Layer {level}/{TOTAL_LEVELS}
                    {levelInfo.isBoss ? ' · BOSS' : ''}
                  </p>
                </div>
                <ul className="slot-paytable-rows">
                  <li className="slot-paytable-row paytable-row-fam">
                    <div className="slot-paytable-combo">
                      <span className="slot-paytable-combo-text">Guides ×3</span>
                      <span className="slot-paytable-detail">Same or any guide line</span>
                    </div>
                    <div className="slot-paytable-payout">
                      <span className="slot-paytable-payout-value">Big Alice Coins</span>
                    </div>
                  </li>
                  <li className="slot-paytable-row paytable-row-bonk">
                    <div className="slot-paytable-combo">
                      <span className="slot-paytable-combo-text">Entities / wild</span>
                      <span className="slot-paytable-detail">Hyperspace beings</span>
                    </div>
                    <div className="slot-paytable-payout">
                      <span className="slot-paytable-payout-value">Easy points</span>
                    </div>
                  </li>
                  <li className="slot-paytable-row paytable-row-degen">
                    <div className="slot-paytable-combo">
                      <span className="slot-paytable-combo-text">This level’s entity ×3</span>
                      <span className="slot-paytable-detail">Defense pull — blocks the encounter</span>
                    </div>
                    <div className="slot-paytable-payout">
                      <span className="slot-paytable-payout-value">SHIELD</span>
                    </div>
                  </li>
                </ul>
                <div className="slot-paytable-session">
                  <span className="slot-paytable-session-label">Alice Coins (run)</span>
                  <span className="slot-paytable-session-value">{aliceCoins.toLocaleString()}</span>
                </div>
                <p className="alice-side-hint">
                  ~{projectedSpendable} spendable chips if this were the final tally ({ALICE_COINS_PER_SPENDABLE_CHIP}{' '}
                  AC → 1 chip, capped).
                </p>
              </aside>

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

            <div className="slot-stage">
              <div
                className={`slot-cabinet alice-cabinet ${spinning ? 'slot-cabinet-active' : ''} ${leverPulled ? 'slot-cabinet-pull' : ''}`}
              >
                <div className="slot-cabinet-rivet slot-cabinet-rivet-tl" aria-hidden />
                <div className="slot-cabinet-rivet slot-cabinet-rivet-tr" aria-hidden />
                <div className="slot-cabinet-rivet slot-cabinet-rivet-bl" aria-hidden />
                <div className="slot-cabinet-rivet slot-cabinet-rivet-br" aria-hidden />
                <div className="slot-cabinet-trim slot-cabinet-trim-top" aria-hidden />
                <div className="slot-cabinet-trim slot-cabinet-trim-mid" aria-hidden />
                <div className="alice-cabinet-cards" aria-hidden>
                  <span>♠</span>
                  <span>♥</span>
                  <span>♦</span>
                  <span>♣</span>
                </div>

                <div className="slot-marquee-hood alice-marquee-hood">
                  <div className="slot-marquee-lens">
                    <div className="slot-marquee-backlight alice-marquee-glow" />
                    <h2 className="slot-marquee-title">Alice Machine</h2>
                    <p className="slot-marquee-sub">
                      {levelInfo.isBoss ? 'Boss Layer · Red Queen Court' : `Wonderland · Layer ${level}`}
                    </p>
                  </div>
                </div>

                <div className="slot-display-bar alice-display-bar">
                  <div className="slot-led-panel">
                    <span className="slot-led-label">Alice Coins</span>
                    <span className="slot-led-value">{aliceCoins.toLocaleString()}</span>
                  </div>
                  <div className="slot-led-panel slot-led-panel-center">
                    <span className="slot-led-label">Status</span>
                    <span className="slot-led-value slot-led-status">{statusLed}</span>
                  </div>
                  <div className="slot-led-panel">
                    <span className="slot-led-label">Layer</span>
                    <span className="slot-led-value">
                      {level}/{TOTAL_LEVELS}
                    </span>
                  </div>
                </div>

                <div className="slot-cabinet-face">
                  <div className="slot-reels-panel">
                    <div className="slot-reels-panel-header">
                      <span className="slot-panel-badge">
                        {levelInfo.isBoss ? 'QUEEN' : `ELF ${level}`}
                      </span>
                      <span className="slot-panel-model">Model A-L1C3</span>
                    </div>
                    <div className="slot-reel-bezel">
                      <div className="slot-reel-case">
                        <div
                          className={`slot-reels ${justLanded ? 'slot-reels-landed' : ''} ${spinning ? 'slot-reels-spinning' : ''}`}
                        >
                          <AliceReel
                            result={displayReels[0]}
                            spinning={spinning}
                            stopDelay={0}
                            spinKey={spinKey}
                          />
                          <div className="slot-reel-divider" aria-hidden />
                          <AliceReel
                            result={displayReels[1]}
                            spinning={spinning}
                            stopDelay={400}
                            spinKey={spinKey + 1}
                          />
                          <div className="slot-reel-divider" aria-hidden />
                          <AliceReel
                            result={displayReels[2]}
                            spinning={spinning}
                            stopDelay={800}
                            spinKey={spinKey + 2}
                          />
                        </div>
                        <div className="slot-payline-overlay" aria-hidden>
                          <span className="slot-payline-arrow slot-payline-arrow-l">◀</span>
                          <span className="slot-payline-bar" />
                          <span className="slot-payline-arrow slot-payline-arrow-r">▶</span>
                        </div>
                      </div>
                      <div className="slot-reel-bezel-label">
                        {phase === 'elf-attack' || phase === 'block-spinning' || phase === 'block-result'
                          ? 'SHIELD LINE — 3 OF THIS BEING'
                          : 'WIN LINE'}
                      </div>
                    </div>
                  </div>

                  <div className="slot-lever-column">
                    <div className="slot-lever-housing" aria-hidden>
                      <div className={`slot-lever-assembly ${leverPulled ? 'slot-lever-pulled' : ''}`}>
                        <div className="slot-lever-arm">
                          <div className="slot-lever-ball alice-lever-ball">
                            <span className="slot-lever-ball-shine" />
                          </div>
                          <div className="slot-lever-stick">
                            <span className="slot-lever-stick-ridge" />
                          </div>
                        </div>
                        <div className="slot-lever-socket">
                          <span className="slot-lever-socket-bolt" />
                          <span className="slot-lever-socket-ring" />
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`slot-pull-btn alice-pull-btn ${!canPullPlayer && !canPullBlock ? 'slot-pull-btn-disabled' : ''}`}
                      disabled={!canPullPlayer && !canPullBlock}
                      onClick={() => {
                        if (canPullPlayer) void doPlayerSpin();
                        else if (canPullBlock) void doBlockSpin();
                      }}
                    >
                      {canPullBlock ? 'DEFENSE PULL' : canPullPlayer ? 'PULL LEVER' : 'WAIT…'}
                    </button>
                  </div>
                </div>

                {message && <p className="casino-result alice-cabinet-msg">{message}</p>}
              </div>

              <div className="alice-machine-actions">
                {phase === 'player-result' && (
                  <button type="button" className="alice-btn alice-btn-danger" onClick={beginElfTurn}>
                    Face the Elf Attack →
                  </button>
                )}
                {phase === 'block-result' && (
                  <button type="button" className="alice-btn alice-btn-primary" onClick={afterDefenseContinue}>
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
                <div className="alice-tricks alice-tricks-under-machine">
                  <h3>The elves offer four paths</h3>
                  <p className="alice-tricks-hint">
                    One path costs nothing. The others take moderate, most, or all Alice Coins. Labels mislead.
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

              {phase === 'victory' && (
                <section className="alice-panel alice-victory">
                  <h2>Through the looking glass</h2>
                  <p className="alice-final-tally">
                    Final Alice Coins: <strong>{aliceCoins.toLocaleString()}</strong>
                  </p>
                  <p>
                    Spendable estimate:{' '}
                    <strong>{aliceCoinsToSpendable(aliceCoins).toLocaleString()} Bonk Chips</strong>
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
                    <p className="alice-claim-ok">
                      +{spendableEarned} spendable Bonk Chips on your server ledger.
                    </p>
                  )}
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
