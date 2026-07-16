'use client';

import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

interface PhaserGameProps {
  scene: (sceneClass?: unknown) => Phaser.Scene;
  width?: number;
  height?: number;
}

export default function PhaserGame({ scene, width = 800, height = 600 }: PhaserGameProps) {
  const gameRef = useRef<HTMLDivElement>(null);
  const gameInstance = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width,
      height,
      parent: gameRef.current,
      scene: scene(),
      backgroundColor: '#1a0033',
      physics: {
        default: 'arcade',
        arcade: { debug: false }
      }
    };

    gameInstance.current = new Phaser.Game(config);

    return () => {
      if (gameInstance.current) {
        gameInstance.current.destroy(true);
        gameInstance.current = null;
      }
    };
  }, [scene, width, height]);

  return <div ref={gameRef} className="mx-auto border-4 border-orange-500 rounded-xl overflow-hidden" />;
}