import Phaser from 'phaser'

export type HoldActionOptions = {
  label: string
  durationMs: number
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  onComplete: () => void
}

export default class HoldAction {
  private scene: Phaser.Scene
  private key: Phaser.Input.Keyboard.Key
  private options: HoldActionOptions
  private heldMs = 0
  private container: Phaser.GameObjects.Container
  private bg: Phaser.GameObjects.Rectangle
  private bar: Phaser.GameObjects.Rectangle
  private text: Phaser.GameObjects.Text
  private active = true

  constructor(scene: Phaser.Scene, key: Phaser.Input.Keyboard.Key, options: HoldActionOptions) {
    this.scene = scene
    this.key = key
    this.options = options

    const x = options.position?.x ?? scene.scale.width / 2
    const y = options.position?.y ?? scene.scale.height / 2 + 80
    const width = options.size?.width ?? 220
    const height = options.size?.height ?? 18

    this.bg = scene.add.rectangle(0, 0, width, height, 0x111111, 0.8).setStrokeStyle(1, 0x333333, 1)
    this.bar = scene.add.rectangle(-width / 2, 0, 0, height - 4, 0x66ccff, 1).setOrigin(0, 0.5)
    this.text = scene.add.text(0, -24, options.label, { fontFamily: 'monospace', color: '#ffffff' }).setOrigin(0.5)

    this.container = scene.add.container(x, y, [this.bg, this.bar, this.text])
    this.container.setScrollFactor(0)
    this.container.setDepth(1500)
  }

  update(deltaMs: number): void {
    if (!this.active) return
    if (this.key.isDown) {
      this.heldMs += deltaMs
    } else {
      this.heldMs = 0
    }

    const width = this.bg.width
    const progress = Phaser.Math.Clamp(this.heldMs / this.options.durationMs, 0, 1)
    this.bar.width = (width - 4) * progress

    if (progress >= 1) {
      this.complete()
    }
  }

  private complete(): void {
    if (!this.active) return
    this.active = false
    try { this.options.onComplete() } finally {
      this.destroy()
    }
  }

  destroy(): void {
    this.container.destroy()
  }
}

