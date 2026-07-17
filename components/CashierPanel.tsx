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
  const { chips: localChips, lifetimeChipsWon, lifetimeExchanges } = useBonkBank();
  const [serverChips, setServerChips] = useState<number | null>(null);
  const [pendingClaim, setPendingClaim] = useState<{
    sessionId: string;
    settleToken: string;
    totalWinnings?: number;
    localOnly?: boolean;
  } | null>(null);
  const [claiming, setClaiming] = useState(false);

  // Exchange / cashier spends use server ledger when wallet is connected.
  const chips = connected && serverChips !== null ? serverChips : localChips;
  const { balances, loading: balancesLoading, error: balanceError, refresh: refreshBalances, hasAnyBalance } =
    useFamTokenBalances();

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

  const refreshServerChips = useCallback(async () => {
    if (!walletAddress) {
      setServerChips(null);
      return;
    }
    try {
      const res = await fetch(`/api/chips/balance?wallet=${encodeURIComponent(walletAddress)}`);
      const data = await res.json();
      if (res.ok) setServerChips(Number(data.chips) || 0);
    } catch {
      setServerChips(null);
    }
  }, [walletAddress]);

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

  const refreshSecurityStatus = useCallback(() => {
    refreshTreasury();
    void refreshServerChips();
  }, [refreshTreasury, refreshServerChips]);

  useEffect(() => {
    refreshTreasury();
  }, [refreshTreasury]);

  useEffect(() => {
    void refreshServerChips();
  }, [refreshServerChips]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('bonk-casino-pending');
      if (raw) setPendingClaim(JSON.parse(raw) as typeof pendingClaim);
    } catch {
      setPendingClaim(null);
    }
  }, []);

  const handleClaimCasinoChips = useCallback(async () => {
    if (!connected || !walletAddress || !pendingClaim?.sessionId || !pendingClaim.settleToken) {
      setMessage({ ok: false, text: 'Connect wallet and finish a casino session first.' });
      return;
    }

    if (pendingClaim.localOnly || pendingClaim.settleToken === 'local' || pendingClaim.sessionId.startsWith('local-')) {
      setMessage({
        ok: false,
        text:
          'This session is still local-only. Re-enter the casino with a live vault link (or win chips after the vault status shows live), then claim again. Local bank chips remain available for chip bets.',
      });
      return;
    }

    setClaiming(true);
    setMessage(null);
    try {
      const res = await fetch('/api/chips/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: pendingClaim.sessionId,
          settleToken: pendingClaim.settleToken,
          wallet: walletAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? 'Claim failed.' });
        return;
      }

      sessionStorage.removeItem('bonk-casino-pending');
      setPendingClaim(null);
      setServerChips(Number(data.chips) || 0);
      setMessage({
        ok: true,
        text: `Claimed ${Number(data.credited).toLocaleString()} server-verified chips to your wallet ledger.`,
      });
    } catch {
      setMessage({ ok: false, text: 'Claim failed — try again.' });
    } finally {
      setClaiming(false);
    }
  }, [connected, walletAddress, pendingClaim]);

  const setAmount = (id: FamCoinId, value: string) => {
    setAmounts(prev => ({ ...prev, [id]: value }));
  };

  const handleExchange = useCallback(
    async (coinId: FamCoinId) => {
      const token = FAM_TOKENS.find(t => t.id === coinId)!;
      const tokenAmount = parseFloat(amounts[coinId]);
      const chipCost = calculateChipCost(coinId, tokenAmount);

      if (!connected || !walletAddress) {
        setMessage({ ok: false, text: 'Connect your Solana wallet to receive real SPL tokens.' });
        return;
      }
      if (!Number.isFinite(tokenAmount) || tokenAmount < token.minTokens) {
        setMessage({
          ok: false,
          text: `Minimum exchange is ${token.minTokens.toLocaleString()} ${token.symbol}.`,
        });
        return;
      }
      if (chipCost <= 0 || chips < chipCost) {
        setMessage({
          ok: false,
          text: `Need ${chipCost.toLocaleString()} chips — you have ${chips.toLocaleString()}.`,
        });
        return;
      }
      if (treasuryReady === false) {
        setMessage({
          ok: false,
          text:
            treasuryStatus?.payoutsBlockedReason ??
            'Cashier payouts offline. Set BONGA_TREASURY_SECRET_KEY (shared Bonk Miner / GrokSight treasury key).',
        });
        return;
      }

      const vault = treasuryTokenMap[coinId];
      if (!vault?.accountExists) {
        setMessage({
          ok: false,
          text: `Treasury has no ${token.symbol} token account yet. Fund the shared treasury wallet first.`,
        });
        return;
      }
      if (!walletCanReceiveToken(balances[coinId])) {
        setMessage({
          ok: false,
          text: `Your wallet has no ${token.symbol} token account yet. Hold at least 1 ${token.symbol} first — the cashier cannot create one for you.`,
        });
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
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setMessage({ ok: false, text: data.error ?? 'Exchange failed.' });
          return;
        }

        setServerChips(Number(data.chipsRemaining) || 0);
        await refreshBalances();
        setMessage({
          ok: true,
          text: `Sent ${data.tokenAmount.toLocaleString()} ${data.symbol} to your wallet.`,
          txUrl: solscanTxUrl(data.signature),
        });
      } catch {
        setMessage({ ok: false, text: 'Network error — try again.' });
      } finally {
        setExchanging(null);
      }
    },
    [
      amounts,
      chips,
      connected,
      walletAddress,
      treasuryReady,
      treasuryStatus,
      treasuryTokenMap,
      refreshBalances,
      balances,
      refreshServerChips,
    ],
  );

  return (
    <div className="cashier-scene">
      <div className="game-scene-vignette" />
      <div className="cashier-content max-w-6xl mx-auto px-4 py-8">
        <header className="cashier-header mb-8">
          <p className="cashier-eyebrow">{BRAND.name} · Solana Mainnet · {BRAND.domain}</p>
          <h1 className="art-title text-center">{BRAND.cashier}</h1>
          <p className="art-subtitle text-center">
            Trade in-game Bonk Chips for real Fam SPL tokens — sent straight to your wallet
          </p>
          {showBackLink && (
            <div className="cashier-nav mt-5 flex flex-wrap justify-center gap-4">
              <Link href="/" className="art-btn px-6 py-2 text-[#f0d878] inline-block">
                ← Back to {BRAND.name}
              </Link>
            </div>
          )}
        </header>

        <div className="cashier-notice mb-8" role="note">
          <h2 className="cashier-notice-title">Token account required</h2>
          <p className="cashier-notice-body">
            Before you can exchange chips for Fam tokens, your wallet must already have that member&apos;s SPL token
            account. <strong>The cashier will not create a new token account for you.</strong>
          </p>
          <p className="cashier-notice-body">
            Example: to receive 100 BONGA (1,500 chips), you must already hold at least 1 BONGA in that wallet — or
            have the BONGA token account from a prior transfer. Swap or receive one token elsewhere first, then come
            back to cash out your chips.
          </p>
        </div>

        <div className="cashier-top-grid mb-8">
          <div className="art-frame cashier-bank-card">
            <span className="art-frame-corners-tr" aria-hidden />
            <span className="art-frame-corners-bl" aria-hidden />
            <div className="p-5 md:p-6">
              <h2 className="art-panel-title">🏦 {BRAND.bank}</h2>
              <p className="text-[#f5e6c8]/55 text-base mb-4">
                Chips from Bonga Chill&apos;s casino are server-verified. Claim them here with your wallet, then exchange for real SPL tokens.
              </p>
              {pendingClaim && (
                <div className="cashier-claim-banner mb-4">
                  <p className="text-sm text-[#f5e6c8]/70">
                    Unclaimed casino session detected
                    {pendingClaim.totalWinnings
                      ? ` — up to ${pendingClaim.totalWinnings.toLocaleString()} chips`
                      : ''}
                    {pendingClaim.localOnly || pendingClaim.sessionId.startsWith('local-')
                      ? ' (local session — need vault-live session to claim)'
                      : ''}.
                  </p>
                  {connected ? (
                    <button
                      type="button"
                      className="art-btn py-2 px-4 text-sm mt-2"
                      onClick={() => void handleClaimCasinoChips()}
                      disabled={claiming}
                    >
                      {claiming ? 'Claiming…' : 'Claim verified chips'}
                    </button>
                  ) : (
                    <p className="text-sm text-amber-200/80 mt-2">Connect wallet above to claim.</p>
                  )}
                </div>
              )}
              <div className="cashier-stat-row">
                <div className="cashier-stat">
                  <span className="cashier-stat-label">Bonk Chips</span>
                  <span className="cashier-stat-value cashier-stat-chips">
                    {chips.toLocaleString()}
                  </span>
                  {connected && serverChips !== null ? (
                    <span className="cashier-stat-hint">
                      Server {serverChips.toLocaleString()} · Local bank {localChips.toLocaleString()}
                    </span>
                  ) : (
                    <span className="cashier-stat-hint">Local bank</span>
                  )}
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
                  <span className={`cashier-stat-value text-base ${treasuryReady ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {treasuryReady === null ? '…' : treasuryReady ? 'Online' : 'Key needed'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="art-frame cashier-wallet-card">
            <span className="art-frame-corners-tr" aria-hidden />
            <span className="art-frame-corners-bl" aria-hidden />
            <div className="p-5 md:p-6">
              <h2 className="art-panel-title">👛 Wallet Connect</h2>
              <p className="text-[#f5e6c8]/55 text-base mb-4">
                Connect Phantom or Solflare to see your real Fam token balances and receive exchanges.
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
                  {balanceError && (
                    <p className="text-sm text-red-300 mt-2">{balanceError}</p>
                  )}
                  {balancesLoading ? (
                    <p className="text-sm text-[#f5e6c8]/45 mt-3 italic">Loading on-chain balances…</p>
                  ) : (
                    <div className="cashier-wallet-balances mt-3">
                      {FAM_TOKENS.map(token => {
                        const bal = balances[token.id];
                        const ready = walletCanReceiveToken(bal);
                        return (
                          <div key={token.id} className="cashier-wallet-balance-row">
                            <span className="text-[#f5e6c8]/60">{token.symbol}</span>
                            <span className="cashier-wallet-balance-end">
                              <span className="text-[#f0d878] font-bold">{bal?.ui ?? '0'}</span>
                              <span className={`cashier-account-badge ${ready ? 'ready' : 'missing'}`}>
                                {ready ? 'Account ready' : 'No account'}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void refreshBalances()}
                    className="text-sm underline text-[#d4af37]/60 hover:text-[#d4af37] mt-3"
                  >
                    Refresh balances
                  </button>
                </div>
              ) : (
                <p className="text-sm text-[#f5e6c8]/45 italic">
                  Your wallet holdings for all six Fam SPL tokens will appear here once connected.
                </p>
              )}
            </div>
          </div>
        </div>

        <CashierSecurityPanel
          treasury={treasuryStatus}
          treasuryLoading={treasuryLoading}
          connected={connected}
          serverChips={serverChips}
          pendingClaim={pendingClaim}
          walletTokenReadyCount={walletTokenReadyCount}
          onRefresh={refreshSecurityStatus}
        />

        {message && (
          <div className={`cashier-toast ${message.ok ? 'cashier-toast-ok' : 'cashier-toast-err'}`}>
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

        <div className="art-frame">
          <span className="art-frame-corners-tr" aria-hidden />
          <span className="art-frame-corners-bl" aria-hidden />
          <div className="p-5 md:p-7">
            <p className="font-display text-center text-lg tracking-[0.25em] uppercase text-[#d4af37]/60 mb-6">
              — Fam Token Exchange —
            </p>
            <p className="text-center text-[#f5e6c8]/50 mb-6 max-w-2xl mx-auto">
              Each Fam coin has its own chip rate. You must already hold a token account for the coin you want — the
              treasury never pays SOL or creates accounts. Only SPL tokens leave the vault.
            </p>

            <div className="cashier-exchange-grid">
              {FAM_TOKENS.map(token => {
                const tokenAmount = parseFloat(amounts[token.id]) || 0;
                const chipCost = calculateChipCost(token.id, tokenAmount);
                const bal = balances[token.id];
                const walletReady = walletCanReceiveToken(bal);
                const canAfford = chips >= chipCost && tokenAmount >= token.minTokens;
                const walletBal = bal?.ui ?? '0';
                const isBusy = exchanging === token.id;
                const canExchange =
                  canAfford &&
                  connected &&
                  walletReady &&
                  treasuryReady !== false &&
                  serverChips !== null;

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
                          Wallet: <strong>{walletBal}</strong>
                        </span>
                      )}
                    </div>

                    {connected && !walletReady && (
                      <p className="cashier-coin-warning">
                        No {token.symbol} token account in this wallet. Hold at least 1 {token.symbol} first.
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
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleExchange(token.id)}
                        disabled={!canExchange || isBusy}
                        className="art-btn w-full py-2.5 text-[#f0d878] disabled:opacity-40"
                      >
                        {isBusy
                          ? 'Sending…'
                          : !connected
                            ? 'Connect wallet'
                            : !walletReady
                              ? `Need ${token.symbol} account`
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
                      <Image src={token.img} alt="" width={32} height={42} className="character-img object-contain" unoptimized />
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