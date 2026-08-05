'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAbilitySoundType, getCombatAudioEngine } from '@/lib/combat-audio';
import {
  applyAudioChannels,
  getAppAudioPrefs,
  isSfxMuted,
  setAppSfxMuted,
  subscribeAppAudioPrefs,
} from '@/lib/global-audio';

export function useCombatAudio() {
  const engineRef = useRef(getCombatAudioEngine());
  const [sfxMuted, setSfxMutedState] = useState(false);

  useEffect(() => {
    const initial = getAppAudioPrefs();
    setSfxMutedState(initial.sfxMuted);
    applyAudioChannels(initial);
    return subscribeAppAudioPrefs(p => setSfxMutedState(p.sfxMuted));
  }, []);

  const playAttackWindup = useCallback(async (abilityId: string) => {
    if (isSfxMuted()) return;
    const engine = engineRef.current;
    await engine.ensureContext();
    await engine.playAttackWindup(getAbilitySoundType(abilityId));
  }, []);

  const playPlayerHit = useCallback(async (abilityId: string, isCrit: boolean, damage: number) => {
    if (isSfxMuted()) return;
    const engine = engineRef.current;
    await engine.playPlayerHit(getAbilitySoundType(abilityId), isCrit, damage);
  }, []);

  const playEnemyWindup = useCallback(async (enemyId: string) => {
    if (isSfxMuted()) return;
    await engineRef.current.playEnemyWindup(enemyId);
  }, []);

  const playEnemyHit = useCallback(async (
    damage: number,
    enemyId: string,
    options?: { heavy?: boolean; heal?: boolean },
  ) => {
    if (isSfxMuted()) return;
    await engineRef.current.playEnemyHit(damage, enemyId, options);
  }, []);

  const playEnemyCopeHeal = useCallback(async (enemyId: string) => {
    if (isSfxMuted()) return;
    await engineRef.current.playEnemyCopeHeal(enemyId);
  }, []);

  const playBlock = useCallback(async () => {
    if (isSfxMuted()) return;
    await engineRef.current.playBlock();
  }, []);

  const playWaveClear = useCallback(async () => {
    if (isSfxMuted()) return;
    await engineRef.current.playWaveClear();
  }, []);

  const playRunComplete = useCallback(async () => {
    if (isSfxMuted()) return;
    await engineRef.current.playRunComplete();
  }, []);

  const playWaveEnter = useCallback(async (wave: number) => {
    if (isSfxMuted()) return;
    await engineRef.current.playWaveEnter(wave);
  }, []);

  const playRunEscalation = useCallback(async (run: number) => {
    if (isSfxMuted()) return;
    await engineRef.current.playRunEscalation(run);
  }, []);

  const playDefeat = useCallback(async () => {
    if (isSfxMuted()) return;
    await engineRef.current.playDefeat();
  }, []);

  const toggleMute = useCallback(() => {
    const next = !isSfxMuted();
    setAppSfxMuted(next);
    setSfxMutedState(next);
    return next;
  }, []);

  return {
    muted: sfxMuted,
    sfxMuted,
    playAttackWindup,
    playPlayerHit,
    playEnemyWindup,
    playEnemyHit,
    playEnemyCopeHeal,
    playBlock,
    playWaveClear,
    playRunComplete,
    playWaveEnter,
    playRunEscalation,
    playDefeat,
    toggleMute,
  };
}
