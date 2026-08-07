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

/**
 * Bright boardwalk paint — dead spaces are cream/tan wood, not grey sludge.
 * Prize wedges stay loud and carnival-like.
 */
export const TIER_COLORS: Record<string, { fill: string; fillAlt: string; ink: string }> = {
  dead: { fill: '#c4a574', fillAlt: '#a67c45', ink: '#1a1208' },
  low: { fill: '#38bdf8', fillAlt: '#0ea5e9', ink: '#0c1a24' },
  small: { fill: '#4ade80', fillAlt: '#22c55e', ink: '#052e16' },
  medium: { fill: '#60a5fa', fillAlt: '#2563eb', ink: '#eff6ff' },
  big: { fill: '#c084fc', fillAlt: '#a855f7', ink: '#faf5ff' },
  jackpot: { fill: '#facc15', fillAlt: '#f59e0b', ink: '#1c1917' },
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

export default function BoardwalkWheel({ spaces, rotationDeg, spinning }: Props) {
  const n = Math.max(1, spaces.length || CARNIVAL_WHEEL_SPACES);
  const seg = 360 / n;
  const size = 640;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 292;
  const rInner = 58;
  const rLabel = 228;
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
      const fill = i % 2 === 0 ? colors.fill : colors.fillAlt;
      return {
        key: s.index,
        path: wedgePath(cx, cy, rInner, rOuter, a0, a1),
        fill,
        ink: colors.ink,
        mid,
        labelPos,
        short: s.label,
        title: `${s.label} · ${s.tierId}`,
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

        <div
          id="boardwalk-wheel-rotor"
          className={`boardwalk-rotor ${spinning ? 'boardwalk-rotor-spinning' : ''}`}
          style={{ transform: `rotate(${rotationDeg}deg)` }}
        >
          <svg className="boardwalk-svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${n} prize spaces`}>
            <defs>
              <radialGradient id="boardwalk-hub-grad" cx="40%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#f5e6c8" />
                <stop offset="45%" stopColor="#c4a574" />
                <stop offset="100%" stopColor="#5c3d1e" />
              </radialGradient>
              <linearGradient id="boardwalk-rim-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5a2b" />
                <stop offset="40%" stopColor="#e8d4a8" />
                <stop offset="100%" stopColor="#3b2410" />
              </linearGradient>
              <filter id="boardwalk-wood-grain" x="-5%" y="-5%" width="110%" height="110%">
                <feTurbulence type="fractalNoise" baseFrequency="0.05 0.85" numOctaves="3" seed="11" result="noise" />
                <feColorMatrix
                  in="noise"
                  type="matrix"
                  values="0 0 0 0 0.4
                          0 0 0 0 0.25
                          0 0 0 0 0.1
                          0 0 0 0.28 0"
                  result="grain"
                />
                <feBlend in="SourceGraphic" in2="grain" mode="multiply" />
              </filter>
              <filter id="boardwalk-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="6" stdDeviation="8" floodOpacity="0.55" />
              </filter>
              <pattern id="boardwalk-plank" width="24" height="24" patternUnits="userSpaceOnUse">
                <rect width="24" height="24" fill="#6b4423" />
                <path d="M0 12 H24" stroke="#3b2410" strokeWidth="1" opacity="0.45" />
                <path d="M0 6 H24" stroke="#a67c45" strokeWidth="0.5" opacity="0.4" />
                <path d="M0 18 H24" stroke="#2a1a0c" strokeWidth="0.6" opacity="0.35" />
              </pattern>
            </defs>

            {/* Outer wooden rim */}
            <circle cx={cx} cy={cy} r={rOuter + 26} fill="url(#boardwalk-rim-grad)" filter="url(#boardwalk-shadow)" />
            <circle cx={cx} cy={cy} r={rOuter + 20} fill="url(#boardwalk-plank)" filter="url(#boardwalk-wood-grain)" />
            <circle cx={cx} cy={cy} r={rOuter + 14} fill="none" stroke="#2a1a0c" strokeWidth="10" />
            <circle cx={cx} cy={cy} r={rOuter + 7} fill="none" stroke="#d2a679" strokeWidth="4" opacity="0.85" />
            <circle cx={cx} cy={cy} r={rOuter + 2} fill="#1a1208" />

            {/* Bright painted wedges */}
            {wedges.map(w => (
              <g key={w.key}>
                <path d={w.path} fill={w.fill} stroke="#1a1208" strokeWidth="2.4" strokeLinejoin="round" />
                <path d={w.path} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
                <title>{w.title}</title>
                <text
                  x={w.labelPos.x}
                  y={w.labelPos.y}
                  fill={w.ink}
                  fontSize={w.fontSize}
                  fontWeight="900"
                  fontFamily="Georgia, 'Times New Roman', serif"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${w.mid}, ${w.labelPos.x}, ${w.labelPos.y})`}
                  style={{ pointerEvents: 'none', userSelect: 'none', paintOrder: 'stroke' }}
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth="0.7"
                >
                  {w.short}
                </text>
              </g>
            ))}

            {/* Rusty nails / pegs */}
            {wedges.map(w => (
              <g key={`peg-${w.key}`}>
                <circle cx={w.peg.x} cy={w.peg.y} r={6} fill="#a89060" stroke="#2a1a0c" strokeWidth="1.4" />
                <circle cx={w.peg.x - 1.2} cy={w.peg.y - 1.4} r={1.6} fill="#f5e6c8" opacity="0.8" />
              </g>
            ))}

            {/* Wooden hub */}
            <circle cx={cx} cy={cy} r={rInner + 10} fill="#2a1a0c" />
            <circle
              cx={cx}
              cy={cy}
              r={rInner + 3}
              fill="url(#boardwalk-hub-grad)"
              stroke="#8b5a2b"
              strokeWidth="5"
              filter="url(#boardwalk-wood-grain)"
            />
            <text
              x={cx}
              y={cy + 7}
              textAnchor="middle"
              fill="#2a1a0c"
              fontSize="22"
              fontWeight="900"
              fontFamily="Georgia, serif"
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
  if (label.length <= 3) return 16;
  if (label.length <= 4) return 14;
  if (label.length <= 6) return 12;
  return 10;
}
