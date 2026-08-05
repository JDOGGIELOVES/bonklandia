'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
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
import {
  ALICE_COACH_TIPS,
  dismissAliceCoach,
  isAliceCoachDismissed,
} from '@/lib/alice-coach';
import {
  loadAliceStats,
  noteAliceBanked,
  noteAliceDiveStarted,
  noteAliceVoyageEnd,
  type AliceLocalStats,
} from '@/lib/alice-stats';
import { loadChipLedgerToken, saveChipLedgerToken } from '@/lib/chip-ledger-client';
import { CASINO_SPIN_DURATION_MS, CASINO_SPIN_START_DELAY_MS } from '@/lib/casino-audio';
import { useAliceAudio } from '@/hooks/useAliceAudio';
import type { WinTier } from '@/lib/slot-machine';

type CoinFlash = {
  id: number;
  text: string;
  kind: 'gain' | 'loss' | 'safe' | 'double';
};

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
    entitySpeaking,
    unlockAudio,
    toggleMute,
    playLeverPull,
    playSpinSequence,
    playLandClunk,
    playWinResult,
    speakEntityLine,
    stopEntitySpeech,
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
  const [cabinetBump, setCabinetBump] = useState(false);
  const [paylineFx, setPaylineFx] = useState<'prize' | 'big' | 'shield' | null>(null);
  const [spinMode, setSpinMode] = useState<'prize' | 'shield'>('prize');
  const [log, setLog] = useState<LogLine[]>([]);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [spendableEarned, setSpendableEarned] = useState<number | null>(null);
  const [logId, setLogId] = useState(0);
  const [doubleUsed, setDoubleUsed] = useState(false);
  const [tripKill, setTripKill] = useState<TripKillState>(emptyTripKillState());
  const [melt, setMelt] = useState(0);
  const [showCoach, setShowCoach] = useState(false);
  const [coinFlash, setCoinFlash] = useState<CoinFlash | null>(null);
  const [shieldBeat, setShieldBeat] = useState<{
    kind: 'pass' | 'fail';
    title: string;
    sub: string;
  } | null>(null);
  /** Level id whose attack line was already spoken this shield cycle. */
  const spokeAttackForLevel = useRef<number | null>(null);
  const voyageRecorded = useRef(false);
  const [localStats, setLocalStats] = useState<AliceLocalStats | null>(null);

  const levelInfo = getLevelInfo(level);
  const defenseEntity = getEntityForLevel(level);
  const projectedSpendable = aliceCoinsToSpendable(aliceCoins);
  const displayReels = results ?? [IDLE_REEL, IDLE_REEL, IDLE_REEL];
  const progressFill =
    phase === 'victory' ? 100 : Math.max(4, Math.round(((level - 1) / TOTAL_LEVELS) * 100));

  useEffect(() => {
    setShowCoach(!isAliceCoachDismissed());
    setLocalStats(loadAliceStats());
  }, []);

  const pushLog = useCallback((text: string) => {
    setLogId(n => {
      const id = n + 1;
      setLog(prev => [{ id, text }, ...prev].slice(0, 14));
      return id;
    });
  }, []);

  const flashCoins = useCallback((text: string, kind: CoinFlash['kind']) => {
    const id = Date.now();
    setCoinFlash({ id, text, kind });
    window.setTimeout(() => {
      setCoinFlash(cur => (cur?.id === id ? null : cur));
    }, 1600);
  }, []);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const onDismissCoach = () => {
    dismissAliceCoach();
    setShowCoach(false);
  };

  const startDive = async () => {
    setBusy(true);
    setClaimMsg(null);
    setSpendableEarned(null);
    setDoubleUsed(false);
    setTripKill(emptyTripKillState());
    setMelt(0);
    voyageRecorded.current = false;
    // User gesture — unlock Bandit-style audio (lever, reels, ambience). Music loads only now.
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
      setLocalStats(noteAliceDiveStarted());
      setPhase('player-spin');
      setMessage('Layer 1 — pull the Alice Machine. Dream-wealth only until the end.');
      pushLog('Eat the Mushroom. Ten layers. Reality softens.');
      pushLog('Only the final tally after The Other can become spendable chips.');
    } catch {
      setMessage('Network error opening Alice Room.');
    }
    setBusy(false);
  };

  const markVoyageEnd = useCallback(
    (opts: { aliceCoins: number; layersCleared: number }) => {
      if (voyageRecorded.current) return;
      voyageRecorded.current = true;
      setLocalStats(noteAliceVoyageEnd(opts));
    },
    [],
  );

  const flashPayline = (kind: 'prize' | 'big' | 'shield') => {
    setPaylineFx(kind);
    window.setTimeout(() => {
      setPaylineFx(cur => (cur === kind ? null : cur));
    }, 1300);
  };

  const runReelSpin = async (
    getResult: () => {
      reels: [AliceSymbol, AliceSymbol, AliceSymbol];
      message: string;
      aliceCoins?: number;
      blocked?: boolean;
    },
    mode: 'prize' | 'shield' = 'prize',
  ) => {
    setSpinMode(mode);
    void playLeverPull(mode);
    void playSpinSequence();
    setLeverPulled(true);
    setCabinetBump(true);
    setJustLanded(false);
    setPaylineFx(null);
    setSpinning(false);

    // Precompute outcome so strip is built with the winning symbols before animation.
    const result = getResult();

    await sleep(LEVER_PULL_MS);
    setCabinetBump(false);

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
    async (fromLevel: number, coinsAtEnd?: number) => {
      stopEntitySpeech();
      setMelt(m => Math.min(10, m + 1));
      setChoices([]);
      setJustLanded(false);

      if (fromLevel >= TOTAL_LEVELS) {
        setPhase('victory');
        setMessage('Through the layers. Bank your final tally when ready.');
        pushLog('Boss cleared. Bank the final tally with your wallet.');
        markVoyageEnd({
          aliceCoins: typeof coinsAtEnd === 'number' ? coinsAtEnd : aliceCoins,
          layersCleared: TOTAL_LEVELS,
        });
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
    [pushLog, stopEntitySpeech, markVoyageEnd, aliceCoins],
  );

  const runDefenseSpin = useCallback(
    async (forLevel: number) => {
      const info = getLevelInfo(forLevel);
      const entity = getEntityForLevel(forLevel);
      setShieldBeat(null);
      setPhase('block-spinning');
      setMessage(`Shielding — need three ${entity.label}s…`);
      pushLog(`Shield pull — three ${entity.label}s on the line.`);
      // Attack line was spoken when waiting for the second lever pull.

      const result = await runReelSpin(() => {
        const r = spinBlockReels(forLevel);
        return { reels: r.reels, message: r.message, blocked: r.blocked };
      }, 'shield');
      pushLog(result.message);

      if (result.blocked) {
        stopEntitySpeech();
        void playLandClunk('shield');
        void playWinResult('fam-any');
        flashPayline('shield');
        setTripKill(s => resetTripKillStreak(s));
        setMessage(result.message);
        setPhase('block-result');
        setShieldBeat({
          kind: 'pass',
          title: 'SHIELD HELD',
          sub: `Three ${entity.label}s — the layer yields.`,
        });
        await sleep(1200);
        setShieldBeat(null);
        await goToNextLayer(forLevel);
        return;
      }

      stopEntitySpeech();
      void playLandClunk('soft');
      void playWinResult('none');
      setPhase('block-result');
      setShieldBeat({
        kind: 'fail',
        title: 'SHIELD BROKE',
        sub: info.loving ? 'The presence still offers paths…' : 'Four doors open. Choose carefully.',
      });
      await sleep(900);
      setShieldBeat(null);

      const doors = buildTrickChoices(forLevel, runSeed, doubleUsed);
      setChoices(doors);
      setPhase('trick-choices');
      setMessage(
        info.loving
          ? 'The presence offers paths…'
          : 'Shield failed — choose a path.',
      );
      // Short fail line only — do not re-read the full attack monologue.
      if (spokeAttackForLevel.current === forLevel) {
        speakEntityLine(info.failLine, entity.id);
      } else {
        speakEntityLine(`${info.attackLine} ${info.failLine}`, entity.id);
      }
      setBusy(false);
    },
    [
      runReelSpin,
      playWinResult,
      pushLog,
      runSeed,
      doubleUsed,
      goToNextLayer,
      speakEntityLine,
      stopEntitySpeech,
      playLandClunk,
    ],
  );

  const doPlayerSpin = async () => {
    if (busy || spinning || phase !== 'player-spin') return;
    setBusy(true);
    setPhase('spinning');
    const forLevel = level;
    const result = await runReelSpin(() => {
      const r = spinPlayerReels(forLevel);
      return { reels: r.reels, message: r.message, aliceCoins: r.aliceCoins };
    }, 'prize');
    if (result.aliceCoins) {
      setAliceCoins(c => c + result.aliceCoins!);
      flashCoins(`+${result.aliceCoins.toLocaleString()} AC`, 'gain');
      pushLog(`+${result.aliceCoins.toLocaleString()} Alice Coins — ${result.message}`);
      void playLandClunk(result.aliceCoins >= 3500 ? 'prize' : 'prize');
      void playWinResult(aliceWinTier(result.aliceCoins));
      flashPayline(result.aliceCoins >= 3500 ? 'big' : 'prize');
    } else {
      void playLandClunk('soft');
      void playWinResult('none');
    }
    // Pause for the fun part: player must pull again for the shield spin.
    setPhase('player-result');
    setMessage(result.message);
    await sleep(700);
    const info = getLevelInfo(forLevel);
    const entity = getEntityForLevel(forLevel);
    setPhase('elf-attack');
    setMessage(`Pull the lever for shield — land 3× ${entity.label}.`);
    pushLog(`── ${info.name} ── Pull again to shield (3× ${entity.label}).`);
    spokeAttackForLevel.current = forLevel;
    speakEntityLine(info.attackLine, entity.id);
    setBusy(false);
  };

  /** Second intentional lever pull: shield defense reels. */
  const doShieldSpin = async () => {
    if (busy || spinning || phase !== 'elf-attack') return;
    setBusy(true);
    await runDefenseSpin(level);
  };

  const onPickTrick = (choice: TrickChoice) => {
    if (phase !== 'trick-choices' || busy) return;
    setBusy(true);
    stopEntitySpeech();

    const { state: nextKill, result: killResult } = evaluateTripKill(tripKill, choice);
    setTripKill(nextKill);

    if (killResult.kill) {
      setAliceCoins(0);
      setChoices([]);
      setPhase('defeat');
      setMessage(killResult.message);
      pushLog(killResult.message);
      markVoyageEnd({ aliceCoins: 0, layersCleared: Math.max(0, level - 1) });
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
      flashCoins(`×2 +${applied.gained.toLocaleString()} AC`, 'double');
      pushLog(`DOUBLE — +${applied.gained.toLocaleString()} Alice Coins. (${choice.label})`);
      void playWinResult('jackpot');
    } else if (applied.lost > 0) {
      flashCoins(`−${applied.lost.toLocaleString()} AC`, 'loss');
      pushLog(`“${choice.label}” — lost ${applied.lost.toLocaleString()} (${choice.tier}).`);
      void playWinResult('none');
    } else {
      flashCoins('SAFE · coins held', 'safe');
      pushLog(`“${choice.label}” — safe. Coins untouched.`);
      void playWinResult('bonk-single');
    }
    setMessage(`${choice.label}: ${applied.flavor}`);
    setChoices([]);
    setPhase('block-result');
    // Auto-descend — no "next level" button.
    void (async () => {
      await sleep(900);
      await goToNextLayer(level, applied.nextCoins);
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
      const earned = data.spendable ?? 0;
      setSpendableEarned(earned);
      setClaimMsg(data.message ?? 'Banked.');
      setSessionToken(null);
      setLocalStats(
        noteAliceBanked({
          aliceCoins,
          spendable: earned,
        }),
      );
    } catch {
      setClaimMsg('Network error banking tally.');
    }
    setBusy(false);
  };

  const canPullPrize = phase === 'player-spin' && !busy && !spinning;
  const canPullShield = phase === 'elf-attack' && !busy && !spinning;
  const canPullPlayer = canPullPrize || canPullShield;
  const statusLed =
    spinning || phase === 'spinning' || phase === 'block-spinning'
      ? 'SPINNING'
      : phase === 'elf-attack'
        ? 'SHIELD'
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
      className={[
        'alice-room',
        'alice-machine-scene',
        meltClass,
        inPlay ? 'alice-room-playing' : '',
        canPullPlayer ? 'alice-room-pull-ready' : '',
        canPullPrize ? 'alice-room-prize-ready' : '',
        canPullShield ? 'alice-room-shield-ready' : '',
      ]
        .filter(Boolean)
        .join(' ')}
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
                aria-label={muted ? 'Unmute all music and sound' : 'Mute all music and sound'}
                title={`${ambienceCredit} · Music only — use bottom-right for Music / SFX`}
              >
                {muted ? '🎵 Music Off' : '🎵 Music On'}
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
            {localStats && (localStats.bestAliceCoins > 0 || localStats.runsCompleted > 0) && (
              <div className="alice-stats-card" aria-label="Your Alice record on this device">
                <p className="alice-stats-title">Your record (this device)</p>
                <div className="alice-stats-grid">
                  <div>
                    <span className="alice-stats-label">Best Alice Coins</span>
                    <span className="alice-stats-value">{localStats.bestAliceCoins.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="alice-stats-label">Best banked chips</span>
                    <span className="alice-stats-value">{localStats.bestSpendable.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="alice-stats-label">Deepest layer</span>
                    <span className="alice-stats-value">
                      {localStats.bestLayers}/{TOTAL_LEVELS}
                    </span>
                  </div>
                  <div>
                    <span className="alice-stats-label">Last banked</span>
                    <span className="alice-stats-value">
                      {localStats.lastBankedSpendable > 0
                        ? `+${localStats.lastBankedSpendable.toLocaleString()} chips`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {showCoach && (
              <div className="alice-coach" role="region" aria-label="How to play">
                <div className="alice-coach-head">
                  <h3 className="alice-coach-title">Quick start</h3>
                  <button type="button" className="alice-coach-dismiss" onClick={onDismissCoach}>
                    Got it
                  </button>
                </div>
                <ol className="alice-coach-list">
                  {ALICE_COACH_TIPS.map((tip, i) => (
                    <li key={tip.id} className="alice-coach-tip">
                      <span className="alice-coach-num" aria-hidden>
                        {i + 1}
                      </span>
                      <span>
                        <strong>{tip.title}</strong>
                        <span className="alice-coach-body">{tip.body}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <ol className="alice-rules">
              <li>
                <strong>10 layers</strong> — Machine Elves → Jesters → Mantis → Greys → Light → Goddess →
                Fractal → Serpent → Ancestors → <strong>The Other</strong> (boss).
              </li>
              <li>
                Each layer: <strong>pull for Alice Coins</strong>, then <strong>pull again for shield</strong>.
              </li>
              <li>
                <strong>Shield pull</strong> — need <strong>three of that level’s entity</strong> or choose a
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
                After the boss, bank the final tally (capped spendable chips). Only the server ledger can cash out.
              </li>
            </ol>
            <button
              type="button"
              className="alice-btn alice-btn-primary"
              disabled={busy}
              onClick={() => {
                if (showCoach) onDismissCoach();
                void startDive();
              }}
            >
              {busy ? 'Opening…' : `${BRAND.aliceRoomNav} — Begin`}
            </button>
          </section>
        )}

        {phase !== 'intro' && (
          <div className="alice-stage-layout alice-stage-solo">
            {/* Status strip — collapses when lever is pull-ready so the arm owns the screen */}
            <div
              className={`alice-trip-strip ${canPullPlayer ? 'alice-trip-strip-compact' : ''}`}
              aria-label="Trip status"
            >
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
                    {canPullPrize ? ' · PULL' : ''}
                    {canPullShield ? ' · SHIELD' : ''}
                  </span>
                  <span className="alice-trip-strip-name">{defenseEntity.label}</span>
                  <span className="alice-trip-strip-need">
                    {canPullShield
                      ? `Pull lever — 3× ${defenseEntity.label}`
                      : canPullPrize
                        ? 'Pull lever for Alice Coins'
                        : 'Shield: 3× this being'}
                  </span>
                </div>
              </div>
              <div className="alice-trip-strip-stats">
                <span className="alice-trip-strip-coins">
                  {aliceCoins.toLocaleString()} <small>AC</small>
                  {coinFlash && (
                    <span
                      key={coinFlash.id}
                      className={`alice-coin-flash alice-coin-flash-${coinFlash.kind}`}
                      aria-live="polite"
                    >
                      {coinFlash.text}
                    </span>
                  )}
                </span>
                <span className="alice-trip-strip-spend">
                  ~{projectedSpendable} chips
                </span>
              </div>
            </div>
            <div
              className="alice-progress"
              role="progressbar"
              aria-valuenow={phase === 'victory' ? TOTAL_LEVELS : level}
              aria-valuemin={1}
              aria-valuemax={TOTAL_LEVELS}
              aria-label={`Layer ${level} of ${TOTAL_LEVELS}`}
            >
              <div className="alice-progress-track">
                <div className="alice-progress-fill" style={{ width: `${progressFill}%` }} />
              </div>
              <span className="alice-progress-label">
                Layer {phase === 'victory' ? TOTAL_LEVELS : level}/{TOTAL_LEVELS}
                {levelInfo.isBoss && phase !== 'victory' ? ' · Boss' : ''}
              </span>
            </div>

            <div
              className={`slot-stage alice-slot-stage ${phase === 'trick-choices' ? 'alice-slot-stage-encounter' : ''}`}
            >
              {/* 3D floor stage: machine stands on a ground plane */}
              <div className="alice-machine-floor" aria-hidden>
                <div className="alice-machine-floor-grid" />
                <div className="alice-machine-floor-shadow" />
              </div>

              <div
                className={[
                  'slot-cabinet',
                  'alice-cabinet',
                  'alice-cabinet-3d',
                  spinning ? 'slot-cabinet-active' : '',
                  leverPulled ? 'slot-cabinet-pull' : '',
                  canPullPrize ? 'alice-cabinet-ready alice-cabinet-prize-ready' : '',
                  canPullShield ? 'alice-cabinet-ready alice-cabinet-shield-ready' : '',
                  cabinetBump ? 'alice-cabinet-bump' : '',
                  spinMode === 'shield' && (spinning || leverPulled) ? 'alice-cabinet-shield-spin' : '',
                  spinMode === 'prize' && (spinning || leverPulled) ? 'alice-cabinet-prize-spin' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                hidden={phase === 'trick-choices'}
                aria-hidden={phase === 'trick-choices'}
              >
                <div className="alice-cabinet-side alice-cabinet-side-left" aria-hidden />
                <div className="alice-cabinet-side alice-cabinet-side-right" aria-hidden />
                <div className="alice-cabinet-top-cap" aria-hidden />

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
                  <div
                    className={`slot-led-panel slot-led-panel-center ${canPullShield || phase === 'block-spinning' ? 'alice-led-shield' : ''} ${canPullPrize || phase === 'spinning' ? 'alice-led-prize' : ''}`}
                  >
                    <span className="slot-led-label">
                      {canPullShield || phase === 'block-spinning' || phase === 'block-result'
                        ? 'Shield'
                        : 'Status'}
                    </span>
                    <span className="slot-led-value slot-led-status">{statusLed}</span>
                  </div>
                  <div className="slot-led-panel">
                    <span className="slot-led-label">Layer</span>
                    <span className="slot-led-value">
                      {level}/{TOTAL_LEVELS}
                    </span>
                  </div>
                </div>

                <div className="slot-cabinet-face alice-cabinet-face">
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
                          className={`slot-reels ${justLanded ? 'slot-reels-landed' : ''} ${spinning ? 'slot-reels-spinning' : ''} ${paylineFx ? `alice-reels-celebrate alice-reels-celebrate-${paylineFx}` : ''}`}
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
                        <div
                          className={`slot-payline-overlay ${paylineFx ? `alice-payline-fx alice-payline-fx-${paylineFx}` : ''} ${canPullShield ? 'alice-payline-shield-idle' : ''} ${canPullPrize ? 'alice-payline-prize-idle' : ''}`}
                          aria-hidden
                        >
                          <span className="slot-payline-arrow slot-payline-arrow-l">◀</span>
                          <span className="slot-payline-bar" />
                          <span className="slot-payline-arrow slot-payline-arrow-r">▶</span>
                        </div>
                      </div>
                      <div
                        className={`slot-reel-bezel-label ${
                          phase === 'elf-attack' ||
                          phase === 'block-spinning' ||
                          phase === 'block-result' ||
                          spinMode === 'shield'
                            ? 'alice-bezel-shield'
                            : 'alice-bezel-prize'
                        }`}
                      >
                        {phase === 'elf-attack' ||
                        phase === 'block-spinning' ||
                        phase === 'block-result'
                          ? `SHIELD — 3× ${defenseEntity.label.toUpperCase()}`
                          : canPullPrize
                            ? 'PRIZE LINE — PULL'
                            : 'WIN LINE'}
                      </div>
                    </div>
                  </div>

                  {/* Lever IS the control — no separate PULL button */}
                  <div className="slot-lever-column alice-lever-column">
                    <button
                      type="button"
                      className={`alice-lever-hit ${!canPullPlayer ? 'alice-lever-hit-disabled' : ''} ${leverPulled ? 'alice-lever-hit-pulled' : ''} ${canPullShield ? 'alice-lever-hit-shield' : ''} ${canPullPrize ? 'alice-lever-hit-prize' : ''}`}
                      disabled={!canPullPlayer}
                      onClick={() => {
                        if (canPullPrize) void doPlayerSpin();
                        else if (canPullShield) void doShieldSpin();
                      }}
                      aria-label={
                        canPullShield
                          ? 'Pull the lever for the shield spin'
                          : canPullPrize
                            ? 'Pull the Alice Machine lever for Alice Coins'
                            : 'Lever locked'
                      }
                    >
                      <div className="slot-lever-housing">
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
                      <span className="alice-lever-hint" aria-hidden>
                        {canPullShield
                          ? '↓ SHIELD'
                          : canPullPrize
                            ? '↓ PULL'
                            : spinning || busy
                              ? '…'
                              : 'LOCKED'}
                      </span>
                    </button>
                  </div>
                </div>

                {message && <p className="casino-result alice-cabinet-msg">{message}</p>}

                {/* Pedestal / feet — reads as a standing floor machine */}
                <div className="alice-cabinet-pedestal" aria-hidden>
                  <div className="alice-cabinet-hopper">
                    <span className="alice-hopper-label">ALICE OUT</span>
                    <div className="alice-hopper-tray">
                      <span className="alice-coin-glint" />
                      <span className="alice-coin-glint" />
                      <span className="alice-coin-glint" />
                    </div>
                  </div>
                  <div className="alice-cabinet-feet">
                    <span className="alice-foot" />
                    <span className="alice-foot" />
                  </div>
                </div>
              </div>

              {shieldBeat && (
                <div
                  className={`alice-shield-beat alice-shield-beat-${shieldBeat.kind}`}
                  role="status"
                  aria-live="polite"
                >
                  <p className="alice-shield-beat-title">{shieldBeat.title}</p>
                  <p className="alice-shield-beat-sub">{shieldBeat.sub}</p>
                </div>
              )}

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
                      <p className="alice-doors-sticky-hint" role="note">
                        One door is kind. Labels mislead — read the whisper under each title.
                      </p>
                      {entitySpeaking && (
                        <button
                          type="button"
                          className="alice-speech-skip"
                          onClick={() => stopEntitySpeech()}
                        >
                          Skip voice
                        </button>
                      )}
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
                  <div className="alice-run-recap" aria-label="Run recap">
                    <p className="alice-run-recap-title">Run recap</p>
                    <ul className="alice-run-recap-list">
                      <li>
                        Layers cleared:{' '}
                        <strong>
                          {TOTAL_LEVELS}/{TOTAL_LEVELS}
                        </strong>
                      </li>
                      <li>
                        Final Alice Coins: <strong>{aliceCoins.toLocaleString()}</strong>
                      </li>
                      <li>
                        Spendable estimate:{' '}
                        <strong>
                          {aliceCoinsToSpendable(aliceCoins).toLocaleString()} Bonk Chips
                        </strong>
                      </li>
                      {localStats && localStats.bestAliceCoins > 0 && (
                        <li className="alice-run-recap-best">
                          Device best: {localStats.bestAliceCoins.toLocaleString()} AC
                          {localStats.bestSpendable > 0
                            ? ` · ${localStats.bestSpendable.toLocaleString()} chips banked`
                            : ''}
                          {aliceCoins >= localStats.bestAliceCoins ? ' · New high!' : ''}
                        </li>
                      )}
                    </ul>
                  </div>
                  <p className="alice-bank-trust">
                    Only chips the server records after you bank can cash out at the Cashier. Alice Coins
                    alone are dream-wealth.
                  </p>
                  {!connected && (
                    <p className="alice-warn">Connect wallet to bank spendable chips.</p>
                  )}
                  <div className="alice-actions">
                    <button
                      type="button"
                      className="alice-btn alice-btn-primary"
                      disabled={busy || !sessionToken || spendableEarned != null}
                      onClick={() => void bankFinalTally()}
                    >
                      {busy
                        ? 'Banking…'
                        : spendableEarned != null
                          ? 'Banked'
                          : 'Bank Final Tally'}
                    </button>
                    <Link href="/cashier" className="alice-btn alice-btn-ghost">
                      {BRAND.cashier}
                    </Link>
                    <button type="button" className="alice-btn alice-btn-ghost" onClick={() => void startDive()}>
                      Dive again
                    </button>
                  </div>
                  {claimMsg && <p className="alice-claim-msg">{claimMsg}</p>}
                  {spendableEarned != null && (
                    <div className="alice-bank-receipt" role="status">
                      <p className="alice-claim-ok">
                        {spendableEarned > 0
                          ? `+${spendableEarned.toLocaleString()} spendable Bonk Chips added to your ledger.`
                          : 'Banked — no spendable chips this run (tally too low or already claimed).'}
                      </p>
                      <p className="alice-bank-receipt-hint">
                        Open the Cashier to view balance and exchange. Server-ledger chips only.
                      </p>
                      <Link href="/cashier" className="alice-btn alice-btn-primary alice-bank-cashier-cta">
                        Go to {BRAND.cashier} →
                      </Link>
                    </div>
                  )}
                </section>
              )}

              {phase === 'defeat' && (
                <section className="alice-panel alice-victory">
                  <h2>Trip kill</h2>
                  <p className="alice-warn">{message}</p>
                  <p>Repeating the same strategy without presence ejects the voyage. No spendable tally.</p>
                  {localStats && localStats.bestLayers > 0 && (
                    <p className="alice-run-recap-best-solo">
                      Device deepest: layer {localStats.bestLayers}/{TOTAL_LEVELS}
                      {localStats.bestAliceCoins > 0
                        ? ` · best ${localStats.bestAliceCoins.toLocaleString()} AC`
                        : ''}
                    </p>
                  )}
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
