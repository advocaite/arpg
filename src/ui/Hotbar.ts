import Phaser from 'phaser'
import type { HotbarConfig } from '@/types'
import { getItem } from '@/systems/ItemDB'
import Tooltip from '@/ui/Tooltip'

export default class HotbarUI {
  private scene: Phaser.Scene
  private container?: Phaser.GameObjects.Container
  private cfg: HotbarConfig = { potionRefId: undefined, skillRefIds: [] }
  private potionQtyText?: Phaser.GameObjects.Text
  private onSkillClick?: (index: number) => void
  private onPrimaryClick?: () => void
  private onSecondaryClick?: () => void
  private allowSkillClicks = true
  private skillCellNodes: Phaser.GameObjects.Rectangle[] = []
  private tooltip?: Tooltip

  constructor(scene: Phaser.Scene) { this.scene = scene }

  mount(cfg: HotbarConfig): void {
    this.unmount()
    this.cfg = cfg
    try { console.log('[Hotbar] mount cfg', JSON.stringify(this.cfg)) } catch {}
    this.tooltip = new Tooltip(this.scene)

    const x = this.scene.scale.width / 2
    const y = this.scene.scale.height - 24

    const barWidth = 680
    const barHeight = 40
    const bg = this.scene.add.rectangle(0, 0, barWidth, barHeight, 0x000000, 0.5).setStrokeStyle(1, 0xffffff, 0.2).setScrollFactor(0)

    const cells: Phaser.GameObjects.GameObject[] = []
    // potion slot on left
    const pBg = this.scene.add.rectangle(-barWidth / 2 + 30, 0, 60, 26, 0x1a1a1a, 1).setStrokeStyle(2, 0xff4444, 1).setScrollFactor(0)
    const pKey = this.scene.add.text(pBg.x - 24, -16, `Q`, { fontFamily: 'monospace', color: '#ffaaaa', fontSize: '10px' }).setScrollFactor(0)
    const pIcon = this.scene.add.image(pBg.x, 0, this.cfg.potionRefId ? 'icon_potion' : 'particle').setDisplaySize(22, 22).setScrollFactor(0)
    this.potionQtyText = undefined
    if (this.cfg.potionRefId) {
      const item = getItem(this.cfg.potionRefId)
      if (item?.stackable) {
        this.potionQtyText = this.scene.add.text(pBg.x + 16, 8, 'x0', { fontFamily: 'monospace', color: '#fff', fontSize: '10px' }).setScrollFactor(0)
      }
    }
    cells.push(pBg, pKey, pIcon, ...(this.potionQtyText ? [this.potionQtyText] : []))

    // 4 skill slots
    const skillStartX = -barWidth / 2 + 120
    this.skillCellNodes = []
    for (let i = 0; i < 4; i++) {
      const cx = skillStartX + i * 90
      const cellBg = this.scene.add.rectangle(cx, 0, 80, 26, 0x1a1a1a, 1).setStrokeStyle(1, 0x333333, 1).setInteractive({ useHandCursor: true }).setScrollFactor(0)
      const keyText = this.scene.add.text(cx - 36, -16, `${i + 1}`, { fontFamily: 'monospace', color: '#aaa', fontSize: '10px' }).setScrollFactor(0)
      const ref = this.cfg.skillRefIds[i]
      try { console.log('[Hotbar] slot', i, 'ref', ref) } catch {}
      const iconKey = ref ? 'icon_skill' : 'particle'
      const icon = this.scene.add.image(cx, 0, iconKey).setDisplaySize(22, 22).setScrollFactor(0)
      const openPicker = (p?: Phaser.Input.Pointer) => { console.log('[Hotbar] click slot', i, 'allow?', this.allowSkillClicks); if (!this.allowSkillClicks) return; p?.event?.stopPropagation?.(); this.onSkillClick?.(i) }
      cellBg.on('pointerup', openPicker)
      cellBg.on('pointerover', (p: Phaser.Input.Pointer) => {
        const name = ref ? `Slot ${i + 1}: ${ref}` : `Slot ${i + 1}: Empty`
        this.tooltip!.show(name, p.worldX + 12, p.worldY + 12)
      })
      cellBg.on('pointermove', (p: Phaser.Input.Pointer) => this.tooltip!.move(p.worldX + 12, p.worldY + 12))
      cellBg.on('pointerout', () => this.tooltip!.hide())
      icon.setInteractive({ useHandCursor: true }).on('pointerup', openPicker)
      icon.on('pointerover', (p: Phaser.Input.Pointer) => {
        const name = ref ? `Slot ${i + 1}: ${ref}` : `Slot ${i + 1}: Empty`
        this.tooltip!.show(name, p.worldX + 12, p.worldY + 12)
      })
      icon.on('pointermove', (p: Phaser.Input.Pointer) => this.tooltip!.move(p.worldX + 12, p.worldY + 12))
      icon.on('pointerout', () => this.tooltip!.hide())
      cells.push(cellBg, keyText, icon)
      this.skillCellNodes.push(cellBg)
    }

    // Primary / Secondary slots (orange border) on the right
    const primX = skillStartX + 4 * 90
    const secX = primX + 90
    const primBg = this.scene.add.rectangle(primX, 0, 80, 26, 0x1a1a1a, 1).setStrokeStyle(2, 0xff9900, 1).setScrollFactor(0).setInteractive({ useHandCursor: true })
    const primLabel = this.scene.add.text(primX - 18, -16, 'P', { fontFamily: 'monospace', color: '#ffb366', fontSize: '10px' }).setScrollFactor(0)
    const primIcon = this.scene.add.image(primX, 0, (this as any).cfg.primaryRefId ? 'icon_skill' : 'particle').setDisplaySize(22, 22).setScrollFactor(0)
    primBg.on('pointerup', (p?: Phaser.Input.Pointer) => { if (!this.allowSkillClicks) return; p?.event?.stopPropagation?.(); this.onPrimaryClick?.() })
    primBg.on('pointerover', (p: Phaser.Input.Pointer) => this.tooltip!.show(`Primary: ${(this as any).cfg.primaryRefId || 'Empty'}`, p.worldX + 12, p.worldY + 12))
    primBg.on('pointermove', (p: Phaser.Input.Pointer) => this.tooltip!.move(p.worldX + 12, p.worldY + 12))
    primBg.on('pointerout', () => this.tooltip!.hide())

    const secBg = this.scene.add.rectangle(secX, 0, 80, 26, 0x1a1a1a, 1).setStrokeStyle(2, 0xff9900, 1).setScrollFactor(0).setInteractive({ useHandCursor: true })
    const secLabel = this.scene.add.text(secX - 18, -16, 'S', { fontFamily: 'monospace', color: '#ffb366', fontSize: '10px' }).setScrollFactor(0)
    const secIcon = this.scene.add.image(secX, 0, (this as any).cfg.secondaryRefId ? 'icon_skill' : 'particle').setDisplaySize(22, 22).setScrollFactor(0)
    secBg.on('pointerup', (p?: Phaser.Input.Pointer) => { if (!this.allowSkillClicks) return; p?.event?.stopPropagation?.(); this.onSecondaryClick?.() })
    secBg.on('pointerover', (p: Phaser.Input.Pointer) => this.tooltip!.show(`Secondary: ${(this as any).cfg.secondaryRefId || 'Empty'}`, p.worldX + 12, p.worldY + 12))
    secBg.on('pointermove', (p: Phaser.Input.Pointer) => this.tooltip!.move(p.worldX + 12, p.worldY + 12))
    secBg.on('pointerout', () => this.tooltip!.hide())

    cells.push(primBg, primLabel, primIcon, secBg, secLabel, secIcon)

    this.container = this.scene.add.container(x, y, [bg, ...cells]).setScrollFactor(0).setDepth(1600)
  }

  unmount(): void { this.container?.destroy(); this.container = undefined }

  setPotionCount(count: number): void { if (this.potionQtyText) this.potionQtyText.setText(`x${count}`) }
  setOnSkillClick(h: (index: number) => void): void { this.onSkillClick = h }
  setOnPrimaryClick(h: () => void): void { this.onPrimaryClick = h }
  setOnSecondaryClick(h: () => void): void { this.onSecondaryClick = h }
  setAllowSkillClick(enabled: boolean): void {
    this.allowSkillClicks = enabled
    // Also disable interactive on the skill cells to avoid click-through
    this.skillCellNodes.forEach(n => enabled ? n.setInteractive({ useHandCursor: true }) : n.disableInteractive())
  }
}
