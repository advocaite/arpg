import Phaser from 'phaser'
import { getAllQuestStates, getQuestDef } from '@/systems/Quests'

export default class QuestTrackerUI {
  private scene: Phaser.Scene
  private container?: Phaser.GameObjects.Container
  private listText?: Phaser.GameObjects.Text
  private lineItems: Phaser.GameObjects.Text[] = []

  constructor(scene: Phaser.Scene) { this.scene = scene }

  mount(): void {
    if (this.container) return
    const w = 280
    const bg = this.scene.add.rectangle(0, 0, w, 120, 0x000000, 0.35).setStrokeStyle(1, 0xffffff, 0.15)
    const title = this.scene.add.text(-w / 2 + 8, -48, 'Quests', { fontFamily: 'monospace', color: '#ffd166' })
    this.listText = this.scene.add.text(-w / 2 + 8, -28, '', { fontFamily: 'monospace', color: '#ffffff', lineSpacing: 4 })
    const y = this.scene.scale.height / 2
    this.container = this.scene.add.container(this.scene.scale.width - w / 2 - 12, y, [bg, title, this.listText]).setScrollFactor(0).setDepth(2100)
    this.scene.scale.on('resize', () => this.relayout())
    this.refresh()
  }

  relayout(): void {
    if (!this.container) return
    const w = 280
    const y = this.scene.scale.height / 2
    this.container.setPosition(this.scene.scale.width - w / 2 - 12, y)
  }

  refresh(): void {
    if (!this.listText) return
    const states = getAllQuestStates()
    const lines: string[] = []
    for (const s of states) {
      const def = getQuestDef(s.id)
      if (!def) continue
      const showProg = typeof def.requiredCount === 'number' && def.requiredCount > 0
      const prog = showProg ? `${s.progress}/${def.requiredCount}` : (s.completed ? 'Done' : 'Active')
      const color = s.completed ? '#ffdd66' : '#ffffff'
      lines.push(`[c=${color}]${def.name}${showProg ? ': ' + prog : ''}`)
    }
    // Destroy previously created line items
    try { this.lineItems.forEach(t => t.destroy()); this.lineItems = [] } catch {}
    // Phaser texts do not support inline color tags; split by line to tint per-line
    this.listText.setText('')
    const y0 = -28
    const dy = 16
    const container = this.container!
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]
      const m = raw.match(/^\[c=([^\]]+)\](.*)$/)
      const col = m ? m[1] : '#ffffff'
      const txt = m ? m[2] : raw
      const t = this.scene.add.text(-140, y0 + i * dy, txt, { fontFamily: 'monospace', color: col })
      container.add(t)
      this.lineItems.push(t)
    }
  }

  setVisible(v: boolean): void { this.container?.setVisible(v) }
}


