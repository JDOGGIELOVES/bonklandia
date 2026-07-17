'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useBonkBank } from '@/hooks/useBonkBank';
import type { PlayableCharacter } from '@/lib/characters';
import {
  SLOT_SYMBOL_POOL,
  buildReelStrip,
  evaluateSpin,
  spinReels,
  type CasinoSession,
  type SlotSymbol,
  type WinTier,
} from '@/lib/slot-machine';
import BongaChillLever from '@/components/BongaChillLever';
import PaidSpinButton from '@/components/PaidSpinButton';
import SlotPaytable from '@/components/SlotPaytable';
import { BONGACHILL_LORE } from '@/lib/lore';
import { BRAND } from '@/lib/brand';
import {
  CHIP_BET_OPTIONS,
  JACKPOT_LADDER_BIAS,
  JACKPOT_LADDER_PAYOUT_MULT,
  JACKPOT_LADDER_STEPS,
  getChipBetOption,
} from '@/lib/casino-extras';
import { fetchServerCasinoSession, type CasinoSecureSession } from '@/lib/casino-client';
import { useCasinoAudio } from '@/hooks/useCasinoAudio';
import {
  CASINO_AMBIENCE_CREDIT,
  CASINO_SPIN_DURATION_MS,
  CASINO_SPIN_START_DELAY_MS,
} from '@/lib/casino-audio';

const REEL_ITEM_HEIGHT = 160;
const REEL_SPIN_MS = CASINO_SPIN_DURATION_MS;
const PAW_PULL_MS = CASINO_SPIN_START_DELAY_MS;

function SlotSymbolCell({ symbol }: { symbol: SlotSymbol }) {
  if (symbol.kind === 'jackpot') {
    return (
      <div className="slot-symbol slot-symbol-jackpot">
        <span className="slot-jackpot-text">BONK</span>
        <span className="slot-jackpot-sub">JACKPOT</span>
      </div>
    );
  }

  return (
    <div className={`slot-symbol slot-symbol-${symbol.kind}`}>
      {symbol.image && (
        <div className="slot-symbol-frame">
          <Image
            src={symbol.image}
            alt={symbol.label}
            width={100}
            height={100}
            className="character-img slot-symbol-img object-contain"
            unoptimized
          />
        </div>
      )}
      <span className="slot-symbol-label">{symbol.label}</span>
    </div>
  );
}

function SlotReel({
  result,
  spinning,
  stopDelay,
  spinKey,
}: {
  result: SlotSymbol;
  spinning: boolean;
  stopDelay: number;
  spinKey: number;
}) {
  const strip = useMemo(
    () => buildReelStrip(result, SLOT_SYMBOL_POOL),
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
            <SlotSymbolCell key={`${spinKey}-${i}-${sym.id}`} symbol={sym} />
          ))}
        </div>
        <div className="slot-reel-glass" />
        <div className="slot-reel-shine" />
      </div>
    </div>
  );
}

type CasinoSlotProps = {
  session: CasinoSession;
  secureSession: CasinoSecureSession;
  fighter: PlayableCharacter;
  onExit: () => void;
  onRunItBack?: () => void;
  /** Depths / custom continue (e.g. next chamber) — shown when free spins are spent. */
  onContinue?: () => void;
  continueLabel?: string;
  exitLabel?: string;
  /** When true, empty free spins still invite quarters (Depths room gate). */
  quarterFirst?: boolean;
};

export default function CasinoSlot({
  session,
  secureSession,
  fighter,
  onExit,
  onRunItBack,
  onContinue,
  continueLabel = 'Continue',
  exitLabel = 'Back to Gallery',
  quarterFirst = false,
}: CasinoSlotProps) {
  const { tier, paytableWave, spins: grantedSpins, outcome, chipMultiplier } = session;
  const isVictory = outcome === 'victory';
  const { connected, publicKey } = useWallet();

  const [spinsLeft, setSpinsLeft] = useState(grantedSpins);
  const [spinning, setSpinning] = useState(false);
  const [leverPulled, setLeverPulled] = useState(false);
  const [spinKey, setSpinKey] = useState(0);
  const [results, setResults] = useState<[SlotSymbol, SlotSymbol, SlotSymbol] | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [lastWinTier, setLastWinTier] = useState<WinTier | null>(null);
  const [totalWinnings, setTotalWinnings] = useState(0);
  const [jackpotFlash, setJackpotFlash] = useState(false);
  const [justLanded, setJustLanded] = useState(false);
  const [pawReady, setPawReady] = useState(false);
  const settledWinningsRef = useRef(0);
  const localCreditedRef = useRef(0);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [selectedBetChips, setSelectedBetChips] = useState(0);
  const [ladderSteps, setLadderSteps] = useState(0);
  const [activeSecure, setActiveSecure] = useState<CasinoSecureSession>(secureSession);
  const [vaultLinkStatus, setVaultLinkStatus] = useState<'local' | 'linking' | 'live'>(
    secureSession.localOnly ? 'local' : 'live',
  );
  const { spendChips, addChips, chips: bankChips } = useBonkBank();
  const {
    muted,
    audioReady,
    unlockAudio,
    toggleMute,
    playLeverPull,
    playSpinSequence,
    playWinResult,
  } = useCasinoAudio();

  const idleReels = useMemo(() => spinReels(tier.jackpotBias), [tier.jackpotBias]);
  const displayReels = results ?? idleReels;

  useEffect(() => {
    setActiveSecure(secureSession);
    setVaultLinkStatus(secureSession.localOnly ? 'local' : 'live');
  }, [secureSession]);

  // Upgrade local consolation session to a claimable server session when possible.
  useEffect(() => {
    if (!activeSecure.localOnly) return;
    let cancelled = false;
    setVaultLinkStatus('linking');
    void fetchServerCasinoSession(session).then(serverSecure => {
      if (cancelled || !serverSecure) {
        if (!cancelled) setVaultLinkStatus('local');
        return;
      }
      setActiveSecure(serverSecure);
      setVaultLinkStatus('live');
      try {
        sessionStorage.setItem(
          'bonk-casino-pending',
          JSON.stringify({ ...serverSecure, totalWinnings }),
        );
      } catch {
        // private mode
      }
    });
    return () => {
      cancelled = true;
    };
    // Only on mount / session identity — avoid re-link loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.outcome, session.paytableWave, session.difficulty, session.chipMultiplier]);

  useEffect(() => {
    const t = setTimeout(() => setPawReady(true), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (totalWinnings <= 0) return;

    const settle = async () => {
      // Always credit local bank so chip bets / offline play work.
      const localDelta = totalWinnings - localCreditedRef.current;
      if (localDelta > 0) {
        addChips(localDelta);
        localCreditedRef.current = totalWinnings;
      }

      if (activeSecure.localOnly) {
        setSettleError(null);
        try {
          sessionStorage.setItem(
            'bonk-casino-pending',
            JSON.stringify({ ...activeSecure, totalWinnings, localOnly: true }),
          );
        } catch {
          // private mode
        }
        return;
      }

      if (totalWinnings <= settledWinningsRef.current) return;

      try {
        const res = await fetch('/api/casino/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSecure.sessionId,
            settleToken: activeSecure.settleToken,
            totalWinnings,
          }),
        });
        const data = await res.json() as { error?: string; settleToken?: string };
        if (!res.ok) {
          setSettleError(data.error ?? 'Could not verify casino winnings for claim.');
          return;
        }
        settledWinningsRef.current = totalWinnings;
        setSettleError(null);
        const nextSecure = data.settleToken
          ? { ...activeSecure, settleToken: data.settleToken }
          : activeSecure;
        if (data.settleToken) setActiveSecure(nextSecure);
        sessionStorage.setItem(
          'bonk-casino-pending',
          JSON.stringify({
            ...nextSecure,
            totalWinnings,
          }),
        );
      } catch {
        setSettleError('Server settlement failed — winnings not yet claimable at cashier.');
      }
    };

    void settle();
  }, [totalWinnings, activeSecure, addChips]);

  const ladderPrimed = ladderSteps >= JACKPOT_LADDER_STEPS;
  const selectedBet = getChipBetOption(selectedBetChips);

  const grantPaidSpin = useCallback((update?: { settleToken?: string; maxWinnings?: number }) => {
    if (update?.settleToken) {
      setActiveSecure(prev => {
        const next = {
          ...prev,
          settleToken: update.settleToken!,
          maxWinnings: update.maxWinnings ?? prev.maxWinnings,
          localOnly: false,
        };
        try {
          sessionStorage.setItem(
            'bonk-casino-pending',
            JSON.stringify({ ...next, totalWinnings }),
          );
        } catch {
          // private mode
        }
        return next;
      });
    }
    setSpinsLeft(s => s + 1);
    setLastMessage('Quarter Slot Machine — 1 spin unlocked. Yank the lever!');
  }, [totalWinnings]);

  const pullLever = useCallback(() => {
    if (spinning || spinsLeft <= 0) return;

    const betOption = getChipBetOption(selectedBetChips);
    if (betOption.chips > 0) {
      const spent = spendChips(betOption.chips);
      if (!spent.ok) {
        setLastMessage(`Need ${betOption.chips.toLocaleString()} chips for this bet — you have ${bankChips.toLocaleString()}.`);
        return;
      }
    }

    const isPrimed = ladderSteps >= JACKPOT_LADDER_STEPS;
    const reelBias = isPrimed ? JACKPOT_LADDER_BIAS : tier.jackpotBias;
    const payoutMultiplier =
      chipMultiplier * betOption.multiplier * (isPrimed ? JACKPOT_LADDER_PAYOUT_MULT : 1);

    const nextResults = spinReels(reelBias);
    const outcomeResult = evaluateSpin(nextResults, paytableWave, payoutMultiplier);

    void playLeverPull();
    void playSpinSequence();

    setLeverPulled(true);
    setLastMessage(null);
    setLastWinTier(null);
    setJackpotFlash(false);
    setJustLanded(false);
    setSpinsLeft(s => s - 1);
    setLadderSteps(isPrimed ? 1 : s => Math.min(JACKPOT_LADDER_STEPS, s + 1));

    setTimeout(() => {
      setSpinning(true);
      setResults(nextResults);
      setSpinKey(k => k + 1);
    }, PAW_PULL_MS);

    setTimeout(() => setLeverPulled(false), 900);

    const totalSpinTime = PAW_PULL_MS + REEL_SPIN_MS + 900;
    setTimeout(() => {
      setSpinning(false);
      setJustLanded(true);
      let message = outcomeResult.message;
      if (isPrimed && outcomeResult.payout > 0) {
        message = `🔥 Ladder primed! ${message}`;
      } else if (betOption.chips > 0 && outcomeResult.payout > 0) {
        message = `${betOption.label} — ${message}`;
      }
      setLastMessage(message);
      setLastWinTier(outcomeResult.winTier);
      if (outcomeResult.payout > 0) setTotalWinnings(w => w + outcomeResult.payout);
      if (outcomeResult.isJackpot) setJackpotFlash(true);
      void playWinResult(outcomeResult.winTier);
      setTimeout(() => setJustLanded(false), 1000);
    }, totalSpinTime);
  }, [
    spinning,
    spinsLeft,
    selectedBetChips,
    spendChips,
    bankChips,
    ladderSteps,
    tier.jackpotBias,
    paytableWave,
    chipMultiplier,
    playLeverPull,
    playSpinSequence,
    playWinResult,
  ]);

  const canPull = !spinning && spinsLeft > 0;

  return (
    <div className={`casino-scene casino-scene-enter ${isVictory ? 'casino-scene-victory' : ''} ${jackpotFlash ? 'casino-jackpot' : ''} ${spinning ? 'casino-spinning' : ''}`}>
      <div className="casino-scene-vignette" />
      <div className="casino-ambient">
        <div className="casino-bokeh casino-bokeh-1" />
        <div className="casino-bokeh casino-bokeh-2" />
        <div className="casino-bokeh casino-bokeh-3" />
      </div>
      <div className="casino-floor" />
      <div className="casino-chandelier-glow" />
      <div className="casino-lights casino-lights-left" />
      <div className="casino-lights casino-lights-right" />
      <div className="casino-neon-strip casino-neon-strip-top" />
      <div className="casino-neon-strip casino-neon-strip-bottom" />

      <div className="casino-content">
        <header className="casino-header">
          <div className="casino-top-bar">
            <div className="casino-audio-bar">
              <button
                type="button"
                className="casino-audio-btn"
                onClick={() => void toggleMute()}
                aria-label={muted ? 'Unmute casino audio' : 'Mute casino audio'}
                title={CASINO_AMBIENCE_CREDIT}
              >
                {muted ? '🔇 Sound Off' : '🔊 Lobby Lounge'}
              </button>
              {!audioReady && (
                <button
                  type="button"
                  className="casino-audio-unlock"
                  onClick={() => void unlockAudio()}
                >
                  Tap to enable sound
                </button>
              )}
            </div>
            <div className="casino-wallet-bar">
              <div className="casino-wallet-connect">
                <WalletMultiButton />
              </div>
              <p className="casino-wallet-status">
                {connected && publicKey
                  ? `Connected · ${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
                  : 'Connect wallet for Quarter Slots & claims'}
              </p>
              <p className={`casino-vault-status casino-vault-status-${vaultLinkStatus}`}>
                {vaultLinkStatus === 'live'
                  ? 'Vault live — wins claimable at cashier'
                  : vaultLinkStatus === 'linking'
                    ? 'Linking vault for claims…'
                    : 'Local reels — wins go to bank; vault links when available'}
              </p>
            </div>
          </div>
          {isVictory ? (
            <p className="casino-eyebrow casino-eyebrow-victory">Victory Spins — {fighter.name} cleared the valley</p>
          ) : (
            <p className="casino-eyebrow">Consolation — {fighter.name} bonked out on wave {paytableWave}</p>
          )}
          <h1 className="casino-title">{tier.name}</h1>
          <p className="casino-tagline">{tier.tagline}</p>
          {isVictory && (
            <p className="casino-victory-bonus">
              {grantedSpins} spins · Wave {paytableWave} paytable · +{Math.round((chipMultiplier - 1) * 100)}% chip bonus
            </p>
          )}
        </header>

        <div className="slot-stage-layout">
          <div className="casino-side-column">
            <SlotPaytable
              wave={paytableWave}
              chipMultiplier={chipMultiplier}
              outcome={outcome}
              lastWinTier={lastWinTier}
              totalWinnings={totalWinnings}
            />

            <div className="casino-chip-bet-panel">
              <div className="casino-chip-bet-header">
                <span className="casino-chip-bet-title">Chip Bet</span>
                <span className="casino-chip-bet-bank">{bankChips.toLocaleString()} in bank</span>
              </div>
              <p className="casino-chip-bet-hint">Optional wager per pull — multiplies line payouts</p>
              <div className="casino-chip-bet-options">
                {CHIP_BET_OPTIONS.map(option => (
                  <button
                    key={option.chips}
                    type="button"
                    className={`casino-chip-bet-btn ${selectedBetChips === option.chips ? 'casino-chip-bet-btn-active' : ''}`}
                    onClick={() => setSelectedBetChips(option.chips)}
                    disabled={spinning || (option.chips > 0 && bankChips < option.chips)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {selectedBet.chips > 0 && (
                <p className="casino-chip-bet-active">
                  Active: {selectedBet.chips.toLocaleString()} chips · {selectedBet.multiplier}× payouts
                </p>
              )}
            </div>

            <div className={`jackpot-ladder-panel ${ladderPrimed ? 'jackpot-ladder-primed' : ''}`}>
              <div className="jackpot-ladder-header">
                <span className="jackpot-ladder-title">Jackpot Ladder</span>
                <span className="jackpot-ladder-status">
                  {ladderPrimed ? 'PRIMED — 2× next pull!' : `${ladderSteps}/${JACKPOT_LADDER_STEPS}`}
                </span>
              </div>
              <div className="jackpot-ladder-steps">
                {Array.from({ length: JACKPOT_LADDER_STEPS }, (_, i) => (
                  <div
                    key={i}
                    className={`jackpot-ladder-step ${i < ladderSteps ? 'jackpot-ladder-step-filled' : ''} ${ladderPrimed && i === JACKPOT_LADDER_STEPS - 1 ? 'jackpot-ladder-step-glow' : ''}`}
                  />
                ))}
              </div>
              <p className="jackpot-ladder-hint">
                {ladderPrimed
                  ? 'Next spin uses boosted jackpot odds and double payouts.'
                  : 'Each pull fills a rung — full ladder primes the next spin.'}
              </p>
            </div>

            <PaidSpinButton
              disabled={spinning}
              sessionId={activeSecure.sessionId}
              settleToken={activeSecure.settleToken}
              onSpinGranted={grantPaidSpin}
            />
          </div>

          <div className="slot-stage">
          <div className={`slot-cabinet ${spinning ? 'slot-cabinet-active' : ''} ${leverPulled ? 'slot-cabinet-pull' : ''}`}>
            <div className="slot-cabinet-rivet slot-cabinet-rivet-tl" aria-hidden />
            <div className="slot-cabinet-rivet slot-cabinet-rivet-tr" aria-hidden />
            <div className="slot-cabinet-rivet slot-cabinet-rivet-bl" aria-hidden />
            <div className="slot-cabinet-rivet slot-cabinet-rivet-br" aria-hidden />
            <div className="slot-cabinet-trim slot-cabinet-trim-top" aria-hidden />
            <div className="slot-cabinet-trim slot-cabinet-trim-mid" aria-hidden />

            <div className="slot-marquee-hood">
              <div className="slot-marquee-lens">
                <div className="slot-marquee-backlight" />
                <h2 className="slot-marquee-title">{BRAND.slotMachine}</h2>
                {isVictory && (
                  <p className="slot-marquee-sub">Victory Edition · Champion Payouts</p>
                )}
              </div>
            </div>

            <div className="slot-display-bar">
              <div className="slot-led-panel">
                <span className="slot-led-label">Credits</span>
                <span className="slot-led-value">{totalWinnings.toLocaleString()}</span>
              </div>
              <div className="slot-led-panel slot-led-panel-center">
                <span className="slot-led-label">Status</span>
                <span className="slot-led-value slot-led-status">
                  {spinning
                    ? 'SPINNING'
                    : spinsLeft > 0
                      ? 'INSERT BONK'
                      : quarterFirst || grantedSpins === 0
                        ? 'INSERT QUARTER'
                        : 'GAME OVER'}
                </span>
              </div>
              <div className="slot-led-panel">
                <span className="slot-led-label">Spins</span>
                <span className="slot-led-value">{spinsLeft}</span>
              </div>
            </div>

            <div className="slot-cabinet-face">
              <div className="slot-reels-panel">
                <div className="slot-reels-panel-header">
                  <span className="slot-panel-badge">{isVictory ? 'VICTORY' : `WAVE ${paytableWave}`}</span>
                  <span className="slot-panel-model">Model 69-BONK</span>
                </div>
                <div className="slot-reel-bezel">
                  <div className="slot-reel-case">
                    <div
                      className={`slot-reels ${justLanded ? 'slot-reels-landed' : ''} ${spinning ? 'slot-reels-spinning' : ''}`}
                    >
                      <SlotReel
                        result={displayReels[0]}
                        spinning={spinning}
                        stopDelay={0}
                        spinKey={spinKey}
                      />
                      <div className="slot-reel-divider" aria-hidden />
                      <SlotReel
                        result={displayReels[1]}
                        spinning={spinning}
                        stopDelay={400}
                        spinKey={spinKey + 1}
                      />
                      <div className="slot-reel-divider" aria-hidden />
                      <SlotReel
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
                  <div className="slot-reel-bezel-label">WIN LINE</div>
                </div>
              </div>

              <div className="slot-lever-column">
                <div className="slot-lever-housing" aria-hidden>
                  {/*
                    One-armed bandit: fixed side socket is the hinge.
                    Stick + red ball form a rigid arm that swings down when pulled.
                  */}
                  <div className={`slot-lever-assembly ${leverPulled ? 'slot-lever-pulled' : ''}`}>
                    <div className="slot-lever-arm">
                      <div className="slot-lever-ball">
                        <span className="slot-lever-ball-shine" />
                      </div>
                      <div className="slot-lever-stick">
                        <span className="slot-lever-stick-ridge" />
                      </div>
                    </div>
                    <div className="slot-lever-socket">
                      <span className="slot-lever-socket-bolt" />
                    </div>
                  </div>
                </div>
                <div className={`slot-bonga-wrap ${pawReady ? 'slot-bonga-ready' : ''}`}>
                  <BongaChillLever
                    pulling={leverPulled}
                    disabled={!canPull}
                    onPull={pullLever}
                  />
                </div>
              </div>
            </div>

            <div className="slot-cabinet-base">
              <div className="slot-coin-slot" aria-hidden>
                <span className="slot-coin-slot-label">BONK IN</span>
              </div>
              <div className="slot-hopper-tray">
                <div className="slot-hopper-lip" />
                <div className="slot-coin-tray">
                  <span className="slot-coin" />
                  <span className="slot-coin" />
                  <span className="slot-coin" />
                  <span className="slot-coin" />
                </div>
              </div>
              <div className="slot-spins">
                {spinsLeft > 0 ? (
                  <span>{spinsLeft} pull{spinsLeft !== 1 ? 's' : ''} remaining — yank the lever</span>
                ) : quarterFirst || grantedSpins === 0 ? (
                  <span>No free pulls — buy a 25¢ quarter spin to yank the {BRAND.slotMachine}</span>
                ) : (
                  <span>Payout complete — keep spinning quarters or cash out at the {BRAND.cashier}</span>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>

        {settleError && (
          <p className="casino-result casino-settle-error">{settleError}</p>
        )}

        {lastMessage && (
          <p className={`casino-result ${jackpotFlash ? 'casino-result-jackpot' : ''}`}>{lastMessage}</p>
        )}

        {totalWinnings > 0 && !settleError && (
          <p className="casino-secure-note">
            {totalWinnings.toLocaleString()} chips in your bank
            {activeSecure.localOnly
              ? ' (local) — vault link enables cashier claim.'
              : ` · vault-verified (max ${activeSecure.maxWinnings.toLocaleString()}) — claim at ${BRAND.cashier} with your wallet.`}
          </p>
        )}

        <div className="casino-lore">
          <p className="casino-lore-epithet">{BONGACHILL_LORE.epithet}</p>
          <p className="casino-lore-text">{BONGACHILL_LORE.backstory}</p>
          <p className="casino-lore-quote">{BONGACHILL_LORE.legend}</p>
        </div>

        {canPull && !lastMessage && (
          <p className="casino-prompt">Bonga Chill reaches in — tap her to yank the lever</p>
        )}

        {!spinning && spinsLeft <= 0 && (
          <div className="casino-exit-actions">
            {(quarterFirst || grantedSpins === 0) && (
              <p className="casino-chips-summary casino-quarter-cta">
                Feed the treasury: buy a <strong>25¢ quarter spin</strong>, pull the lever, then keep going if you want —
                or continue when you&apos;re ready.
              </p>
            )}
            <div className="casino-paid-spin-exit">
              <PaidSpinButton
                disabled={spinning}
                sessionId={activeSecure.sessionId}
                settleToken={activeSecure.settleToken}
                onSpinGranted={grantPaidSpin}
              />
            </div>
            <p className="casino-chips-summary">
              You won <strong>{totalWinnings.toLocaleString()}</strong> Bonk Chips — cash them in at the {BRAND.cashier}.
            </p>
            <div className="casino-exit-buttons">
              {onContinue && (
                <button
                  type="button"
                  onClick={onContinue}
                  className="art-btn casino-exit-btn casino-runitback-btn"
                >
                  {continueLabel}
                </button>
              )}
              <Link href="/cashier" className="art-btn casino-exit-btn casino-cashier-btn">
                {BRAND.cashier} →
              </Link>
              {isVictory && onRunItBack && (
                <button type="button" onClick={onRunItBack} className="art-btn casino-exit-btn casino-runitback-btn">
                  Run It Back
                </button>
              )}
              <button type="button" onClick={onExit} className="art-btn casino-exit-btn">
                {exitLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}