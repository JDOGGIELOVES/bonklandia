'use client';

import Image from 'next/image';
import { DICE_FAMILY_COINS } from '@/lib/carnival/wheel';
import { logoImage } from '@/lib/characters';

/**
 * Physical d6: one official Fam token logo per face (faces 1–6).
 * face 1 = Bonk … face 6 = Bonnie (matches server coinForDice).
 */
const FACE_LOGOS = DICE_FAMILY_COINS.map(d => ({
  face: d.face,
  name: d.name,
  src: logoImage(`${d.coinId}.png`),
}));

/** CSS 3D cube rotations so the given face is on top (toward camera). */
const SHOW_FACE: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(0deg) rotateY(-90deg)',
  3: 'rotateX(0deg) rotateY(180deg)',
  4: 'rotateX(0deg) rotateY(90deg)',
  5: 'rotateX(-90deg) rotateY(0deg)',
  6: 'rotateX(90deg) rotateY(0deg)',
};

type Props = {
  face: number;
  rolling?: boolean;
};

export default function FamilyLogoDice({ face, rolling }: Props) {
  const safeFace = Math.min(6, Math.max(1, face || 1));
  const rot = SHOW_FACE[safeFace] ?? SHOW_FACE[1];
  const label = FACE_LOGOS.find(f => f.face === safeFace)?.name ?? 'Fam';

  return (
    <div
      className={`fam-logo-dice ${rolling ? 'fam-logo-dice-rolling' : ''}`}
      aria-label={`Family dice showing ${label} (face ${safeFace})`}
      title={`d6 face ${safeFace}: ${label}`}
    >
      <div
        className="fam-logo-dice-cube"
        style={rolling ? undefined : { transform: rot }}
      >
        {FACE_LOGOS.map(f => (
          <div
            key={f.face}
            className={`fam-logo-dice-face fam-logo-dice-face-${f.face}`}
            data-face={f.face}
          >
            <Image
              src={f.src}
              alt={f.name}
              width={72}
              height={72}
              className="fam-logo-dice-img"
              unoptimized
            />
            <span className="fam-logo-dice-num">{f.face}</span>
          </div>
        ))}
      </div>
      <p className="fam-logo-dice-caption">
        {rolling ? 'Rolling…' : `${label} · face ${safeFace}`}
      </p>
    </div>
  );
}
