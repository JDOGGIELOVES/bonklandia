'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useBonkBank } from '@/hooks/useBonkBank';
import { useFamTokenBalances } from '@/hooks/useFamTokenBalances';
import { formatWalletAddress } from '@/lib/bank';
import {
  FAM_TOKENS,
  calculateChipCost,
  formatMintAddress,
  solscanTokenUrl,
  solscanTxUrl,
  walletCanReceiveToken,
  type FamCoinId,
} from '@/lib/fam-tokens';
import CashierSecurityPanel, { type TreasurySnapshot } from '@/components/CashierSecurityPanel';
import { BRAND } from '@/lib/brand';

type CashierPanelProps = {
  showBackLink?: boolean;
};

export default function CashierPanel({ showBackLink = true }: CashierPanelProps) {
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const {
    chips,
    lifetimeChipsWon,
    lifetimeExchanges,
    spendChips,
    refresh: refreshLocalBank,
  } = useBonkBank();

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

  const treasuryReady = treasuryStatus?.payoutsReady ?? null;
  const treasuryTokenMap = Object.fromEntries(
    (treasuryStatus?.tokens ?? []).map(t => [t.id, t]),
  ) as Record<string, TreasurySnapshot['tokens'][number]>;

  const walletTokenReadyCount = FAM_TOKENS.filter(t =>
    walletCanReceiveToken(balances[t.id]),
  ).length;

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

  const showExchangeMessage = useCallback((msg: { text: string; ok: boolean; txUrl?: string }) => {
    setMessage(msg);
    requestAnimationFrame(() => {
      document.getElementById('cashier-toast')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, []);

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
      if (chipCost <= 0 || chips < chipCost) {
        return `Need ${chipCost.toLocaleString()} Bonk Chips (you have ${chips.toLocaleString()}). Wallet ${token.symbol} is separate from chips.`;
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
            bankChips: chips,
          }),
        });

        const rawText = await res.text();
        let data: {
          error?: string;
          chipsRemaining?: number;
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
          showExchangeMessage({ ok: false, text: data.error ?? `Exchange failed (${res.status}).` });
          void refreshBalances();
          return;
        }

        // Debit Bonk Chips bank only after on-chain send succeeds.
        const spent = spendChips(chipCost);
        if (!spent.ok) {
          showExchangeMessage({
            ok: true,
            text: `Sent ${Number(data.tokenAmount).toLocaleString()} ${data.symbol}, but chip bank debit failed — refresh and check balance.`,
            txUrl: data.signature ? solscanTxUrl(data.signature) : undefined,
          });
        } else {
          refreshLocalBank();
          showExchangeMessage({
            ok: true,
            text: `Sent ${Number(data.tokenAmount).toLocaleString()} ${data.symbol} to your wallet. ${spent.state.chips.toLocaleString()} Bonk Chips left.`,
            txUrl: data.signature ? solscanTxUrl(data.signature) : undefined,
          });
        }
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
      chips,
      spendChips,
      refreshLocalBank,
      refreshBalances,
      showExchangeMessage,
      balancesLoading,
    ],
  );

  return (
    <div className="cashier-scene">
      <div className="game-scene-vignette" />
      <div className="cashier-content max-w-6xl mx-auto px-4 py-8">
        <header className="cashier-header mb-8">
          <p className="cashier-eyebrow">
            {BRAND.name} · Solana Mainnet · Build {BRAND.buildId}
          </p>
          <h1 className="art-title text-center">{BRAND.cashier}</h1>
          <p className="art-subtitle text-center">
            Trade Bonk Chips for real Fam SPL tokens — Solflare &amp; Phantom supported
          </p>
          {showBackLink && (
            <div className="cashier-nav mt-5 flex flex-wrap justify-center gap-4">
              <Link href="/depths" className="art-btn px-6 py-2 text-[#f0d878] inline-block">
                {BRAND.depths}
              </Link>
              <Link href="/" className="art-btn px-6 py-2 text-[#f0d878] inline-block">
                ← Back to {BRAND.name}
              </Link>
            </div>
          )}
        </header>

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

        <div className="cashier-notice mb-8" role="note">
          <h2 className="cashier-notice-title">How exchange works</h2>
          <p className="cashier-notice-body">
            <strong>Bonk Chips</strong> are what you spend (won in Depths / Bandit).{' '}
            <strong>BONGA in Solflare</strong> is separate — you need some on this wallet so we can send more BONGA to
            you. No claim or sync steps.
          </p>
        </div>

        <div className="cashier-top-grid mb-8">
          <div className="art-frame cashier-bank-card">
            <span className="art-frame-corners-tr" aria-hidden />
            <span className="art-frame-corners-bl" aria-hidden />
            <div className="p-5 md:p-6">
              <h2 className="art-panel-title">🏦 {BRAND.bank}</h2>
              <p className="text-[#f5e6c8]/55 text-base mb-4">
                Wins credit here automatically. Connect Solflare or Phantom and exchange below.
              </p>

              <div className="cashier-stat-row">
                <div className="cashier-stat">
                  <span className="cashier-stat-label">Bonk Chips</span>
                  <span className="cashier-stat-value cashier-stat-chips">{chips.toLocaleString()}</span>
                  <span className="cashier-stat-hint">
                    {chips > 0
                      ? connected
                        ? 'Ready to exchange'
                        : 'Connect wallet to exchange'
                      : 'Win chips in Depths or Bandit first'}
                  </span>
                </div>
                <div className="cashier-stat">
                  <span className="cashier-stat-label">Exchanges</span>
                  <span className="cashier-stat-value">{lifetimeExchanges.toLocaleString()}</span>
                </div>
                <div className="cashier-stat">
                  <span className="cashier-stat-label">Lifetime Won</span>
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

        <CashierSecurityPanel
          treasury={treasuryStatus}
          treasuryLoading={treasuryLoading}
          connected={connected}
          serverChips={chips}
          pendingClaim={null}
          walletTokenReadyCount={walletTokenReadyCount}
          onRefresh={() => {
            refreshTreasury();
            void refreshBalances();
          }}
        />

        <div className="art-frame">
          <span className="art-frame-corners-tr" aria-hidden />
          <span className="art-frame-corners-bl" aria-hidden />
          <div className="p-5 md:p-6">
            <h2 className="art-panel-title">Exchange chips → Fam tokens</h2>
            <p className="text-center text-[#f5e6c8]/50 mb-6 max-w-2xl mx-auto">
              Spend Bonk Chips for SPL tokens from the treasury. Works with Solflare and Phantom.
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
                      <div className="art-portrait shrink-0">
                        <div className="art-portrait-inner">
                          <Image
                            src={token.img}
                            alt={token.name}
                            width={72}
                            height={96}
                            className="character-img w-[68px] h-[90px] object-contain"
                            unoptimized
                          />
                        </div>
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
                        width={32}
                        height={42}
                        className="character-img object-contain"
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
