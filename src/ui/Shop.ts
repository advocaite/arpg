import Phaser from 'phaser'
import type { ItemConfig } from '@/types'

export default class ShopUI {
  private scene: Phaser.Scene
  private container?: Phaser.GameObjects.Container
  private coins: number = 0
  private items: ItemConfig[] = []
  private onBuy?: (item: ItemConfig) => boolean
  private keydown?: (e: KeyboardEvent) => void

  constructor(scene: Phaser.Scene) { this.scene = scene }

  open(title: string, coins: number, items: ItemConfig[], onBuy: (item: ItemConfig) => boolean): void {
    this.close()
    this.coins = coins
    this.items = items
    this.onBuy = onBuy

    const w = 360, h = 260
    const x = this.scene.scale.width / 2, y = this.scene.scale.height / 2
    const bg = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0.9).setStrokeStyle(1, 0xffffff, 0.2)
    const titleText = this.scene.add.text(0, -h / 2 + 16, `${title} (Coins: ${coins})`, { fontFamily: 'monospace', color: '#fff' }).setOrigin(0.5)

    const labels: Phaser.GameObjects.Text[] = []
    items.forEach((it, idx) => {
      const t = this.scene.add.text(-w / 2 + 16, -h / 2 + 40 + idx * 22, `${idx + 1}. ${it.name} [${it.rarity}]`, { fontFamily: 'monospace', color: '#ffd166' })
      t.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tryBuy(it))
      labels.push(t)
    })

    const hint = this.scene.add.text(0, h / 2 - 18, '1-9 buy | click to buy | Esc to close', { fontFamily: 'monospace', color: '#bbb' }).setOrigin(0.5)

    this.container = this.scene.add.container(x, y, [bg, titleText, ...labels, hint]).setScrollFactor(0).setDepth(2100)

    const esc = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    esc?.once('down', () => this.close())

    this.keydown = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10)
      if (!Number.isFinite(n)) return
      const idx = n - 1
      const it = this.items[idx]
      if (it) this.tryBuy(it)
    }
    this.scene.input.keyboard?.on('keydown', this.keydown)
  }

  private tryBuy(it: ItemConfig): void {
    if (this.onBuy && this.onBuy(it)) this.close()
  }

  close(): void {
    if (this.keydown) this.scene.input.keyboard?.off('keydown', this.keydown)
    this.container?.destroy(); this.container = undefined
  }
}
