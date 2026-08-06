'use client';

type Props = {
  spinning: boolean;
  /** When true, clown is mid-crank (spin request in flight or wheel moving). */
  active?: boolean;
};

/**
 * Boardwalk carny who “spins” the prize wheel — pure CSS/SVG, no asset pipeline.
 */
export default function CarnivalClown({ spinning, active }: Props) {
  const busy = spinning || active;
  return (
    <div
      className={`carnival-clown ${busy ? 'carnival-clown-spinning' : ''}`}
      aria-hidden
      title={busy ? 'Spinning the wheel…' : 'Your boardwalk spinner'}
    >
      <div className="carnival-clown-figure">
        {/* Hat */}
        <div className="carnival-clown-hat">
          <span className="carnival-clown-hat-pom" />
        </div>
        {/* Head */}
        <div className="carnival-clown-head">
          <span className="carnival-clown-eye carnival-clown-eye-l" />
          <span className="carnival-clown-eye carnival-clown-eye-r" />
          <span className="carnival-clown-nose" />
          <span className="carnival-clown-smile" />
        </div>
        {/* Ruff */}
        <div className="carnival-clown-ruff" />
        {/* Body */}
        <div className="carnival-clown-torso">
          <span className="carnival-clown-button" />
          <span className="carnival-clown-button" />
          <span className="carnival-clown-button" />
        </div>
        {/* Arms — right arm cranks the wheel */}
        <div className="carnival-clown-arm carnival-clown-arm-left" />
        <div className="carnival-clown-arm carnival-clown-arm-right">
          <div className="carnival-clown-crank">
            <span className="carnival-clown-crank-knob" />
          </div>
        </div>
        {/* Legs / shoes */}
        <div className="carnival-clown-legs">
          <span className="carnival-clown-leg" />
          <span className="carnival-clown-leg" />
        </div>
        <div className="carnival-clown-shoes">
          <span className="carnival-clown-shoe" />
          <span className="carnival-clown-shoe" />
        </div>
      </div>
      <p className="carnival-clown-name">Chuckles</p>
      <p className="carnival-clown-line">{busy ? 'Round she goes!' : 'Ready when you are!'}</p>
    </div>
  );
}
