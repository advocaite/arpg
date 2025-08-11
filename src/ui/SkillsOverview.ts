import Phaser from 'phaser'
import SkillsMenuUI, { UISkillMeta } from './SkillsMenu'
import PassiveMenuUI, { UIPassiveMeta } from './PassiveMenu'

export type OverviewSkill = { slot: 'primary' | 'secondary' | 1 | 2 | 3 | 4; name?: string; iconKey?: string; skillId?: string }

type OpenArgs = {
  skillsList: UISkillMeta[]
  passivesList: UIPassiveMeta[]
  current: { primary?: string; primaryRune?: string; secondary?: string; secondaryRune?: string; slots: (string | undefined)[]; runes: (string | undefined)[]; passives: (string | undefined)[] }
  onUpdate: (next: { primary?: string; primaryRune?: string; secondary?: string; secondaryRune?: string; slots: (string | undefined)[]; runes: (string | undefined)[]; passives: (string | undefined)[] }) => void
  onClose?: () => void
  focusIndex?: number // if provided, immediately open that action slot's selector
}

export default class SkillsOverviewUI {
  private scene: Phaser.Scene
  private container?: Phaser.GameObjects.Container
  private skillsMenu: SkillsMenuUI
  private passiveMenu: PassiveMenuUI
  private onCloseCb?: () => void

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.skillsMenu = new SkillsMenuUI(scene)
    this.passiveMenu = new PassiveMenuUI(scene)
  }

  open(args: OpenArgs): void {
    this.close()
    const { skillsList, passivesList } = args
    // Work on a local copy; preserve undefined (avoid JSON null coercion)
    const current = {
      primary: (args.current as any).primary ?? (args as any).current.primaryRefId,
      primaryRune: (args.current as any).primaryRune ?? (args as any).current.primaryRuneRefId,
      secondary: (args.current as any).secondary ?? (args as any).current.secondaryRefId,
      secondaryRune: (args.current as any).secondaryRune ?? (args as any).current.secondaryRuneRefId,
      slots: [...args.current.slots],
      runes: [...(args.current.runes || new Array(4).fill(undefined))],
      passives: [...args.current.passives]
    } as { primary?: string; primaryRune?: string; secondary?: string; secondaryRune?: string; slots: (string | undefined)[]; runes: (string | undefined)[]; passives: (string | undefined)[] }
    const onUpdate = args.onUpdate
    this.onCloseCb = args.onClose
    const x = this.scene.scale.width / 2, y = this.scene.scale.height / 2
    const w = 760, h = 500

    // Build lookup maps
    const skillById = new Map<string, UISkillMeta>(skillsList.map(s => [s.id, s]))
    const passiveById = new Map<string, UIPassiveMeta>(passivesList.map(p => [p.id, p]))

    const bg = this.scene.add.rectangle(0, 0, w, h, 0x0a0a0a, 0.95).setStrokeStyle(2, 0x553333, 1).setScrollFactor(0)
    const title = this.scene.add.text(0, -h / 2 + 8, 'SKILLS OVERVIEW', { fontFamily: 'monospace', color: '#ffb38a', fontSize: '16px' }).setOrigin(0.5, 0).setScrollFactor(0)

    const rowLabel = (lx: number, ly: number, text: string) => this.scene.add.text(lx, ly, text, { fontFamily: 'monospace', color: '#cda', fontSize: '12px' }).setOrigin(0, 0).setScrollFactor(0)
    const primaryLbl = rowLabel(-w / 2 + 16, -h / 2 + 40, 'PRIMARY')
    const secondaryLbl = rowLabel(-w / 2 + 16, -h / 2 + 100, 'SECONDARY')
    const actionLbl = rowLabel(-w / 2 + 16, -h / 2 + 160, 'ACTION BAR SLOTS')
    const passiveLbl = rowLabel(-w / 2 + 16, h / 2 - 120, 'PASSIVE SLOTS')

    const makeSlot = (sx: number, sy: number, label: string, currentId?: string, onClick?: () => void, runeId?: string) => {
      const rect = this.scene.add.rectangle(sx, sy, 220, 48, 0x1a1a1a, 1).setStrokeStyle(1, 0x333333, 1).setScrollFactor(0).setInteractive({ useHandCursor: true })
      const icon = this.scene.add.image(sx - 80, sy, currentId ? 'icon_skill' : 'particle').setDisplaySize(28, 28).setScrollFactor(0)
      const skillName = currentId ? (skillById.get(currentId)?.name || 'Unknown') : 'Empty'
      const runeName = (currentId && runeId)
        ? (skillById.get(currentId)?.runes?.find(r => r.id === runeId)?.name || (runeId === 'norune' ? 'No Rune' : 'Rune'))
        : (currentId ? 'No Rune' : '')
      const nameText = this.scene.add.text(sx - 60, sy - 16, skillName, { fontFamily: 'monospace', color: '#ffffff', fontSize: '12px' }).setScrollFactor(0)
      const runeText = this.scene.add.text(sx - 60, sy - 2, runeName, { fontFamily: 'monospace', color: '#aaa', fontSize: '10px' }).setScrollFactor(0)
      rect.on('pointerover', () => rect.setStrokeStyle(2, 0x66ccff, 1))
      rect.on('pointerout', () => rect.setStrokeStyle(1, 0x333333, 1))
      if (onClick) rect.on('pointerup', onClick)
      return [rect, icon, nameText, runeText] as Phaser.GameObjects.GameObject[]
    }

    const nodes: Phaser.GameObjects.GameObject[] = [bg, title, primaryLbl, secondaryLbl, actionLbl, passiveLbl]

    // Primary / Secondary slots
    const baseDisabled = () => current.slots.filter(Boolean) as string[]
    nodes.push(...makeSlot(-w / 2 + 180, -h / 2 + 56, 'Primary', current.primary, () => this.skillsMenu.open({ slotIndex: 0, skills: skillsList, currentId: current.primary, disabledIds: [...baseDisabled(), ...(current.secondary ? [current.secondary] : [])], onAccept: (id?: string, runeId?: string) => { current.primary = id; current.primaryRune = runeId; this.open({ ...args, current }) } } as any), current.primaryRune))
    nodes.push(...makeSlot(-w / 2 + 180, -h / 2 + 116, 'Secondary', current.secondary, () => this.skillsMenu.open({ slotIndex: 1, skills: skillsList, currentId: current.secondary, disabledIds: [...baseDisabled(), ...(current.primary ? [current.primary] : [])], onAccept: (id?: string, runeId?: string) => { current.secondary = id; current.secondaryRune = runeId; this.open({ ...args, current }) } } as any), current.secondaryRune))

    // Action bar slots 1-4 in a 2x2 centered grid
    const gridCx = 0
    const gridCy = -h / 2 + 260
    const gridDX = 260 // wider than slot width (220) to avoid overlap
    const gridDY = 90  // taller than slot height (48)
    const gridPositions = [
      { x: gridCx - gridDX / 2, y: gridCy - gridDY / 2 }, // slot 1
      { x: gridCx + gridDX / 2, y: gridCy - gridDY / 2 }, // slot 2
      { x: gridCx - gridDX / 2, y: gridCy + gridDY / 2 }, // slot 3
      { x: gridCx + gridDX / 2, y: gridCy + gridDY / 2 }  // slot 4
    ]
    for (let i = 0; i < 4; i++) {
      const pos = gridPositions[i]
      const otherSlots = current.slots.map((v, idx) => (idx === i ? undefined : v)).filter(Boolean) as string[]
      const dis = [...otherSlots, ...(current.primary ? [current.primary] : []), ...(current.secondary ? [current.secondary] : [])]
      nodes.push(
        ...makeSlot(pos.x, pos.y, `Slot ${i + 1}`, current.slots[i], () => this.skillsMenu.open({ slotIndex: i, skills: skillsList, currentId: current.slots[i], disabledIds: dis, onAccept: (id?: string, runeId?: string) => { current.slots[i] = id; current.runes[i] = runeId; this.open({ ...args, current }) } } as any), current.runes[i])
      )
    }

    // Passive slots (5 centered at bottom)
    for (let i = 0; i < 5; i++) {
      const colX = -w / 2 + 100 + i * 140
      const rect = this.scene.add.rectangle(colX, h / 2 - 80, 100, 48, 0x1a1a1a, 1).setStrokeStyle(1, 0x333333, 1).setScrollFactor(0).setInteractive({ useHandCursor: true })
      const icon = this.scene.add.image(colX - 30, h / 2 - 80, current.passives[i] ? 'icon_skill' : 'particle').setDisplaySize(26, 26).setScrollFactor(0)
      const pName = current.passives[i] ? (passiveById.get(current.passives[i]!)?.name || 'Passive') : 'Empty'
      const text = this.scene.add.text(colX - 10, h / 2 - 90, pName, { fontFamily: 'monospace', color: '#ffffff', fontSize: '12px' }).setScrollFactor(0)
      rect.on('pointerover', () => rect.setStrokeStyle(2, 0x66ccff, 1))
      rect.on('pointerout', () => rect.setStrokeStyle(1, 0x333333, 1))
      rect.on('pointerup', () => this.passiveMenu.open({ passives: passivesList, currentId: current.passives[i], onAccept: (pid) => { current.passives[i] = pid; onUpdate(current); this.open(args) } }))
      nodes.push(rect, icon, text)
    }

    // Accept/Cancel at bottom center
    const acceptBtn = this.scene.add.text(-40, h / 2 - 28, 'ACCEPT', { fontFamily: 'monospace', color: '#ffd166', fontSize: '12px', backgroundColor: '#222' }).setPadding(6, 4, 6, 4).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true })
    const cancelBtn = this.scene.add.text(40, h / 2 - 28, 'CANCEL', { fontFamily: 'monospace', color: '#ff7777', fontSize: '12px', backgroundColor: '#222' }).setPadding(6, 4, 6, 4).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true })
    acceptBtn.on('pointerup', () => { console.log('[OverviewUI] Commit', JSON.stringify(current)); onUpdate(current); this.onCloseCb?.(); try { (this.scene as any).__suppressEscUntil = (this.scene as any).time?.now + 150 } catch {} this.close() })
    cancelBtn.on('pointerup', () => { this.onCloseCb?.(); try { (this.scene as any).__suppressEscUntil = (this.scene as any).time?.now + 150 } catch {} this.close() })
    const esc = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    esc?.once('down', () => { this.onCloseCb?.(); try { (this.scene as any).__suppressEscUntil = (this.scene as any).time?.now + 150 } catch {} this.close() })

    this.container = this.scene.add.container(x, y, [...nodes, acceptBtn, cancelBtn]).setScrollFactor(0).setDepth(3500)

    // If a focusIndex is provided, auto-open that slot's selector shortly after render
    if (typeof args.focusIndex === 'number' && args.focusIndex >= 0 && args.focusIndex < 4) {
      this.scene.time.delayedCall(10, () => {
        this.skillsMenu.open({ slotIndex: args.focusIndex!, skills: skillsList, currentId: current.slots[args.focusIndex!], disabledIds: current.slots.filter(Boolean) as string[], onAccept: (id?: string) => { current.slots[args.focusIndex!] = id; this.open({ ...args, current }) } } as any)
      })
    }
  }

  close(): void { this.container?.destroy(); this.container = undefined; this.onCloseCb = undefined }
}


