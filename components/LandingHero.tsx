import Link from 'next/link';
import BonkBankBadge from '@/components/BonkBankBadge';
import { BRAND } from '@/lib/brand';

export default function LandingHero() {
  return (
    <header className="tavern-entrance">
      <div className="tavern-entrance-nav">
        <BonkBankBadge />
        <Link href="/depths" className="tavern-nav-plaque">
          {BRAND.depths}
        </Link>
        <Link href="/cashier" className="tavern-nav-plaque">
          {BRAND.cashier}
        </Link>
      </div>

      <div className="tavern-sign">
        <div className="tavern-sign-chains" aria-hidden>
          <span className="tavern-sign-chain tavern-sign-chain-left" />
          <span className="tavern-sign-chain tavern-sign-chain-right" />
        </div>
        <div className="tavern-sign-board">
          <div className="tavern-sign-crest" aria-hidden>
            <span className="tavern-sign-crest-ring" />
            <span className="tavern-sign-crest-icon">⚔</span>
          </div>
          <p className="tavern-sign-motto">{BRAND.tagline}</p>
          <h1 className="tavern-sign-title">{BRAND.name}</h1>
          <div className="tavern-sign-nails" aria-hidden>
            <span /><span /><span /><span />
          </div>
          <p className="tavern-sign-sub">{BRAND.selectSubtitle}</p>
        </div>
        <div className="tavern-sign-wax" aria-hidden>✦</div>
      </div>

      <p className="tavern-entrance-prologue">{BRAND.selectHero}</p>
    </header>
  );
}