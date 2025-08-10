import Phaser from 'phaser'

export default class Tooltip {
  private scene: Phaser.Scene
  private bg?: Phaser.GameObjects.Rectangle
  private text?: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) { this.scene = scene }

  show(content: string, x: number, y: number): void {
    this.hide()
    const padding = 6
    this.text = this.scene.add.text(0, 0, content, { fontFamily: 'monospace', color: '#fff', fontSize: '12px', wordWrap: { width: 280 } })
    const w = this.text.width + padding * 2
    const h = this.text.height + padding * 2
    this.bg = this.scene.add.rectangle(x + w / 2, y - h / 2, w, h, 0x000000, 0.85).setStrokeStyle(1, 0xffffff, 0.2)
    this.text.setPosition(this.bg.x - this.text.width / 2, this.bg.y - this.text.height / 2)
    this.bg.setDepth(3000); this.text.setDepth(3001)
  }

  move(x: number, y: number): void {
    if (!this.bg || !this.text) return
    this.bg.setPosition(x + this.bg.width / 2, y - this.bg.height / 2)
    this.text.setPosition(this.bg.x - this.text.width / 2, this.bg.y - this.text.height / 2)
  }

  hide(): void {
    this.bg?.destroy(); this.text?.destroy(); this.bg = undefined; this.text = undefined
  }
}

