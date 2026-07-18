'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useBonkBank } from '@/hooks/useBonkBank';
import { useFamTokenBalances } from '@/hooks/useFamTokenBalances';
import { formatWalletAddress, loadBankState } from '@/lib/bank';
import {
  loadChipLedgerChips,
  loadChipLedgerToken,
  saveChipLedgerToken,
} from '@/lib/chip-ledger-client';
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

function loadLocalChipCount(): number {
  return loadBankState().chips;
}

type CashierPanelProps = {
  showBackLink?: boolean;
};

export default function CashierPanel({ showBackLink = true }: CashierPanelProps) {
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const {
    chips: localChips,
    lifetimeChipsWon,
    lifetimeExchanges,
    clearLocalChips,
    refresh: refreshLocalBank,
  } = useBonkBank();
  const [serverChips, setServerChips] = useState<number | null>(null);
  const [pendingClaim, setPendingClaim] = useState<{
    sessionId: string;
    settleToken: string;
    totalWinnings?: number;
    localOnly?: boolean;
  } | null>(null);
  const [syncingChips, setSyncingChips] = useState(false);
  const chipSyncInFlight = useRef(false);

  // One player-facing balance: bank chips + any portable ledger (merged invisibly).
  const ledgerChips = serverChips ?? (walletAddress ? loadChipLedgerChips(walletAddress) : 0);
  const chips = ledgerChips + localChips;
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

  const refreshServerChips = useCallback(async () => {
    if (!walletAddress) {
      setServerChips(null);
      return;
    }
    // Seed from browser-held ledger so UI is never stuck at 0 after a refresh.
    const cached = loadChipLedgerChips(walletAddress);
    if (cached > 0) setServerChips(cached);

    try {
      const ledgerToken = loadChipLedgerToken(walletAddress);
      const res = await fetch('/api/chips/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, ledgerToken }),
      });
      const data = await res.json() as { chips?: number; ledgerToken?: string | null };
      if (res.ok) {
        const next = Number(data.chips) || 0;
        // Prefer higher of server response vs cached (never drop without force debit).
        const best = Math.max(next, loadChipLedgerChips(walletAddress));
        setServerChips(best);
        if (data.ledgerToken && next >= loadChipLedgerChips(walletAddress)) {
          saveChipLedgerToken(walletAddress, data.ledgerToken, next);
        } else if (data.ledgerToken && next > 0) {
          saveChipLedgerToken(walletAddress, data.ledgerToken, next);
        }
      }
    } catch {
      // keep cached
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

  const showExchangeMessage = useCallback((msg: { text: string; ok: boolean; txUrl?: string }) => {
    setMessage(msg);
    requestAnimationFrame(() => {
      document.getElementById('cashier-toast')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, []);

  /** Import local bank chips onto the portable ledger (then clear local to avoid double spend). */
  const syncLocalChipsToServer = useCallback(
    async (opts?: { silent?: boolean }): Promise<{ deposited: number; chips: number; error?: string }> => {
      if (!connected || !walletAddress) {
        return { deposited: 0, chips: serverChips ?? 0, error: 'Connect wallet first.' };
      }
      if (chipSyncInFlight.current) {
        return { deposited: 0, chips: serverChips ?? 0, error: 'Sync already in progress.' };
      }
      const amount = loadLocalChipCount();
      if (amount <= 0) {
        await refreshServerChips();
        return { deposited: 0, chips: serverChips ?? 0 };
      }

      chipSyncInFlight.current = true;
      setSyncingChips(true);
      try {
        const ledgerToken = loadChipLedgerToken(walletAddress);
        const res = await fetch('/api/chips/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet: walletAddress, amount, ledgerToken }),
        });
        const data = await res.json() as {
          error?: string;
          chips?: number;
          deposited?: number;
          ledgerToken?: string;
        };
        if (!res.ok) {
          const error = data.error ?? 'Could not sync local chips to cashier ledger.';
          if (!opts?.silent) {
            showExchangeMessage({ ok: false, text: error });
          }
          return { deposited: 0, chips: serverChips ?? 0, error };
        }

        const deposited = Number(data.deposited) || amount;
        const nextServer = Number(data.chips);
        if (data.ledgerToken && Number.isFinite(nextServer)) {
          saveChipLedgerToken(walletAddress, data.ledgerToken, nextServer, { force: true });
        }
        clearLocalChips(deposited);
        refreshLocalBank();
        if (Number.isFinite(nextServer)) setServerChips(nextServer);
        else await refreshServerChips();

        const note = `Your chip balance is ready (${Number.isFinite(nextServer) ? nextServer.toLocaleString() : deposited.toLocaleString()} chips).`;
        if (!opts?.silent) {
          showExchangeMessage({ ok: true, text: note });
        }
        return { deposited, chips: Number.isFinite(nextServer) ? nextServer : deposited };
      } catch {
        const error = 'Chip sync failed — try again.';
        if (!opts?.silent) {
          showExchangeMessage({ ok: false, text: error });
        }
        return { deposited: 0, chips: serverChips ?? 0, error };
      } finally {
        chipSyncInFlight.current = false;
        setSyncingChips(false);
      }
    },
    [
      connected,
      walletAddress,
      clearLocalChips,
      refreshLocalBank,
      refreshServerChips,
      serverChips,
      showExchangeMessage,
    ],
  );

  /**
   * Invisible backend prep: claim any vault session + fold local bank into the
   * portable ledger. Players never see this — they only see Bonk Chips + Exchange.
   */
  useEffect(() => {
    if (!connected || !walletAddress) return;

    let cancelled = false;
    const run = async () => {
      await refreshServerChips();
      if (cancelled) return;

      const pending = (() => {
        try {
          const raw = sessionStorage.getItem('bonk-casino-pending');
          return raw ? (JSON.parse(raw) as typeof pendingClaim) : null;
        } catch {
          return null;
        }
      })();

      if (
        pending?.sessionId &&
        pending.settleToken &&
        !pending.localOnly &&
        pending.settleToken !== 'local' &&
        !pending.sessionId.startsWith('local-')
      ) {
        try {
          const res = await fetch('/api/chips/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: pending.sessionId,
              settleToken: pending.settleToken,
              wallet: walletAddress,
              ledgerToken: loadChipLedgerToken(walletAddress),
            }),
          });
          const data = (await res.json()) as {
            credited?: number;
            chips?: number;
            ledgerToken?: string;
          };
          if (!cancelled && res.ok) {
            const credited = Number(data.credited) || 0;
            if (data.ledgerToken && Number.isFinite(Number(data.chips))) {
              saveChipLedgerToken(walletAddress, data.ledgerToken, Number(data.chips), {
                force: true,
              });
            }
            // Those chips were already in the local bank — remove them so total isn't doubled.
            if (credited > 0) {
              clearLocalChips(credited);
              refreshLocalBank();
            }
            if (Number.isFinite(Number(data.chips))) {
              setServerChips(Number(data.chips) || 0);
            }
          }
        } catch {
          // ignore — local chips still spendable via exchange import
        }
      }

      try {
        sessionStorage.removeItem('bonk-casino-pending');
      } catch {
        // private mode
      }
      if (!cancelled) setPendingClaim(null);

      if (cancelled) return;
      // Silently fold local bank into portable ledger when possible.
      if (loadLocalChipCount() > 0) {
        await syncLocalChipsToServer({ silent: true });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, walletAddress]);

  const setAmount = (id: FamCoinId, value: string) => {
    setAmounts(prev => ({ ...prev, [id]: value }));
  };

  const exchangeBlockReason = useCallback(
    (coinId: FamCoinId): string | null => {
      const token = FAM_TOKENS.find(t => t.id === coinId)!;
      const tokenAmount = parseFloat(amounts[coinId]);
      const chipCost = calculateChipCost(coinId, tokenAmount);

      if (!connected || !walletAddress) {
        return 'Connect your Solana wallet first.';
      }
      if (balancesLoading) {
        return 'Still reading your token accounts — wait a moment, then try again.';
      }
      if (treasuryReady === false) {
        return (
          treasuryStatus?.payoutsBlockedReason ??
          'Cashier payouts offline (treasury signing key / emergency stop).'
        );
      }
      if (!Number.isFinite(tokenAmount) || tokenAmount < token.minTokens) {
        return `Minimum is ${token.minTokens.toLocaleString()} ${token.symbol}.`;
      }
      const available = ledgerChips + localChips;
      if (chipCost <= 0 || available < chipCost) {
        return `Need ${chipCost.toLocaleString()} chips (you have ${available.toLocaleString()}).`;
      }
      if (!walletCanReceiveToken(balances[coinId])) {
        return `No ${token.symbol} token account on this wallet (mint ${formatMintAddress(token.mint)}). Hold a little ${token.symbol} first, then hit refresh.`;
      }
      const vault = treasuryTokenMap[coinId];
      if (vault && !vault.accountExists) {
        return `Treasury has no ${token.symbol} account funded yet.`;
      }
      return null;
    },
    [
      amounts,
      balances,
      balancesLoading,
      connected,
      localChips,
      ledgerChips,
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
        if (balancesLoading || serverChips === null) {
          void refreshBalances();
          void refreshServerChips();
        }
        return;
      }

      setExchanging(coinId);
      setMessage(null);

      // Import whatever is still in the local bank in the same request as the spend.
      const importLocalAmount = loadLocalChipCount();

      try {
        const res = await fetch('/api/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coinId,
            tokenAmount,
            walletAddress,
            chipCost,
            ledgerToken: loadChipLedgerToken(walletAddress),
            importLocalAmount,
          }),
        });

        const data = await res.json() as {
          error?: string;
          chipsRemaining?: number;
          tokenAmount?: number;
          symbol?: string;
          signature?: string;
          ledgerToken?: string;
          importedLocal?: number;
        };
        if (!res.ok) {
          showExchangeMessage({ ok: false, text: data.error ?? 'Exchange failed.' });
          void refreshBalances();
          void refreshServerChips();
          return;
        }

        if (importLocalAmount > 0) {
          clearLocalChips(importLocalAmount);
          refreshLocalBank();
        }
        if (data.ledgerToken && walletAddress) {
          saveChipLedgerToken(
            walletAddress,
            data.ledgerToken,
            Number(data.chipsRemaining) || 0,
            { force: true },
          );
        }
        setServerChips(Number(data.chipsRemaining) || 0);
        await refreshBalances();
        showExchangeMessage({
          ok: true,
          text: `Sent ${Number(data.tokenAmount).toLocaleString()} ${data.symbol} to your wallet.`,
          txUrl: data.signature ? solscanTxUrl(data.signature) : undefined,
        });
      } catch {
        showExchangeMessage({ ok: false, text: 'Network error — try again.' });
      } finally {
        setExchanging(null);
      }
    },
    [
      amounts,
      exchangeBlockReason,
      walletAddress,
      refreshBalances,
      refreshServerChips,
      showExchangeMessage,
      balancesLoading,
      serverChips,
      clearLocalChips,
      refreshLocalBank,
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
                Chips you win in {BRAND.depths} and the Bandit show up here automatically. Connect your wallet and
                exchange them for Fam SPL tokens below.
              </p>

              <div className="cashier-stat-row">
                <div className="cashier-stat">
                  <span className="cashier-stat-label">Bonk Chips</span>
                  <span className="cashier-stat-value cashier-stat-chips">
                    {chips.toLocaleString()}
                  </span>
                  <span className="cashier-stat-hint">
                    {connected
                      ? chips > 0
                        ? 'Ready to exchange'
                        : 'Win chips in the Depths or Bandit, then come back'
                      : 'Connect wallet to exchange for SPL tokens'}
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
                            <span className="text-[#f5e6c8]/60" title={token.mint}>
                              {token.symbol}
                            </span>
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
                  <p className="text-xs text-[#f5e6c8]/40 mt-2 break-all">
                    Full address: {walletAddress}
                  </p>
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
          serverChips={chips}
          pendingClaim={null}
          walletTokenReadyCount={walletTokenReadyCount}
          onRefresh={refreshSecurityStatus}
        />

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
              {connected && balancesLoading && (
                <p className="text-center text-[#f5e6c8]/55 mb-4 text-sm">
                  Reading Fam token accounts on Solana…
                </p>
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
                // Always clickable when not busy so users get a clear error instead of a dead button.
                const canAttempt = !isBusy;

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
                          Wallet: <strong className={walletReady ? 'text-emerald-400' : undefined}>{walletBal}</strong>
                          {walletReady && bal?.raw !== undefined && bal.raw > BigInt(0) ? ' ✓' : ''}
                        </span>
                      )}
                    </div>

                    {connected && !balancesLoading && !walletReady && (
                      <p className="cashier-coin-warning">
                        No {token.symbol} account for mint {formatMintAddress(token.mint)} on this connected wallet.
                        Confirm Phantom is on the same address and holds this CA (not a lookalike token).
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
                        {connected && (
                          <span className="cashier-cost-have">
                            {' '}
                            · you have {chips.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {blockReason && connected && (
                        <p className="cashier-coin-block-reason" role="status">
                          {blockReason}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleExchange(token.id)}
                        disabled={!canAttempt}
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
                              ? `Need ${token.symbol} account — tap for help`
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