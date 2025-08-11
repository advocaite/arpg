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
  private titleText?: Phaser.GameObjects.Text
  private toast?: Phaser.GameObjects.Text
  private widthPx: number = 600
  private heightPx: number = 300
  private listContainer?: Phaser.GameObjects.Container
  private listMaskG?: Phaser.GameObjects.Graphics
  private viewHeightPx: number = 0
  private contentHeightPx: number = 0
  private listTexts: Phaser.GameObjects.Text[] = []
  private selectedIndex: number = 0

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
    this.widthPx = w; this.heightPx = h
    this.viewHeightPx = h - 140
    const x = this.scene.scale.width / 2, y = this.scene.scale.height / 2
    const bg = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0.9).setStrokeStyle(1, 0xffffff, 0.2)
    const titleText = this.scene.add.text(0, -h / 2 + 16, `${title} (Coins: ${this.coins})`, { fontFamily: 'monospace', color: '#fff' }).setOrigin(0.5)
    this.titleText = titleText

    // Two-step menu: root options (Buy, Sell), then scrollable lists
    const openBuyWindow = () => { this.close(); this.open('Shop - Buy', this.coins, this.items, this.onBuy!, this.onSell, 'buy', this.onCloseCb) }
    const openSellWindow = () => { this.close(); this.open('Shop - Sell', this.coins, this.items, this.onBuy!, this.onSell, 'sell', this.onCloseCb) }
    const openRootWindow = () => { this.close(); this.open('Shop', this.coins, this.items, this.onBuy!, this.onSell, 'root', this.onCloseCb) }
    const rootBuy = this.scene.add.text(-w / 2 + 16, -h / 2 + 40, 'Buy Items', { fontFamily: 'monospace', color: '#ffd166' })
    rootBuy.setInteractive({ useHandCursor: true })
    rootBuy.on('pointerdown', () => openBuyWindow())
    rootBuy.on('pointerup', () => openBuyWindow())
    const rootSell = this.scene.add.text(-w / 2 + 16, -h / 2 + 62, 'Sell Items', { fontFamily: 'monospace', color: '#66ff99' })
    rootSell.setInteractive({ useHandCursor: true })
    rootSell.on('pointerdown', () => openSellWindow())
    rootSell.on('pointerup', () => openSellWindow())

    const listContainer = this.scene.add.container(-w / 2 + 16, -h / 2 + 86)
    this.listContainer = listContainer

    const labels: Phaser.GameObjects.Text[] = []
    const sellLines: Phaser.GameObjects.Text[] = []
    const rebuildBuy = () => {
      labels.forEach(t => t.destroy()); labels.length = 0
      items.forEach((it, idx) => {
        const t = this.scene.add.text(0, idx * 20, `${idx + 1}. ${it.name} [${it.rarity}]`, { fontFamily: 'monospace', color: '#ffd166' })
        t.setInteractive({ useHandCursor: true })
        t.on('pointerup', () => { this.selectedIndex = idx; this.applySelectionStyles('#ffd166'); this.tryBuy(it) })
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
      this.listTexts = labels
      this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, labels.length - 1))
      this.contentHeightPx = labels.length * 20
      this.applySelectionStyles('#ffd166')
      this.scrollToSelected(h)
      const maxY = -h / 2 + 86
      const minY = maxY - Math.max(0, this.contentHeightPx - this.viewHeightPx)
      listContainer.y = Phaser.Math.Clamp(listContainer.y, minY, maxY)
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
        tx.setInteractive({ useHandCursor: true }).on('pointerup', () => { this.selectedIndex = i; this.applySelectionStyles('#fff'); this.trySell(i) })
        tx.on('pointerover', (p: Phaser.Input.Pointer) => { try { (this.scene as any).invUI?.showTooltip?.(i, p) } catch {} })
        tx.on('pointerout', () => { try { (this.scene as any).invUI?.tooltip?.hide?.() } catch {} })
        sellLines.push(tx)
      })
      listContainer.removeAll(true)
      listContainer.add(sellLines)
      this.listTexts = sellLines
      this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, sellLines.length - 1))
      this.contentHeightPx = sellLines.length * 20
      this.applySelectionStyles('#fff')
      this.scrollToSelected(h)
      const maxY = -h / 2 + 86
      const minY = maxY - Math.max(0, this.contentHeightPx - this.viewHeightPx)
      listContainer.y = Phaser.Math.Clamp(listContainer.y, minY, maxY)
    }

    const showBuy = () => { this.mode = 'buy'; rebuildBuy() }
    const showSell = () => { this.mode = 'sell'; rebuildSell() }

    const hint = this.scene.add.text(0, h / 2 - 18, 'Buy/Sell | Scroll list with mouse | Esc to close', { fontFamily: 'monospace', color: '#bbb' }).setOrigin(0.5)

    const children: Phaser.GameObjects.GameObject[] = [bg, titleText]
    if (this.mode === 'root') { children.push(rootBuy, rootSell) }
    else if (this.mode === 'buy') { rebuildBuy(); children.push(listContainer) }
    else if (this.mode === 'sell') { rebuildSell(); children.push(listContainer) }
    // Add a Back button in non-root modes
    if (this.mode !== 'root') {
      const back = this.scene.add.text(-w / 2 + 16, -h / 2 + 16, '< Back', { fontFamily: 'monospace', color: '#bbb' })
      back.setInteractive({ useHandCursor: true })
      back.on('pointerdown', () => openRootWindow())
      back.on('pointerup', () => openRootWindow())
      children.push(back)
    }
    children.push(hint)
    this.container = this.scene.add.container(x, y, children).setScrollFactor(0).setDepth(2100)
    // Note: We temporarily disable masking here to avoid hiding content on some devices.
    // If needed, we can re-enable a geometry mask later once coordinates are fully validated.
    // Enable wheel scroll
    this.scene.input.on('wheel', (_p: any, _dx: number, dy: number) => {
      if (this.mode === 'root') return
      const step = Math.sign(dy) * 20
      const maxY = -h / 2 + 86
      const minY = maxY - Math.max(0, this.contentHeightPx - this.viewHeightPx)
      listContainer.y = Phaser.Math.Clamp(listContainer.y - step, minY, maxY)
    })

    const esc = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    esc?.once('down', () => { this.close(); try { (this.scene as any).__suppressEscUntil = (this.scene as any).time?.now + 150 } catch {} })

    this.keydown = (e: KeyboardEvent) => {
      if (this.mode !== 'root' && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
        const total = this.listTexts.length
        if (total > 0) {
          if (e.key === 'ArrowUp') {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1)
            this.applySelectionStyles(this.mode === 'buy' ? '#ffd166' : '#fff')
            this.scrollToSelected(h)
            return
          }
          if (e.key === 'ArrowDown') {
            this.selectedIndex = Math.min(total - 1, this.selectedIndex + 1)
            this.applySelectionStyles(this.mode === 'buy' ? '#ffd166' : '#fff')
            this.scrollToSelected(h)
            return
          }
          if (e.key === 'Enter') {
            if (this.mode === 'sell') this.trySell(this.selectedIndex)
            else if (this.mode === 'buy') {
              const it = this.items[this.selectedIndex]
              if (it) this.tryBuy(it)
            }
            return
          }
        }
      }
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
    const ok = this.onBuy ? this.onBuy(it) : false
    const msg = ok ? `Purchased ${it.name}` : 'Not enough coins'
    this.showToast(msg, ok ? '#66ff99' : '#ff6666')
  }

  private trySell(index: number): void {
    // Pre-compute label and value from current inventory before mutating
    let label = 'Cannot sell'
    try {
      const inv: ItemInstance[] = (this.scene as any).inventory || []
      const inst = inv[index]
      if (inst) {
        const cfg = getItem(inst.itemId)
        const value = computeSellValue(inst)
        if (cfg) label = `Sold ${cfg.name} +${value}c`; else label = `Sold +${value}c`
      }
    } catch {}
    const ok = this.onSell ? this.onSell(index) : false
    this.showToast(ok ? label : 'Cannot sell', ok ? '#66ff99' : '#ff6666')
    if (ok && this.mode === 'sell') {
      // Rebuild sell list to reflect updated inventory and indices
      try {
        const lc = this.listContainer
        if (lc) {
          // Preserve current scroll relative position as fraction
          const maxY = -this.heightPx / 2 + 86
          const minY = maxY - Math.max(0, this.contentHeightPx - this.viewHeightPx)
          const frac = (lc.y - minY) / Math.max(1, (maxY - minY))
          // Re-generate list
          // Use same logic as initial rebuild
          const inv: ItemInstance[] = (this.scene as any).inventory || []
          const sellLines: Phaser.GameObjects.Text[] = []
          inv.forEach((inst, i) => {
            if (!inst) return
            const cfg = getItem(inst.itemId)
            if (!cfg) return
            const value = computeSellValue(inst)
            const label2 = `${i + 1}. ${cfg.name} [${cfg.rarity}] - ${value}c`
            const tx = this.scene.add.text(0, i * 20, label2, { fontFamily: 'monospace', color: '#fff' })
            tx.setInteractive({ useHandCursor: true }).on('pointerup', () => this.trySell(i))
            tx.on('pointerover', (p: Phaser.Input.Pointer) => { try { (this.scene as any).invUI?.showTooltip?.(i, p) } catch {} })
            tx.on('pointerout', () => { try { (this.scene as any).invUI?.tooltip?.hide?.() } catch {} })
            sellLines.push(tx)
          })
          lc.removeAll(true)
          lc.add(sellLines)
          this.contentHeightPx = sellLines.length * 20
          const maxY2 = -this.heightPx / 2 + 86
          const minY2 = maxY2 - Math.max(0, this.contentHeightPx - this.viewHeightPx)
          lc.y = Phaser.Math.Clamp(minY2 + frac * Math.max(1, (maxY2 - minY2)), minY2, maxY2)
        }
      } catch {}
    }
  }

  close(): void {
    if (this.keydown) this.scene.input.keyboard?.off('keydown', this.keydown)
    this.container?.destroy(); this.container = undefined
    try { this.listMaskG?.destroy(); this.listMaskG = undefined } catch {}
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

  // Allow host scene to update coin display without recreating the UI
  setCoins(amount: number): void {
    this.coins = amount
    if (this.titleText) {
      const raw = this.titleText.text || 'Shop'
      // Rebuild title maintaining current mode label prefix
      const label = this.mode === 'buy' ? 'Shop - Buy' : this.mode === 'sell' ? 'Shop - Sell' : 'Shop'
      this.titleText.setText(`${label} (Coins: ${this.coins})`)
    }
  }

  private showToast(message: string, color: string = '#66ff99'): void {
    try { this.toast?.destroy() } catch {}
    const t = this.scene.add.text(0, this.heightPx / 2 - 38, message, { fontFamily: 'monospace', color, fontSize: '12px' }).setOrigin(0.5)
    this.toast = t
    this.container?.add(t)
    this.scene.tweens.add({ targets: t, y: (this.heightPx / 2 - 54), alpha: 0, duration: 900, onComplete: () => { try { t.destroy() } catch {}; if (this.toast === t) this.toast = undefined } })
  }

  private applySelectionStyles(baseColor: string): void {
    const selColor = '#ffff88'
    this.listTexts.forEach((t, i) => { try { t.setColor(i === this.selectedIndex ? selColor : baseColor) } catch {} })
  }

  private scrollToSelected(panelHeight: number): void {
    const lineY = this.selectedIndex * 20
    const top = -panelHeight / 2 + 86
    const currentTopY = this.listContainer?.y ?? top
    const currentTopLine = Math.round((top - currentTopY) / 20)
    const visibleLines = Math.floor(this.viewHeightPx / 20)
    if (this.selectedIndex < currentTopLine) {
      const newY = top - this.selectedIndex * 20
      const maxY = top
      const minY = maxY - Math.max(0, this.contentHeightPx - this.viewHeightPx)
      if (this.listContainer) this.listContainer.y = Phaser.Math.Clamp(newY, minY, maxY)
    } else if (this.selectedIndex >= currentTopLine + visibleLines) {
      const newTopLine = this.selectedIndex - visibleLines + 1
      const newY = top - newTopLine * 20
      const maxY = top
      const minY = maxY - Math.max(0, this.contentHeightPx - this.viewHeightPx)
      if (this.listContainer) this.listContainer.y = Phaser.Math.Clamp(newY, minY, maxY)
    }
  }
}
