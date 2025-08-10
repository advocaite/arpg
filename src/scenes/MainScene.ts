import Phaser from 'phaser'
import HoldAction from '@/ui/HoldAction'
import WaveSystem, { type WaveConfig } from '@/systems/WaveSystem'
import ShopSystem from '@/systems/ShopSystem'
import PauseSystem from '@/systems/PauseSystem'
import { CharacterProfile } from '@/types'
import { computeDerivedStats, applyDamageReduction } from '@/systems/Stats'

type DamageNumber = Phaser.GameObjects.Text

type PlayerStats = {
  damage: number
  coins: number
}

export default class MainScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>
  private shiftKey!: Phaser.Input.Keyboard.Key
  private restartKey!: Phaser.Input.Keyboard.Key
  private respawnKey!: Phaser.Input.Keyboard.Key
  private escKey!: Phaser.Input.Keyboard.Key
  private shopKey!: Phaser.Input.Keyboard.Key

  private fpsText!: Phaser.GameObjects.Text
  private hpText!: Phaser.GameObjects.Text
  private coinText!: Phaser.GameObjects.Text
  private deathText: Phaser.GameObjects.Text | null = null
  private controlsHint!: Phaser.GameObjects.Text
  private waveText!: Phaser.GameObjects.Text

  private attackCooldownMs = 250
  private lastAttackAt = 0
  private enemies!: Phaser.Physics.Arcade.Group
  private shooters!: Phaser.Physics.Arcade.Group
  private projectiles!: Phaser.Physics.Arcade.Group
  private pickups!: Phaser.Physics.Arcade.Group
  private playerHp = 100
  private armor = 0
  private resistAll = 0
  private damageMultiplier = 1
  private level = 1
  private invulnerableUntilMs = 0
  private stats: PlayerStats = { damage: 10, coins: 0 }
  private pause!: PauseSystem

  private vignette?: Phaser.GameObjects.Rectangle
  private boss?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private bossAlive = false

  // Dash
  private isDashing = false
  private dashEndAtMs = 0
  private dashCooldownEndAtMs = 0
  private lastMoveDir: Phaser.Math.Vector2 = new Phaser.Math.Vector2(1, 0)

  // World size
  private worldWidth = 1600
  private worldHeight = 1200

  // Death
  private isDead = false
  private restartHold?: HoldAction
  private waveSystem?: WaveSystem
  private shop?: ShopSystem

  // Tilemap
  private walls!: Phaser.Physics.Arcade.StaticGroup

  // Upgrades
  private baseMoveSpeed = 220
  private attackSpeedScale = 1
  private multistrike = 1
  private attackRangeOffset = 24
  private critChance = 0
  private critMultiplier = 1.5
  private magnetRadius = 120

  private character?: CharacterProfile

  private resetState(): void {
    this.isDead = false
    this.deathText?.destroy()
    this.deathText = null
    this.restartHold?.destroy()
    this.restartHold = undefined

    this.invulnerableUntilMs = 0

    this.isDashing = false
    this.dashEndAtMs = 0
    this.dashCooldownEndAtMs = 0

    this.baseMoveSpeed = 220
    this.attackSpeedScale = 1
    this.multistrike = 1
    this.attackRangeOffset = 24
    this.critChance = 0
    this.critMultiplier = 1.5

    this.time.timeScale = 1
    this.physics.world.isPaused = false
    this.input.keyboard?.removeAllListeners()
  }

  init(data: { character?: CharacterProfile }): void {
    this.character = data?.character
    if (this.character) {
      const s = this.character.stats
      this.level = Number(this.character.level ?? 1)
      const derived = computeDerivedStats(s, this.character.class, this.level)
      this.damageMultiplier = derived.damageMultiplier
      this.armor = derived.armor
      this.resistAll = derived.resistAll
      const baseLife = 100
      this.playerHp = baseLife + s.vitality * derived.lifePerVitality
      // small Dex bumps for feel
      this.baseMoveSpeed *= 1 + s.dexterity * 0.005
      this.attackSpeedScale *= 1 + s.dexterity * 0.005
      this.critChance += s.dexterity * 0.001
      if (this.character.class === 'ranged') this.attackRangeOffset += 8
      if (this.character.class === 'magic') this.critMultiplier += 0.5
    }
  }

  constructor() { super({ key: 'Main' }) }

  create(): void {
    this.resetState()

    this.pause = new PauseSystem(this)

    const savedCoins = Number(localStorage.getItem('coins') || 0)
    if (!Number.isNaN(savedCoins)) this.stats.coins = savedCoins

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT)
    this.restartKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R)
    this.respawnKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    this.shopKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)

    // UI
    this.fpsText = this.add.text(12, 12, 'FPS: --', { fontFamily: 'monospace', color: '#6cf' }).setScrollFactor(0).setDepth(1000)
    this.hpText = this.add.text(12, 32, `HP: ${this.playerHp}`, { fontFamily: 'monospace', color: '#fff' }).setScrollFactor(0).setDepth(1000)
    this.coinText = this.add.text(12, 52, `Coins: ${this.stats.coins}`, { fontFamily: 'monospace', color: '#ffd166' }).setScrollFactor(0).setDepth(1000)
    this.controlsHint = this.add.text(this.scale.width - 12, 12, 'E: Shop  |  ESC: Pause  |  Shift: Dash  |  Space/Click: Attack', { fontFamily: 'monospace', color: '#bbb' }).setOrigin(1, 0).setScrollFactor(0).setDepth(1000)
    this.waveText = this.add.text(this.scale.width / 2, 16, 'Wave 1 - 00.0s', { fontFamily: 'monospace', color: '#aaf' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1000)

    // World bounds
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight)

    // Player and groups
    const centerX = this.worldWidth / 2
    const centerY = this.worldHeight / 2
    this.player = this.physics.add.sprite(centerX, centerY, 'player').setTint(0x55ccff)
    this.player.body.setCircle(12)
    this.player.setSize(24, 24)
    this.player.setCollideWorldBounds(true)

    this.enemies = this.physics.add.group({ maxSize: 50, runChildUpdate: false })
    this.shooters = this.physics.add.group({ maxSize: 30 })
    this.projectiles = this.physics.add.group({ maxSize: 100 })
    this.pickups = this.physics.add.group()
    this.walls = this.physics.add.staticGroup()

    // Build walls
    this.buildBorders()
    this.buildObstacles()

    // Seed enemies
    const enemy = this.physics.add.sprite(centerX + 150, centerY, 'player').setTint(0xff5555)
    enemy.body.setCircle(12)
    enemy.setDataEnabled()
    enemy.setData('speed', 100)
    this.enemies.add(enemy)

    // Wave system
    const waves: WaveConfig[] = [
      { index: 1, durationMs: 15000, spawnEveryMs: 1400, spawnCount: 1 },
      { index: 2, durationMs: 20000, spawnEveryMs: 1100, spawnCount: 2 },
      { index: 3, durationMs: 22000, spawnEveryMs: 900, spawnCount: 2 }
    ]
    this.waveSystem = new WaveSystem(
      this,
      waves,
      () => this.spawnEnemy(),
      (w) => this.showWaveBanner(`Wave ${w.index}`),
      (w) => {
        this.showWaveBanner(`Wave ${w.index} Complete`)
        if (w.index === waves[waves.length - 1].index && !this.bossAlive) this.spawnBoss()
      }
    )

    // Shop
    this.shop = new ShopSystem(
      this,
      [
        { id: 'dmg1', label: '+5 Damage', cost: 5, apply: () => { this.stats.damage += 5 } },
        { id: 'spd1', label: '+10% Move Speed', cost: 8, apply: () => { this.baseMoveSpeed *= 1.1 } },
        { id: 'atkspd', label: '+20% Attack Speed', cost: 6, apply: () => { this.attackSpeedScale *= 1.2 } },
        { id: 'multi', label: '+1 Multi-Strike', cost: 10, apply: () => { this.multistrike = Math.min(this.multistrike + 1, 5) } },
        { id: 'range', label: '+6 Attack Range', cost: 6, apply: () => { this.attackRangeOffset += 6 } },
        { id: 'crit', label: '+10% Crit (x1.5→x2.0)', cost: 12, apply: () => { this.critChance = Math.min(this.critChance + 0.10, 0.7); this.critMultiplier = Math.min(this.critMultiplier + 0.5, 2.0) } }
      ],
      () => this.stats.coins,
      (amount) => this.trySpendCoins(amount)
    )
    this.shop.setHooks(
      () => { this.pause.pause('shop'); this.freezeDynamics() },
      () => this.pause.resume('shop')
    )

    // Colliders (use walls)
    this.physics.add.collider(this.player, this.walls)
    this.physics.add.collider(this.enemies, this.walls)
    this.physics.add.collider(this.shooters, this.walls)
    this.physics.add.collider(this.projectiles, this.walls, (_img, p) => (p as Phaser.GameObjects.GameObject).destroy())

    // Overlaps
    this.physics.add.overlap(this.player, this.enemies, () => this.onPlayerHit())
    this.physics.add.overlap(this.player, this.shooters, () => this.onPlayerHit())
    this.physics.add.overlap(this.player, this.projectiles, (_p, proj) => { proj.destroy(); this.onPlayerHit() })
    this.physics.add.overlap(this.player, this.pickups, (_player, item) => this.collectPickup(item as Phaser.Types.Physics.Arcade.GameObjectWithBody))

    // Camera bounds
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight)
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08)
  }

  private buildBorders(): void {
    const tile = 32
    for (let x = 0; x < this.worldWidth; x += tile) {
      this.walls.create(x + tile / 2, tile / 2, 'wall')
      this.walls.create(x + tile / 2, this.worldHeight - tile / 2, 'wall')
    }
    for (let y = tile; y < this.worldHeight - tile; y += tile) {
      this.walls.create(tile / 2, y + tile / 2, 'wall')
      this.walls.create(this.worldWidth - tile / 2, y + tile / 2, 'wall')
    }
  }

  private buildObstacles(): void {
    const tile = 32
    for (let x = 6 * tile; x <= this.worldWidth - 6 * tile; x += 10 * tile) {
      for (let y = 6 * tile; y <= this.worldHeight - 6 * tile; y += 10 * tile) {
        this.walls.create(x, y, 'wall')
      }
    }
  }

  private trySpendCoins(amount: number): boolean {
    if (this.stats.coins >= amount) {
      this.stats.coins -= amount
      localStorage.setItem('coins', String(this.stats.coins))
      this.coinText.setText(`Coins: ${this.stats.coins}`)
      return true
    }
    return false
  }

  private collectPickup(item: Phaser.Types.Physics.Arcade.GameObjectWithBody): void {
    const sprite = item as unknown as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
    const kind = (sprite.getData('kind') as string) ?? 'coin'
    if (kind === 'coin') {
      this.stats.coins += 1
      localStorage.setItem('coins', String(this.stats.coins))
      this.coinText.setText(`Coins: ${this.stats.coins}`)
    } else if (kind === 'heart') {
      this.playerHp = Math.min(100, this.playerHp + 10)
      this.hpText.setText(`HP: ${this.playerHp}`)
    }
    sprite.destroy()
  }

  private handleDeath(): void {
    if (this.isDead) return
    this.isDead = true

    if (this.pause.isPaused()) this.pause.resume()
    this.time.timeScale = 1

    this.player.setVelocity(0, 0)
    this.player.body.enable = false
    this.player.setTint(0x333333)

    const lines = ['YOU DIED', 'Hold R to Restart', 'Press Enter to Respawn']
    this.deathText = this.add.text(this.scale.width / 2, this.scale.height / 2, lines.join('\n'), { fontFamily: 'monospace', color: '#ff7777', align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(2000)

    this.restartHold = new HoldAction(this, this.restartKey, { label: 'Hold R to Restart', durationMs: 1200, position: { x: this.scale.width / 2, y: this.scale.height / 2 + 100 }, onComplete: () => this.scene.restart() })

    this.cameras.main.flash(200, 255, 0, 0, false)
  }

  private respawn(): void {
    if (!this.isDead) return

    this.pause.resume()
    this.time.timeScale = 1
    this.physics.world.isPaused = false

    this.projectiles.clear(true, true)
    this.enemies.clear(true, true)
    this.shooters.clear(true, true)
    this.pickups.clear(true, true)

    this.playerHp = 100
    this.hpText.setText(`HP: ${this.playerHp}`)
    const centerX = this.worldWidth / 2
    const centerY = this.worldHeight / 2
    this.player.setPosition(centerX, centerY)
    this.player.setVelocity(0, 0)
    this.player.setTint(0x55ccff)
    this.player.body.enable = true
    this.invulnerableUntilMs = this.time.now + 1000

    this.deathText?.destroy(); this.deathText = null
    this.restartHold?.destroy(); this.restartHold = undefined

    const waves: WaveConfig[] = [
      { index: 1, durationMs: 15000, spawnEveryMs: 1400, spawnCount: 1 },
      { index: 2, durationMs: 20000, spawnEveryMs: 1100, spawnCount: 2 },
      { index: 3, durationMs: 22000, spawnEveryMs: 900, spawnCount: 2 }
    ]
    this.waveSystem = new WaveSystem(this, waves, () => this.spawnEnemy(), (w) => this.showWaveBanner(`Wave ${w.index}`), (w) => this.showWaveBanner(`Wave ${w.index} Complete`))

    this.spawnEnemy(); this.spawnEnemy()

    this.isDead = false
  }

  private dropLoot(x: number, y: number): void {
    const roll = Math.random()
    if (roll < 0.7) {
      const c = this.physics.add.sprite(x, y, 'coin')
      c.setDataEnabled(); c.setData('kind', 'coin')
      this.pickups.add(c)
    } else if (roll < 0.85) {
      const h = this.physics.add.sprite(x, y, 'heart')
      h.setDataEnabled(); h.setData('kind', 'heart')
      this.pickups.add(h)
    }
  }

  private spawnEnemy(): void {
    if (this.isDead) return
    const margin = 40
    const w = this.worldWidth
    const h = this.worldHeight
    const edge = Phaser.Math.Between(0, 3)
    const x = edge === 0 ? margin : edge === 1 ? w - margin : Phaser.Math.Between(margin, w - margin)
    const y = edge === 2 ? margin : edge === 3 ? h - margin : Phaser.Math.Between(margin, h - margin)

    const type = Phaser.Math.RND.pick(['chaser', 'shooter']) as 'chaser' | 'shooter'
    if (type === 'chaser') {
      const e = this.physics.add.sprite(x, y, 'player').setTint(0xff5555)
      e.body.setCircle(12)
      e.setDataEnabled(); e.setData('speed', 120)
      this.enemies.add(e)
    } else {
      const s = this.physics.add.sprite(x, y, 'player').setTint(0xff9f1c)
      s.body.setCircle(12)
      s.setDataEnabled(); s.setData('cooldown', 0); s.setData('range', 320)
      this.shooters.add(s)
    }
  }

  private onPlayerHit(): void {
    const now = this.time.now
    if (now < this.invulnerableUntilMs) return
    if (this.isDead) return

    const incoming = 10
    const reduced = applyDamageReduction(incoming, this.armor, this.resistAll, this.level)
    this.playerHp = Math.max(0, this.playerHp - reduced)
    this.hpText.setText(`HP: ${this.playerHp}`)

    if (this.playerHp <= 0) { this.handleDeath(); return }

    this.invulnerableUntilMs = now + 500
    this.player.setTint(0xffe066)
    this.cameras.main.shake(100, 0.002)
    this.time.delayedCall(120, () => this.player.setTint(0x55ccff))
  }

  private showDamage(x: number, y: number, dmg: number, color: string = '#ffd166'): void {
    const t = this.add.text(x, y - 10, `${dmg}`, { fontFamily: 'monospace', color })
    t.setDepth(1000)
    this.tweens.add({ targets: t, y: y - 28, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => t.destroy() })
    // simple burst
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5
      const speed = 40 + Math.random() * 100
      const vx = Math.cos(angle) * speed
      const vy = Math.sin(angle) * speed
      const p = this.add.image(x, y, 'particle')
      p.setTint(0xffe066)
      p.setDepth(900)
      const duration = 300 + Math.random() * 200
      this.tweens.add({ targets: p, x: x + vx, y: y + vy, alpha: 0, scale: 0, duration, ease: 'Quad.easeOut', onComplete: () => p.destroy() })
    }
  }

  private performAttack(): void {
    if (this.isDead) return
    const now = this.time.now
    const cooldown = this.attackCooldownMs / this.attackSpeedScale
    if (now - this.lastAttackAt < cooldown) return
    this.lastAttackAt = now

    const pointer = this.input.activePointer
    const baseDx = pointer ? Math.sign(pointer.worldX - this.player.x) || 1 : this.lastMoveDir.x || 1
    const baseDy = pointer ? Math.sign(pointer.worldY - this.player.y) || 0 : this.lastMoveDir.y || 0

    const strikes = this.multistrike
    for (let i = 0; i < strikes; i++) {
      const angleOffset = (strikes > 1) ? ((i - (strikes - 1) / 2) * 0.2) : 0
      const cos = Math.cos(angleOffset)
      const sin = Math.sin(angleOffset)
      const dirX = baseDx * cos - baseDy * sin
      const dirY = baseDx * sin + baseDy * cos

      const norm = Math.hypot(dirX, dirY) || 1
      const hbX = this.player.x + (dirX / norm) * this.attackRangeOffset
      const hbY = this.player.y + (dirY / norm) * this.attackRangeOffset

      const hitbox = this.physics.add.sprite(hbX, hbY, 'hitbox').setDepth(1)
      const lifetime = 100
      this.time.delayedCall(lifetime, () => hitbox.destroy())

      const onHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_obj1, obj2) => {
        const enemy = obj2 as Phaser.Types.Physics.Arcade.GameObjectWithBody
        const sprite = enemy as unknown as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
        const isCrit = Math.random() < this.critChance
        const dmg = Math.round(this.stats.damage * this.damageMultiplier * (isCrit ? this.critMultiplier : 1))
        this.showDamage(sprite.x, sprite.y, dmg, isCrit ? '#ff66ff' : '#ffd166')
        this.dropLoot(sprite.x, sprite.y)
        sprite.destroy()
        this.cameras.main.flash(60, 255, 255, 255, false)
      }
      this.physics.add.overlap(hitbox, this.enemies, onHit)
      this.physics.add.overlap(hitbox, this.shooters, onHit)

      const hitBoss: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_obj1, obj2) => {
        if (!this.bossAlive || !this.boss) return
        if (obj2 !== this.boss) return
        const isCrit = Math.random() < this.critChance
        const dmg = Math.round(this.stats.damage * this.damageMultiplier * (isCrit ? this.critMultiplier : 1))
        const hp = (this.boss.getData('hp') as number) - dmg
        this.showDamage(this.boss.x, this.boss.y, dmg, isCrit ? '#ff66ff' : '#ffd166')
        this.boss.setData('hp', hp)
        if (hp <= 0) {
          this.boss.destroy(); this.boss = undefined; this.bossAlive = false
          this.showWaveBanner('Boss Defeated!')
          for (let j = 0; j < 10; j++) this.dropLoot(this.worldWidth / 2 + (Math.random() - 0.5) * 40, this.worldHeight / 2 - 200 + (Math.random() - 0.5) * 40)
        }
      }
      if (this.bossAlive && this.boss) this.physics.add.overlap(hitbox, this.boss, hitBoss)
    }

    const originalScale = this.time.timeScale
    this.time.timeScale = 0.2
    this.time.delayedCall(60, () => { this.time.timeScale = originalScale })
  }

  private tryDash(moveX: number, moveY: number): void {
    if (this.isDead) return
    const now = this.time.now
    if (!Phaser.Input.Keyboard.JustDown(this.shiftKey)) return
    if (now < this.dashCooldownEndAtMs || this.isDashing) return

    let dir = new Phaser.Math.Vector2(moveX, moveY)
    if (dir.lengthSq() === 0) {
      const p = this.input.activePointer
      if (p) dir.set(p.worldX - this.player.x, p.worldY - this.player.y)
      else dir.copy(this.lastMoveDir)
    }
    if (dir.lengthSq() === 0) dir.set(1, 0)
    dir.normalize()

    const dashSpeed = 600
    const dashDurationMs = 140
    const dashCooldownMs = 500

    this.isDashing = true
    this.dashEndAtMs = now + dashDurationMs
    this.dashCooldownEndAtMs = now + dashCooldownMs
    this.invulnerableUntilMs = this.dashEndAtMs

    this.player.setVelocity(dir.x * dashSpeed, dir.y * dashSpeed)
    this.player.setTint(0xaadfff)

    this.time.delayedCall(dashDurationMs, () => { this.isDashing = false; this.player.setTint(0x55ccff) })
  }

  private showWaveBanner(text: string): void {
    const t = this.add.text(this.scale.width / 2, 80, text, { fontFamily: 'monospace', color: '#aaf' }).setOrigin(0.5).setScrollFactor(0).setDepth(1200)
    this.tweens.add({ targets: t, alpha: 0, y: 50, duration: 1200, ease: 'Quad.easeOut', onComplete: () => t.destroy() })
  }

  private spawnBoss(): void {
    const x = this.worldWidth / 2
    const y = this.worldHeight / 2 - 200
    this.boss = this.physics.add.sprite(x, y, 'player').setTint(0x9b5de5)
    this.boss.body.setCircle(20)
    this.boss.setScale(1.8)
    this.boss.setDataEnabled(); this.boss.setData('speed', 80); this.boss.setData('hp', 200); this.boss.setData('nextFireAt', 0)
    this.bossAlive = true

    this.physics.add.collider(this.boss, this.walls)
    this.physics.add.overlap(this.player, this.boss, () => this.onPlayerHit())
  }

  private bossFireRing(): void {
    if (!this.bossAlive || !this.boss) return
    const bullets = 12
    for (let i = 0; i < bullets; i++) {
      const angle = (Math.PI * 2 * i) / bullets
      const nx = Math.cos(angle)
      const ny = Math.sin(angle)
      this.fireProjectile(this.boss.x, this.boss.y, nx, ny)
    }
  }

  update(time: number, delta: number): void {
    this.fpsText.setText(`FPS: ${Math.round(1000 / Math.max(1, delta))}`)

    if (this.waveSystem && !this.waveSystem.isFinished) {
      const secs = (this.waveSystem.timeLeftMs / 1000).toFixed(1)
      this.waveText.setText(`Wave ${this.waveSystem.currentNumber} - ${secs}s`)
    }

    if (this.shop?.isOpen() && (Phaser.Input.Keyboard.JustDown(this.shopKey) || Phaser.Input.Keyboard.JustDown(this.escKey))) { this.shop.toggle(); return }

    if (!this.shop?.isOpen() && Phaser.Input.Keyboard.JustDown(this.escKey)) {
      if (this.pause.isPaused()) this.pause.resume('esc')
      else { this.pause.pause('esc'); this.freezeDynamics() }
    }

    if (this.pause.isPaused() && !this.isDead) { this.waveSystem?.update(0); return }

    if (Phaser.Input.Keyboard.JustDown(this.shopKey)) this.shop?.toggle()

    this.waveSystem?.update(delta)

    if (this.isDead) { this.restartHold?.update(delta); if (Phaser.Input.Keyboard.JustDown(this.respawnKey)) this.respawn(); return }

    const left = !!this.cursors.left?.isDown || this.wasd.A.isDown
    const right = !!this.cursors.right?.isDown || this.wasd.D.isDown
    const up = !!this.cursors.up?.isDown || this.wasd.W.isDown
    const down = !!this.cursors.down?.isDown || this.wasd.S.isDown

    const moveX = (right ? 1 : 0) - (left ? 1 : 0)
    const moveY = (down ? 1 : 0) - (up ? 1 : 0)

    this.tryDash(moveX, moveY)

    if (this.isDashing) {
      // keep dash velocity
    } else {
      const length = Math.hypot(moveX, moveY)
      if (length > 0) { const nx = moveX / length, ny = moveY / length; this.player.setVelocity(nx * this.baseMoveSpeed, ny * this.baseMoveSpeed); this.lastMoveDir.set(nx, ny) }
      else { this.player.setVelocity(0, 0) }
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.space!) || this.input.activePointer.isDown) this.performAttack()

    this.enemies.children.iterate((child): boolean => {
      const enemy = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined
      if (!enemy || !enemy.body) return true
      const ex = enemy.x - this.player.x, ey = enemy.y - this.player.y
      const dist = Math.hypot(ex, ey) || 1
      const spd = (enemy.getData('speed') as number) ?? 100
      enemy.setVelocity((-ex / dist) * spd, (-ey / dist) * spd)
      return true
    })

    const now = this.time.now
    this.shooters.children.iterate((child): boolean => {
      const s = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined
      if (!s || !s.body) return true
      const dx = this.player.x - s.x, dy = this.player.y - s.y
      const d = Math.hypot(dx, dy)
      const range = (s.getData('range') as number) ?? 320
      const pending = (s.getData('pendingFireAt') as number) ?? 0
      if (d < range) {
        const cd = (s.getData('cooldown') as number) ?? 0
        if (pending > 0 && now >= pending) { this.fireProjectile(s.x, s.y, dx / d, dy / d); s.setData('cooldown', now + 900); s.setData('pendingFireAt', 0); s.clearTint() }
        else if (pending === 0 && now >= cd) { s.setTint(0xffe066); s.setData('pendingFireAt', now + 300) }
      } else { if (pending > 0) { s.setData('pendingFireAt', 0); s.clearTint() } }
      return true
    })

    this.pickups.children.iterate((child): boolean => {
      const item = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined
      if (!item || !item.body) return true
      const dx = this.player.x - item.x, dy = this.player.y - item.y
      const dist = Math.hypot(dx, dy)
      if (dist < this.magnetRadius && dist > 4) { const nx = dx / dist, ny = dy / dist; const pull = 180; item.setVelocity(nx * pull, ny * pull) }
      return true
    })

    if (this.bossAlive && this.boss && !this.pause.isPaused()) {
      const ex = this.boss.x - this.player.x, ey = this.boss.y - this.player.y
      const dist = Math.hypot(ex, ey) || 1
      const spd = (this.boss.getData('speed') as number) ?? 80
      this.boss.setVelocity((-ex / dist) * spd, (-ey / dist) * spd)
      const nextAt = (this.boss.getData('nextFireAt') as number) ?? 0
      if (nextAt === 0) this.boss.setData('nextFireAt', now + 1000)
      else if (now + delta >= nextAt && now < nextAt) this.boss.setTint(0xff66ff)
      else if (now >= nextAt) { this.boss.clearTint(); this.bossFireRing(); this.boss.setData('nextFireAt', now + 1600) }
    }

    const ratio = 1 - this.playerHp / 100
    const alpha = Phaser.Math.Clamp(ratio * 0.35, 0, 0.35)
    if (this.vignette) this.vignette.setAlpha(alpha)
  }

  private fireProjectile(x: number, y: number, nx: number, ny: number): void {
    const p = this.physics.add.image(x, y, 'projectile').setDepth(1)
    const speed = 260
    p.setVelocity(nx * speed, ny * speed)
    this.projectiles.add(p)
    this.time.delayedCall(3000, () => p.destroy())
  }

  private freezeDynamics(): void {
    this.player?.setVelocity(0, 0)
    this.enemies?.children.iterate((child) => { (child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined)?.setVelocity(0, 0); return true })
    this.shooters?.children.iterate((child) => { (child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined)?.setVelocity(0, 0); return true })
    this.projectiles?.children.iterate((child) => { (child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined)?.setVelocity(0, 0); return true })
    this.boss?.setVelocity(0, 0)
  }
}
