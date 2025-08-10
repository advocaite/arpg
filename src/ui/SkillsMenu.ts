import Phaser from 'phaser'

export type UISkillMeta = {
  id: string
  name: string
  category?: 'primary' | 'secondary' | 'defensive' | 'might' | 'tactics' | 'rage' | 'utility' | 'other'
  runes?: Array<{ id: string; name: string; reqLevel?: number }>
}

type RuneMeta = { id: string; name: string; reqLevel?: number }

type OpenArgs = {
  slotIndex: number
  skills: UISkillMeta[]
  currentId?: string
  disabledIds?: string[]
  level?: number
  onAccept: (skillId?: string, runeId?: string) => void
  onCancel?: () => void
}

export default class SkillsMenuUI {
  private scene: Phaser.Scene
  private container?: Phaser.GameObjects.Container
  private hover?: Phaser.GameObjects.Rectangle
  private selectedSkillId?: string
  private selectedRuneId?: string

  constructor(scene: Phaser.Scene) { this.scene = scene }

  open(args: OpenArgs): void {
    this.close()
    const { slotIndex, skills, currentId, disabledIds = [], level = 1, onAccept, onCancel } = args

    const screenW = this.scene.scale.width, screenH = this.scene.scale.height
    const modalW = 720, modalH = 420
    const x = screenW / 2, y = screenH / 2

    // Ensure UI prioritizes top-most interactive elements
    try { (this.scene.input as any).topOnly = true } catch {}

    // Frame
    const bg = this.scene.add.rectangle(0, 0, modalW, modalH, 0x0a0a0a, 0.95).setStrokeStyle(2, 0x553333, 1).setScrollFactor(0)
    const title = this.scene.add.text(0, -modalH / 2 + 10, 'SKILLS', { fontFamily: 'monospace', color: '#ffb38a', fontSize: '16px' }).setOrigin(0.5, 0).setScrollFactor(0)
    const subtitle = this.scene.add.text(-modalW / 2 + 16, -modalH / 2 + 36, `Assign to Slot ${slotIndex + 1}`, { fontFamily: 'monospace', color: '#999', fontSize: '12px' }).setOrigin(0, 0).setScrollFactor(0)
    const closeX = this.scene.add.text(modalW / 2 - 12, -modalH / 2 + 8, 'X', { fontFamily: 'monospace', color: '#ff7777' }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setScrollFactor(0)

    // Sections
    const sectionLabel = (lx: number, ly: number, text: string) => this.scene.add.text(lx, ly, text, { fontFamily: 'monospace', color: '#cda', fontSize: '12px' }).setOrigin(0, 0).setScrollFactor(0)
    const skillsLabel = sectionLabel(-modalW / 2 + 16, -modalH / 2 + 60, 'ACTIVE SKILLS')

    // Active skill grid (like inventory slots)
    const gridX = -modalW / 2 + 16
    const gridY = -modalH / 2 + 80
    const cols = 6, rows = 2
    const cellW = 88, cellH = 64, gap = 8
    const gridBottom = gridY + (rows - 1) * (cellH + gap) + cellH / 2
    const runesLabelY = gridBottom + 20
    const runesLabel = sectionLabel(-modalW / 2 + 16, runesLabelY, 'SKILL RUNES')

    const disabledSet = new Set<string>(disabledIds)
    if (currentId) disabledSet.add(currentId)

    this.hover = this.scene.add.rectangle(0, 0, cellW, cellH, 0x66ccff, 0.08).setStrokeStyle(2, 0x66ccff, 0.9).setVisible(false).setScrollFactor(0)
    const selectOutline = this.scene.add.rectangle(0, 0, cellW, cellH, 0x00ff00, 0.06).setStrokeStyle(2, 0x00ff66, 0.9).setVisible(false).setScrollFactor(0)

    const cellNodes: Phaser.GameObjects.GameObject[] = []
    // Inject a synthetic "No Skill" option at index 0
    const skillsWithNone: UISkillMeta[] = [{ id: 'noskill', name: 'No Skill', category: 'other' }, ...skills]
    const shown = Math.min(skillsWithNone.length, cols * rows)
    for (let i = 0; i < shown; i++) {
      const s = skillsWithNone[i]
      const cx = gridX + (i % cols) * (cellW + gap) + cellW / 2
      const cy = gridY + Math.floor(i / cols) * (cellH + gap) + cellH / 2
      const locked = s.id !== 'noskill' && typeof s?.runes?.[0]?.reqLevel === 'number' && level < (s.runes![0].reqLevel as number) // simple gate example
      const isDisabled = (s.id !== 'noskill' && disabledSet.has(s.id)) || locked

      const cell = this.scene.add.rectangle(cx, cy, cellW, cellH, isDisabled ? 0x151515 : 0x1a1a1a, 1).setStrokeStyle(1, isDisabled ? 0x444444 : 0x333333, 1).setScrollFactor(0)
      const iconKey = s.id === 'noskill' ? 'particle' : 'icon_skill'
      const icon = this.scene.add.image(cx - 26, cy, iconKey).setDisplaySize(28, 28).setTint(isDisabled ? 0x777777 : 0xffffff).setScrollFactor(0)
      const name = this.scene.add.text(cx - 8, cy - 9, s.name, { fontFamily: 'monospace', color: isDisabled ? '#777777' : '#ffffff', fontSize: '12px' }).setScrollFactor(0)
      const cat = this.scene.add.text(cx - 8, cy + 7, s.id === 'noskill' ? '' : (s.category || 'other').toUpperCase(), { fontFamily: 'monospace', color: '#888', fontSize: '10px' }).setScrollFactor(0)

      if (!isDisabled) {
        const choose = () => {
          console.log('[SkillsMenu] choose skill', s.id)
          this.selectedSkillId = s.id === 'noskill' ? undefined : s.id
          this.selectedRuneId = undefined
          selectOutline.setPosition(cx, cy).setVisible(true)
          renderRunes(s.id === 'noskill' ? undefined : s)
        }
        cell.setInteractive({ useHandCursor: true })
          .on('pointerdown', (ev: any) => ev?.event?.stopPropagation?.())
          .on('pointerup', choose)
          .on('pointerover', () => this.hover!.setPosition(cx, cy).setVisible(true))
          .on('pointerout', () => this.hover!.setVisible(false))
        icon.setInteractive({ useHandCursor: true }).on('pointerdown', (ev: any) => ev?.event?.stopPropagation?.()).on('pointerup', choose)
        name.setInteractive({ useHandCursor: true }).on('pointerdown', (ev: any) => ev?.event?.stopPropagation?.()).on('pointerup', choose)
      }
      cellNodes.push(cell, icon, name, cat)
    }

    // Runes row
    const runesContainer = this.scene.add.container(0, 0).setScrollFactor(0)
    let runeHover: Phaser.GameObjects.Rectangle | null = null
    let runeSelect: Phaser.GameObjects.Rectangle | null = null
    const renderRunes = (skill?: UISkillMeta) => {
      runesContainer.removeAll(true)
      const rowY = runesLabelY + 18 + 46 / 2 // position row beneath label
      const rowX = -modalW / 2 + 16
      const rCellW = 120, rCellH = 46
      // recreate hover/select for current size and add first so it sits behind the cells
      runeHover = this.scene.add.rectangle(0, 0, rCellW, rCellH, 0x66ccff, 0.08).setStrokeStyle(2, 0x66ccff, 0.9).setVisible(false).setScrollFactor(0)
      runeSelect = this.scene.add.rectangle(0, 0, rCellW, rCellH, 0x00ff00, 0.06).setStrokeStyle(2, 0xffaa00, 0.9).setVisible(false).setScrollFactor(0)
      runesContainer.add(runeHover)
      runesContainer.add(runeSelect)
      const baseRunes: RuneMeta[] = [
        { id: 'norune', name: 'No Rune' },
        { id: 'empty1', name: 'Empty' },
        { id: 'empty2', name: 'Empty' },
        { id: 'empty3', name: 'Empty' },
        { id: 'empty4', name: 'Empty' },
        { id: 'empty5', name: 'Empty' },
      ]
      const list: RuneMeta[] = skill ? baseRunes.concat(((skill.runes as RuneMeta[]) || [])) : baseRunes
      for (let i = 0; i < Math.min(list.length, 6); i++) {
        const r = list[i]
        const cx = rowX + i * (rCellW + 6) + rCellW / 2
        const cy = rowY
        const locked = typeof r.reqLevel === 'number' && level < r.reqLevel
        const cell = this.scene.add.rectangle(cx, cy, rCellW, rCellH, locked ? 0x151515 : 0x1a1a1a, 1).setStrokeStyle(1, locked ? 0x444444 : 0x333333, 1).setScrollFactor(0)
        const label = this.scene.add.text(cx - rCellW / 2 + 10, cy - 8, r.name, { fontFamily: 'monospace', color: locked ? '#777777' : '#ffffff', fontSize: '11px' }).setScrollFactor(0)
        if (!locked) {
          const pick = () => { this.selectedRuneId = r.id; runeSelect!.setPosition(cx, cy).setVisible(true) }
          const over = () => { runeHover!.setPosition(cx, cy).setVisible(true) }
          const out = () => { runeHover!.setVisible(false) }
          cell.setInteractive({ useHandCursor: true })
            .on('pointerover', over)
            .on('pointerout', out)
            .on('pointerup', pick)
          label.setInteractive({ useHandCursor: true })
            .on('pointerover', over)
            .on('pointerout', out)
            .on('pointerup', pick)
        }
        runesContainer.add(cell)
        runesContainer.add(label)
      }
    }

    // Accept/Cancel buttons
    const btn = (bx: number, by: number, text: string, color: string) => {
      const t = this.scene.add.text(bx, by, text, { fontFamily: 'monospace', color, fontSize: '12px', backgroundColor: '#222' }).setPadding(6, 4, 6, 4).setOrigin(0.5).setScrollFactor(0)
      t.setInteractive({ useHandCursor: true })
      return t
    }
    const accept = btn(0, modalH / 2 - 24, 'ACCEPT', '#ffd166')
    const cancel = btn(80, modalH / 2 - 24, 'CANCEL', '#ff7777')

    accept.setInteractive({ useHandCursor: true }).on('pointerdown', (ev: any) => ev?.event?.stopPropagation?.()).on('pointerup', () => {
      console.log('[SkillsMenu] accept', this.selectedSkillId, this.selectedRuneId)
      onAccept(this.selectedSkillId, this.selectedRuneId)
      this.close()
    })
    cancel.setInteractive({ useHandCursor: true }).on('pointerdown', (ev: any) => ev?.event?.stopPropagation?.()).on('pointerup', () => { console.log('[SkillsMenu] cancel'); onCancel?.(); this.close() })
    closeX.on('pointerdown', (ev: any) => ev?.event?.stopPropagation?.()).on('pointerup', () => { console.log('[SkillsMenu] closeX'); onCancel?.(); this.close() })

    // ESC to close
    const esc = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    esc?.once('down', () => { console.log('[SkillsMenu] esc close'); onCancel?.(); this.close() })

    // Initial rune render based on current
    const initial = skills.find(s => s.id === currentId)
    if (initial) { this.selectedSkillId = initial.id; renderRunes(initial) } else { renderRunes(undefined) }

    // Compose container
    this.container = this.scene.add.container(x, y, [bg, title, subtitle, skillsLabel, runesLabel, ...cellNodes, selectOutline, runesContainer, this.hover!, accept, cancel, closeX]).setScrollFactor(0).setDepth(4000)
  }

  close(): void { this.container?.destroy(); this.container = undefined; this.hover?.destroy(); this.hover = undefined }
}


