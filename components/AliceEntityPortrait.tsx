'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { AliceSymbol } from '@/lib/alice-room/symbols';
import { shouldPreferStillOverVideo } from '@/lib/alice-media';

type AliceEntityPortraitProps = {
  entity: AliceSymbol;
  /** When true, load and play the Grok loop (choice screen only). */
  playVideo?: boolean;
  className?: string;
  priority?: boolean;
};

/**
 * Still PNG first (instant); compressed loop mounts after paint.
 * Skips video on Save-Data / very slow networks.
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
  const [videoMount, setVideoMount] = useState(false);
  const [stillOnly, setStillOnly] = useState(false);

  useEffect(() => {
    setVideoReady(false);
    setVideoFailed(false);
    setVideoMount(false);
    setStillOnly(shouldPreferStillOverVideo());
  }, [entity.id, entity.video]);

  useEffect(() => {
    if (!playVideo || !entity.video || stillOnly) {
      setVideoMount(false);
      return;
    }
    let idleId: number | undefined;
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    // Slightly longer defer — still shows doors first; lite MP4s load fast after.
    const t = window.setTimeout(() => {
      if (typeof win.requestIdleCallback === 'function') {
        idleId = win.requestIdleCallback(() => setVideoMount(true), { timeout: 400 });
      } else {
        setVideoMount(true);
      }
    }, 120);
    return () => {
      window.clearTimeout(t);
      if (idleId !== undefined && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleId);
      }
    };
  }, [playVideo, entity.video, entity.id, stillOnly]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoMount || !playVideo || !entity.video || videoFailed || stillOnly) return;

    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;

    const tryPlay = () => {
      void el.play().catch(() => {
        /* Autoplay blocked — poster still shows */
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
        try {
          el.removeAttribute('src');
          el.load();
        } catch {
          /* */
        }
      };
    }

    return () => {
      el.pause();
    };
  }, [videoMount, playVideo, entity.video, entity.id, videoFailed, stillOnly]);

  if (!entity.image && !entity.video) {
    return (
      <span className={`alice-encounter-emoji ${className}`} aria-hidden>
        {entity.emoji}
      </span>
    );
  }

  const showVideoEl = playVideo && videoMount && entity.video && !videoFailed && !stillOnly;

  return (
    <div
      className={`alice-entity-media ${showVideoEl ? 'alice-entity-media-keyed' : ''} ${className}`}
    >
      {showVideoEl && <div className="alice-entity-key-stage" aria-hidden />}
      {entity.image && (
        <Image
          src={entity.image}
          alt={entity.label}
          width={720}
          height={720}
          className={`alice-encounter-portrait alice-entity-poster ${videoReady && showVideoEl ? 'alice-entity-poster-hidden' : ''}`}
          priority={priority}
          unoptimized
        />
      )}
      {showVideoEl && entity.video && (
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
          preload="metadata"
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => setVideoReady(true)}
          onError={() => setVideoFailed(true)}
          aria-label={`${entity.label} animation`}
        />
      )}
    </div>
  );
}
