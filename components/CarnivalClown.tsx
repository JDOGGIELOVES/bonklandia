'use client';

import Image from 'next/image';

type Props = {
  spinning: boolean;
  active?: boolean;
};

const CLOWN_SRC = '/assets/carnival/boardwalk-clown.png?v=20260806clown1';

/**
 * Traditional boardwalk carnival clown (not the Alice Room jester).
 */
export default function CarnivalClown({ spinning, active }: Props) {
  const busy = spinning || active;
  return (
    <div
      className={`carnival-clown ${busy ? 'carnival-clown-spinning' : ''}`}
      aria-hidden
      title={busy ? 'Spinning the wheel…' : 'Boardwalk clown'}
    >
      <div className="carnival-clown-figure">
        <Image
          src={CLOWN_SRC}
          alt=""
          width={220}
          height={280}
          className="carnival-clown-hero-img"
          unoptimized
          priority
        />
      </div>
      <p className="carnival-clown-name">Bongo the Clown</p>
      <p className="carnival-clown-line">{busy ? 'Round she goes!' : 'Ready when you are!'}</p>
    </div>
  );
}
