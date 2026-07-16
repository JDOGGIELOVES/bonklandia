'use client';

type CombatArenaVfxProps = {
  speedLines: boolean;
  impact: boolean;
  impactTarget: 'enemy' | 'player';
  impactKey: number;
  blockFlash: boolean;
  healPulse: boolean;
};

export default function CombatArenaVfx({
  speedLines,
  impact,
  impactTarget,
  impactKey,
  blockFlash,
  healPulse,
}: CombatArenaVfxProps) {
  return (
    <>
      <div className={`combat-speed-lines ${speedLines ? 'combat-speed-lines-active' : ''}`} aria-hidden>
        <span className="combat-speed-line combat-speed-line-1" />
        <span className="combat-speed-line combat-speed-line-2" />
        <span className="combat-speed-line combat-speed-line-3" />
        <span className="combat-speed-line combat-speed-line-4" />
      </div>

      {impact && (
        <div
          className={`combat-impact-ring combat-impact-ring-${impactTarget}`}
          key={`impact-${impactTarget}-${impactKey}`}
          aria-hidden
        />
      )}

      {impact && (
        <div className={`combat-impact-slash combat-impact-slash-${impactTarget}`} aria-hidden>
          <span />
          <span />
        </div>
      )}

      <div className={`combat-block-shield ${blockFlash ? 'combat-block-shield-active' : ''}`} aria-hidden>
        <span className="combat-block-shield-ring" />
        <span className="combat-block-shield-text">BLOCKED!</span>
      </div>

      <div className={`combat-heal-pulse ${healPulse ? 'combat-heal-pulse-active' : ''}`} aria-hidden />
    </>
  );
}