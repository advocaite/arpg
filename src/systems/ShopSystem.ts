export type Upgrade = {
  id: string
  label: string
  cost: number
  apply: () => void
}

export default class ShopSystem {
  private scene: Phaser.Scene
  private upgrades: Upgrade[]
  private container?: Phaser.GameObjects.Container
  private visible = false
  private onOpen?: () => void
  private onClose?: () => void
  private getCoins: () => number
  private spendCoins: (amount: number) => boolean

  constructor(scene: Phaser.Scene, upgrades: Upgrade[], getCoins: () => number, spendCoins: (amount: number) => boolean) {
    this.scene = scene
    this.upgrades = upgrades
    this.getCoins = getCoins
    this.spendCoins = spendCoins
  }

  isOpen(): boolean { return this.visible }

  setHooks(onOpen?: () => void, onClose?: () => void): void {
    this.onOpen = onOpen
    this.onClose = onClose
  }

  toggle(): void {
    if (this.visible) {
      this.hide()
    } else {
      this.show()
    }
  }

  show(): void {
    if (this.visible) return
    const width = 320
    const height = 180
    const x = this.scene.scale.width / 2
    const y = this.scene.scale.height / 2

    const bg = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.8).setStrokeStyle(1, 0xffffff, 0.2)
    const title = this.scene.add.text(0, -height / 2 + 16, `Shop (Coins: ${this.getCoins()})`, { fontFamily: 'monospace', color: '#fff' }).setOrigin(0.5)

    const labels: Phaser.GameObjects.Text[] = []
    this.upgrades.forEach((u, idx) => {
      const t = this.scene.add.text(-width / 2 + 12, -height / 2 + 40 + idx * 24, `${idx + 1}. ${u.label} ($${u.cost})`, {
        fontFamily: 'monospace',
        color: this.getCoins() >= u.cost ? '#ffd166' : '#777'
      })
      labels.push(t)
    })

    this.container = this.scene.add.container(x, y, [bg, title, ...labels]).setDepth(2000)
    this.container.setScrollFactor(0)

    // Hotkeys 1..N to buy
    this.scene.input.keyboard?.on('keydown', this.onKeyDown)

    this.visible = true
    this.onOpen?.()
  }

  hide(): void {
    if (!this.visible) return
    this.container?.destroy()
    this.container = undefined
    this.visible = false
    this.scene.input.keyboard?.off('keydown', this.onKeyDown)
    this.onClose?.()
  }

  private onKeyDown = (ev: KeyboardEvent) => {
    const index = parseInt(ev.key, 10)
    if (!Number.isFinite(index)) return
    const idx = index - 1
    const upgrade = this.upgrades[idx]
    if (!upgrade) return

    // Attempt purchase
    if (this.getCoins() >= upgrade.cost) {
      if (this.spendCoins(upgrade.cost)) {
        upgrade.apply()
        // Refresh
        this.hide()
        this.show()
      }
    }
  }
}
