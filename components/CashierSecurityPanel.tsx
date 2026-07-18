'use client';

import { formatWalletAddress } from '@/lib/bank';
import { BRAND } from '@/lib/brand';
import { FAM_TOKENS } from '@/lib/fam-tokens';
import { getExplorerAddressUrl } from '@/lib/wallet/config';

export type TreasuryTokenRow = {
  id: string;
  symbol: string;
  accountExists: boolean;
  balance: string;
};

export type TreasurySnapshot = {
  treasury: string;
  sol: number;
  payoutsReady: boolean;
  quarterSlotReady: boolean;
  payoutsBlockedReason: string | null;
  fundedTokenCount: number;
  tokens: TreasuryTokenRow[];
  fetchedAt?: string;
  emergencyStop?: boolean;
  emergencyStopMessage?: string | null;
};

type CashierSecurityPanelProps = {
  treasury: TreasurySnapshot | null;
  treasuryLoading?: boolean;
  connected: boolean;
  serverChips: number | null;
  pendingClaim: { totalWinnings?: number } | null;
  walletTokenReadyCount: number;
  onRefresh: () => void;
};

const RULES = [
  {
    id: 'no-sol',
    label: 'No SOL prizes / transfers',
    detail:
      'Treasury never SystemProgram-sends SOL. Cashier pays only the base network fee (~0.000005 SOL) when redeeming tokens; quarter slots deposit SOL in.',
  },
  {
    id: 'no-ata',
    label: 'No token account creation',
    detail: 'You must already hold each Fam coin in your wallet before exchanging.',
  },
  {
    id: 'spl-only',
    label: 'SPL transferChecked only',
    detail: 'Every payout is a single audited token transfer — no system or ATA instructions.',
  },
  {
    id: 'chips',
    label: 'Server-verified chips',
    detail: 'Casino winnings are capped and settled on the server before you can cash out.',
  },
  {
    id: 'quarter',
    label: 'Quarter Slot deposits in only',
    detail: '25¢ SOL goes to the shared treasury — treasury never sends SOL back.',
  },
] as const;

export default function CashierSecurityPanel({
  treasury,
  treasuryLoading,
  connected,
  serverChips,
  pendingClaim,
  walletTokenReadyCount,
  onRefresh,
}: CashierSecurityPanelProps) {
  const payoutStatus = treasuryLoading
    ? 'loading'
    : treasury?.payoutsReady
      ? 'online'
      : 'offline';

  return (
    <div className="art-frame cashier-security-panel mb-8">
      <span className="art-frame-corners-tr" aria-hidden />
      <span className="art-frame-corners-bl" aria-hidden />
      <div className="p-5 md:p-6">
        <div className="cashier-security-header">
          <div>
            <h2 className="art-panel-title">🛡️ Security & Treasury</h2>
            <p className="cashier-security-sub">
              Shared treasury — Bonklandia · Bonk Miner · GrokSight — live rules and vault status
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="cashier-security-refresh art-btn py-2 px-4 text-sm text-[#f0d878]"
          >
            Refresh status
          </button>
        </div>

        {treasury?.emergencyStop ? (
          <div
            className="mb-4 rounded-lg border border-red-500/60 bg-red-950/50 px-4 py-3 text-sm text-red-100"
            role="alert"
          >
            <strong className="font-semibold">Emergency stop active.</strong>{' '}
            {treasury.emergencyStopMessage ??
              'All cashier, casino, and claim operations are offline.'}
          </div>
        ) : null}

        <div className="cashier-security-grid">
          <section className="cashier-security-section">
            <h3 className="cashier-security-section-title">Protection rules</h3>
            <ul className="cashier-security-rules">
              {RULES.map(rule => (
                <li key={rule.id} className="cashier-security-rule">
                  <span className="cashier-security-rule-check" aria-hidden>✓</span>
                  <div>
                    <span className="cashier-security-rule-label">{rule.label}</span>
                    <p className="cashier-security-rule-detail">{rule.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="cashier-security-section">
            <h3 className="cashier-security-section-title">Live status</h3>
            <div className="cashier-security-status-grid">
              <div className="cashier-security-status-card">
                <span className="cashier-security-status-label">Cashier payouts</span>
                <span className={`cashier-security-pill cashier-security-pill-${payoutStatus}`}>
                  {payoutStatus === 'loading' && 'Checking…'}
                  {payoutStatus === 'online' && 'Online'}
                  {payoutStatus === 'offline' && 'Offline'}
                </span>
              </div>
              <div className="cashier-security-status-card">
                <span className="cashier-security-status-label">Quarter Slot</span>
                <span className={`cashier-security-pill ${treasury?.quarterSlotReady ? 'cashier-security-pill-online' : 'cashier-security-pill-offline'}`}>
                  {treasury?.quarterSlotReady ? 'Accepting SOL' : 'Unavailable'}
                </span>
              </div>
              <div className="cashier-security-status-card">
                <span className="cashier-security-status-label">Fam vaults funded</span>
                <span className="cashier-security-status-value">
                  {treasury ? `${treasury.fundedTokenCount} / ${FAM_TOKENS.length}` : '—'}
                </span>
              </div>
              <div className="cashier-security-status-card">
                <span className="cashier-security-status-label">Vault SOL</span>
                <span className="cashier-security-status-value">
                  {treasury ? treasury.sol.toFixed(4) : '—'}
                </span>
              </div>
            </div>

            {treasury?.payoutsBlockedReason && (
              <p className="cashier-security-warn">{treasury.payoutsBlockedReason}</p>
            )}

            {treasury && (
              <div className="cashier-security-treasury-link mt-3">
                <span className="text-[#f5e6c8]/50 text-sm">Treasury wallet</span>
                <a
                  href={getExplorerAddressUrl(treasury.treasury)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cashier-treasury-address"
                >
                  {formatWalletAddress(treasury.treasury)}
                </a>
                {treasury.fetchedAt && (
                  <span className="cashier-security-fetched">
                    Updated {new Date(treasury.fetchedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}
          </section>

          <section className="cashier-security-section">
            <h3 className="cashier-security-section-title">Treasury token vaults</h3>
            <div className="cashier-security-vault-grid">
              {(treasury?.tokens ?? FAM_TOKENS.map(t => ({ id: t.id, symbol: t.symbol, accountExists: false, balance: '0' }))).map(
                row => (
                  <div
                    key={row.id}
                    className={`cashier-security-vault-row ${row.accountExists ? 'ready' : 'missing'}`}
                  >
                    <span className="cashier-security-vault-symbol">{row.symbol}</span>
                    <span className="cashier-security-vault-balance">
                      {row.accountExists ? row.balance : 'No account'}
                    </span>
                  </div>
                ),
              )}
            </div>
          </section>

          <section className="cashier-security-section">
            <h3 className="cashier-security-section-title">Your account</h3>
            <div className="cashier-security-account">
              <div className="cashier-security-account-row">
                <span>Wallet connected</span>
                <span className={connected ? 'text-emerald-400' : 'text-amber-400'}>
                  {connected ? 'Yes' : 'No — connect to claim & exchange'}
                </span>
              </div>
              <div className="cashier-security-account-row">
                <span>Server-verified chips</span>
                <strong className="text-[#f0d878]">
                  {connected && serverChips !== null ? serverChips.toLocaleString() : '—'}
                </strong>
              </div>
              <div className="cashier-security-account-row">
                <span>Token accounts ready</span>
                <span>
                  {connected ? `${walletTokenReadyCount} / ${FAM_TOKENS.length}` : '—'}
                </span>
              </div>
              <div className="cashier-security-account-row">
                <span>Pending casino claim</span>
                <span className={pendingClaim ? 'text-amber-300' : 'text-[#f5e6c8]/55'}>
                  {pendingClaim
                    ? pendingClaim.totalWinnings
                      ? `Yes — up to ${pendingClaim.totalWinnings.toLocaleString()} chips`
                      : 'Yes — claim above'
                    : 'None'}
                </span>
              </div>
            </div>
            {!connected && (
              <p className="cashier-security-hint mt-3">
                Connect your wallet to see verified chip balance and which Fam tokens you can receive.
              </p>
            )}
            {connected && serverChips === 0 && pendingClaim && (
              <p className="cashier-security-hint mt-3">
                You have an unclaimed casino session — use <strong>Claim verified chips</strong> in {BRAND.bank} first.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}