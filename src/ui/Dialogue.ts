import Phaser from 'phaser'

export type DialogueOption = {
  label: string
  onSelect: () => void
}

export default class DialogueBox {
  private scene: Phaser.Scene
  private container?: Phaser.GameObjects.Container
  private onClose?: () => void
  private keydown?: (e: KeyboardEvent) => void

  constructor(scene: Phaser.Scene) { this.scene = scene }

  open(title: string, lines: string[], options: DialogueOption[], onClose?: () => void): void {
    this.onClose = onClose
    const w = 520, h = 260
    const x = this.scene.scale.width / 2, y = this.scene.scale.height - h / 2 - 24

    const bg = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0.9).setStrokeStyle(1, 0xffffff, 0.2)
    const titleText = this.scene.add.text(0, -h / 2 + 16, title, { fontFamily: 'monospace', color: '#ffd166' }).setOrigin(0.5)

    const linesText = this.scene.add.text(-w / 2 + 16, -h / 2 + 40, lines.join('\n'), { fontFamily: 'monospace', color: '#ffffff' })
    const opts: Phaser.GameObjects.Text[] = []
    options.forEach((opt, idx) => {
      const t = this.scene.add.text(-w / 2 + 16, -h / 2 + 120 + idx * 22, `${idx + 1}. ${opt.label}`, { fontFamily: 'monospace', color: '#aaf' })
      t.setInteractive({ useHandCursor: true }).on('pointerup', () => this.select(options[idx]))
      opts.push(t)
    })

    this.container = this.scene.add.container(x, y, [bg, titleText, linesText, ...opts]).setScrollFactor(0).setDepth(2500)

    this.keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { this.close(); return }
      const n = parseInt(e.key, 10)
      if (Number.isFinite(n) && n >= 1 && n <= options.length) {
        this.select(options[n - 1])
      }
    }
    this.scene.input.keyboard?.on('keydown', this.keydown)
  }

  private select(opt: DialogueOption): void {
    try { opt.onSelect() } finally { this.close() }
  }

  close(): void {
    this.container?.destroy(); this.container = undefined
    if (this.keydown) this.scene.input.keyboard?.off('keydown', this.keydown)
    this.onClose?.()
  }
}

