import Link from 'next/link';
import BonkBankBadge from '@/components/BonkBankBadge';
import { BRAND } from '@/lib/brand';

/**
 * Home entrance: nav plaques + clear “realm paths” so Valley / Alice / Depths
 * are obvious destinations (combat is not buried under scroll alone).
 */
export default function LandingHero() {
  return (
    <header className="tavern-entrance">
      <div className="tavern-entrance-nav">
        <BonkBankBadge />
        <a href="#hall-of-champions" className="tavern-nav-plaque tavern-nav-plaque-valley">
          {BRAND.degenValleyNav}
        </a>
        <Link href="/depths" className="tavern-nav-plaque">
          {BRAND.depths}
        </Link>
        <Link href="/alice" className="tavern-nav-plaque tavern-nav-plaque-alice" title={BRAND.aliceRoom}>
          {BRAND.aliceRoomNav}
        </Link>
        <Link href="/carnival" className="tavern-nav-plaque tavern-nav-plaque-carnival" title="Carnival Wheel">
          Carnival
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
        <p className="realm-paths-sub">
          Four doors. One realm. <strong className="text-[#f0d878]">{BRAND.degenValley}</strong> is the
          classic wave fight — pick a champion below.
        </p>
        <div className="realm-paths-grid">
          <a
            href="#hall-of-champions"
            className="realm-path-card realm-path-combat realm-path-valley"
            id="degen-valley-path"
          >
            <span className="realm-path-emoji" aria-hidden>
              ⚔
            </span>
            <strong className="realm-path-name">{BRAND.degenValley}</strong>
            <p className="realm-path-blurb">
              Main game: choose a bloodline, bonk through 12 degen waves, earn chips, free Bandit on
              clear.
            </p>
            <span className="realm-path-cta">{BRAND.degenValleyCta}</span>
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
              Chamber crawl: rivals, Valley Leak degens, rest camps. Free Bandit pulls per clear.
            </p>
            <span className="realm-path-cta">Descend →</span>
          </Link>

          <Link href="/carnival" className="realm-path-card realm-path-carnival">
            <span className="realm-path-emoji" aria-hidden>
              🎡
            </span>
            <strong className="realm-path-name">Carnival Wheel</strong>
            <p className="realm-path-blurb">
              $0.25 BONGA · 63-space wheel · d6 family coin · prizes cash out only at the Cashier.
            </p>
            <span className="realm-path-cta">Spin the wheel →</span>
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
