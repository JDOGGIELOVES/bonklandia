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
                <stop offset="0%" stopColor="#f5e6c8" />
                <stop offset="55%" stopColor="#c4a574" />
                <stop offset="100%" stopColor="#5c3d1e" />
              </radialGradient>
              <linearGradient id="boardwalk-rim-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5a2b" />
                <stop offset="40%" stopColor="#d2a679" />
                <stop offset="100%" stopColor="#5c3d1e" />
              </linearGradient>
              <filter id="boardwalk-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.45" />
              </filter>
            </defs>

            <circle cx={cx} cy={cy} r={rOuter + 22} fill="url(#boardwalk-rim-grad)" filter="url(#boardwalk-shadow)" />
            <circle cx={cx} cy={cy} r={rOuter + 14} fill="none" stroke="#3b2410" strokeWidth="6" />
            <circle cx={cx} cy={cy} r={rOuter + 4} fill="#2a1a0c" />

            {wedges.map(w => (
              <g key={w.key}>
                <path d={w.path} fill={w.fill} stroke="#1a1208" strokeWidth="1.4" />
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
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {w.short}
                </text>
              </g>
            ))}

            {wedges.map(w => (
              <g key={`peg-${w.key}`}>
                <circle cx={w.peg.x} cy={w.peg.y} r={5} fill="#c0c0c0" stroke="#3f3f46" strokeWidth="1" />
                <circle cx={w.peg.x - 1.2} cy={w.peg.y - 1.2} r={1.4} fill="#f4f4f5" opacity="0.85" />
              </g>
            ))}

            <circle cx={cx} cy={cy} r={rInner + 6} fill="#3b2410" />
            <circle cx={cx} cy={cy} r={rInner} fill="url(#boardwalk-hub-grad)" stroke="#f0d878" strokeWidth="3" />
            <text x={cx} y={cy - 6} textAnchor="middle" fill="#3b2410" fontSize="22" fontWeight="900" fontFamily="Georgia, serif">
              SPIN
            </text>
            <text
              x={cx}
              y={cy + 16}
              textAnchor="middle"
              fill="#5c3d1e"
              fontSize="11"
              fontWeight="700"
              fontFamily="Georgia, serif"
              letterSpacing="0.12em"
            >
              {n} SPACES
            </text>
          </svg>
        </div>
      </div>
      <p className="boardwalk-caption">
        {n} big wedges · months · zodiac · crypto · flapper on the pins
      </p>
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
