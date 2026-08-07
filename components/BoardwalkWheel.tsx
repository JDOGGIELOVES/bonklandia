'use client';

import { useEffect, useMemo, useRef } from 'react';
import { CARNIVAL_WHEEL_SPACES, type PrizeTierId } from '@/lib/carnival/wheel';
import { playPegTick } from '@/lib/carnival/boardwalk-audio';

export type BoardwalkSpace = {
  index: number;
  label: string;
  kind: string;
  tierId: PrizeTierId;
  prizeUsd: number;
};

/** Boardwalk palette — vivid alternating wedges by prize tier. */
export const TIER_COLORS: Record<string, { fill: string; ink: string }> = {
  dead: { fill: '#3d3428', ink: '#c4b5a0' },
  low: { fill: '#6b7280', ink: '#f8fafc' },
  small: { fill: '#15803d', ink: '#ecfdf5' },
  medium: { fill: '#1d4ed8', ink: '#eff6ff' },
  big: { fill: '#7e22ce', ink: '#faf5ff' },
  jackpot: { fill: '#eab308', ink: '#1c1917' },
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
 * Boardwalk prize wheel — 32 readable wedges (months, zodiac, crypto).
 */
export default function BoardwalkWheel({ spaces, rotationDeg, spinning }: Props) {
  const n = Math.max(1, spaces.length || CARNIVAL_WHEEL_SPACES);
  const seg = 360 / n;
  const size = 640;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 292;
  const rInner = 62;
  const rLabel = 230;
  const rPeg = 300;

  const lastPegRef = useRef(-1);
  const prevRotRef = useRef(rotationDeg);

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
      const peg = Math.floor((((deg % 360) + 360) % 360) / seg);
      if (peg !== lastPegRef.current) {
        lastPegRef.current = peg;
        const speed = Math.min(1, Math.abs(deg - (prevRotRef.current % 360)) / 20);
        playPegTick(0.35 + speed * 0.55);
      }
      prevRotRef.current = deg;
    }, 32);
    return () => window.clearInterval(id);
  }, [spinning, seg, rotationDeg]);

  const wedges = useMemo(() => {
    return spaces.map((s, i) => {
      const a0 = i * seg;
      const a1 = (i + 1) * seg;
      const mid = a0 + seg / 2;
      const labelPos = polar(cx, cy, rLabel, mid);
      const colors = TIER_COLORS[s.tierId] ?? TIER_COLORS.dead!;
      const fill =
        s.tierId === 'jackpot'
          ? i % 2 === 0
            ? '#eab308'
            : '#facc15'
          : i % 2 === 0
            ? colors.fill
            : s.tierId === 'dead'
              ? '#2a241c'
              : lightenHex(colors.fill, 18);
      return {
        key: s.index,
        path: wedgePath(cx, cy, rInner, rOuter, a0, a1),
        fill,
        ink: colors.ink,
        mid,
        labelPos,
        short: s.label,
        title: `${s.label} · ${s.tierId} · $${s.prizeUsd.toFixed(2)}`,
        peg: polar(cx, cy, rPeg, a1),
        fontSize: sFont(s.label),
      };
    });
  }, [spaces, seg, cx, cy, rInner, rOuter, rLabel, rPeg]);

  return (
    <div className="boardwalk-stage" aria-label={`${n}-space carnival prize wheel`}>
      <div className="boardwalk-post" aria-hidden />
      <div className="boardwalk-wheel-frame">
        <div className={`boardwalk-flapper ${spinning ? 'boardwalk-flapper-busy' : ''}`} aria-hidden>
          <div className="boardwalk-flapper-arm" />
          <div className="boardwalk-flapper-tip" />
        </div>

        <div className="boardwalk-wood-ring" aria-hidden />

        <div
          id="boardwalk-wheel-rotor"
          className={`boardwalk-rotor ${spinning ? 'boardwalk-rotor-spinning' : ''}`}
          style={{ transform: `rotate(${rotationDeg}deg)` }}
        >
          <svg
            className="boardwalk-svg"
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label={`${n} prize spaces`}
          >
            <defs>
              <radialGradient id="boardwalk-hub-grad" cx="40%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#e8d4a8" />
                <stop offset="50%" stopColor="#a67c45" />
                <stop offset="100%" stopColor="#3d2814" />
              </radialGradient>
              <linearGradient id="boardwalk-rim-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6b4423" />
                <stop offset="35%" stopColor="#c4a574" />
                <stop offset="70%" stopColor="#8b5a2b" />
                <stop offset="100%" stopColor="#3b2410" />
              </linearGradient>
              {/* Hand-painted wood grain + brush texture */}
              <filter id="boardwalk-wood-grain" x="-5%" y="-5%" width="110%" height="110%">
                <feTurbulence type="fractalNoise" baseFrequency="0.04 0.9" numOctaves="3" seed="7" result="noise" />
                <feColorMatrix
                  in="noise"
                  type="matrix"
                  values="0 0 0 0 0.35
                          0 0 0 0 0.22
                          0 0 0 0 0.1
                          0 0 0 0.35 0"
                  result="grain"
                />
                <feBlend in="SourceGraphic" in2="grain" mode="multiply" />
              </filter>
              <filter id="boardwalk-paint" x="-10%" y="-10%" width="120%" height="120%">
                <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="3" result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" xChannelSelector="R" yChannelSelector="G" />
              </filter>
              <filter id="boardwalk-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="5" stdDeviation="7" floodOpacity="0.5" />
              </filter>
              <pattern id="boardwalk-plank" width="28" height="28" patternUnits="userSpaceOnUse">
                <rect width="28" height="28" fill="#5c3d1e" />
                <path d="M0 14 H28" stroke="#3b2410" strokeWidth="0.8" opacity="0.5" />
                <path d="M0 7 H28" stroke="#8b5a2b" strokeWidth="0.4" opacity="0.35" />
                <path d="M0 21 H28" stroke="#2a1a0c" strokeWidth="0.5" opacity="0.4" />
              </pattern>
            </defs>

            <circle cx={cx} cy={cy} r={rOuter + 24} fill="url(#boardwalk-rim-grad)" filter="url(#boardwalk-shadow)" />
            <circle cx={cx} cy={cy} r={rOuter + 18} fill="url(#boardwalk-plank)" filter="url(#boardwalk-wood-grain)" />
            <circle cx={cx} cy={cy} r={rOuter + 12} fill="none" stroke="#2a1a0c" strokeWidth="8" />
            <circle cx={cx} cy={cy} r={rOuter + 6} fill="none" stroke="#8b5a2b" strokeWidth="3" opacity="0.7" />
            <circle cx={cx} cy={cy} r={rOuter + 2} fill="#2a1a0c" />

            {wedges.map(w => (
              <g key={w.key} filter="url(#boardwalk-paint)">
                <path d={w.path} fill={w.fill} stroke="#1a1208" strokeWidth="2.2" strokeLinejoin="round" />
                <path d={w.path} fill="none" stroke="rgba(255,240,200,0.12)" strokeWidth="0.8" />
                <title>{w.title}</title>
                <text
                  x={w.labelPos.x}
                  y={w.labelPos.y}
                  fill={w.ink}
                  fontSize={w.fontSize}
                  fontWeight="800"
                  fontFamily="Georgia, 'Times New Roman', serif"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${w.mid}, ${w.labelPos.x}, ${w.labelPos.y})`}
                  style={{ pointerEvents: 'none', userSelect: 'none', paintOrder: 'stroke' }}
                  stroke="rgba(0,0,0,0.45)"
                  strokeWidth="0.6"
                >
                  {w.short}
                </text>
              </g>
            ))}

            {wedges.map(w => (
              <g key={`peg-${w.key}`}>
                <circle cx={w.peg.x} cy={w.peg.y} r={5.5} fill="#8a7a5c" stroke="#2a1a0c" strokeWidth="1.2" />
                <circle cx={w.peg.x - 1} cy={w.peg.y - 1.2} r={1.5} fill="#e8dcc0" opacity="0.75" />
              </g>
            ))}

            <circle cx={cx} cy={cy} r={rInner + 8} fill="#2a1a0c" />
            <circle
              cx={cx}
              cy={cy}
              r={rInner + 2}
              fill="url(#boardwalk-hub-grad)"
              stroke="#5c3d1e"
              strokeWidth="4"
              filter="url(#boardwalk-wood-grain)"
            />
            <text
              x={cx}
              y={cy + 6}
              textAnchor="middle"
              fill="#2a1a0c"
              fontSize="20"
              fontWeight="900"
              fontFamily="Georgia, serif"
              opacity="0.85"
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
  if (label.length <= 3) return 15;
  if (label.length <= 4) return 13;
  if (label.length <= 6) return 11;
  return 9;
}

function lightenHex(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  const r = Math.min(255, ((n >> 16) & 255) + amount);
  const g = Math.min(255, ((n >> 8) & 255) + amount);
  const b = Math.min(255, (n & 255) + amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
