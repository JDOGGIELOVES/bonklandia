'use client';

import { useCallback } from 'react';
import PhaserGame from '@/lib/phaser/PhaserGame';
import { BonkBlitzScene } from '@/scenes/BonkBlitzScene';
import { FrequencyFlowScene } from '@/scenes/FrequencyFlowScene';

interface MiniGamePanelProps {
  game: 'bonk' | 'bonga';
  onComplete: (score: number, performance: string) => void;
  width?: number;
  height?: number;
}

export default function MiniGamePanel({
  game,
  onComplete,
  width = 780,
  height = 520,
}: MiniGamePanelProps) {
  const createScene = useCallback(() => {
    if (game === 'bonk') return new BonkBlitzScene(onComplete);
    return new FrequencyFlowScene(onComplete);
  }, [game, onComplete]);

  return <PhaserGame scene={createScene} width={width} height={height} />;
}