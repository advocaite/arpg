import Phaser from 'phaser'
import type { HotbarConfig } from '@/types'
import { getSkill } from '@/systems/SkillDB'
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
  private onPotionClick?: () => void
  private allowSkillClicks = true
  private skillCellNodes: Phaser.GameObjects.Rectangle[] = []
  private tooltip?: Tooltip
  private barWidth: number = 680
  private barHeight: number = 40
  private potionPicker?: Phaser.GameObjects.Container
  private potionPickerTip?: Tooltip
  // Cooldown overlays
  private slotCooldowns: Array<{ overlay: Phaser.GameObjects.Rectangle; until: number }> = []
  private primaryCooldown?: { overlay: Phaser.GameObjects.Rectangle; until: number }
  private secondaryCooldown?: { overlay: Phaser.GameObjects.Rectangle; until: number }
  private potionCooldown?: { overlay: Phaser.GameObjects.Rectangle; until: number }
  private tickHandler?: (time: number, delta: number) => void

  constructor(scene: Phaser.Scene) { this.scene = scene }

  mount(cfg: HotbarConfig): void {
    this.unmount()
    this.cfg = cfg
    try { console.log('[Hotbar] mount cfg', JSON.stringify(this.cfg)) } catch {}
    this.tooltip = new Tooltip(this.scene)
    const formatSkillWithRune = (skillId?: string, runeId?: string): string => {
      if (!skillId) return 'Empty'
      const s = getSkill(skillId)
      const name = s?.name || skillId
      if (!runeId || runeId === 'norune') return `${name} — No Rune`
      const rName = (s?.runes || []).find(r => r.id === runeId)?.name || runeId
      return `${name} — ${rName}`
    }


    const x = this.scene.scale.width / 2
    const y = this.scene.scale.height - 24

    const barWidth = this.barWidth
    const barHeight = this.barHeight
    const bg = this.scene.add.rectangle(0, 0, barWidth, barHeight, 0x000000, 0.5).setStrokeStyle(1, 0xffffff, 0.2).setScrollFactor(0)

    const cells: Phaser.GameObjects.GameObject[] = []
    // potion slot on left
    const pBg = this.scene.add.rectangle(-barWidth / 2 + 30, 0, 60, 26, 0x1a1a1a, 1).setStrokeStyle(2, 0xff4444, 1).setScrollFactor(0)
    const pKey = this.scene.add.text(pBg.x - 24, -16, `Q`, { fontFamily: 'monospace', color: '#ffaaaa', fontSize: '10px' }).setScrollFactor(0)
    const pIcon = this.scene.add.image(pBg.x, 0, this.cfg.potionRefId ? 'icon_potion' : 'particle').setDisplaySize(22, 22).setScrollFactor(0).setDepth(1)
    const openPotionPicker = (p?: Phaser.Input.Pointer) => { if (!this.allowSkillClicks) return; p?.event?.stopPropagation?.(); this.onPotionClick?.() }
    pBg.setInteractive({ useHandCursor: true }).on('pointerup', openPotionPicker)
    pIcon.setInteractive({ useHandCursor: true }).on('pointerup', openPotionPicker)
    this.potionQtyText = undefined
    if (this.cfg.potionRefId) {
      const item = getItem(this.cfg.potionRefId)
      if (item?.stackable) {
        this.potionQtyText = this.scene.add.text(pBg.x + 16, 8, 'x0', { fontFamily: 'monospace', color: '#fff', fontSize: '10px' }).setScrollFactor(0)
      }
    }
    // Potion cooldown overlay (hidden by default)
    const pOv = this.scene.add.rectangle(pBg.x, 13, 60, 26, 0x000000, 0.55).setOrigin(0.5, 1).setScrollFactor(0).setVisible(false)
    this.potionCooldown = { overlay: pOv, until: 0 }
    cells.push(pBg, pKey, pIcon, pOv, ...(this.potionQtyText ? [this.potionQtyText] : []))

    // 4 skill slots
    const skillStartX = -barWidth / 2 + 120
    this.skillCellNodes = []
    this.slotCooldowns = []
    for (let i = 0; i < 4; i++) {
      const cx = skillStartX + i * 90
      const cellBg = this.scene.add.rectangle(cx, 0, 80, 26, 0x1a1a1a, 1).setStrokeStyle(1, 0x333333, 1).setInteractive({ useHandCursor: true }).setScrollFactor(0)
      const keyText = this.scene.add.text(cx - 36, -16, `${i + 1}`, { fontFamily: 'monospace', color: '#aaa', fontSize: '10px' }).setScrollFactor(0)
      const ref = this.cfg.skillRefIds[i]
      try { console.log('[Hotbar] slot', i, 'ref', ref) } catch {}
      const iconKey = ref ? 'icon_skill' : 'particle'
      const icon = this.scene.add.image(cx, 0, iconKey).setDisplaySize(22, 22).setScrollFactor(0).setDepth(1)
      // Cooldown overlay rectangle above icon
      const ov = this.scene.add.rectangle(cx, 13, 80, 26, 0x000000, 0.55).setOrigin(0.5, 1).setScrollFactor(0).setVisible(false)
      this.slotCooldowns.push({ overlay: ov, until: 0 })
      const openPicker = (p?: Phaser.Input.Pointer) => { console.log('[Hotbar] click slot', i, 'allow?', this.allowSkillClicks); if (!this.allowSkillClicks) return; p?.event?.stopPropagation?.(); this.onSkillClick?.(i) }
      cellBg.on('pointerup', openPicker)
      cellBg.on('pointerover', (p: Phaser.Input.Pointer) => {
        const runeId = (this.cfg.runeRefIds || [])[i]
        const name = `Slot ${i + 1}: ${formatSkillWithRune(ref, runeId)}`
        this.tooltip!.show(name, p.worldX + 12, p.worldY + 12)
      })
      cellBg.on('pointermove', (p: Phaser.Input.Pointer) => this.tooltip!.move(p.worldX + 12, p.worldY + 12))
      cellBg.on('pointerout', () => this.tooltip!.hide())
      icon.setInteractive({ useHandCursor: true }).on('pointerup', openPicker)
      icon.on('pointerover', (p: Phaser.Input.Pointer) => {
        const runeId = (this.cfg.runeRefIds || [])[i]
        const name = `Slot ${i + 1}: ${formatSkillWithRune(ref, runeId)}`
        this.tooltip!.show(name, p.worldX + 12, p.worldY + 12)
      })
      icon.on('pointermove', (p: Phaser.Input.Pointer) => this.tooltip!.move(p.worldX + 12, p.worldY + 12))
      icon.on('pointerout', () => this.tooltip!.hide())
      cells.push(cellBg, keyText, icon, ov)
      this.skillCellNodes.push(cellBg)
    }

    // Primary / Secondary slots (orange border) on the right
    const primX = skillStartX + 4 * 90
    const secX = primX + 90
    const primBg = this.scene.add.rectangle(primX, 0, 80, 26, 0x1a1a1a, 1).setStrokeStyle(2, 0xff9900, 1).setScrollFactor(0).setInteractive({ useHandCursor: true })
    const primLabel = this.scene.add.text(primX - 18, -16, 'P', { fontFamily: 'monospace', color: '#ffb366', fontSize: '10px' }).setScrollFactor(0)
    const primIcon = this.scene.add.image(primX, 0, (this as any).cfg.primaryRefId ? 'icon_skill' : 'particle').setDisplaySize(22, 22).setScrollFactor(0).setDepth(1)
    const primOv = this.scene.add.rectangle(primX, 13, 80, 26, 0x000000, 0.55).setOrigin(0.5, 1).setScrollFactor(0).setVisible(false)
    this.primaryCooldown = { overlay: primOv, until: 0 }
    primBg.on('pointerup', (p?: Phaser.Input.Pointer) => { if (!this.allowSkillClicks) return; p?.event?.stopPropagation?.(); this.onPrimaryClick?.() })
    primBg.on('pointerover', (p: Phaser.Input.Pointer) => {
      const sid = (this as any).cfg.primaryRefId as (string | undefined)
      const rid = (this as any).cfg.primaryRuneRefId as (string | undefined)
      this.tooltip!.show(`Primary: ${formatSkillWithRune(sid, rid)}`, p.worldX + 12, p.worldY + 12)
    })
    primBg.on('pointermove', (p: Phaser.Input.Pointer) => this.tooltip!.move(p.worldX + 12, p.worldY + 12))
    primBg.on('pointerout', () => this.tooltip!.hide())

    const secBg = this.scene.add.rectangle(secX, 0, 80, 26, 0x1a1a1a, 1).setStrokeStyle(2, 0xff9900, 1).setScrollFactor(0).setInteractive({ useHandCursor: true })
    const secLabel = this.scene.add.text(secX - 18, -16, 'S', { fontFamily: 'monospace', color: '#ffb366', fontSize: '10px' }).setScrollFactor(0)
    const secIcon = this.scene.add.image(secX, 0, (this as any).cfg.secondaryRefId ? 'icon_skill' : 'particle').setDisplaySize(22, 22).setScrollFactor(0).setDepth(1)
    const secOv = this.scene.add.rectangle(secX, 13, 80, 26, 0x000000, 0.55).setOrigin(0.5, 1).setScrollFactor(0).setVisible(false)
    this.secondaryCooldown = { overlay: secOv, until: 0 }
    secBg.on('pointerup', (p?: Phaser.Input.Pointer) => { if (!this.allowSkillClicks) return; p?.event?.stopPropagation?.(); this.onSecondaryClick?.() })
    secBg.on('pointerover', (p: Phaser.Input.Pointer) => {
      const sid = (this as any).cfg.secondaryRefId as (string | undefined)
      const rid = (this as any).cfg.secondaryRuneRefId as (string | undefined)
      this.tooltip!.show(`Secondary: ${formatSkillWithRune(sid, rid)}`, p.worldX + 12, p.worldY + 12)
    })
    secBg.on('pointermove', (p: Phaser.Input.Pointer) => this.tooltip!.move(p.worldX + 12, p.worldY + 12))
    secBg.on('pointerout', () => this.tooltip!.hide())

    cells.push(primBg, primLabel, primIcon, primOv, secBg, secLabel, secIcon, secOv)

    this.container = this.scene.add.container(x, y, [bg, ...cells]).setScrollFactor(0).setDepth(1600)
    // Tick overlays each frame
    this.tickHandler = () => this.updateCooldownOverlays()
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.tickHandler, this)
  }

  unmount(): void { this.closePotionPicker(); this.tooltip?.hide(); if (this.tickHandler) this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tickHandler, this); this.container?.destroy(); this.container = undefined }

  setPotionCount(count: number): void { if (this.potionQtyText) this.potionQtyText.setText(`x${count}`) }
  setOnSkillClick(h: (index: number) => void): void { this.onSkillClick = h }
  setOnPrimaryClick(h: () => void): void { this.onPrimaryClick = h }
  setOnSecondaryClick(h: () => void): void { this.onSecondaryClick = h }
  setOnPotionClick(h: () => void): void { this.onPotionClick = h }

  // Inline potion picker UI (horizontal boxes above potion slot)
  openPotionPicker(invPotions: { id: string; name: string; lore?: string }[], onChoose: (id: string) => void): void {
    this.closePotionPicker()
    if (!this.container) return
    const baseX = this.container.x - this.barWidth / 2 + 30
    const baseY = this.container.y - 36
    const nodes: Phaser.GameObjects.GameObject[] = []
    const bg = this.scene.add.rectangle(baseX, baseY, Math.max(70, invPotions.length * 34 + 10), 30, 0x0a0a0a, 0.95).setOrigin(0, 0.5).setStrokeStyle(1, 0x333333, 1).setScrollFactor(0)
    nodes.push(bg)
    const tip = new Tooltip(this.scene)
    this.potionPickerTip = tip
    invPotions.forEach((p, i) => {
      const cx = baseX + 8 + i * 34
      const rect = this.scene.add.rectangle(cx, baseY, 28, 28, 0x1a1a1a, 1).setStrokeStyle(1, 0x333333, 1).setScrollFactor(0)
      const icon = this.scene.add.image(cx, baseY, 'icon_potion').setDisplaySize(20, 20).setScrollFactor(0)
      rect.setInteractive({ useHandCursor: true })
        .on('pointerup', () => { onChoose(p.id); this.closePotionPicker() })
        .on('pointerover', (pp: Phaser.Input.Pointer) => tip.show(`${p.name}${p.lore ? `\n${p.lore}` : ''}`, pp.worldX + 10, pp.worldY + 10))
        .on('pointermove', (pp: Phaser.Input.Pointer) => tip.move(pp.worldX + 10, pp.worldY + 10))
        .on('pointerout', () => tip.hide())
      nodes.push(rect, icon)
    })
    this.potionPicker = this.scene.add.container(0, 0, nodes).setDepth(2000)
  }

  closePotionPicker(): void {
    try { this.potionPickerTip?.hide() } catch {}
    this.potionPickerTip = undefined
    this.potionPicker?.destroy(); this.potionPicker = undefined
  }
  setAllowSkillClick(enabled: boolean): void {
    this.allowSkillClicks = enabled
    // Also disable interactive on the skill cells to avoid click-through
    this.skillCellNodes.forEach(n => enabled ? n.setInteractive({ useHandCursor: true }) : n.disableInteractive())
  }

  getBounds(): { x: number; y: number; width: number; height: number } | undefined {
    if (!this.container) return undefined
    return { x: this.container.x, y: this.container.y, width: this.barWidth, height: this.barHeight }
  }

  // External API to begin a cooldown fill
  startCooldown(kind: 'slot' | 'primary' | 'secondary' | 'potion', indexOrZero: number, durationMs: number): void {
    const until = this.scene.time.now + Math.max(0, durationMs)
    if (kind === 'slot') {
      const c = this.slotCooldowns[indexOrZero]
      if (c) { c.until = until; (c as any).__duration = Math.max(1, durationMs); c.overlay.setVisible(durationMs > 0); c.overlay.setScale(1, 1) }
      return
    }
    if (kind === 'primary' && this.primaryCooldown) { this.primaryCooldown.until = until; (this.primaryCooldown as any).__duration = Math.max(1, durationMs); this.primaryCooldown.overlay.setVisible(durationMs > 0); this.primaryCooldown.overlay.setScale(1, 1); return }
    if (kind === 'secondary' && this.secondaryCooldown) { this.secondaryCooldown.until = until; (this.secondaryCooldown as any).__duration = Math.max(1, durationMs); this.secondaryCooldown.overlay.setVisible(durationMs > 0); this.secondaryCooldown.overlay.setScale(1, 1); return }
    if (kind === 'potion' && this.potionCooldown) { this.potionCooldown.until = until; (this.potionCooldown as any).__duration = Math.max(1, durationMs); this.potionCooldown.overlay.setVisible(durationMs > 0); this.potionCooldown.overlay.setScale(1, 1); return }
  }

  private updateCooldownOverlays(): void {
    const now = this.scene.time.now
    const update = (entry?: { overlay: Phaser.GameObjects.Rectangle; until: number }): void => {
      if (!entry) return
      const remain = Math.max(0, entry.until - now)
      if (remain <= 0) { entry.overlay.setVisible(false); return }
      const dur = Math.max(1, Number((entry as any).__duration || 1000))
      const frac = Math.max(0.02, Math.min(1, remain / dur))
      entry.overlay.setVisible(true)
      entry.overlay.setScale(1, frac) // origin(0.5,1) to fill from bottom
    }
    // Update slots
    for (const c of this.slotCooldowns) update(c)
    update(this.primaryCooldown)
    update(this.secondaryCooldown)
    update(this.potionCooldown)
  }
}
