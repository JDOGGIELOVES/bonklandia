'use client';

import { useAppAudioMute } from '@/hooks/useAppAudioMute';

/**
 * Fixed Music / SFX controls — same corner on every page.
 * Channels are independent: mute beds without killing lever/reel clicks.
 */
export default function GlobalMusicToggle() {
  const { musicMuted, sfxMuted, toggleMusic, toggleSfx } = useAppAudioMute();

  return (
    <div className="global-music-dock" role="region" aria-label="Audio controls">
      <button
        type="button"
        className={`global-music-btn ${musicMuted ? 'global-music-btn-off' : 'global-music-btn-on'}`}
        onClick={() => toggleMusic()}
        aria-pressed={!musicMuted}
        aria-label={musicMuted ? 'Turn music on' : 'Turn music off'}
        title={
          musicMuted
            ? 'Music is OFF — click to enable trip / lobby beds'
            : 'Music is ON — click to silence background tracks (SFX stay on)'
        }
      >
        <span className="global-music-icon" aria-hidden>
          {musicMuted ? '🎵' : '🎵'}
        </span>
        <span className="global-music-label">{musicMuted ? 'Music Off' : 'Music On'}</span>
      </button>
      <button
        type="button"
        className={`global-music-btn global-sfx-btn ${sfxMuted ? 'global-music-btn-off' : 'global-music-btn-on'}`}
        onClick={() => toggleSfx()}
        aria-pressed={!sfxMuted}
        aria-label={sfxMuted ? 'Turn sound effects on' : 'Turn sound effects off'}
        title={
          sfxMuted
            ? 'SFX is OFF — lever, reels, combat clicks muted'
            : 'SFX is ON — lever, reels, combat (music separate)'
        }
      >
        <span className="global-music-icon" aria-hidden>
          {sfxMuted ? '🔇' : '🔊'}
        </span>
        <span className="global-music-label">{sfxMuted ? 'SFX Off' : 'SFX On'}</span>
      </button>
    </div>
  );
}
