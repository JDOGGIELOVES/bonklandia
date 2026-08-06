'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getEntityFx,
  type AliceTripBurst,
} from '@/lib/alice-room/entity-fx';

type AliceTripFxProps = {
  /** Current layer entity — soft ambient wash while in play. */
  ambientEntityId: string | null;
  /** One-shot transition overlay. */
  burst: AliceTripBurst | null;
  onBurstEnd?: () => void;
  /** Dim ambient when not playing. */
  active?: boolean;
};

/**
 * Full-viewport psychedelic field + personality-matched transition bursts.
 * Renders ABOVE game UI (pointer-events: none) so flashes are actually visible.
 */
export default function AliceTripFx({
  ambientEntityId,
  burst,
  onBurstEnd,
  active = true,
}: AliceTripFxProps) {
  const [liveBurst, setLiveBurst] = useState<AliceTripBurst | null>(null);
  const onEndRef = useRef(onBurstEnd);
  onEndRef.current = onBurstEnd;
  const ambient = ambientEntityId ? getEntityFx(ambientEntityId) : null;

  useEffect(() => {
    if (!burst) return;
    setLiveBurst(burst);
    const profile = getEntityFx(burst.entityId);
    const t = window.setTimeout(() => {
      setLiveBurst(cur => (cur?.key === burst.key ? null : cur));
      onEndRef.current?.();
    }, profile.durationMs);
    return () => window.clearTimeout(t);
  }, [burst]);

  const burstFx = liveBurst ? getEntityFx(liveBurst.entityId) : null;

  return (
    <div className="alice-trip-fx" aria-hidden>
      {/* Soft ambient personality wash — sits over bg, under opaque panels slightly */}
      {active && ambient ? (
        <div
          className={`alice-trip-ambient alice-vibe-${ambient.cssId}`}
          data-entity={ambient.entityId}
        >
          <div className="alice-trip-ambient-wash" />
          <div className="alice-trip-ambient-grain" />
          <div className="alice-trip-ambient-pulse" />
        </div>
      ) : null}

      {/* One-shot screen transition — highest layer, hard to miss */}
      {liveBurst && burstFx ? (
        <div
          key={liveBurst.key}
          className={[
            'alice-trip-burst',
            `alice-trip-burst-${liveBurst.mode}`,
            `alice-vibe-${burstFx.cssId}`,
          ].join(' ')}
          data-entity={burstFx.entityId}
          data-mode={liveBurst.mode}
        >
          <div className="alice-trip-burst-scrim" />
          <div className="alice-trip-burst-veil" />
          <div className="alice-trip-burst-pattern" />
          <div className="alice-trip-burst-rings" />
          <div className="alice-trip-burst-core" />
          <div className="alice-trip-burst-shards" />
          <div className="alice-trip-burst-label">{burstFx.label}</div>
        </div>
      ) : null}
    </div>
  );
}
