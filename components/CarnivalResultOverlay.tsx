'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { FamCoinId } from '@/lib/fam-tokens';
import { getFamToken } from '@/lib/fam-tokens';
import type { PrizeTierId } from '@/lib/carnival/wheel';
import { TIER_COLORS } from '@/components/BoardwalkWheel';

export type CarnivalResult = {
  wheelLabel: string;
  tierId: PrizeTierId;
  prizeUsd: number;
  diceFace: number;
  coinId: FamCoinId;
  coinName: string;
  chips: number;
};

type Props = {
  result: CarnivalResult;
  chipsCredited: number;
  onPlayAgain: () => void;
  onDismiss: () => void;
};

/**
 * Full-screen win/lose fanfare — instant readable outcome after the spin.
 */
export default function CarnivalResultOverlay({
  result,
  chipsCredited,
  onPlayAgain,
  onDismiss,
}: Props) {
  const won = result.prizeUsd > 0 && chipsCredited > 0;
  const jackpot = result.tierId === 'jackpot';
  const big = result.tierId === 'big' || jackpot;
  const coinImg = getFamToken(result.coinId)?.img;
  const tierColor = TIER_COLORS[result.tierId]?.fill ?? '#f0d878';

  return (
    <div
      className={`carnival-result-overlay ${won ? 'carnival-result-win' : 'carnival-result-lose'} ${jackpot ? 'carnival-result-jackpot' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="carnival-result-title"
    >
      <div className="carnival-result-burst" aria-hidden />
      <div className="carnival-result-card">
        <p className="carnival-result-kicker" style={{ color: tierColor }}>
          {jackpot ? '★ JACKPOT ★' : won ? (big ? 'BIG WIN' : 'YOU WIN') : 'NO PRIZE'}
        </p>
        <h2 id="carnival-result-title" className="carnival-result-headline">
          {won
            ? jackpot
              ? 'JACKPOT!'
              : `+$${result.prizeUsd.toFixed(2)}`
            : 'Dead spin'}
        </h2>

        {won ? (
          <p className="carnival-result-sub">
            <strong>{chipsCredited}</strong> spendable chips toward{' '}
            <strong>{result.coinName}</strong>
          </p>
        ) : (
          <p className="carnival-result-sub">
            The flapper landed on a dead space. Better luck next spin!
          </p>
        )}

        <div className="carnival-result-details">
          <div className="carnival-result-chip">
            <span className="carnival-result-chip-label">Wheel</span>
            <strong>{result.wheelLabel}</strong>
            <span className="carnival-result-tier" style={{ color: tierColor }}>
              {result.tierId}
            </span>
          </div>
          <div className="carnival-result-chip">
            <span className="carnival-result-chip-label">Coin</span>
            <strong>{result.coinName}</strong>
            {coinImg && (
              <Image
                src={coinImg}
                alt={result.coinName}
                width={56}
                height={56}
                className="carnival-result-coin"
                unoptimized
              />
            )}
          </div>
        </div>

        <div className="carnival-result-actions">
          {won && (
            <Link href="/cashier" className="art-btn carnival-cashier-btn carnival-result-primary">
              Cash out →
            </Link>
          )}
          <button type="button" className="art-btn carnival-result-primary" onClick={onPlayAgain}>
            Spin again
          </button>
          <button type="button" className="art-btn carnival-result-secondary" onClick={onDismiss}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
