import Phaser from 'phaser'
import { CharacterProfile } from '@/types'
import PauseSystem from '@/systems/PauseSystem'

export default class DungeonScene extends Phaser.Scene {
  private character?: CharacterProfile
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private walls!: Phaser.Physics.Arcade.StaticGroup
  private portal!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private fpsText!: Phaser.GameObjects.Text
  private hpText!: Phaser.GameObjects.Text
  private pause!: PauseSystem
  private escKey!: Phaser.Input.Keyboard.Key
  private playerHp = 100

  constructor() { super({ key: 'Dungeon' }) }

  init(data: { character?: CharacterProfile }): void { this.character = data?.character }

  create(): void {
    this.pause = new PauseSystem(this)
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)

    this.fpsText = this.add.text(12, 12, 'FPS: --', { fontFamily: 'monospace', color: '#6cf' }).setScrollFactor(0).setDepth(1000)
    this.hpText = this.add.text(12, 32, `HP: ${this.playerHp}`, { fontFamily: 'monospace', color: '#fff' }).setScrollFactor(0).setDepth(1000)

    this.cameras.main.setBackgroundColor('#101018')
    this.physics.world.setBounds(0, 0, 1600, 1200)
    this.walls = this.physics.add.staticGroup()

    const tile = 32
    for (let x = 0; x < 1600; x += tile) { this.walls.create(x + tile / 2, tile / 2, 'wall'); this.walls.create(x + tile / 2, 1200 - tile / 2, 'wall') }
    for (let y = tile; y < 1200 - tile; y += tile) { this.walls.create(tile / 2, y + tile / 2, 'wall'); this.walls.create(1600 - tile / 2, y + tile / 2, 'wall') }

    this.player = this.physics.add.sprite(800, 600, 'player').setTint(0x55ccff)
    this.player.body.setCircle(12); this.player.setCollideWorldBounds(true)

    this.portal = this.physics.add.sprite(800, 500, 'player').setTint(0x66ffcc)
    this.portal.body.setCircle(12)

    this.physics.add.collider(this.player, this.walls)
    this.physics.add.overlap(this.player, this.portal, () => this.scene.start('Town', { character: this.character }))

    this.add.text(12, 52, 'Dungeon - Return portal ahead. (MVP)', { fontFamily: 'monospace', color: '#bbb' }).setScrollFactor(0)
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08)
  }

  update(_time: number, delta: number): void {
    this.fpsText.setText(`FPS: ${Math.round(1000 / Math.max(1, delta))}`)
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      if (this.pause.isPaused()) this.pause.resume('esc')
      else this.pause.pause('esc')
    }
    if (this.pause.isPaused()) return

    const cursors = this.input.keyboard!.createCursorKeys()
    const wasd = this.input.keyboard!.addKeys('W,A,S,D') as any
    const left = !!cursors.left?.isDown || wasd.A.isDown
    const right = !!cursors.right?.isDown || wasd.D.isDown
    const up = !!cursors.up?.isDown || wasd.W.isDown
    const down = !!cursors.down?.isDown || wasd.S.isDown
    const moveX = (right ? 1 : 0) - (left ? 1 : 0)
    const moveY = (down ? 1 : 0) - (up ? 1 : 0)
    const speed = 220
    const len = Math.hypot(moveX, moveY)
    if (len > 0) { const nx = moveX / len, ny = moveY / len; this.player.setVelocity(nx * speed, ny * speed) } else { this.player.setVelocity(0, 0) }
  }
}
