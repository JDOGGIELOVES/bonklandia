'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  applyMuteToAllEngines,
  isAppAudioMuted,
  setAppAudioMuted,
  subscribeAppAudioMuted,
  toggleAppAudioMuted,
} from '@/lib/global-audio';

/**
 * Shared music/SFX mute across Home, Bandit, Alice, Depths, Cashier.
 * Always reflects the same preference as the fixed global MUSIC button.
 */
export function useAppAudioMute() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const initial = isAppAudioMuted();
    setMuted(initial);
    applyMuteToAllEngines(initial);
    return subscribeAppAudioMuted(setMuted);
  }, []);

  const toggleMute = useCallback(() => toggleAppAudioMuted(), []);
  const setMute = useCallback((next: boolean) => setAppAudioMuted(next), []);

  return { muted, toggleMute, setMute };
}
