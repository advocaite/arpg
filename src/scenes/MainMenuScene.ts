import Phaser from 'phaser'
import { CharacterProfile, CharacterClass, Stats } from '@/types'
import { loadCharacters, upsertCharacter, deleteCharacter } from '@/systems/SaveSystem'

export default class MainMenuScene extends Phaser.Scene {
  private slots: CharacterProfile[] = []
  private ui!: Phaser.GameObjects.Container
  private selectedSlot = 0

  constructor() { super({ key: 'MainMenu' }) }

  create(): void {
    this.cameras.main.setBackgroundColor('#0d0f1a')
    console.log('[MainMenu] create')
    this.slots = this.ensureThreeSlots(loadCharacters())

    this.add.text(this.scale.width / 2, 40, 'ARPG', { fontFamily: 'monospace', color: '#ffffff', fontSize: '28px' }).setOrigin(0.5)

    this.ui = this.add.container(0, 0).setDepth(100)

    this.renderSlots()

    const handler = (e: KeyboardEvent) => {
      console.log('[MainMenu] keydown', e.key)
      if (e.key === 'ArrowUp') this.moveSelection(-1)
      if (e.key === 'ArrowDown') this.moveSelection(1)
      if (e.key === 'Enter') { e.preventDefault(); this.tryStart() }
      if (e.key.toLowerCase() === 'c') this.openCreator(this.selectedSlot)
      if (e.key.toLowerCase() === 'p') {
        const size = prompt('Enter world size WxH (e.g., 2000x1400)', '2000x1400') || '2000x1400'
        const m = size.match(/(\d+)\s*[xX]\s*(\d+)/)
        const w = m ? parseInt(m[1], 10) : 2000
        const h = m ? parseInt(m[2], 10) : 1400
        this.scene.start('Painter', { worldWidth: w, worldHeight: h })
      }
      if (e.key.toLowerCase() === 'd') this.deleteSlot(this.selectedSlot)
    }
    this.input.keyboard?.on('keydown', handler)
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown', handler))
  }

  private ensureThreeSlots(list: CharacterProfile[]): CharacterProfile[] {
    const out = [...list]
    for (let i = out.length; i < 3; i++) {
      out.push({ id: i, name: '', class: 'melee', stats: { strength: 5, vitality: 5, intelligence: 5, dexterity: 5 } })
    }
    return out.slice(0, 3)
  }

  private moveSelection(delta: number): void { this.selectedSlot = (this.selectedSlot + delta + 3) % 3; this.renderSlots() }

  private slotLabel(c: CharacterProfile, idx: number): string {
    if (!c.name) return `[${idx + 1}] Empty - press C to create`
    const lvl = Number(c.level || 1)
    const exp = Number(c.exp || 0)
    return `[${idx + 1}] ${c.name} (${c.class}) Lv:${lvl} XP:${exp}  STR:${c.stats.strength} VIT:${c.stats.vitality} INT:${c.stats.intelligence} DEX:${c.stats.dexterity}`
  }

  private renderSlots(): void {
    this.ui.removeAll(true)
    const hint = this.add.text(this.scale.width / 2, this.scale.height - 32, 'Enter: Play  C: Create/Edit  P: World Painter  D: Delete  ↑/↓: Select  (Click: Select, Double-Click: Play)', { fontFamily: 'monospace', color: '#bbb' }).setOrigin(0.5)
    this.ui.add(hint)
    for (let i = 0; i < 3; i++) {
      const c = this.slots[i]
      const t = this.add.text(this.scale.width / 2, 120 + i * 40, this.slotLabel(c, i), { fontFamily: 'monospace', color: i === this.selectedSlot ? '#ffd166' : '#ffffff' }).setOrigin(0.5)
      t.setInteractive({ useHandCursor: true })
      t.on('pointerdown', () => { this.selectedSlot = i; this.renderSlots() })
      t.on('pointerup', () => { /* single click handled above */ })
      t.on('pointerover', () => { t.setStyle({ color: '#ffd166' }) })
      t.on('pointerout', () => { t.setStyle({ color: i === this.selectedSlot ? '#ffd166' : '#ffffff' }) })
      t.on('pointerupoutside', () => {})
      t.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if ((pointer as any).downTime && ((pointer as any).upTime || 0) - (pointer as any).downTime < 250) {
          // crude double-click: go play if named
          const slot = this.slots[i]
          if (slot.name) this.selectedSlot = i, this.tryStart()
        }
      })
      this.ui.add(t)
    }

    // Bottom buttons
    const btnPlay = this.add.text(this.scale.width / 2 - 180, this.scale.height - 80, '[ Play ]', { fontFamily: 'monospace', color: '#aaf' }).setOrigin(0.5)
    btnPlay.setInteractive({ useHandCursor: true })
    btnPlay.on('pointerdown', () => this.tryStart())
    const btnCreate = this.add.text(this.scale.width / 2 - 10, this.scale.height - 80, '[ Create/Edit ]', { fontFamily: 'monospace', color: '#aaf' }).setOrigin(0.5)
    btnCreate.setInteractive({ useHandCursor: true })
    btnCreate.on('pointerdown', () => this.openCreator(this.selectedSlot))
    const btnDelete = this.add.text(this.scale.width / 2 + 160, this.scale.height - 80, '[ Delete ]', { fontFamily: 'monospace', color: '#faa' }).setOrigin(0.5)
    btnDelete.setInteractive({ useHandCursor: true })
    btnDelete.on('pointerdown', () => this.deleteSlot(this.selectedSlot))
    const btnResetQuests = this.add.text(this.scale.width / 2, this.scale.height - 48, '[ Reset Quest Data ]', { fontFamily: 'monospace', color: '#ffd166' }).setOrigin(0.5)
    btnResetQuests.setInteractive({ useHandCursor: true })
    btnResetQuests.on('pointerdown', () => this.resetQuestDataForSelected())
    this.ui.add(btnPlay); this.ui.add(btnCreate); this.ui.add(btnDelete); this.ui.add(btnResetQuests)
  }

  private deleteSlot(idx: number): void {
    const c = this.slots[idx]
    if (!c.name) return
    deleteCharacter(c.id)
    this.slots[idx] = { id: idx, name: '', class: 'melee', stats: { strength: 5, vitality: 5, intelligence: 5, dexterity: 5 } }
    this.renderSlots()
  }

  private resetQuestDataForSelected(): void {
    const c = this.slots[this.selectedSlot]
    if (!c.name) return
    // Clear per-character quest state and completion logs
    try {
      localStorage.removeItem(`quests.state.${c.id}`)
      localStorage.removeItem(`quests.completed.${c.id}`)
      // Also clear NPC state so conversation/NPC visibility resets
      localStorage.removeItem('npc.state')
      alert('Quest data reset. Start or load the world to see changes.')
    } catch {}
  }

  private openCreator(idx: number): void {
    const c = this.slots[idx]
    const overlay = this.add.container(0, 0).setDepth(1000)
    const bg = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 520, 320, 0x000000, 0.9).setStrokeStyle(1, 0xffffff, 0.2)
    overlay.add(bg)

    const nameText = this.add.text(this.scale.width / 2 - 200, this.scale.height / 2 - 120, `Name: ${c.name || '<empty>'}`, { fontFamily: 'monospace', color: '#fff' })
    overlay.add(nameText)

    const classes: CharacterClass[] = ['melee', 'ranged', 'magic']
    let classIdx = Math.max(0, classes.indexOf(c.class))
    const classText = this.add.text(this.scale.width / 2 - 200, this.scale.height / 2 - 90, `Class: ${classes[classIdx]}`, { fontFamily: 'monospace', color: '#fff' })
    overlay.add(classText)

    const stats: Stats = { ...c.stats }
    const statsText = this.add.text(this.scale.width / 2 - 200, this.scale.height / 2 - 60, this.formatStats(stats), { fontFamily: 'monospace', color: '#fff' })
    overlay.add(statsText)

    const instructions = this.add.text(this.scale.width / 2, this.scale.height / 2 + 100, 'N: Edit Name  [A/D]: Class  [Q/W/E/R]: +1 to STR/VIT/INT/DEX  Enter: Save  Esc: Cancel', { fontFamily: 'monospace', color: '#ffd166' }).setOrigin(0.5)
    overlay.add(instructions)

    const keydown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'n': case 'N': {
          const newName = prompt('Enter character name', c.name || '') ?? ''
          nameText.setText(`Name: ${newName || '<empty>'}`)
          ;(c as any)._tempName = newName
          break
        }
        case 'a': case 'A': classIdx = (classIdx + classes.length - 1) % classes.length; classText.setText(`Class: ${classes[classIdx]}`); break
        case 'd': case 'D': classIdx = (classIdx + 1) % classes.length; classText.setText(`Class: ${classes[classIdx]}`); break
        case 'q': case 'Q': stats.strength += 1; statsText.setText(this.formatStats(stats)); break
        case 'w': case 'W': stats.vitality += 1; statsText.setText(this.formatStats(stats)); break
        case 'e': case 'E': stats.intelligence += 1; statsText.setText(this.formatStats(stats)); break
        case 'r': case 'R': stats.dexterity += 1; statsText.setText(this.formatStats(stats)); break
        case 'Enter': {
          const newProfile: CharacterProfile = { id: c.id, name: (c as any)._tempName ?? c.name, class: classes[classIdx], level: c.level || 1, exp: c.exp || 0, hp: c.hp, stats: { ...stats } }
          upsertCharacter(newProfile)
          this.slots = this.ensureThreeSlots(loadCharacters())
          this.input.keyboard?.off('keydown', keydown)
          overlay.destroy()
          this.renderSlots()
          break
        }
        case 'Escape':
          this.input.keyboard?.off('keydown', keydown)
          overlay.destroy()
          break
      }
    }
    this.input.keyboard?.on('keydown', keydown)
  }

  private formatStats(s: Stats): string { return `STR: ${s.strength}  VIT: ${s.vitality}  INT: ${s.intelligence}  DEX: ${s.dexterity}` }

  private tryStart(): void {
    const c = this.slots[this.selectedSlot]
    console.log('[MainMenu] tryStart slot', this.selectedSlot, c)
    if (!c.name) { this.openCreator(this.selectedSlot); return }
    // Prevent repeated handlers, then start Town directly with a visible cue and a fallback
    this.input.keyboard?.removeAllListeners()
    const loading = this.add.text(this.scale.width / 2, this.scale.height - 16, 'Loading Town...', { fontFamily: 'monospace', color: '#bbb' }).setOrigin(0.5)
    try { this.scene.start('World', { character: c, worldId: 'town' }); console.log('[MainMenu] scene.start(World) called') } catch (err) { console.error('[MainMenu] start failed', err) }
    // Fallback: if somehow still on this scene after a tick, try again
    this.time.delayedCall(200, () => {
      if (this.scene.isActive('MainMenu')) {
        console.warn('[MainMenu] fallback start Town')
        try { this.scene.start('World', { character: c, worldId: 'town' }) } catch {}
      }
    })
  }
}
