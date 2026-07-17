import Link from 'next/link';
import BonkBankBadge from '@/components/BonkBankBadge';
import { BRAND } from '@/lib/brand';

export default function LandingHero() {
  return (
    <header className="landing-hero">
      <div className="landing-hero-backdrop" aria-hidden />
      <div className="landing-hero-glow landing-hero-glow-left" aria-hidden />
      <div className="landing-hero-glow landing-hero-glow-right" aria-hidden />
      <div className="landing-hero-rays" aria-hidden />

      <div className="landing-hero-nav">
        <BonkBankBadge />
        <Link href="/cashier" className="landing-nav-link">
          {BRAND.cashier}
        </Link>
      </div>

      <div className="landing-hero-emblem" aria-hidden>
        <span className="landing-hero-emblem-ring" />
        <span className="landing-hero-emblem-core">✦</span>
      </div>

      <p className="landing-hero-epigraph">{BRAND.tagline}</p>
      <h1 className="landing-hero-title">{BRAND.name}</h1>

      <div className="landing-hero-divider" aria-hidden>
        <span className="landing-hero-divider-line" />
        <span className="landing-hero-divider-gem">❖</span>
        <span className="landing-hero-divider-line" />
      </div>

      <p className="landing-hero-subtitle">{BRAND.selectSubtitle}</p>
      <p className="landing-hero-tagline">{BRAND.selectHero}</p>
    </header>
  );
}