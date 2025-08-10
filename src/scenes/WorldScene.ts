import Phaser from 'phaser'
import PauseSystem from '@/systems/PauseSystem'
import { CharacterProfile, WorldConfig, PortalConfig, SpawnerConfig } from '@/types'
import { loadWorldConfig } from '@/systems/WorldLoader'
import townConfig from '@/data/worlds/town.json'
import HotbarUI from '@/ui/Hotbar'
import { loadHotbar, saveHotbar } from '@/systems/Inventory'
import { computeDerivedStats } from '@/systems/Stats'
import StatsPanel from '@/ui/StatsPanel'
import ShopUI from '@/ui/Shop'
import { listItems } from '@/systems/ItemDB'
import { getSkill } from '@/systems/SkillDB'
import { executeSkill } from '@/systems/SkillRuntime'
import SkillsMenuUI from '@/ui/SkillsMenu'
import SkillsOverviewUI from '@/ui/SkillsOverview'
import skillsRaw from '@/data/skills.json'
import { applyDamageReduction } from '@/systems/Stats'
import HoldAction from '@/ui/HoldAction'

export default class WorldScene extends Phaser.Scene {
  private character?: CharacterProfile
  private worldId: string = 'town'
  private worldConfig?: WorldConfig

  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>
  private escKey!: Phaser.Input.Keyboard.Key
  private pause!: PauseSystem

  private fpsText!: Phaser.GameObjects.Text
  private hpText!: Phaser.GameObjects.Text
  private coinText!: Phaser.GameObjects.Text
  private playerHp = 100
  private baseMoveSpeed = 220
  private critChance = 0
  private attackSpeedScale = 1
  private armor = 0
  private resistAll = 0
  private damageMultiplier = 1
  private level = 1
  private lastMoveDir: Phaser.Math.Vector2 = new Phaser.Math.Vector2(1, 0)
  private attackCooldownMs = 250
  private lastAttackAt = 0
  private attackRangeOffset = 24
  private multistrike = 1

  private portals: Array<{ sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody; cfg: PortalConfig }> = []
  private walls!: Phaser.Physics.Arcade.StaticGroup
  private enemies!: Phaser.Physics.Arcade.Group
  private projectiles!: Phaser.Physics.Arcade.Group
  private pickups!: Phaser.Physics.Arcade.Group
  private hotbar?: HotbarUI
  private hotbarCfg: { potionRefId?: string; skillRefIds: (string | undefined)[] } = { potionRefId: undefined, skillRefIds: [] }
  private statsPanel?: StatsPanel
  private kKey!: Phaser.Input.Keyboard.Key
  private shiftKey!: Phaser.Input.Keyboard.Key
  private eKey!: Phaser.Input.Keyboard.Key
  private qKey!: Phaser.Input.Keyboard.Key
  private numKeys!: Phaser.Input.Keyboard.Key[]
  private restartKey!: Phaser.Input.Keyboard.Key
  private respawnKey!: Phaser.Input.Keyboard.Key
  private skillCooldownUntil: number[] = [0, 0, 0, 0]
  private mana = 100
  private manaText!: Phaser.GameObjects.Text
  private shopUI?: ShopUI
  private npcs: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody[] = []
  private coins = 0
  private skillsMenu?: SkillsMenuUI
  private skillsOverview?: SkillsOverviewUI
  private invulnerableUntilMs = 0
  private isDead = false
  private deathText?: Phaser.GameObjects.Text
  private restartHold?: HoldAction
  private lastCheckpoint: { x: number; y: number } | null = null
  private uiModalOpen = false

  constructor() { super({ key: 'World' }) }

  init(data: { character?: CharacterProfile; worldId?: string }): void {
    this.character = data?.character
    this.worldId = data?.worldId || 'town'
  }

  async create(): Promise<void> {
    this.cameras.main.setBackgroundColor('#0b0f18')
    this.pause = new PauseSystem(this)

    // Inputs
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this.kKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.K)
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT)
    this.eKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    this.restartKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R)
    this.respawnKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    this.qKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q)
    this.numKeys = [
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR)
    ]

    // UI
    this.fpsText = this.add.text(12, 12, 'FPS: --', { fontFamily: 'monospace', color: '#6cf' }).setScrollFactor(0).setDepth(1000)
    this.hpText = this.add.text(12, 32, `HP: ${this.playerHp}`, { fontFamily: 'monospace', color: '#fff' }).setScrollFactor(0).setDepth(1000)
    this.coinText = this.add.text(12, 52, `Coins: ${Number(localStorage.getItem('coins') || 0) || 0}`, { fontFamily: 'monospace', color: '#ffd166' }).setScrollFactor(0).setDepth(1000)
    this.manaText = this.add.text(12, 72, `Mana: ${this.mana}`, { fontFamily: 'monospace', color: '#66ccff' }).setScrollFactor(0).setDepth(1000)

    // Load world config (import for known ids; fetch fallback for others)
    if (this.worldId === 'town' || this.worldId === 'town_default') {
      this.worldConfig = townConfig as WorldConfig
    } else {
      this.worldConfig = await loadWorldConfig(`/src/data/worlds/${this.worldId}.json`)
    }
    const w = this.worldConfig.width, h = this.worldConfig.height
    this.physics.world.setBounds(0, 0, w, h)
    this.walls = this.physics.add.staticGroup()
    this.enemies = this.physics.add.group({ maxSize: 200 })
    this.projectiles = this.physics.add.group({ maxSize: 100, allowGravity: false })
    this.pickups = this.physics.add.group()

    // Build borders (placeholder until tilemaps)
    const tile = 32
    for (let x = 0; x < w; x += tile) { this.walls.create(x + tile / 2, tile / 2, 'wall'); this.walls.create(x + tile / 2, h - tile / 2, 'wall') }
    for (let y = tile; y < h - tile; y += tile) { this.walls.create(tile / 2, y + tile / 2, 'wall'); this.walls.create(w - tile / 2, y + tile / 2, 'wall') }

    // Player
    this.player = this.physics.add.sprite(w / 2, h / 2, 'player').setTint(0x55ccff)
    this.player.body.setCircle(12)
    this.player.setCollideWorldBounds(true)
    this.isDead = false
    this.invulnerableUntilMs = 0

    // Derived stats (HP/move feel)
    if (this.character) {
      const s = this.character.stats
      this.level = Number(this.character.level ?? 1)
      const d = computeDerivedStats(s, this.character.class, this.level)
      this.playerHp = 100 + s.vitality * d.lifePerVitality
      this.armor = d.armor
      this.resistAll = d.resistAll
      this.damageMultiplier = d.damageMultiplier
      // tiny dex QoL bumps
      this.baseMoveSpeed *= 1 + s.dexterity * 0.005
      this.attackSpeedScale *= 1 + s.dexterity * 0.005
      this.critChance += s.dexterity * 0.001
      this.hpText.setText(`HP: ${this.playerHp}`)
    }

    // Hotbar
    this.hotbarCfg = loadHotbar(this.character?.id ?? 0)
    this.hotbar = new HotbarUI(this)
    const cfgToUse = (this.hotbarCfg.potionRefId || this.hotbarCfg.skillRefIds.length) ? this.hotbarCfg : { potionRefId: 'potion_small', skillRefIds: ['skill_dash', undefined, undefined, undefined] as (string | undefined)[] }
    this.hotbar.mount(cfgToUse)
    this.hotbar.setOnSkillClick(() => this.openSkillsOverview())
    this.hotbar.setOnPrimaryClick(() => this.openSkillsOverview())
    this.hotbar.setOnSecondaryClick(() => this.openSkillsOverview())

    // Portals
    for (const p of this.worldConfig.portals) {
      const s = this.physics.add.sprite(p.x, p.y, 'player').setTint(0x66ffcc)
      s.body.setCircle(12)
      ;(s as any).isInvulnerable = true
      this.add.text(p.x, p.y - 30, p.name, { fontFamily: 'monospace', color: '#aaf' }).setOrigin(0.5)
      this.portals.push({ sprite: s, cfg: p })
      this.physics.add.overlap(this.player, s, () => this.teleport(p))
    }

    // NPCs
    for (const n of this.worldConfig.npcs) {
      const s = this.physics.add.sprite(n.x, n.y, 'player').setTint(0xffcc66)
      s.body.setCircle(12)
      ;(s as any).isInvulnerable = true
      this.add.text(n.x, n.y - 28, n.name, { fontFamily: 'monospace', color: '#ffd166' }).setOrigin(0.5)
      s.setData('role', n.role)
      this.npcs.push(s)
    }

    // Colliders & Camera
    this.physics.add.collider(this.player, this.walls)
    this.physics.add.collider(this.enemies, this.walls)
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08)

    // Stats panel
    this.statsPanel = new StatsPanel(this)
    this.updateStatsPanel()
    // bind overview to O
    this.input.keyboard?.on('keydown-O', () => this.openSkillsOverview())

    // Spawners from config (optional)
    this.setupSpawners(this.worldConfig.spawners || [])

    // Checkpoints (optional)
    this.setupCheckpoints(this.worldConfig.checkpoints || [])
  }

  private teleport(p: PortalConfig): void {
    const payload = { character: this.character }
    console.log('[World] teleport via portal', p.id, 'to', p.destinationScene, p.destinationId)
    if (p.destinationScene === 'World' && p.destinationId) {
      this.scene.start('World', { ...payload, worldId: p.destinationId })
      return
    }
    // Back-compat: jump to legacy scenes if specified
    this.scene.start(p.destinationScene, { ...payload, portalId: p.destinationId })
  }

  update(_time: number, delta: number): void {
    this.fpsText.setText(`FPS: ${Math.round(1000 / Math.max(1, delta))}`)
    if (!this.player || !this.player.body || !this.worldConfig) return
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) { if (this.pause.isPaused()) this.pause.resume('esc'); else this.pause.pause('esc') }
    if (Phaser.Input.Keyboard.JustDown(this.kKey)) this.statsPanel?.toggle()
    if (this.pause.isPaused()) return

    // If dead, only update death UI interactions
    if (this.isDead) {
      this.restartHold?.update(delta)
      if (Phaser.Input.Keyboard.JustDown(this.respawnKey)) this.respawnAtCheckpoint()
      return
    }

    const left = !!this.cursors.left?.isDown || this.wasd.A.isDown
    const right = !!this.cursors.right?.isDown || this.wasd.D.isDown
    const up = !!this.cursors.up?.isDown || this.wasd.W.isDown
    const down = !!this.cursors.down?.isDown || this.wasd.S.isDown

    const moveX = (right ? 1 : 0) - (left ? 1 : 0)
    const moveY = (down ? 1 : 0) - (up ? 1 : 0)
    const len = Math.hypot(moveX, moveY)
    // Dash + movement
    this.tryDash(moveX, moveY)
    if (!this.isDashing) {
      if (len > 0) { const nx = moveX / len, ny = moveY / len; this.player.setVelocity(nx * this.baseMoveSpeed, ny * this.baseMoveSpeed); this.lastMoveDir.set(nx, ny) } else { this.player.setVelocity(0, 0) }
    }

    if (!this.uiModalOpen && Phaser.Input.Keyboard.JustDown(this.cursors.space!)) this.performAttack()
    // Suppress attack on UI clicks (respect Hotbar clicks)
    if (!this.uiModalOpen && this.input.activePointer.isDown && this.input.activePointer.y < this.scale.height - 60) this.performAttack()

    // Hotbar: Q (potion), 1-4 skills
    if (Phaser.Input.Keyboard.JustDown(this.qKey) && this.hotbarCfg.potionRefId) {
      // For now, just restore a small amount like Arena
      this.playerHp = Math.min(this.playerHp + 20, 999)
      this.hpText.setText(`HP: ${this.playerHp}`)
    }
    for (let i = 0; i < 4; i++) {
      if (!this.uiModalOpen && Phaser.Input.Keyboard.JustDown(this.numKeys[i])) {
        const nowTs = this.time.now
        if (nowTs < this.skillCooldownUntil[i]) continue
        const skillId = this.hotbarCfg.skillRefIds[i]
        if (!skillId) continue
        const skill = getSkill(skillId)
        if (!skill) continue
        const cd = Number(skill.cooldownMs ?? 600)
        this.skillCooldownUntil[i] = nowTs + cd
        executeSkill(skill, { scene: this, caster: this.player as any, projectiles: this.projectiles, onAoeDamage: (x, y, radius, damage) => {
          const dxp = this.player.x - x, dyp = this.player.y - y; const dp = Math.hypot(dxp, dyp)
          if (dp <= radius) {
            const reduced = applyDamageReduction(damage, this.armor, this.resistAll, this.level)
            this.playerHp = Math.max(0, this.playerHp - reduced); this.hpText.setText(`HP: ${this.playerHp}`)
          }
        } })
      }
    }

    // Interact
    if (!this.uiModalOpen && Phaser.Input.Keyboard.JustDown(this.eKey)) { console.log('[World] E pressed; attempting talk'); this.tryTalk() }

    // Simple enemy chase
    this.enemies.children.iterate((child): boolean => {
      const enemy = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined
      if (!enemy || !enemy.body) return true
      const ex = enemy.x - this.player.x, ey = enemy.y - this.player.y
      const dist = Math.hypot(ex, ey) || 1
      const spd = (enemy.getData('speed') as number) || 100
      if (dist > 2) enemy.setVelocity((-ex / dist) * spd, (-ey / dist) * spd)
      // Damage on touch with brief i-frames
      const now = this.time.now
      if (!this.isDead && now >= this.invulnerableUntilMs && dist < 16) {
        const incoming = 10
        const reduced = applyDamageReduction(incoming, this.armor, this.resistAll, this.level)
        this.playerHp = Math.max(0, this.playerHp - reduced)
        this.hpText.setText(`HP: ${this.playerHp}`)
        this.invulnerableUntilMs = now + 500
        this.player.setTint(0xffe066)
        this.time.delayedCall(120, () => this.player.setTint(0x55ccff))
        if (this.playerHp <= 0) this.handleDeath()
      }
      return true
    })
  }

  private performAttack(): void {
    const now = this.time.now
    const cooldown = this.attackCooldownMs / Math.max(0.001, this.attackSpeedScale)
    if (now - this.lastAttackAt < cooldown) return
    this.lastAttackAt = now

    const baseDx = this.lastMoveDir.x || 1
    const baseDy = this.lastMoveDir.y || 0

    const strikes = this.multistrike
    for (let i = 0; i < strikes; i++) {
      const angleOffset = (strikes > 1) ? ((i - (strikes - 1) / 2) * 0.2) : 0
      const cos = Math.cos(angleOffset), sin = Math.sin(angleOffset)
      const dirX = baseDx * cos - baseDy * sin
      const dirY = baseDx * sin + baseDy * cos
      const norm = Math.hypot(dirX, dirY) || 1
      const hbX = this.player.x + (dirX / norm) * this.attackRangeOffset
      const hbY = this.player.y + (dirY / norm) * this.attackRangeOffset
      const hitbox = this.physics.add.sprite(hbX, hbY, 'hitbox').setDepth(1)
      this.time.delayedCall(100, () => hitbox.destroy())
      const isCrit = Math.random() < this.critChance
      const dmg = Math.round(10 * this.damageMultiplier * (isCrit ? 1.5 : 1))
      const onHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_o1, o2) => {
        const target = o2 as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
        if ((target as any).isInvulnerable) return
        target.destroy()
        const t = this.add.text(hbX, hbY - 10, `${dmg}`, { fontFamily: 'monospace', color: isCrit ? '#ff66ff' : '#ffd166' }).setDepth(900)
        this.tweens.add({ targets: t, y: hbY - 28, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => t.destroy() })
      }
      this.physics.add.overlap(hitbox, this.enemies, onHit)
    }
  }

  private fireDemoProjectiles(): void {
    if (!this.projectiles) return
    const count = 8
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count
      const nx = Math.cos(ang), ny = Math.sin(ang)
      const p = this.physics.add.sprite(this.player.x, this.player.y, 'projectile')
      p.setDepth(1)
      p.body.allowGravity = false
      p.setActive(true)
      p.setVelocity(nx * 260, ny * 260)
      this.projectiles.add(p)
      this.time.delayedCall(2000, () => p.destroy())
    }
  }

  private setupSpawners(spawners: SpawnerConfig[]): void {
    for (const s of spawners) {
      const start = Number(s.startDelayMs ?? 0)
      const every = Math.max(200, Number(s.everyMs || 1000))
      const count = Math.max(1, Number(s.count || 1))
      const limit = Number(s.limit || 0)
      let spawned = 0
      // Spawn some immediately to ensure activity on entry
      for (let i = 0; i < Math.min(count, 3); i++) {
        const x = Phaser.Math.Between(40, this.worldConfig!.width - 40)
        const y = Phaser.Math.Between(40, this.worldConfig!.height - 40)
        const e = this.physics.add.sprite(x, y, 'player').setTint(0xff5555)
        e.body.setCircle(12)
        e.setData('speed', 100)
        this.enemies.add(e)
        spawned++
      }
      this.time.delayedCall(start, () => {
        const evt = this.time.addEvent({ delay: every, loop: true, callback: () => {
          for (let i = 0; i < count; i++) {
            const x = Phaser.Math.Between(40, this.worldConfig!.width - 40)
            const y = Phaser.Math.Between(40, this.worldConfig!.height - 40)
            const e = this.physics.add.sprite(x, y, 'player').setTint(0xff5555)
            e.body.setCircle(12)
            e.setData('speed', 100)
            this.enemies.add(e)
            spawned++
            if (limit > 0 && spawned >= limit) { evt.remove(false); break }
          }
        } })
      })
    }
  }

  // Dash (Arena-like)
  private isDashing = false
  private dashEndAtMs = 0
  private dashCooldownEndAtMs = 0
  private tryDash(moveX: number, moveY: number): void {
    const now = this.time.now
    if (!Phaser.Input.Keyboard.JustDown(this.shiftKey)) return
    if (now < this.dashCooldownEndAtMs || this.isDashing) return
    let dir = new Phaser.Math.Vector2(moveX, moveY)
    if (dir.lengthSq() === 0) { const p = this.input.activePointer; if (p) dir.set(p.worldX - this.player.x, p.worldY - this.player.y); else dir.copy(this.lastMoveDir) }
    if (dir.lengthSq() === 0) dir.set(1, 0)
    dir.normalize()
    const dashSpeed = 600, dashDurationMs = 140, dashCooldownMs = 500
    this.isDashing = true; this.dashEndAtMs = now + dashDurationMs; this.dashCooldownEndAtMs = now + dashCooldownMs
    this.player.setVelocity(dir.x * dashSpeed, dir.y * dashSpeed); this.player.setTint(0xaadfff)
    this.time.delayedCall(dashDurationMs, () => { this.isDashing = false; this.player.setTint(0x55ccff) })
  }

  private tryTalk(): void {
    let nearest: { s: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null; d: number } = { s: null, d: Infinity }
    for (const s of this.npcs) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y)
      if (d < nearest.d) nearest = { s, d }
    }
    console.log('[World] tryTalk nearest?', !!nearest.s, 'dist', nearest.d)
    if (!nearest.s || nearest.d > 120) { console.log('[World] no NPC in range to talk; dist', nearest.d); return }
    const role = (nearest.s.getData('role') as string) || ''
    console.log('[World] nearest role', role)
    if (role === 'shopkeeper') { console.log('[World] opening shop'); this.openShop() }
  }

  private openShop(): void {
    const stock = listItems().slice(0, 3)
    this.shopUI?.open('Shop', this.coins, stock, (it) => {
      const price = it.rarity === 'legendary' ? 100 : it.rarity === 'epic' ? 40 : it.rarity === 'rare' ? 15 : 5
      if (this.coins < price) return false
      this.coins -= price
      localStorage.setItem('coins', String(this.coins))
      this.coinText.setText(`Coins: ${this.coins}`)
      // Disable hotbar interactions while shop is open
      try { this.hotbar?.setAllowSkillClick(false) } catch {}
      return true
    })
    // Re-enable hotbar clicks after shop closes via ESC
    const esc = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    esc?.once('down', () => { try { this.hotbar?.setAllowSkillClick(true) } catch {} })
  }

  private openSkillSelect(slotIndex: number): void {
    // New D3-like menu
    if (!this.skillsMenu) this.skillsMenu = new SkillsMenuUI(this)
    const skills = (skillsRaw as any).skills.map((s: any) => ({ id: s.id, name: s.name }))
    const currentId = this.hotbarCfg.skillRefIds[slotIndex]
    const disabledIds = (this.hotbarCfg.skillRefIds.filter(Boolean) as string[])
    this.uiModalOpen = true
    this.hotbar?.setAllowSkillClick(false)
    this.skillsMenu.open({
      slotIndex,
      skills,
      currentId,
      disabledIds,
      level: Number(this.character?.level ?? 1),
      onAccept: (id) => {
        console.log('[World] skill chosen for slot', slotIndex, id)
        this.hotbarCfg.skillRefIds[slotIndex] = id
        this.hotbar?.mount(this.hotbarCfg)
        const charId = this.character?.id ?? 0
        saveHotbar(charId, this.hotbarCfg)
        this.uiModalOpen = false
        this.hotbar?.setAllowSkillClick(true)
      },
      onCancel: () => {
        this.uiModalOpen = false
        this.hotbar?.setAllowSkillClick(true)
      }
    })
    const esc = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    esc?.once('down', () => { this.uiModalOpen = false; this.hotbar?.setAllowSkillClick(true) })
  }

  private async openSkillsOverview(): Promise<void> {
    if (!this.skillsOverview) {
      const mod = await import('@/ui/SkillsOverview')
      const Cls = (mod as any).default
      this.skillsOverview = new Cls(this)
    }
    const skills = (skillsRaw as any).skills.map((s: any) => ({ id: s.id, name: s.name }))
    const current = { primary: (this.hotbarCfg as any).primaryRefId, secondary: (this.hotbarCfg as any).secondaryRefId, slots: [...this.hotbarCfg.skillRefIds], passives: [undefined, undefined, undefined, undefined, undefined] as (string | undefined)[] }
    this.uiModalOpen = true
    this.hotbar?.setAllowSkillClick(false)
    this.skillsOverview!.open({
      skillsList: skills,
      passivesList: [{ id: 'pass_a', name: 'Ruthless' }, { id: 'pass_b', name: 'Berserker Rage' }],
      current,
      onUpdate: (next) => {
        console.log('[Overview] Accept next', JSON.stringify(next))
        const before = [...next.slots]
        // Do NOT mirror primary/secondary into action slots; those are independent
        next.slots = next.slots.map(v => (v == null ? undefined : v))
        console.log('[Overview] Slots before', JSON.stringify(before), 'after', JSON.stringify(next.slots))
        ;(this.hotbarCfg as any).primaryRefId = next.primary
        ;(this.hotbarCfg as any).secondaryRefId = next.secondary
        this.hotbarCfg.skillRefIds = next.slots
        const charId = this.character?.id ?? 0
        console.log('[Overview] Persist hotbar char', charId, 'cfg', JSON.stringify(this.hotbarCfg))
        saveHotbar(charId, this.hotbarCfg)
        this.hotbar?.mount(this.hotbarCfg)
      },
      onClose: () => { this.uiModalOpen = false; this.hotbar?.setAllowSkillClick(true) }
    })
    const esc = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    esc.once('down', () => { this.uiModalOpen = false; try { this.hotbar?.setAllowSkillClick(true); (this.skillsOverview as any)?.close?.() } catch {} })
  }

  private async openSkillsOverviewWithFocus(index: number): Promise<void> {
    await this.openSkillsOverview()
    // re-open overview immediately with focus on a specific action slot
    const skills = (skillsRaw as any).skills.map((s: any) => ({ id: s.id, name: s.name }))
    const current = { primary: this.hotbarCfg.skillRefIds[0], secondary: this.hotbarCfg.skillRefIds[1], slots: [...this.hotbarCfg.skillRefIds], passives: [undefined, undefined, undefined, undefined, undefined] as (string | undefined)[] }
    this.skillsOverview!.open({
      skillsList: skills,
      passivesList: [{ id: 'pass_a', name: 'Ruthless' }, { id: 'pass_b', name: 'Berserker Rage' }],
      current,
      onUpdate: (next) => {
        if (typeof next.primary !== 'undefined') next.slots[0] = next.primary
        if (typeof next.secondary !== 'undefined') next.slots[1] = next.secondary
        this.hotbarCfg.skillRefIds = next.slots
        const charId = this.character?.id ?? 0
        saveHotbar(charId, this.hotbarCfg)
        this.hotbar?.mount(this.hotbarCfg)
      },
      onClose: () => { this.uiModalOpen = false; this.hotbar?.setAllowSkillClick(true) },
      focusIndex: index
    })
  }

  private setupCheckpoints(list: { x: number; y: number; name?: string }[]): void {
    for (const c of list) {
      const s = this.physics.add.sprite(c.x, c.y, 'player').setTint(0x66aaff)
      s.body.setCircle(10)
      ;(s as any).isInvulnerable = true
      if (c.name) this.add.text(c.x, c.y - 26, c.name, { fontFamily: 'monospace', color: '#66aaff' }).setOrigin(0.5)
      this.physics.add.overlap(this.player, s, () => { this.lastCheckpoint = { x: c.x, y: c.y } })
    }
  }

  private handleDeath(): void {
    if (this.isDead) return
    this.isDead = true
    this.player.setVelocity(0, 0)
    this.player.body.enable = false
    this.player.setTint(0x333333)
    const lines = ['YOU DIED', 'Hold R to Restart (Town)', 'Press Enter to Respawn at Checkpoint']
    this.deathText = this.add.text(this.scale.width / 2, this.scale.height / 2, lines.join('\n'), { fontFamily: 'monospace', color: '#ff7777', align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(2000)
    // Hold-to-restart with progress bar
    this.restartHold?.destroy();
    this.restartHold = new HoldAction(this, this.restartKey, { label: 'Hold R to Restart', durationMs: 1200, position: { x: this.scale.width / 2, y: this.scale.height / 2 + 100 }, onComplete: () => this.scene.start('World', { character: this.character, worldId: 'town' }) })
    this.respawnKey.once('down', () => this.respawnAtCheckpoint())
  }

  private respawnAtCheckpoint(): void {
    this.deathText?.destroy(); this.deathText = undefined
    this.restartHold?.destroy(); this.restartHold = undefined
    this.isDead = false
    // Restore defaults
    this.playerHp = Math.max(50, this.playerHp)
    this.hpText.setText(`HP: ${this.playerHp}`)
    const pos = this.lastCheckpoint || { x: this.worldConfig!.width / 2, y: this.worldConfig!.height / 2 }
    this.player.setPosition(pos.x, pos.y)
    this.player.setTint(0x55ccff)
    this.player.body.enable = true
    this.invulnerableUntilMs = this.time.now + 1000
  }

  private updateStatsPanel(): void {
    const s = this.character?.stats
    if (!s || !this.statsPanel) return
    this.statsPanel.setData({
      name: this.character?.name,
      className: this.character?.class,
      level: this.level,
      base: { strength: s.strength, vitality: s.vitality, intelligence: s.intelligence, dexterity: s.dexterity },
      secondary: { armor: this.armor, resistAll: this.resistAll, damageMultiplier: this.damageMultiplier, critChance: this.critChance, attackSpeed: this.attackSpeedScale }
    })
  }
}


