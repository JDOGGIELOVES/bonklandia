'use client';

import { useCallback, useRef, useState } from 'react';
import { getAbilitySoundType, getCombatAudioEngine } from '@/lib/combat-audio';

export function useCombatAudio() {
  const engineRef = useRef(getCombatAudioEngine());
  const [muted, setMuted] = useState(false);

  const playAttackWindup = useCallback(async (abilityId: string) => {
    const engine = engineRef.current;
    await engine.ensureContext();
    await engine.playAttackWindup(getAbilitySoundType(abilityId));
  }, []);

  const playPlayerHit = useCallback(async (abilityId: string, isCrit: boolean, damage: number) => {
    const engine = engineRef.current;
    await engine.playPlayerHit(getAbilitySoundType(abilityId), isCrit, damage);
  }, []);

  const playEnemyWindup = useCallback(async (enemyId: string) => {
    await engineRef.current.playEnemyWindup(enemyId);
  }, []);

  const playEnemyHit = useCallback(async (
    damage: number,
    enemyId: string,
    options?: { heavy?: boolean; heal?: boolean },
  ) => {
    await engineRef.current.playEnemyHit(damage, enemyId, options);
  }, []);

  const playEnemyCopeHeal = useCallback(async (enemyId: string) => {
    await engineRef.current.playEnemyCopeHeal(enemyId);
  }, []);

  const playBlock = useCallback(async () => {
    await engineRef.current.playBlock();
  }, []);

  const playWaveClear = useCallback(async () => {
    await engineRef.current.playWaveClear();
  }, []);

  const playRunComplete = useCallback(async () => {
    await engineRef.current.playRunComplete();
  }, []);

  const playWaveEnter = useCallback(async (wave: number) => {
    await engineRef.current.playWaveEnter(wave);
  }, []);

  const playRunEscalation = useCallback(async (run: number) => {
    await engineRef.current.playRunEscalation(run);
  }, []);

  const playDefeat = useCallback(async () => {
    await engineRef.current.playDefeat();
  }, []);

  const toggleMute = useCallback(() => {
    const nowMuted = engineRef.current.toggleMute();
    setMuted(nowMuted);
    return nowMuted;
  }, []);

  return {
    muted,
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