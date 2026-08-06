'use client';

import Image from 'next/image';

type Props = {
  spinning: boolean;
  /** When true, jester is mid-spin (request in flight or wheel moving). */
  active?: boolean;
};

/**
 * Boardwalk spinner — uses the real Alice jester hero portrait (not CSS cartoon).
 */
export default function CarnivalClown({ spinning, active }: Props) {
  const busy = spinning || active;
  return (
    <div
      className={`carnival-clown ${busy ? 'carnival-clown-spinning' : ''}`}
      aria-hidden
      title={busy ? 'Spinning the wheel…' : 'Carnival jester'}
    >
      <div className="carnival-clown-figure">
        <Image
          src="/assets/alice/entities/jester.png"
          alt=""
          width={220}
          height={280}
          className="carnival-clown-hero-img"
          unoptimized
          priority
        />
      </div>
      <p className="carnival-clown-name">The Jester</p>
      <p className="carnival-clown-line">{busy ? 'Round she goes!' : 'Ready when you are!'}</p>
    </div>
  );
}
