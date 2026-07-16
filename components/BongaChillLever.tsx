'use client';

import Image from 'next/image';
import { characterImage } from '@/lib/characters';

const BONGACHILL_IMG = characterImage('bongachill.png');

type BongaChillLeverProps = {
  pulling: boolean;
  disabled: boolean;
  onPull: () => void;
};

export default function BongaChillLever({ pulling, disabled, onPull }: BongaChillLeverProps) {
  return (
    <button
      type="button"
      className={`bonga-chill-btn ${pulling ? 'bonga-chill-pulling' : ''} ${disabled ? 'bonga-chill-disabled' : ''}`}
      onClick={onPull}
      disabled={disabled}
      aria-label="Bonga Chill pulls the slot lever for you"
    >
      <Image
        src={BONGACHILL_IMG}
        alt="Bonga Chill"
        width={512}
        height={512}
        className="bonga-chill-img"
        priority
        unoptimized
      />
      {!disabled && !pulling && (
        <span className="bonga-chill-label">Tap Bonga Chill to BONK</span>
      )}
    </button>
  );
}