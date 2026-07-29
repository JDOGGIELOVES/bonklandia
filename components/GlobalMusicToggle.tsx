'use client';

import { useAppAudioMute } from '@/hooks/useAppAudioMute';

/**
 * Fixed music on/off control — same corner on every page.
 * Stops all beds (Bandit lobby + Alice trip + speech) when muted.
 */
export default function GlobalMusicToggle() {
  const { muted, toggleMute } = useAppAudioMute();

  return (
    <div className="global-music-dock" role="region" aria-label="Music controls">
      <button
        type="button"
        className={`global-music-btn ${muted ? 'global-music-btn-off' : 'global-music-btn-on'}`}
        onClick={() => toggleMute()}
        aria-pressed={!muted}
        aria-label={muted ? 'Turn music and sound on' : 'Turn music and sound off'}
        title={muted ? 'Music is OFF — click to enable' : 'Music is ON — click to silence all tracks'}
      >
        <span className="global-music-icon" aria-hidden>
          {muted ? '🔇' : '🔊'}
        </span>
        <span className="global-music-label">{muted ? 'Music Off' : 'Music On'}</span>
      </button>
    </div>
  );
}
