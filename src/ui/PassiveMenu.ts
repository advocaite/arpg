import Phaser from 'phaser'

export type UIPassiveMeta = { id: string; name: string }

type OpenArgs = {
  passives: UIPassiveMeta[]
  currentId?: string
  onAccept: (passiveId?: string) => void
  onCancel?: () => void
}

export default class PassiveMenuUI {
  private scene: Phaser.Scene
  private container?: Phaser.GameObjects.Container
  private hover?: Phaser.GameObjects.Rectangle
  private select?: Phaser.GameObjects.Rectangle
  private selectedId?: string

  constructor(scene: Phaser.Scene) { this.scene = scene }

  open(args: OpenArgs): void {
    this.close()
    const { passives, currentId, onAccept, onCancel } = args
    const screenW = this.scene.scale.width, screenH = this.scene.scale.height
    const modalW = 560, modalH = 300
    const x = screenW / 2, y = screenH / 2

    try { (this.scene.input as any).topOnly = true } catch {}

    const bg = this.scene.add.rectangle(0, 0, modalW, modalH, 0x0a0a0a, 0.95).setStrokeStyle(2, 0x553333, 1).setScrollFactor(0)
    const title = this.scene.add.text(0, -modalH / 2 + 10, 'PASSIVE SKILLS', { fontFamily: 'monospace', color: '#ffb38a', fontSize: '16px' }).setOrigin(0.5, 0).setScrollFactor(0)
    const closeX = this.scene.add.text(modalW / 2 - 12, -modalH / 2 + 8, 'X', { fontFamily: 'monospace', color: '#ff7777' }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setScrollFactor(0)

    const gridX = -modalW / 2 + 16
    const gridY = -modalH / 2 + 60
    const cols = 5
    const cellW = 100, cellH = 56, gap = 10

    const all = [{ id: 'nopassive', name: 'No Passive' }, ...passives]

    this.hover = this.scene.add.rectangle(0, 0, cellW, cellH, 0x66ccff, 0.08).setStrokeStyle(2, 0x66ccff, 0.9).setVisible(false).setScrollFactor(0)
    this.select = this.scene.add.rectangle(0, 0, cellW, cellH, 0x00ff00, 0.06).setStrokeStyle(2, 0xffaa00, 0.9).setVisible(false).setScrollFactor(0)

    const nodes: Phaser.GameObjects.GameObject[] = []
    for (let i = 0; i < Math.min(all.length, cols * 2); i++) {
      const p = all[i]
      const cx = gridX + (i % cols) * (cellW + gap) + cellW / 2
      const cy = gridY + Math.floor(i / cols) * (cellH + gap) + cellH / 2
      const cell = this.scene.add.rectangle(cx, cy, cellW, cellH, 0x1a1a1a, 1).setStrokeStyle(1, 0x333333, 1).setScrollFactor(0)
      const iconKey = p.id === 'nopassive' ? 'particle' : 'icon_skill'
      const icon = this.scene.add.image(cx - 26, cy, iconKey).setDisplaySize(26, 26).setScrollFactor(0)
      const label = this.scene.add.text(cx - 8, cy - 9, p.name, { fontFamily: 'monospace', color: '#ffffff', fontSize: '12px' }).setScrollFactor(0)
      const choose = () => { this.selectedId = p.id === 'nopassive' ? undefined : p.id; this.select!.setPosition(cx, cy).setVisible(true) }
      const over = () => { this.hover!.setPosition(cx, cy).setVisible(true) }
      const out = () => { this.hover!.setVisible(false) }
      cell.setInteractive({ useHandCursor: true }).on('pointerover', over).on('pointerout', out).on('pointerup', choose)
      icon.setInteractive({ useHandCursor: true }).on('pointerover', over).on('pointerout', out).on('pointerup', choose)
      label.setInteractive({ useHandCursor: true }).on('pointerover', over).on('pointerout', out).on('pointerup', choose)
      nodes.push(cell, icon, label)
      if (currentId && currentId === p.id) { this.selectedId = currentId; this.select.setPosition(cx, cy).setVisible(true) }
    }

    const accept = this.scene.add.text(0, modalH / 2 - 24, 'ACCEPT', { fontFamily: 'monospace', color: '#ffd166', fontSize: '12px', backgroundColor: '#222' }).setPadding(6, 4, 6, 4).setOrigin(0.5).setScrollFactor(0)
      .setInteractive({ useHandCursor: true }).on('pointerup', () => { onAccept(this.selectedId); this.close() })
    const cancel = this.scene.add.text(80, modalH / 2 - 24, 'CANCEL', { fontFamily: 'monospace', color: '#ff7777', fontSize: '12px', backgroundColor: '#222' }).setPadding(6, 4, 6, 4).setOrigin(0.5).setScrollFactor(0)
      .setInteractive({ useHandCursor: true }).on('pointerup', () => { onCancel?.(); this.close() })
    closeX.on('pointerup', () => { onCancel?.(); this.close() })

    const esc = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    esc?.once('down', () => { onCancel?.(); this.close() })

    this.container = this.scene.add.container(x, y, [bg, title, ...nodes, this.hover, this.select, accept, cancel, closeX]).setScrollFactor(0).setDepth(4100)
  }

  close(): void { this.container?.destroy(); this.container = undefined; this.hover?.destroy(); this.hover = undefined; this.select?.destroy(); this.select = undefined }
}


