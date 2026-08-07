'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useBonkBank } from '@/hooks/useBonkBank';
import { useSpendableChips } from '@/hooks/useSpendableChips';
import { useFamTokenBalances } from '@/hooks/useFamTokenBalances';
import { formatWalletAddress } from '@/lib/bank';
import { loadChipLedgerToken, saveChipLedgerToken } from '@/lib/chip-ledger-client';
import {
  FAM_TOKENS,
  calculateChipCost,
  formatMintAddress,
  solscanTokenUrl,
  solscanTxUrl,
  walletCanReceiveToken,
  type FamCoinId,
} from '@/lib/fam-tokens';
import type { TreasurySnapshot } from '@/components/CashierSecurityPanel';
import { BRAND } from '@/lib/brand';

type CashierPanelProps = {
  showBackLink?: boolean;
};

/** Map API/server errors into short, actionable cashier language. */
function humanizeCashierError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('daily') && (s.includes('limit') || s.includes('reached') || s.includes('left'))) {
    return `${raw} Daily caps reset at midnight UTC. Try a smaller amount or come back tomorrow.`;
  }
  if (s.includes('minimum') || s.includes('min ')) {
    return raw;
  }
  if (s.includes('insufficient') || s.includes('not enough') || s.includes('need ')) {
    return `${raw} Earn more with your wallet connected in Depths, Bandit, or Alice, then refresh.`;
  }
  if (s.includes('offline') || s.includes('emergency') || s.includes('treasury')) {
    return `${raw} Payouts are paused for safety — try again later.`;
  }
  if (s.includes('wallet') || s.includes('connect')) {
    return raw;
  }
  if (s.includes('rate') || s.includes('too many')) {
    return `${raw} Wait a minute and try once more.`;
  }
  if (s.includes('session') || s.includes('expired')) {
    return `${raw} Refresh the page and reconnect your wallet.`;
  }
  return raw;
}

export default function CashierPanel({ showBackLink = true }: CashierPanelProps) {
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const { chips: localDisplayChips, lifetimeChipsWon: localLifetimeWon } = useBonkBank();
  const {
    spendableChips,
    lifetimeWon: spendableLifetimeWon,
    lifetimeExchanged,
    ledgerToken,
    loading: spendableLoading,
    refresh: refreshSpendable,
  } = useSpendableChips();
  /** Only server-ledger chips can be cashed. */
  const chips = spendableChips;
  const lifetimeChipsWon = spendableLifetimeWon || localLifetimeWon;

  const {
    balances,
    loading: balancesLoading,
    error: balanceError,
    refresh: refreshBalances,
    hasAnyBalance,
    source: balanceSource,
  } = useFamTokenBalances();

  const [amounts, setAmounts] = useState<Record<FamCoinId, string>>({
    bonk: '1',
    bonga: '1',
    bong: '5',
    bink: '10',
    bonnie: '0.05',
    beng: '0.4',
  });
  const [exchanging, setExchanging] = useState<FamCoinId | null>(null);
  const [treasuryStatus, setTreasuryStatus] = useState<TreasurySnapshot | null>(null);
  const [treasuryLoading, setTreasuryLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; ok: boolean; txUrl?: string } | null>(null);
  const [walletQuota, setWalletQuota] = useState<{
    remainingUsd: number;
    usdMax: number;
    remainingChips: number;
    chipsMax: number;
    exchangesUsed: number;
    exchangesMax: number;
    maxUsdPerExchange: number;
  } | null>(null);

  const treasuryReady = treasuryStatus?.payoutsReady ?? null;
  const treasuryTokenMap = Object.fromEntries(
    (treasuryStatus?.tokens ?? []).map(t => [t.id, t]),
  ) as Record<string, TreasurySnapshot['tokens'][number]>;

  const refreshTreasury = useCallback(() => {
    setTreasuryLoading(true);
    fetch('/api/treasury')
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setTreasuryStatus(null);
          return;
        }
        setTreasuryStatus(data as TreasurySnapshot);
      })
      .catch(() => setTreasuryStatus(null))
      .finally(() => setTreasuryLoading(false));
  }, []);

  useEffect(() => {
    refreshTreasury();
  }, [refreshTreasury]);

  useEffect(() => {
    if (!walletAddress) {
      setWalletQuota(null);
      return;
    }
    fetch(`/api/exchange?wallet=${encodeURIComponent(walletAddress)}`)
      .then(r => r.json())
      .then(data => {
        if (data?.walletQuota) {
          setWalletQuota({
            remainingUsd: Number(data.walletQuota.remainingUsd) || 0,
            usdMax: Number(data.walletQuota.usdMax) || 0,
            remainingChips: Number(data.walletQuota.remainingChips) || 0,
            chipsMax: Number(data.walletQuota.chipsMax) || 0,
            exchangesUsed: Number(data.walletQuota.exchangesUsed) || 0,
            exchangesMax: Number(data.walletQuota.exchangesMax) || 0,
            maxUsdPerExchange: Number(data.walletQuota.maxUsdPerExchange) || 1,
          });
        } else {
          setWalletQuota(null);
        }
      })
      .catch(() => {
        setWalletQuota(null);
      });
  }, [walletAddress]);

  const showExchangeMessage = useCallback((msg: { text: string; ok: boolean; txUrl?: string }) => {
    setMessage({
      ...msg,
      text: msg.ok ? msg.text : humanizeCashierError(msg.text),
    });
    requestAnimationFrame(() => {
      document.getElementById('cashier-toast')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, []);

  const readinessLabel = !connected
    ? 'Connect wallet to see your balance'
    : spendableLoading
      ? 'Loading…'
      : treasuryReady === false
        ? 'Cashier is closed right now — try again later'
        : chips > 0
          ? 'Ready to cash out'
          : 'No chips yet — play to earn some';

  const setAmount = (id: FamCoinId, value: string) => {
    setAmounts(prev => ({ ...prev, [id]: value }));
  };

  const exchangeBlockReason = useCallback(
    (coinId: FamCoinId): string | null => {
      const token = FAM_TOKENS.find(t => t.id === coinId)!;
      const tokenAmount = parseFloat(amounts[coinId]);
      const chipCost = calculateChipCost(coinId, tokenAmount);

      if (!connected || !walletAddress) {
        return 'Connect Solflare or Phantom first.';
      }
      if (balancesLoading) {
        return 'Still reading your token accounts — wait a moment.';
      }
      if (treasuryReady === false) {
        return (
          treasuryStatus?.payoutsBlockedReason ??
          'Cashier payouts offline (treasury key / emergency stop).'
        );
      }
      if (!Number.isFinite(tokenAmount) || tokenAmount < token.minTokens) {
        return `Minimum is ${token.minTokens.toLocaleString()} ${token.symbol}.`;
      }
      if (spendableLoading) {
        return 'Loading spendable chip balance…';
      }
      if (chipCost <= 0 || chips < chipCost) {
        return `Need ${chipCost.toLocaleString()} spendable Bonk Chips (server balance: ${chips.toLocaleString()}). Earn chips in Depths/Bandit with this wallet connected — fake local chips cannot be cashed. Wallet ${token.symbol} is separate.`;
      }
      if (!walletCanReceiveToken(balances[coinId])) {
        return `No ${token.symbol} on this connected address (${formatMintAddress(token.mint)}). Hold ${token.symbol} on this same Solflare/Phantom account first.`;
      }
      const vault = treasuryTokenMap[coinId];
      if (vault && !vault.accountExists) {
        return `Treasury has no ${token.symbol} stocked yet.`;
      }
      return null;
    },
    [
      amounts,
      balances,
      balancesLoading,
      chips,
      connected,
      spendableLoading,
      treasuryReady,
      treasuryStatus,
      treasuryTokenMap,
      walletAddress,
    ],
  );

  const handleExchange = useCallback(
    async (coinId: FamCoinId) => {
      const token = FAM_TOKENS.find(t => t.id === coinId)!;
      const tokenAmount = parseFloat(amounts[coinId]);
      const chipCost = calculateChipCost(coinId, tokenAmount);
      const blocked = exchangeBlockReason(coinId);
      if (blocked) {
        showExchangeMessage({ ok: false, text: blocked });
        if (balancesLoading) void refreshBalances();
        return;
      }

      setExchanging(coinId);
      setMessage(null);

      try {
        const res = await fetch('/api/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coinId,
            tokenAmount,
            walletAddress,
            chipCost,
            ledgerToken: ledgerToken ?? (walletAddress ? loadChipLedgerToken(walletAddress) : null),
          }),
        });

        const rawText = await res.text();
        let data: {
          error?: string;
          chipsRemaining?: number;
          spendableChips?: number;
          ledgerToken?: string;
          tokenAmount?: number;
          symbol?: string;
          signature?: string;
        } = {};
        try {
          data = rawText ? (JSON.parse(rawText) as typeof data) : {};
        } catch {
          showExchangeMessage({
            ok: false,
            text: `Cashier error (${res.status}). ${rawText.slice(0, 160) || 'Empty response — try again.'}`,
          });
          return;
        }

        if (!res.ok) {
          showExchangeMessage({
            ok: false,
            text: data.error ?? `Exchange failed (${res.status}). Refresh and try a smaller amount.`,
          });
          void refreshBalances();
          void refreshSpendable();
          // Refresh quota after a blocked attempt (daily cap messages)
          if (walletAddress) {
            fetch(`/api/exchange?wallet=${encodeURIComponent(walletAddress)}`)
              .then(r => r.json())
              .then(d => {
                if (d?.walletQuota) {
                  setWalletQuota({
                    remainingUsd: Number(d.walletQuota.remainingUsd) || 0,
                    usdMax: Number(d.walletQuota.usdMax) || 0,
                    remainingChips: Number(d.walletQuota.remainingChips) || 0,
                    chipsMax: Number(d.walletQuota.chipsMax) || 0,
                    exchangesUsed: Number(d.walletQuota.exchangesUsed) || 0,
                    exchangesMax: Number(d.walletQuota.exchangesMax) || 0,
                    maxUsdPerExchange: Number(d.walletQuota.maxUsdPerExchange) || 1,
                  });
                }
              })
              .catch(() => {
                /* */
              });
          }
          return;
        }

        if (walletAddress && data.ledgerToken) {
          saveChipLedgerToken(
            walletAddress,
            data.ledgerToken,
            Math.max(0, Math.floor(Number(data.spendableChips ?? data.chipsRemaining) || 0)),
            { force: true },
          );
        }
        await refreshSpendable();
        showExchangeMessage({
          ok: true,
          text: `Sent ${Number(data.tokenAmount).toLocaleString()} ${data.symbol}. ${Math.max(0, Math.floor(Number(data.spendableChips ?? 0))).toLocaleString()} spendable Bonk Chips left.`,
          txUrl: data.signature ? solscanTxUrl(data.signature) : undefined,
        });
        await refreshBalances();
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Unknown error';
        showExchangeMessage({ ok: false, text: `Could not reach cashier: ${detail}` });
      } finally {
        setExchanging(null);
      }
    },
    [
      amounts,
      exchangeBlockReason,
      walletAddress,
      ledgerToken,
      refreshSpendable,
      refreshBalances,
      showExchangeMessage,
      balancesLoading,
    ],
  );

  return (
    <div className="cashier-scene">
      <div className="game-scene-vignette" />
      <div className="cashier-content max-w-6xl mx-auto px-4 py-8">
        <header className="cashier-header mb-6">
          <p className="cashier-eyebrow">
            {BRAND.name} · Solana Mainnet · Build {BRAND.buildId}
          </p>
          <h1 className="art-title text-center">{BRAND.cashier}</h1>
          <p className="art-subtitle text-center">
            Exchange chips for Fam tokens
          </p>
          {showBackLink && (
            <div className="cashier-nav mt-5 flex flex-wrap justify-center gap-3">
              <Link
                href={`${BRAND.homePath}${BRAND.homeAnchor}`}
                className="art-btn px-5 py-2 text-[#f0d878] inline-block"
              >
                ← {BRAND.home}
              </Link>
              <Link href="/alice" className="art-btn px-5 py-2 text-[#f0abfc] inline-block">
                {BRAND.aliceRoomNav}
              </Link>
              <Link href="/depths" className="art-btn px-5 py-2 text-[#f0d878] inline-block">
                {BRAND.depths}
              </Link>
            </div>
          )}
        </header>

        <ol className="cashier-journey" aria-label="How cashing out works">
          <li className="cashier-journey-step">
            <span className="cashier-journey-num">1</span>
            <strong>Play</strong>
            <span>Win chips in the games</span>
          </li>
          <li className="cashier-journey-step">
            <span className="cashier-journey-num">2</span>
            <strong>Connect</strong>
            <span>Same wallet you play with</span>
          </li>
          <li className="cashier-journey-step">
            <span className="cashier-journey-num">3</span>
            <strong>Exchange</strong>
            <span>Trade chips for Fam tokens</span>
          </li>
          <li className="cashier-journey-step">
            <span className="cashier-journey-num">4</span>
            <strong>Receive</strong>
            <span>Tokens arrive in your wallet</span>
          </li>
        </ol>

        {!connected && (
          <div className="cashier-wallet-callout" role="region" aria-label="Connect wallet">
            <div>
              <h2 className="cashier-wallet-callout-title">Connect your wallet</h2>
              <p className="cashier-wallet-callout-body">
                Use Solflare or Phantom to see your balance and cash out.
              </p>
            </div>
            <div className="cashier-wallet-callout-connect">
              <WalletMultiButton />
            </div>
          </div>
        )}

        {message && (
          <div
            id="cashier-toast"
            className={`cashier-toast mb-6 ${message.ok ? 'cashier-toast-ok' : 'cashier-toast-err'}`}
            role="status"
          >
            <div>
              {message.text}
              {message.txUrl && (
                <a href={message.txUrl} target="_blank" rel="noopener noreferrer" className="cashier-tx-link">
                  View on Solscan →
                </a>
              )}
            </div>
            <button type="button" onClick={() => setMessage(null)} className="cashier-toast-close" aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}

        <div className="cashier-top-grid mb-8">
          <div className="art-frame cashier-bank-card">
            <span className="art-frame-corners-tr" aria-hidden />
            <span className="art-frame-corners-bl" aria-hidden />
            <div className="p-5 md:p-6">
              <h2 className="art-panel-title">🏦 {BRAND.bank}</h2>
              <p className={`cashier-readiness ${connected && chips > 0 && treasuryReady ? 'cashier-readiness-ok' : ''}`}>
                {readinessLabel}
              </p>

              {connected && walletQuota && (
                <div className="cashier-quota cashier-quota-prominent" aria-label="Daily cash-out headroom">
                  <p className="cashier-quota-title">Left today</p>
                  <div className="cashier-quota-meters">
                    <div className="cashier-quota-meter">
                      <div className="cashier-quota-meter-head">
                        <span>USD left</span>
                        <strong>
                          ~${walletQuota.remainingUsd.toFixed(2)} / ${walletQuota.usdMax.toFixed(2)}
                        </strong>
                      </div>
                      <div className="cashier-quota-meter-track">
                        <div
                          className="cashier-quota-meter-fill"
                          style={{
                            width: `${walletQuota.usdMax > 0 ? Math.min(100, (walletQuota.remainingUsd / walletQuota.usdMax) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="cashier-quota-meter">
                      <div className="cashier-quota-meter-head">
                        <span>Chips left</span>
                        <strong>
                          {walletQuota.remainingChips.toLocaleString()} / {walletQuota.chipsMax.toLocaleString()}
                        </strong>
                      </div>
                      <div className="cashier-quota-meter-track">
                        <div
                          className="cashier-quota-meter-fill cashier-quota-meter-fill-chips"
                          style={{
                            width: `${walletQuota.chipsMax > 0 ? Math.min(100, (walletQuota.remainingChips / walletQuota.chipsMax) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="cashier-quota-meter">
                      <div className="cashier-quota-meter-head">
                        <span>Exchanges left</span>
                        <strong>
                          {Math.max(0, walletQuota.exchangesMax - walletQuota.exchangesUsed)} /{' '}
                          {walletQuota.exchangesMax}
                        </strong>
                      </div>
                      <div className="cashier-quota-meter-track">
                        <div
                          className="cashier-quota-meter-fill cashier-quota-meter-fill-tx"
                          style={{
                            width: `${walletQuota.exchangesMax > 0 ? Math.min(100, (Math.max(0, walletQuota.exchangesMax - walletQuota.exchangesUsed) / walletQuota.exchangesMax) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="cashier-quota-note">
                    Each cashout still capped at ~${walletQuota.maxUsdPerExchange}. Resets daily (UTC). Best-effort
                    for this region.
                  </p>
                </div>
              )}

              <div className="cashier-stat-row">
                <div className="cashier-stat">
                  <span className="cashier-stat-label">Spendable chips</span>
                  <span className="cashier-stat-value cashier-stat-chips">
                    {spendableLoading ? '…' : chips.toLocaleString()}
                  </span>
                  <span className="cashier-stat-hint">
                    {!connected
                      ? 'Connect wallet to load spendable balance'
                      : chips > 0
                        ? 'Server-verified · ready to exchange'
                        : 'Play Depths / Bandit / bank Alice with this wallet'}
                  </span>
                  {connected && chips === 0 && !spendableLoading && (
                    <div className="cashier-earn-links">
                      <Link href="/depths">{BRAND.depths}</Link>
                      <Link href="/alice">{BRAND.aliceRoomNav}</Link>
                      <Link href={`${BRAND.homePath}${BRAND.homeAnchor}`}>{BRAND.home}</Link>
                    </div>
                  )}
                </div>
                {localDisplayChips > chips && (
                  <div className="cashier-stat">
                    <span className="cashier-stat-label">Local (not cashable)</span>
                    <span className="cashier-stat-value text-[#f5e6c8]/50">{localDisplayChips.toLocaleString()}</span>
                    <span className="cashier-stat-hint">Display only — cannot cash</span>
                  </div>
                )}
                <div className="cashier-stat">
                  <span className="cashier-stat-label">Exchanges</span>
                  <span className="cashier-stat-value">{lifetimeExchanged.toLocaleString()}</span>
                </div>
                <div className="cashier-stat">
                  <span className="cashier-stat-label">Lifetime earned</span>
                  <span className="cashier-stat-value text-[#f5e6c8]/70">{lifetimeChipsWon.toLocaleString()}</span>
                </div>
                <div className="cashier-stat">
                  <span className="cashier-stat-label">Cashier</span>
                  <span
                    className={`cashier-stat-value text-base ${treasuryReady ? 'text-emerald-400' : 'text-amber-400'}`}
                  >
                    {treasuryReady === null ? '…' : treasuryReady ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="art-frame cashier-wallet-card">
            <span className="art-frame-corners-tr" aria-hidden />
            <span className="art-frame-corners-bl" aria-hidden />
            <div className="p-5 md:p-6">
              <h2 className="art-panel-title">👛 Wallet</h2>
              <p className="text-[#f5e6c8]/55 text-base mb-4">
                Solflare and Phantom both work. Use the address that already holds the Fam token you want.
              </p>
              <div className="cashier-wallet-connect mb-4">
                <WalletMultiButton />
              </div>
              {connected && walletAddress ? (
                <div className="cashier-wallet-info">
                  <div className="cashier-wallet-row">
                    <span className="text-[#f5e6c8]/50">Connected</span>
                    <span className="font-mono text-[#d4af37]">{formatWalletAddress(walletAddress)}</span>
                  </div>
                  {balanceError && <p className="text-sm text-red-300 mt-2">{balanceError}</p>}
                  {balancesLoading ? (
                    <p className="text-sm text-[#f5e6c8]/45 mt-3 italic">Loading on-chain balances…</p>
                  ) : (
                    <div className="cashier-wallet-balances mt-3">
                      {FAM_TOKENS.map(token => {
                        const bal = balances[token.id];
                        const ready = walletCanReceiveToken(bal);
                        return (
                          <div key={token.id} className="cashier-wallet-bal-row">
                            <span>{token.symbol}</span>
                            <span className={ready ? 'text-emerald-400' : 'text-amber-300/80'}>
                              {bal?.ui ?? '0'}
                              {ready ? ' ✓' : ' — need account'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    className="art-btn py-2 px-4 text-sm mt-3"
                    onClick={() => void refreshBalances()}
                  >
                    Refresh balances
                  </button>
                </div>
              ) : (
                <p className="text-sm text-[#f5e6c8]/45 italic">
                  Connect Solflare or Phantom to exchange.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="art-frame">
          <span className="art-frame-corners-tr" aria-hidden />
          <span className="art-frame-corners-bl" aria-hidden />
          <div className="p-5 md:p-6">
            <h2 className="art-panel-title">Exchange chips → Fam tokens</h2>
            <p className="text-center text-[#f5e6c8]/50 mb-6 max-w-2xl mx-auto">
              Pick a coin and cash out. Hold a little of that token first so your wallet can receive more.
            </p>

            <div className="cashier-exchange-grid">
              {connected && balancesLoading && (
                <p className="text-center text-[#f5e6c8]/55 mb-4 text-sm">Reading Fam token accounts…</p>
              )}
              {connected && balanceError && (
                <p className="text-center text-amber-200/90 mb-4 text-sm">
                  Balance lookup error: {balanceError}. Hit refresh after connecting.
                </p>
              )}
              {connected && !balancesLoading && balanceSource && (
                <p className="text-center text-[#f5e6c8]/40 mb-4 text-xs">
                  Balances via {balanceSource === 'server' ? 'server RPC' : 'browser RPC'}
                  {hasAnyBalance ? ' · Fam tokens detected' : ''}
                </p>
              )}

              {FAM_TOKENS.map(token => {
                const tokenAmount = parseFloat(amounts[token.id]) || 0;
                const chipCost = calculateChipCost(token.id, tokenAmount);
                const bal = balances[token.id];
                const walletReady = walletCanReceiveToken(bal);
                const canAfford = chips >= chipCost && tokenAmount >= token.minTokens;
                const walletBal = balancesLoading ? '…' : bal?.ui ?? '—';
                const isBusy = exchanging === token.id;
                const blockReason = exchangeBlockReason(token.id);

                return (
                  <div key={token.id} className="cashier-coin-card">
                    <div className="cashier-coin-header">
                      <div className="cashier-token-logo shrink-0" aria-hidden>
                        <Image
                          src={token.img}
                          alt={`${token.symbol} logo`}
                          width={72}
                          height={72}
                          className="cashier-token-logo-img"
                          unoptimized
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display text-xl font-bold text-[#f0d878]">{token.name}</h3>
                        <p className="text-sm text-[#d4af37]/75 italic">{token.role}</p>
                        <p className="cashier-coin-symbol">{token.symbol}</p>
                        <a
                          href={solscanTokenUrl(token.mint)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cashier-mint-ca"
                          title={token.mint}
                        >
                          CA: {formatMintAddress(token.mint)}
                        </a>
                      </div>
                    </div>

                    <div className="cashier-coin-meta">
                      <span className="cashier-rate">{token.rateLabel}</span>
                      {treasuryTokenMap[token.id] && (
                        <span className="cashier-held">
                          Treasury:{' '}
                          <strong>
                            {treasuryTokenMap[token.id].accountExists
                              ? treasuryTokenMap[token.id].balance
                              : 'No account'}
                          </strong>
                        </span>
                      )}
                      {connected && (
                        <span className="cashier-held">
                          Wallet:{' '}
                          <strong className={walletReady ? 'text-emerald-400' : undefined}>{walletBal}</strong>
                          {walletReady ? ' ✓' : ''}
                        </span>
                      )}
                    </div>

                    {connected && !balancesLoading && !walletReady && (
                      <p className="cashier-coin-warning">
                        No {token.symbol} on this connected address. Hold {token.symbol} in Solflare/Phantom on this
                        same account first.
                      </p>
                    )}

                    <div className="cashier-coin-actions">
                      <label className="cashier-amount-label">
                        {token.symbol} amount
                        <input
                          type="number"
                          min={token.minTokens}
                          step="any"
                          value={amounts[token.id]}
                          onChange={e => setAmount(token.id, e.target.value)}
                          className="cashier-amount-input"
                        />
                      </label>
                      <div className="cashier-cost">
                        Cost: <strong>{chipCost.toLocaleString()}</strong> chips
                        <span className="cashier-cost-have"> · you have {chips.toLocaleString()}</span>
                      </div>
                      {blockReason && connected && (
                        <p className="cashier-coin-block-reason" role="status">
                          {blockReason}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleExchange(token.id)}
                        disabled={isBusy}
                        title={blockReason ?? `Exchange chips for ${token.symbol}`}
                        className={`art-btn w-full py-2.5 text-[#f0d878] disabled:opacity-40 ${
                          blockReason ? 'cashier-exchange-btn-blocked' : ''
                        }`}
                      >
                        {isBusy
                          ? 'Sending…'
                          : !connected
                            ? 'Connect wallet'
                            : !walletReady
                              ? `Need ${token.symbol} in wallet — tap for help`
                              : !canAfford
                                ? `Need ${chipCost.toLocaleString()} chips — tap for help`
                                : `Exchange for ${token.symbol}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {connected && hasAnyBalance && (
          <div className="art-frame mt-8">
            <span className="art-frame-corners-tr" aria-hidden />
            <span className="art-frame-corners-bl" aria-hidden />
            <div className="p-5 md:p-6">
              <h2 className="art-panel-title">On-Chain Holdings</h2>
              <div className="cashier-holdings-grid">
                {FAM_TOKENS.map(token => {
                  const bal = balances[token.id];
                  if (!bal || bal.raw <= BigInt(0)) return null;
                  return (
                    <div key={token.id} className="cashier-holding-pill">
                      <Image
                        src={token.img}
                        alt=""
                        width={36}
                        height={36}
                        className="cashier-token-logo-img cashier-holding-logo"
                        unoptimized
                      />
                      <div>
                        <div className="font-display font-bold text-[#f0d878]">{token.symbol}</div>
                        <div className="text-sm text-[#f5e6c8]/55">{bal.ui}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
