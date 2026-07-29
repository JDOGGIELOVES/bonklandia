'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { AliceSymbol } from '@/lib/alice-room/symbols';

type AliceEntityPortraitProps = {
  entity: AliceSymbol;
  /** When true, load and play the Grok loop (choice screen only). */
  playVideo?: boolean;
  className?: string;
  priority?: boolean;
};

/**
 * Still PNG for reels; optional lazy video loop for encounter/choice screen.
 * Only one video loads at a time (current level) to limit bandwidth.
 */
export default function AliceEntityPortrait({
  entity,
  playVideo = false,
  className = '',
  priority = false,
}: AliceEntityPortraitProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setVideoReady(false);
    setVideoFailed(false);
  }, [entity.id, entity.video]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !playVideo || !entity.video || videoFailed) return;

    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;

    const tryPlay = () => {
      void el.play().catch(() => {
        // Autoplay blocked — poster still shows
      });
    };

    if (el.readyState >= 2) {
      setVideoReady(true);
      tryPlay();
    } else {
      const onReady = () => {
        setVideoReady(true);
        tryPlay();
      };
      el.addEventListener('canplay', onReady);
      el.addEventListener('loadeddata', onReady);
      return () => {
        el.removeEventListener('canplay', onReady);
        el.removeEventListener('loadeddata', onReady);
        el.pause();
      };
    }

    return () => {
      el.pause();
    };
  }, [playVideo, entity.video, entity.id, videoFailed]);

  if (!entity.image && !entity.video) {
    return (
      <span className={`alice-encounter-emoji ${className}`} aria-hidden>
        {entity.emoji}
      </span>
    );
  }

  return (
    <div className={`alice-entity-media ${className}`}>
      {entity.image && (
        <Image
          src={entity.image}
          alt={entity.label}
          width={720}
          height={720}
          className={`alice-encounter-portrait alice-entity-poster ${videoReady && playVideo && !videoFailed ? 'alice-entity-poster-hidden' : ''}`}
          priority={priority}
          unoptimized
        />
      )}
      {playVideo && entity.video && !videoFailed && (
        <video
          key={entity.video}
          ref={videoRef}
          className={`alice-encounter-video alice-entity-video-keyblack ${videoReady ? 'alice-encounter-video-ready' : ''}`}
          src={entity.video}
          poster={entity.image ?? undefined}
          muted
          playsInline
          loop
          autoPlay
          preload="auto"
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => setVideoReady(true)}
          onError={() => setVideoFailed(true)}
          aria-label={`${entity.label} animation`}
        />
      )}
    </div>
  );
}
