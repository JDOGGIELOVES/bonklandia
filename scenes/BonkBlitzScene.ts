import Phaser from 'phaser';

export class BonkBlitzScene extends Phaser.Scene {
  private score = 0;
  private combo = 0;
  private targets: Phaser.GameObjects.Rectangle[] = [];
  private onComplete: (score: number, performance: string) => void;

  constructor(onComplete?: (score: number, performance: string) => void) {
    super({ key: 'BonkBlitzScene' });
    this.onComplete = onComplete || (() => {});
  }

  preload() {
    this.load.image('bonk', '/assets/characters/bonk.png?v=20260715e');
    this.load.image('shadow', '/assets/enemies/shadow-entity.png');
  }

  create() {
    this.add.rectangle(400, 300, 800, 600, 0x0a001f);

    // Shadow Entity - Top
    this.add.image(400, 110, 'shadow').setScale(0.48);

    // Title
    this.add.text(400, 45, 'BONK BLITZ', {
      fontSize: '46px', color: '#ffcc00', fontStyle: 'bold'
    }).setOrigin(0.5);

    // Bonk - Bottom
    this.add.image(400, 470, 'bonk').setScale(0.72);

    this.time.addEvent({
      delay: 520,
      callback: this.spawnTarget,
      callbackScope: this,
      loop: true
    });

    this.input.on('pointerdown', this.handleBonk, this);

    this.time.delayedCall(20000, () => {
      const performance = this.score > 2200 ? 'Perfect' : this.score > 1100 ? 'Good' : 'Miss';
      this.onComplete(this.score, performance);
      this.scene.stop();
    });
  }

  spawnTarget() {
    const x = Phaser.Math.Between(180, 620);
    const target = this.add.rectangle(x, 260, 68, 68, 0xff2222)
      .setOrigin(0.5)
      .setStrokeStyle(8, 0xffff00);

    this.tweens.add({
      targets: target,
      y: 390,
      duration: 920,
      onComplete: () => target.destroy()
    });

    this.targets.push(target);
  }

  handleBonk(pointer: Phaser.Input.Pointer) {
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const target = this.targets[i];
      if (!target.active) continue;

      const distance = Phaser.Math.Distance.Between(pointer.x, pointer.y, target.x, target.y);

      if (distance < 65) {
        this.score += 160;
        this.combo++;

        this.add.text(target.x, target.y - 70, 'BONK!', {
          fontSize: '42px', color: '#ffff00', fontStyle: 'bold'
        }).setOrigin(0.5);

        target.destroy();
        this.targets.splice(i, 1);
        break;
      }
    }
  }
}