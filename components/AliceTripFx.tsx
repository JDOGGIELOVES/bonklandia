'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getEntityFx,
  type AliceTripBurst,
} from '@/lib/alice-room/entity-fx';

type AliceTripFxProps = {
  /** One-shot transition overlay — entity introduction only. */
  burst: AliceTripBurst | null;
  onBurstEnd?: () => void;
};

/**
 * Full-viewport psychedelic burst for entity introductions only.
 * No continuous ambient wash (that washed out door / UI text).
 */
export default function AliceTripFx({ burst, onBurstEnd }: AliceTripFxProps) {
  const [liveBurst, setLiveBurst] = useState<AliceTripBurst | null>(null);
  const onEndRef = useRef(onBurstEnd);
  onEndRef.current = onBurstEnd;

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
  if (!liveBurst || !burstFx) {
    return <div className="alice-trip-fx alice-trip-fx-idle" aria-hidden />;
  }

  return (
    <div className="alice-trip-fx" aria-hidden>
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
    </div>
  );
}
