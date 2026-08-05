import Link from 'next/link';
import BonkBankBadge from '@/components/BonkBankBadge';
import { BRAND } from '@/lib/brand';

/**
 * Home entrance: nav plaques + clear “realm paths” so Alice / Depths / combat
 * are obvious destinations (not buried next to the champion grid).
 */
export default function LandingHero() {
  return (
    <header className="tavern-entrance">
      <div className="tavern-entrance-nav">
        <BonkBankBadge />
        <Link href="/depths" className="tavern-nav-plaque">
          {BRAND.depths}
        </Link>
        <Link href="/alice" className="tavern-nav-plaque tavern-nav-plaque-alice" title={BRAND.aliceRoom}>
          {BRAND.aliceRoomNav}
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
            <span />
            <span />
            <span />
            <span />
          </div>
          <p className="tavern-sign-sub">{BRAND.selectSubtitle}</p>
        </div>
        <div className="tavern-sign-wax" aria-hidden>
          ✦
        </div>
      </div>

      <p className="tavern-entrance-prologue">{BRAND.selectHero}</p>

      <section className="realm-paths" aria-label="Paths through Bonklandia">
        <h2 className="realm-paths-title">Where will you go?</h2>
        <p className="realm-paths-sub">Three doors. One realm. Pick a path — or scroll to the Hall of Champions.</p>
        <div className="realm-paths-grid">
          <a href="#hall-of-champions" className="realm-path-card realm-path-combat">
            <span className="realm-path-emoji" aria-hidden>
              ⚔
            </span>
            <strong className="realm-path-name">Hall of Champions</strong>
            <p className="realm-path-blurb">
              Pick a bloodline and bonk through Degen Valley. Earn chips. Free Bandit pulls on floors.
            </p>
            <span className="realm-path-cta">Choose champion ↓</span>
          </a>

          <Link href="/alice" className="realm-path-card realm-path-alice">
            <span className="realm-path-emoji" aria-hidden>
              🍄
            </span>
            <strong className="realm-path-name">{BRAND.aliceRoomNav}</strong>
            <p className="realm-path-blurb">
              {BRAND.aliceRoom}: pull for coins, pull for shield, doors if you miss. Bank only after The
              Other.
            </p>
            <span className="realm-path-cta">Enter Alice Machine →</span>
          </Link>

          <Link href="/depths" className="realm-path-card realm-path-depths">
            <span className="realm-path-emoji" aria-hidden>
              🕳
            </span>
            <strong className="realm-path-name">{BRAND.depths}</strong>
            <p className="realm-path-blurb">
              Chamber crawl with rival mascots. Clear rooms for free Bandit spins and chip rewards.
            </p>
            <span className="realm-path-cta">Descend →</span>
          </Link>

          <Link href="/cashier" className="realm-path-card realm-path-cashier">
            <span className="realm-path-emoji" aria-hidden>
              🏦
            </span>
            <strong className="realm-path-name">{BRAND.cashier}</strong>
            <p className="realm-path-blurb">
              Server-ledger chips only. Micro-prize cashouts to Fam tokens. Wallet required.
            </p>
            <span className="realm-path-cta">Open Cashier →</span>
          </Link>
        </div>
      </section>
    </header>
  );
}
