import Phaser from 'phaser'

export default class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'Boot' }) }
  preload(): void {}
  create(): void {
    this.scene.start('Preload')
  }
}
