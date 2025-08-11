import Phaser from 'phaser'
import type { ItemConfig, ItemInstance } from '@/types'
import Tooltip from '@/ui/Tooltip'
import { getItem, getItemValue, computeSellValue, rarityToColor } from '@/systems/ItemDB'

export default class ShopUI {
  private scene: Phaser.Scene
  private container?: Phaser.GameObjects.Container
  private coins: number = 0
  private items: ItemConfig[] = []
  private onBuy?: (item: ItemConfig) => boolean
  private onSell?: (index: number) => boolean
  private keydown?: (e: KeyboardEvent) => void
  private tooltip?: Tooltip
  private mode: 'root' | 'buy' | 'sell' = 'root'
  private onCloseCb?: () => void

  constructor(scene: Phaser.Scene) { this.scene = scene }

  open(title: string, coins: number, items: ItemConfig[], onBuy: (item: ItemConfig) => boolean, onSell?: (index: number) => boolean, mode: 'root' | 'buy' | 'sell' = 'root', onClose?: () => void): void {
    this.close()
    this.coins = coins
    this.items = items
    this.onBuy = onBuy
    this.onSell = onSell
    this.mode = mode
    this.onCloseCb = onClose

    const w = 600, h = 300
    const x = this.scene.scale.width / 2, y = this.scene.scale.height / 2
    const bg = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0.9).setStrokeStyle(1, 0xffffff, 0.2)
    const titleText = this.scene.add.text(0, -h / 2 + 16, `${title} (Coins: ${coins})`, { fontFamily: 'monospace', color: '#fff' }).setOrigin(0.5)

    // Two-step menu: root options (Buy, Sell), then scrollable lists
    const openBuyWindow = () => { this.close(); const ui = new ShopUI(this.scene); ui.open('Shop - Buy', this.coins, this.items, this.onBuy!, this.onSell, 'buy', this.onCloseCb) }
    const openSellWindow = () => { this.close(); const ui = new ShopUI(this.scene); ui.open('Shop - Sell', this.coins, this.items, this.onBuy!, this.onSell, 'sell', this.onCloseCb) }
    const rootBuy = this.scene.add.text(-w / 2 + 16, -h / 2 + 40, 'Buy Items', { fontFamily: 'monospace', color: '#ffd166' })
    rootBuy.setInteractive({ useHandCursor: true })
    rootBuy.on('pointerdown', () => openBuyWindow())
    rootBuy.on('pointerup', () => openBuyWindow())
    const rootSell = this.scene.add.text(-w / 2 + 16, -h / 2 + 62, 'Sell Items', { fontFamily: 'monospace', color: '#66ff99' })
    rootSell.setInteractive({ useHandCursor: true })
    rootSell.on('pointerdown', () => openSellWindow())
    rootSell.on('pointerup', () => openSellWindow())

    const listContainer = this.scene.add.container(-w / 2 + 16, -h / 2 + 86)
    // Temporarily omit masking to avoid coordinate mismatch; can reintroduce later with container-local mask

    const labels: Phaser.GameObjects.Text[] = []
    const sellLines: Phaser.GameObjects.Text[] = []
    const rebuildBuy = () => {
      labels.forEach(t => t.destroy()); labels.length = 0
      items.forEach((it, idx) => {
        const t = this.scene.add.text(0, idx * 20, `${idx + 1}. ${it.name} [${it.rarity}]`, { fontFamily: 'monospace', color: '#ffd166' })
        t.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tryBuy(it))
        t.on('pointerover', (p: Phaser.Input.Pointer) => {
          if (!this.tooltip) this.tooltip = new Tooltip(this.scene)
          const content = this.formatBaseItemTooltip(it)
          const border = rarityToColor(it.rarity)
          this.tooltip.show(content, p.worldX, p.worldY, { borderColor: border })
        })
        t.on('pointerout', () => { this.tooltip?.hide() })
        labels.push(t)
      })
      listContainer.removeAll(true)
      listContainer.add(labels)
    }
    const rebuildSell = () => {
      sellLines.forEach(t => t.destroy()); sellLines.length = 0
      const inv: ItemInstance[] = (this.scene as any).inventory || []
      this.tooltip = new Tooltip(this.scene)
      inv.forEach((inst, i) => {
        if (!inst) return
        const cfg = getItem(inst.itemId)
        if (!cfg) return
        const value = computeSellValue(inst)
        const label = `${i + 1}. ${cfg.name} [${cfg.rarity}] - ${value}c`
        const tx = this.scene.add.text(0, i * 20, label, { fontFamily: 'monospace', color: '#fff' })
        tx.setInteractive({ useHandCursor: true }).on('pointerup', () => this.trySell(i))
        tx.on('pointerover', (p: Phaser.Input.Pointer) => { try { (this.scene as any).invUI?.showTooltip?.(i, p) } catch {} })
        tx.on('pointerout', () => { try { (this.scene as any).invUI?.tooltip?.hide?.() } catch {} })
        sellLines.push(tx)
      })
      listContainer.removeAll(true)
      listContainer.add(sellLines)
    }

    const showBuy = () => { this.mode = 'buy'; rebuildBuy() }
    const showSell = () => { this.mode = 'sell'; rebuildSell() }

    const hint = this.scene.add.text(0, h / 2 - 18, 'Buy/Sell | Scroll list with mouse | Esc to close', { fontFamily: 'monospace', color: '#bbb' }).setOrigin(0.5)

    const children: Phaser.GameObjects.GameObject[] = [bg, titleText]
    if (this.mode === 'root') { children.push(rootBuy, rootSell) }
    else if (this.mode === 'buy') { rebuildBuy(); children.push(listContainer) }
    else if (this.mode === 'sell') { rebuildSell(); children.push(listContainer) }
    children.push(hint)
    this.container = this.scene.add.container(x, y, children).setScrollFactor(0).setDepth(2100)
    // Enable wheel scroll
    this.scene.input.on('wheel', (_p: any, _dx: number, dy: number) => {
      if (this.mode === 'root') return
      listContainer.y -= Math.sign(dy) * 20
    })

    const esc = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    esc?.once('down', () => { this.close(); try { (this.scene as any).__suppressEscUntil = (this.scene as any).time?.now + 150 } catch {} })

    this.keydown = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10)
      if (!Number.isFinite(n)) return
      if (this.mode === 'root') {
        if (n === 1) { openBuyWindow(); return }
        if (n === 2) { openSellWindow(); return }
        return
      }
      if (this.mode === 'buy') {
        const idx = n - 1
        const it = this.items[idx]
        if (it) this.tryBuy(it)
        return
      }
      if (this.mode === 'sell') {
        const idx = n - 1
        this.trySell(idx)
        return
      }
    }
    this.scene.input.keyboard?.on('keydown', this.keydown)
  }

  private tryBuy(it: ItemConfig): void {
    if (this.onBuy && this.onBuy(it)) this.close()
  }

  private trySell(index: number): void {
    if (this.onSell && this.onSell(index)) this.close()
  }

  close(): void {
    if (this.keydown) this.scene.input.keyboard?.off('keydown', this.keydown)
    this.container?.destroy(); this.container = undefined
    try { this.tooltip?.hide() } catch {}
    try { this.onCloseCb?.() } catch {}
  }

  private formatBaseItemTooltip(it: ItemConfig): string {
    const lines: string[] = []
    lines.push(`${it.name} [${it.rarity}]`)
    const p = it.params || {}
    const entries = Object.entries(p).filter(([_, v]) => typeof v === 'number' || typeof v === 'string').map(([k, v]) => `- ${k}: ${v}`)
    if (entries.length) lines.push(entries.join('\n'))
    const base = getItemValue(it.id)
    if (base > 0) lines.push(`\nBase Value: ${base} coins`)
    return lines.join('\n')
  }
}
