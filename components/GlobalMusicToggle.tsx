'use client';

import { useAppAudioMute } from '@/hooks/useAppAudioMute';

/**
 * Compact fixed Music / SFX dock — icon-first so it steals less play area.
 * Channels stay independent (beds vs lever/reel/combat clicks).
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
            ? 'Music OFF — click to enable background tracks'
            : 'Music ON — click to silence beds (SFX stay on)'
        }
      >
        <span className="global-music-icon" aria-hidden>
          {musicMuted ? '🎵' : '🎵'}
        </span>
        <span className="global-music-label">{musicMuted ? 'Off' : 'On'}</span>
      </button>
      <button
        type="button"
        className={`global-music-btn global-sfx-btn ${sfxMuted ? 'global-music-btn-off' : 'global-music-btn-on'}`}
        onClick={() => toggleSfx()}
        aria-pressed={!sfxMuted}
        aria-label={sfxMuted ? 'Turn sound effects on' : 'Turn sound effects off'}
        title={
          sfxMuted
            ? 'SFX OFF — lever, reels, combat muted'
            : 'SFX ON — clicks & combat (music separate)'
        }
      >
        <span className="global-music-icon" aria-hidden>
          {sfxMuted ? '🔇' : '🔊'}
        </span>
        <span className="global-music-label">{sfxMuted ? 'Off' : 'On'}</span>
      </button>
    </div>
  );
}
