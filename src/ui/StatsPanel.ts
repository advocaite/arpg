import Phaser from 'phaser'

export type StatsPanelData = {
  name?: string
  className?: string
  level?: number
  base: { strength: number; vitality: number; intelligence: number; dexterity: number }
  secondary: { armor?: number; resistAll?: number; damageMultiplier?: number; critChance?: number; attackSpeed?: number }
}

export default class StatsPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private bg: Phaser.GameObjects.Rectangle
  private text: Phaser.GameObjects.Text
  private visible = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    const w = scene.scale.width
    this.container = scene.add.container(w - 10, 10).setDepth(2000).setScrollFactor(0)
    this.container.setVisible(false)
    this.bg = scene.add.rectangle(0, 0, 280, 180, 0x000000, 0.7).setOrigin(1, 0).setStrokeStyle(1, 0xffffff, 0.2)
    this.text = scene.add.text(0, 0, '', { fontFamily: 'monospace', color: '#fff' }).setOrigin(1, 0)
    this.container.add([this.bg, this.text])
  }

  setData(data: StatsPanelData): void {
    const lines: string[] = []
    const title = `${data.name || 'Unnamed'}${data.className ? ` (${data.className})` : ''}${data.level ? `  Lv.${data.level}` : ''}`
    lines.push(title)
    lines.push('')
    lines.push(`STR: ${data.base.strength}  VIT: ${data.base.vitality}`)
    lines.push(`INT: ${data.base.intelligence}  DEX: ${data.base.dexterity}`)
    lines.push('')
    const sec = data.secondary
    const dm = sec.damageMultiplier ? `x${sec.damageMultiplier.toFixed(2)}` : 'x1.00'
    const crit = sec.critChance ? `${Math.round(sec.critChance * 100)}%` : '0%'
    const atkSpd = sec.attackSpeed ? `${(sec.attackSpeed).toFixed(2)}x` : '1.00x'
    lines.push(`Armor: ${sec.armor ?? 0}  Resist: ${sec.resistAll ?? 0}`)
    lines.push(`Dmg Mult: ${dm}  Crit: ${crit}  AtkSpd: ${atkSpd}`)
    this.text.setText(lines.join('\n'))
    const padding = 12
    const bounds = this.text.getBounds()
    this.bg.setSize(Math.max(220, bounds.width + padding * 2), Math.max(120, bounds.height + padding * 2))
    this.text.setPosition(-padding, padding)
  }

  toggle(show?: boolean): void {
    this.visible = show === undefined ? !this.visible : show
    this.container.setVisible(this.visible)
  }
}



