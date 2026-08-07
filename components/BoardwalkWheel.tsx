'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CARNIVAL_WHEEL_SPACES, type PrizeTierId } from '@/lib/carnival/wheel';
import { playPegTick } from '@/lib/carnival/boardwalk-audio';

export type BoardwalkSpace = {
  index: number;
  label: string;
  kind: string;
  tierId: PrizeTierId;
  prizeUsd: number;
};

/** Hand-painted carnival colors — bold, slightly uneven. */
export const TIER_COLORS: Record<string, { fill: string; fillAlt: string; ink: string }> = {
  dead: { fill: '#d2b48c', fillAlt: '#b8956a', ink: '#1a1208' },
  low: { fill: '#5ec8f0', fillAlt: '#2ea8d8', ink: '#0a1a24' },
  small: { fill: '#5edc7a', fillAlt: '#35b854', ink: '#052e16' },
  medium: { fill: '#5b8def', fillAlt: '#3b6fd4', ink: '#f0f6ff' },
  big: { fill: '#c98bf5', fillAlt: '#a855e0', ink: '#faf5ff' },
  jackpot: { fill: '#ffd84d', fillAlt: '#f0b429', ink: '#1c1400' },
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wedgePath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  a0: number,
  a1: number,
): string {
  const p0 = polar(cx, cy, rOuter, a0);
  const p1 = polar(cx, cy, rOuter, a1);
  const p2 = polar(cx, cy, rInner, a1);
  const p3 = polar(cx, cy, rInner, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return [
    `M ${p0.x} ${p0.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p3.x} ${p3.y}`,
    'Z',
  ].join(' ');
}

type Props = {
  spaces: BoardwalkSpace[];
  rotationDeg: number;
  spinning: boolean;
};

/**
 * Rickety boardwalk wheel — 20 big hand-painted wedges, metal nails, red flapper.
 */
export default function BoardwalkWheel({ spaces, rotationDeg, spinning }: Props) {
  const n = Math.max(1, spaces.length || CARNIVAL_WHEEL_SPACES);
  const seg = 360 / n;
  const size = 640;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 288;
  const rInner = 52;
  const rLabel = 210;
  const rPeg = 298;

  const lastPegRef = useRef(-1);
  const prevRotRef = useRef(rotationDeg);
  const [flapperKick, setFlapperKick] = useState(0);

  useEffect(() => {
    if (!spinning) {
      lastPegRef.current = -1;
      prevRotRef.current = rotationDeg;
      return;
    }
    const id = window.setInterval(() => {
      const el = document.getElementById('boardwalk-wheel-rotor');
      if (!el) return;
      const tr = getComputedStyle(el).transform;
      if (!tr || tr === 'none') return;
      const m = tr.match(/matrix\(([^)]+)\)/);
      if (!m) return;
      const parts = m[1]!.split(',').map(Number);
      const a = parts[0] ?? 1;
      const b = parts[1] ?? 0;
      let deg = (Math.atan2(b, a) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      // Pegs sit at segment boundaries — flapper at top (0°)
      const peg = Math.floor((((deg % 360) + 360) % 360) / seg);
      if (peg !== lastPegRef.current) {
        lastPegRef.current = peg;
        // Speed estimate from rotation delta → louder/faster clicks early in spin
        const delta = Math.abs(deg - (prevRotRef.current % 360));
        const speed = Math.min(1, delta / 14);
        playPegTick(0.45 + speed * 0.55);
        setFlapperKick(k => k + 1);
      }
      prevRotRef.current = deg;
    }, 20);
    return () => window.clearInterval(id);
  }, [spinning, seg, rotationDeg]);

  const wedges = useMemo(() => {
    return spaces.map((s, i) => {
      // Slight irregular wedge edges — hand-cut feel (tiny a0/a1 jitter for paint lines only)
      const a0 = i * seg;
      const a1 = (i + 1) * seg;
      const mid = a0 + seg / 2;
      const labelPos = polar(cx, cy, rLabel, mid);
      const colors = TIER_COLORS[s.tierId] ?? TIER_COLORS.dead!;
      const fill = i % 2 === 0 ? colors.fill : colors.fillAlt;
      // Slight per-wedge radius wobble for rickety paint
      const rJitter = rOuter + ((i * 7) % 5) - 2;
      return {
        key: s.index,
        path: wedgePath(cx, cy, rInner, rJitter, a0, a1),
        fill,
        ink: colors.ink,
        mid,
        labelPos,
        short: s.label,
        title: s.label,
        peg: polar(cx, cy, rPeg, a1),
        fontSize: sFont(s.label),
      };
    });
  }, [spaces, seg, cx, cy, rInner, rOuter, rLabel, rPeg]);

  return (
    <div className={`boardwalk-stage ${spinning ? 'boardwalk-stage-spinning' : ''}`}>
      <div className="boardwalk-post" aria-hidden />
      <div className="boardwalk-wheel-frame">
        <div
          key={flapperKick}
          className={`boardwalk-flapper ${spinning ? 'boardwalk-flapper-busy' : ''} ${flapperKick > 0 ? 'boardwalk-flapper-hit' : ''}`}
          aria-hidden
        >
          <div className="boardwalk-flapper-arm" />
          <div className="boardwalk-flapper-tip" />
        </div>

        <div
          id="boardwalk-wheel-rotor"
          className={`boardwalk-rotor ${spinning ? 'boardwalk-rotor-spinning' : ''}`}
          style={{ transform: `rotate(${rotationDeg}deg)` }}
        >
          <svg className="boardwalk-svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${n} prize spaces`}>
            <defs>
              <radialGradient id="boardwalk-hub-grad" cx="38%" cy="32%" r="68%">
                <stop offset="0%" stopColor="#f0e0c0" />
                <stop offset="40%" stopColor="#c4a574" />
                <stop offset="100%" stopColor="#4a3018" />
              </radialGradient>
              <linearGradient id="boardwalk-rim-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#5c3d1e" />
                <stop offset="30%" stopColor="#e8d4a8" />
                <stop offset="65%" stopColor="#8b5a2b" />
                <stop offset="100%" stopColor="#2a1a0c" />
              </linearGradient>
              <filter id="boardwalk-wood-grain" x="-8%" y="-8%" width="116%" height="116%">
                <feTurbulence type="fractalNoise" baseFrequency="0.035 0.75" numOctaves="4" seed="19" result="noise" />
                <feColorMatrix
                  in="noise"
                  type="matrix"
                  values="0 0 0 0 0.42
                          0 0 0 0 0.26
                          0 0 0 0 0.1
                          0 0 0 0.4 0"
                  result="grain"
                />
                <feBlend in="SourceGraphic" in2="grain" mode="multiply" />
              </filter>
              <filter id="boardwalk-paint-edge" x="-5%" y="-5%" width="110%" height="110%">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
              </filter>
              <filter id="boardwalk-shadow" x="-25%" y="-25%" width="150%" height="150%">
                <feDropShadow dx="2" dy="8" stdDeviation="10" floodOpacity="0.55" />
              </filter>
              <pattern id="boardwalk-plank" width="32" height="32" patternUnits="userSpaceOnUse">
                <rect width="32" height="32" fill="#6b4423" />
                <path d="M0 8 H32" stroke="#3b2410" strokeWidth="1.2" opacity="0.5" />
                <path d="M0 16 H32" stroke="#a67c45" strokeWidth="0.7" opacity="0.45" />
                <path d="M0 24 H32" stroke="#2a1a0c" strokeWidth="0.9" opacity="0.4" />
                <path d="M0 4 H32" stroke="#8b5a2b" strokeWidth="0.4" opacity="0.3" />
              </pattern>
            </defs>

            {/* Rickety outer wood rim */}
            <circle cx={cx} cy={cy} r={rOuter + 28} fill="url(#boardwalk-rim-grad)" filter="url(#boardwalk-shadow)" />
            <circle cx={cx} cy={cy} r={rOuter + 22} fill="url(#boardwalk-plank)" filter="url(#boardwalk-wood-grain)" />
            <circle cx={cx} cy={cy} r={rOuter + 16} fill="none" stroke="#1a1008" strokeWidth="12" />
            <circle cx={cx} cy={cy} r={rOuter + 9} fill="none" stroke="#c4a574" strokeWidth="5" opacity="0.75" />
            <circle cx={cx} cy={cy} r={rOuter + 3} fill="#1a1008" />

            {/* Hand-painted wedges */}
            <g filter="url(#boardwalk-paint-edge)">
              {wedges.map(w => (
                <g key={w.key}>
                  <path d={w.path} fill={w.fill} stroke="#1a1008" strokeWidth="3" strokeLinejoin="round" />
                  <path d={w.path} fill="none" stroke="rgba(255,248,220,0.22)" strokeWidth="1.2" />
                  <title>{w.title}</title>
                  <text
                    x={w.labelPos.x}
                    y={w.labelPos.y}
                    fill={w.ink}
                    fontSize={w.fontSize}
                    fontWeight="900"
                    fontFamily="Georgia, 'Palatino Linotype', serif"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${w.mid}, ${w.labelPos.x}, ${w.labelPos.y})`}
                    style={{ pointerEvents: 'none', userSelect: 'none', paintOrder: 'stroke' }}
                    stroke="rgba(0,0,0,0.4)"
                    strokeWidth="1"
                  >
                    {w.short}
                  </text>
                </g>
              ))}
            </g>

            {/* Metal nails at every space edge */}
            {wedges.map(w => (
              <g key={`peg-${w.key}`}>
                <circle cx={w.peg.x} cy={w.peg.y} r={7} fill="#6b7280" stroke="#1a1a1a" strokeWidth="1.6" />
                <circle cx={w.peg.x} cy={w.peg.y} r={4.2} fill="#c0c0c0" />
                <circle cx={w.peg.x - 1.4} cy={w.peg.y - 1.6} r={1.8} fill="#f8fafc" opacity="0.9" />
              </g>
            ))}

            {/* Worn wooden hub */}
            <circle cx={cx} cy={cy} r={rInner + 12} fill="#1a1008" />
            <circle
              cx={cx}
              cy={cy}
              r={rInner + 4}
              fill="url(#boardwalk-hub-grad)"
              stroke="#5c3d1e"
              strokeWidth="6"
              filter="url(#boardwalk-wood-grain)"
            />
            <circle cx={cx} cy={cy} r={rInner - 8} fill="none" stroke="#3b2410" strokeWidth="2" opacity="0.5" />
            <text
              x={cx}
              y={cy + 8}
              textAnchor="middle"
              fill="#2a1a0c"
              fontSize="24"
              fontWeight="900"
              fontFamily="Georgia, serif"
              opacity="0.9"
            >
              SPIN
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}

function sFont(label: string): number {
  if (label.length <= 3) return 18;
  if (label.length <= 4) return 16;
  if (label.length <= 5) return 14;
  return 12;
}
