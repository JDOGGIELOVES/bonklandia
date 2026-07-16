import Phaser from 'phaser';

export class FrequencyFlowScene extends Phaser.Scene {
  private score = 0;
  private combo = 0;
  private notes: Phaser.GameObjects.Rectangle[] = [];
  private onComplete: (score: number, performance: string) => void;

  constructor(onComplete?: (score: number, performance: string) => void) {
    super({ key: 'FrequencyFlowScene' });
    this.onComplete = onComplete || (() => {});
  }

  preload() {
    this.load.image('bonga', '/assets/characters/bonga.png?v=20260715e');
    this.load.image('shadow', '/assets/enemies/shadow-entity.png');
    this.load.image('bg', '/assets/backgrounds/combat-bg.jpg');
  }

  create() {
    // Background
    this.add.image(400, 300, 'bg').setScale(1.15).setAlpha(0.85);

    // Shadow Entity at the top
    this.add.image(400, 110, 'shadow').setScale(0.55);

    // Bonga at the bottom
    this.add.image(400, 480, 'bonga').setScale(0.72);

    this.add.text(400, 50, 'FREQUENCY FLOW', {
      fontSize: '42px', 
      color: '#aaffff', 
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(400, 480, 'TAP THE FALLING NOTES!', { 
      fontSize: '24px', 
      color: '#aaffff' 
    }).setOrigin(0.5);

    this.time.addEvent({
      delay: 520,
      callback: this.spawnNote,
      callbackScope: this,
      loop: true
    });

    this.input.on('pointerdown', this.handleTap, this);

    this.time.delayedCall(22000, () => {
      const performance = this.score > 1800 ? 'Perfect' : this.score > 900 ? 'Good' : 'Miss';
      this.onComplete(this.score, performance);
      this.scene.stop();
    });
  }

  spawnNote() {
    const x = Phaser.Math.Between(150, 650);
    const note = this.add.rectangle(x, 160, 48, 48, 0x00ffff).setOrigin(0.5);
    
    this.tweens.add({
      targets: note,
      y: 420,
      duration: 1100,
      onComplete: () => {
        if (note.active) note.destroy();
      }
    });

    this.notes.push(note);
  }

  handleTap(pointer: Phaser.Input.Pointer) {
    const hitY = 420;
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const note = this.notes[i];
      if (!note.active) continue;

      const distance = Math.abs(note.y - hitY);
      
      if (distance < 55) {
        const isPerfect = distance < 22;
        this.score += isPerfect ? 125 : 65;
        this.combo++;

        this.add.text(note.x, note.y - 45, isPerfect ? 'PERFECT!' : 'GOOD', {
          fontSize: '28px', 
          color: isPerfect ? '#ffff00' : '#00ff88',
          fontStyle: 'bold'
        }).setOrigin(0.5);

        note.destroy();
        this.notes.splice(i, 1);
        break;
      }
    }
  }
}