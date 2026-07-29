'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  ALICE_COINS_PER_SPENDABLE_CHIP,
  BOSS_LEVEL,
  TOTAL_LEVELS,
  aliceCoinsToSpendable,
  applyChoice,
  buildAliceReelStrip,
  buildTrickChoices,
  emptyTripKillState,
  evaluateTripKill,
  getLevelInfo,
  newRunSeed,
  resetTripKillStreak,
  spinBlockReels,
  spinPlayerReels,
  type AlicePhase,
  type TrickChoice,
  type TripKillState,
} from '@/lib/alice-room/game';
import { getEntityForLevel } from '@/lib/alice-room/symbols';
import { ALL_ALICE_SYMBOLS, type AliceSymbol } from '@/lib/alice-room/symbols';
import AliceEntityPortrait from '@/components/AliceEntityPortrait';
import { BRAND } from '@/lib/brand';
import { loadChipLedgerToken, saveChipLedgerToken } from '@/lib/chip-ledger-client';
import { CASINO_SPIN_DURATION_MS, CASINO_SPIN_START_DELAY_MS } from '@/lib/casino-audio';
import { useAliceAudio } from '@/hooks/useAliceAudio';
import type { WinTier } from '@/lib/slot-machine';

/**
 * MUST match CSS `.alice-cabinet .slot-reels { --slot-reel-height: 160px }`
 * and each `.slot-symbol` height. Mismatch scrolls the strip into empty black.
 */
const REEL_ITEM_HEIGHT = 160;
const REEL_SPIN_MS = CASINO_SPIN_DURATION_MS;
const LEVER_PULL_MS = CASINO_SPIN_START_DELAY_MS;

type LogLine = { id: number; text: string };

function AliceSymbolCell({ symbol }: { symbol: AliceSymbol }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = Boolean(symbol.image) && !imgFailed;

  return (
    <div
      className={`slot-symbol alice-slot-symbol slot-symbol-${
        symbol.kind === 'elf' ? 'enemy' : symbol.kind === 'wild' ? 'jackpot' : 'fam'
      }`}
      style={{ height: REEL_ITEM_HEIGHT }}
    >
      {showImg ? (
        <div className="slot-symbol-frame alice-symbol-frame">
          <Image
            src={symbol.image!}
            alt={symbol.label}
            width={120}
            height={120}
            className="character-img slot-symbol-img alice-symbol-img object-contain"
            unoptimized
            onError={() => setImgFailed(true)}
          />
        </div>
      ) : (
        <span className="alice-symbol-emoji-fallback" aria-hidden>
          {symbol.emoji}
        </span>
      )}
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
    () => buildAliceReelStrip(result, ALL_ALICE_SYMBOLS, 28),
    [result, spinKey],
  );
  const stopAt = (strip.length - 1) * REEL_ITEM_HEIGHT;

  return (
    <div className="slot-reel-column">
      <div
        className="slot-reel-window"
        style={{ height: REEL_ITEM_HEIGHT, ['--slot-reel-height' as string]: `${REEL_ITEM_HEIGHT}px` }}
      >
        <div className="slot-reel-drum-shadow slot-reel-drum-shadow-top" />
        <div className="slot-reel-drum-shadow slot-reel-drum-shadow-bottom" />
        <div
          className={`slot-reel-strip ${spinning ? 'slot-reel-spinning' : 'slot-reel-stopped'}`}
          style={{
            ['--reel-stop' as string]: `-${stopAt}px`,
            ['--reel-duration' as string]: `${REEL_SPIN_MS}ms`,
            ['--slot-reel-height' as string]: `${REEL_ITEM_HEIGHT}px`,
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

function aliceWinTier(aliceCoins: number): WinTier {
  if (aliceCoins >= 7000) return 'jackpot';
  if (aliceCoins >= 3500) return 'fam-triple';
  if (aliceCoins >= 1500) return 'fam-any';
  if (aliceCoins > 0) return 'bonk-single';
  return 'none';
}

export default function AliceRoomGame() {
  const { publicKey, connected } = useWallet();
  const [phase, setPhase] = useState<AlicePhase>('intro');
  const [level, setLevel] = useState(1);
  const {
    muted,
    audioReady,
    unlockAudio,
    toggleMute,
    playLeverPull,
    playSpinSequence,
    playWinResult,
    ambienceCredit,
  } = useAliceAudio(level);
  const [aliceCoins, setAliceCoins] = useState(0);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [runSeed, setRunSeed] = useState(0);
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
  const [doubleUsed, setDoubleUsed] = useState(false);
  const [tripKill, setTripKill] = useState<TripKillState>(emptyTripKillState());
  const [melt, setMelt] = useState(0);

  const levelInfo = getLevelInfo(level);
  const defenseEntity = getEntityForLevel(level);
  const projectedSpendable = aliceCoinsToSpendable(aliceCoins);
  const displayReels = results ?? [IDLE_REEL, IDLE_REEL, IDLE_REEL];

  const pushLog = useCallback((text: string) => {
    setLogId(n => {
      const id = n + 1;
      setLog(prev => [{ id, text }, ...prev].slice(0, 14));
      return id;
    });
  }, []);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const startDive = async () => {
    setBusy(true);
    setClaimMsg(null);
    setSpendableEarned(null);
    setDoubleUsed(false);
    setTripKill(emptyTripKillState());
    setMelt(0);
    // User gesture — unlock Bandit-style audio (lever, reels, ambience).
    void unlockAudio();
    try {
      const wallet = publicKey?.toBase58() ?? null;
      const res = await fetch('/api/alice/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      });
      const data = (await res.json()) as {
        sessionToken?: string;
        error?: string;
        minPlayMs?: number;
      };
      if (!res.ok || !data.sessionToken) {
        setMessage(data.error ?? 'Could not open the Alice Room.');
        setBusy(false);
        return;
      }
      const seed = newRunSeed();
      setSessionToken(data.sessionToken);
      setRunSeed(seed);
      setLevel(1);
      setAliceCoins(0);
      setResults(null);
      setChoices([]);
      setLog([]);
      setPhase('player-spin');
      setMessage('Layer 1 — pull the Alice Machine. Dream-wealth only until the end.');
      pushLog('Eat the Mushroom. Ten layers. Reality softens.');
      pushLog('Only the final tally after The Other can become spendable chips.');
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
    // Same SFX + timing pattern as Bonklandia Bandit.
    void playLeverPull();
    void playSpinSequence();
    setLeverPulled(true);
    setJustLanded(false);
    setSpinning(false);

    // Precompute outcome so strip is built with the winning symbols before animation.
    const result = getResult();

    await sleep(LEVER_PULL_MS);

    // Set results + spinKey + spinning together so reel math and art stay aligned.
    setResults(result.reels);
    setMessage(result.message);
    setSpinKey(k => k + 1);
    setSpinning(true);

    // Spin duration + last reel stop delay (800ms) + settle
    await sleep(REEL_SPIN_MS + 900);
    setSpinning(false);
    setLeverPulled(false);
    setJustLanded(true);
    return result;
  };

  /** Seamless: after shield success or a choice, go straight to next layer’s prize pull. */
  const goToNextLayer = useCallback(
    async (fromLevel: number) => {
      setMelt(m => Math.min(10, m + 1));
      setChoices([]);
      setJustLanded(false);

      if (fromLevel >= TOTAL_LEVELS) {
        setPhase('victory');
        setMessage('Through the layers. Bank your final tally when ready.');
        pushLog('Boss cleared. Bank the final tally with your wallet.');
        setBusy(false);
        return;
      }

      const nextLevel = fromLevel + 1;
      const next = getLevelInfo(nextLevel);
      setLevel(nextLevel);
      setMessage(`Deeper… ${next.name}. Pull when ready.`);
      pushLog(`Layer cleared → ${next.name}.`);
      setResults(null);
      // Brief beat so the strip/entity updates, then unlock the next prize pull.
      await sleep(900);
      setPhase('player-spin');
      setBusy(false);
    },
    [pushLog],
  );

  const runDefenseSpin = useCallback(
    async (forLevel: number) => {
      const info = getLevelInfo(forLevel);
      const entity = getEntityForLevel(forLevel);
      setPhase('block-spinning');
      setMessage(`${info.attackLine} — shielding…`);
      pushLog(`── ${info.name} ── Defense: three ${entity.label}s.`);

      const result = await runReelSpin(() => {
        const r = spinBlockReels(forLevel);
        return { reels: r.reels, message: r.message, blocked: r.blocked };
      });
      pushLog(result.message);

      if (result.blocked) {
        void playWinResult('fam-any');
        setTripKill(s => resetTripKillStreak(s));
        setMessage(result.message);
        setPhase('block-result');
        await sleep(1100);
        await goToNextLayer(forLevel);
        return;
      }

      void playWinResult('none');
      const doors = buildTrickChoices(forLevel, runSeed, doubleUsed);
      setChoices(doors);
      setPhase('trick-choices');
      setMessage(
        info.loving
          ? 'The presence offers paths…'
          : 'Shield failed — choose a path.',
      );
      setBusy(false);
    },
    [runReelSpin, playWinResult, pushLog, runSeed, doubleUsed, goToNextLayer],
  );

  const doPlayerSpin = async () => {
    if (busy || spinning || phase !== 'player-spin') return;
    setBusy(true);
    setPhase('spinning');
    const forLevel = level;
    const result = await runReelSpin(() => {
      const r = spinPlayerReels(forLevel);
      return { reels: r.reels, message: r.message, aliceCoins: r.aliceCoins };
    });
    if (result.aliceCoins) {
      setAliceCoins(c => c + result.aliceCoins!);
      pushLog(`+${result.aliceCoins.toLocaleString()} Alice Coins — ${result.message}`);
      void playWinResult(aliceWinTier(result.aliceCoins));
    } else {
      void playWinResult('none');
    }
    // Auto-chain into defense — no "Face entity" click.
    setPhase('player-result');
    setMessage(result.message);
    await sleep(1000);
    await runDefenseSpin(forLevel);
  };

  const onPickTrick = (choice: TrickChoice) => {
    if (phase !== 'trick-choices' || busy) return;
    setBusy(true);

    const { state: nextKill, result: killResult } = evaluateTripKill(tripKill, choice);
    setTripKill(nextKill);

    if (killResult.kill) {
      setAliceCoins(0);
      setChoices([]);
      setPhase('defeat');
      setMessage(killResult.message);
      pushLog(killResult.message);
      setBusy(false);
      return;
    }
    if (killResult.warn && killResult.message) {
      pushLog(killResult.message);
    }

    const applied = applyChoice(aliceCoins, choice);
    setAliceCoins(applied.nextCoins);
    if (choice.tier === 'double') {
      setDoubleUsed(true);
      pushLog(`DOUBLE — +${applied.gained.toLocaleString()} Alice Coins. (${choice.label})`);
      void playWinResult('jackpot');
    } else if (applied.lost > 0) {
      pushLog(`“${choice.label}” — lost ${applied.lost.toLocaleString()} (${choice.tier}).`);
      void playWinResult('none');
    } else {
      pushLog(`“${choice.label}” — safe. Coins untouched.`);
      void playWinResult('bonk-single');
    }
    setMessage(`${choice.label}: ${applied.flavor}`);
    setChoices([]);
    setPhase('block-result');
    // Auto-descend — no "next level" button.
    void (async () => {
      await sleep(900);
      await goToNextLayer(level);
    })();
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
  const statusLed =
    spinning || phase === 'spinning' || phase === 'block-spinning'
      ? 'SPINNING'
      : phase === 'trick-choices'
        ? 'CHOOSE'
        : phase === 'victory'
          ? 'CLEARED'
          : phase === 'defeat'
            ? 'EJECTED'
            : phase === 'block-result' || phase === 'player-result' || phase === 'level-clear'
              ? '…'
              : phase === 'intro'
                ? 'READY'
                : 'PULL';

  const meltClass = `alice-melt-${Math.min(10, Math.max(0, melt || level - 1))}`;

  const inPlay = phase !== 'intro';

  return (
    <div
      className={`alice-room alice-machine-scene ${meltClass} ${inPlay ? 'alice-room-playing' : ''}`}
    >
      <div className="alice-room-bg" aria-hidden />
      <div className="casino-scene-vignette alice-vignette" />
      <div className="alice-room-content">
        <header className={`casino-header alice-machine-header ${inPlay ? 'alice-header-play' : ''}`}>
          <div className="casino-top-bar alice-top-bar-compact">
            <div className="alice-room-nav">
              <Link href="/" className="alice-nav-link">
                ← Home
              </Link>
              <Link href="/cashier" className="alice-nav-link">
                Cashier
              </Link>
            </div>
            <div className="casino-audio-bar alice-audio-bar">
              <button
                type="button"
                className="casino-audio-btn"
                onClick={() => void toggleMute()}
                aria-label={muted ? 'Unmute Alice Machine audio' : 'Mute Alice Machine audio'}
                title={ambienceCredit}
              >
                {muted ? '🔇' : '🔊'}
              </button>
              {!audioReady && (
                <button
                  type="button"
                  className="casino-audio-unlock"
                  onClick={() => void unlockAudio()}
                >
                  Sound
                </button>
              )}
            </div>
            <div className="casino-wallet-bar alice-wallet-compact">
              <div className="casino-wallet-connect">
                <WalletMultiButton />
              </div>
            </div>
          </div>
          {!inPlay && (
            <>
              <p className="casino-eyebrow alice-eyebrow-line">
                {BRAND.aliceRoomNav} — 10-layer DMT voyage
              </p>
              <h1 className="casino-title alice-page-title">{BRAND.aliceRoom}</h1>
              <p className="casino-tagline alice-tagline-desktop">
                Alice Machine · win spin → encounter → defense → strategy doors. Only post-boss tally
                is spendable.
              </p>
            </>
          )}
        </header>

        {phase === 'intro' && (
          <section className="alice-panel alice-intro">
            <h2>The voyage</h2>
            <ol className="alice-rules">
              <li>
                <strong>10 layers</strong> — Machine Elves → Jesters → Mantis → Greys → Light → Goddess →
                Fractal → Serpent → Ancestors → <strong>The Other</strong> (boss).
              </li>
              <li>
                Each layer: <strong>one pull</strong> for Alice Coins — defense runs automatically after.
              </li>
              <li>
                <strong>Auto shield spin</strong> — need <strong>three of that level’s entity</strong> or choose a
                path.
              </li>
              <li>
                Fail shield → <strong>strategy doors</strong> (loving floors may offer a <strong>double</strong>).
                Then you drop straight into the next layer.
              </li>
              <li>
                <strong>Soft anti-rush</strong> — only ejects if you pick the <em>same harsh door type</em>{' '}
                many times in a row (safe/double paths never kill).
              </li>
              <li>
                After the boss, bank the final tally (capped spendable chips).
              </li>
            </ol>
            <button
              type="button"
              className="alice-btn alice-btn-primary"
              disabled={busy}
              onClick={() => void startDive()}
            >
              {busy ? 'Opening…' : `${BRAND.aliceRoomNav} — Begin`}
            </button>
          </section>
        )}

        {phase !== 'intro' && (
          <div className="alice-stage-layout alice-stage-solo">
            {/* Compact status strip — no cramped left column on mobile */}
            <div className="alice-trip-strip" aria-label="Trip status">
              <div className="alice-trip-strip-entity">
                {defenseEntity.image && (
                  <Image
                    src={defenseEntity.image}
                    alt={defenseEntity.label}
                    width={56}
                    height={56}
                    className="alice-trip-strip-img"
                    unoptimized
                  />
                )}
                <div className="alice-trip-strip-meta">
                  <span className="alice-trip-strip-layer">
                    L{level}/{TOTAL_LEVELS}
                    {levelInfo.isBoss ? ' · BOSS' : ''}
                    {levelInfo.loving ? ' · LOVE' : ''}
                  </span>
                  <span className="alice-trip-strip-name">{defenseEntity.label}</span>
                  <span className="alice-trip-strip-need">Shield: 3× this being</span>
                </div>
              </div>
              <div className="alice-trip-strip-stats">
                <span className="alice-trip-strip-coins">
                  {aliceCoins.toLocaleString()} <small>AC</small>
                </span>
                <span className="alice-trip-strip-spend">
                  ~{projectedSpendable} chips
                </span>
              </div>
            </div>

            <div className="slot-stage alice-slot-stage">
              <div
                className={`slot-cabinet alice-cabinet ${spinning ? 'slot-cabinet-active' : ''} ${leverPulled ? 'slot-cabinet-pull' : ''}`}
              >
                <div className="slot-cabinet-rivet slot-cabinet-rivet-tl" aria-hidden />
                <div className="slot-cabinet-rivet slot-cabinet-rivet-tr" aria-hidden />
                <div className="slot-cabinet-rivet slot-cabinet-rivet-bl" aria-hidden />
                <div className="slot-cabinet-rivet slot-cabinet-rivet-br" aria-hidden />
                <div className="slot-cabinet-trim slot-cabinet-trim-top" aria-hidden />
                <div className="slot-cabinet-trim slot-cabinet-trim-mid" aria-hidden />

                <div className="slot-marquee-hood alice-marquee-hood">
                  <div className="slot-marquee-lens">
                    <div className="slot-marquee-backlight alice-marquee-glow" />
                    <h2 className="slot-marquee-title">Alice Machine</h2>
                    <p className="slot-marquee-sub">
                      {levelInfo.isBoss ? 'BOSS · The Other' : `Layer ${level} · ${levelInfo.name}`}
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
                        {levelInfo.isBoss ? 'OTHER' : `L${level}`}
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
                        {phase === 'elf-attack' ||
                        phase === 'block-spinning' ||
                        phase === 'block-result'
                          ? `SHIELD — 3× ${defenseEntity.label.toUpperCase()}`
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
                      className={`slot-pull-btn alice-pull-btn ${!canPullPlayer ? 'slot-pull-btn-disabled' : ''}`}
                      disabled={!canPullPlayer}
                      onClick={() => {
                        if (canPullPlayer) void doPlayerSpin();
                      }}
                    >
                      {canPullPlayer ? 'PULL LEVER' : spinning || busy ? '…' : 'WAIT…'}
                    </button>
                  </div>
                </div>

                {message && <p className="casino-result alice-cabinet-msg">{message}</p>}
              </div>

              {phase === 'trick-choices' && (
                <section className="alice-encounter" aria-label={`${levelInfo.name} encounter`}>
                  <div className="alice-encounter-stage">
                    <div className="alice-encounter-glow" aria-hidden />
                    <AliceEntityPortrait
                      entity={defenseEntity}
                      playVideo
                      priority
                      className="alice-encounter-media"
                    />
                    <div className="alice-encounter-caption">
                      <p className="alice-encounter-layer">
                        Layer {level}/{TOTAL_LEVELS}
                        {levelInfo.loving ? ' · Loving presence' : ''}
                      </p>
                      <h2 className="alice-encounter-name">{levelInfo.name}</h2>
                      <p className="alice-encounter-line">{levelInfo.attackLine}</p>
                      <p className="alice-encounter-prompt">
                        {levelInfo.loving
                          ? 'Choose a path. Losses capped at 50% — a golden door may double your Alice Coins.'
                          : 'Shield failed. Choose carefully — one path is safe. Labels mislead.'}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`alice-trick-grid alice-encounter-choices ${choices.length >= 5 ? 'alice-trick-grid-5' : ''}`}
                  >
                    {choices.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className={`alice-trick-card ${c.tier === 'double' ? 'alice-trick-double' : ''}`}
                        onClick={() => onPickTrick(c)}
                      >
                        <span className="alice-trick-label">{c.label}</span>
                        <span className="alice-trick-whisper">{c.whisper}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {phase === 'victory' && (
                <section className="alice-panel alice-victory">
                  <h2>Voyage complete</h2>
                  <p className="alice-final-tally">
                    Final Alice Coins: <strong>{aliceCoins.toLocaleString()}</strong>
                  </p>
                  <p>
                    Spendable estimate:{' '}
                    <strong>{aliceCoinsToSpendable(aliceCoins).toLocaleString()} Bonk Chips</strong>
                  </p>
                  {!connected && (
                    <p className="alice-warn">Connect wallet to bank spendable chips.</p>
                  )}
                  <div className="alice-actions">
                    <button
                      type="button"
                      className="alice-btn alice-btn-primary"
                      disabled={busy || !sessionToken}
                      onClick={() => void bankFinalTally()}
                    >
                      {busy ? 'Banking…' : 'Bank Final Tally'}
                    </button>
                    <Link href="/cashier" className="alice-btn alice-btn-ghost">
                      {BRAND.cashier}
                    </Link>
                    <button type="button" className="alice-btn alice-btn-ghost" onClick={() => void startDive()}>
                      Dive again
                    </button>
                  </div>
                  {claimMsg && <p className="alice-claim-msg">{claimMsg}</p>}
                  {spendableEarned != null && spendableEarned > 0 && (
                    <p className="alice-claim-ok">+{spendableEarned} spendable Bonk Chips.</p>
                  )}
                </section>
              )}

              {phase === 'defeat' && (
                <section className="alice-panel alice-victory">
                  <h2>Trip kill</h2>
                  <p className="alice-warn">{message}</p>
                  <p>Repeating the same strategy without presence ejects the voyage. No spendable tally.</p>
                  <div className="alice-actions">
                    <button type="button" className="alice-btn alice-btn-primary" onClick={() => void startDive()}>
                      Begin again — slower
                    </button>
                    <Link href="/" className="alice-btn alice-btn-ghost">
                      Leave
                    </Link>
                  </div>
                </section>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
