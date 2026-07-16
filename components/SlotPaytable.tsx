'use client';

import {
  formatBonkChips,
  getMaxJackpot,
  getPaytable,
  type CasinoOutcome,
  type WinTier,
} from '@/lib/slot-machine';

type SlotPaytableProps = {
  wave: number;
  chipMultiplier?: number;
  outcome?: CasinoOutcome;
  lastWinTier: WinTier | null;
  totalWinnings: number;
};

export default function SlotPaytable({
  wave,
  chipMultiplier = 1,
  outcome = 'defeat',
  lastWinTier,
  totalWinnings,
}: SlotPaytableProps) {
  const rows = getPaytable(wave, chipMultiplier);
  const maxJackpot = getMaxJackpot(wave, chipMultiplier);

  return (
    <aside className="slot-paytable" aria-label="Slot machine winning key">
      <div className="slot-paytable-header">
        <h3 className="slot-paytable-title">Winning Key</h3>
        <p className="slot-paytable-sub">
          {outcome === 'victory' ? 'Victory' : 'Wave'} {wave} payouts in Bonk Chips
          {chipMultiplier > 1 && ` (+${Math.round((chipMultiplier - 1) * 100)}% bonus)`}
        </p>
      </div>

      <div className="slot-paytable-jackpot-callout">
        <span className="slot-paytable-jackpot-label">Max jackpot</span>
        <span className="slot-paytable-jackpot-value">{formatBonkChips(maxJackpot)}</span>
      </div>

      <ul className="slot-paytable-rows">
        {rows.map(row => (
          <li
            key={row.tier}
            className={`slot-paytable-row ${row.rowClass} ${lastWinTier === row.tier ? 'slot-paytable-row-hit' : ''}`}
          >
            <div className="slot-paytable-combo">
              <span className="slot-paytable-combo-text">{row.combo}</span>
              <span className="slot-paytable-detail">{row.detail}</span>
            </div>
            <div className="slot-paytable-payout">
              {row.payout > 0 ? (
                <>
                  <span className="slot-paytable-payout-value">+{formatBonkChips(row.payout)}</span>
                  <span className="slot-paytable-payout-unit">chips</span>
                </>
              ) : (
                <span className="slot-paytable-payout-none">—</span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="slot-paytable-session">
        <span className="slot-paytable-session-label">Session winnings</span>
        <span className="slot-paytable-session-value">{formatBonkChips(totalWinnings)} Bonk Chips</span>
      </div>
    </aside>
  );
}