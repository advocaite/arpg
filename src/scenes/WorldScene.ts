import Phaser from 'phaser'
import PauseSystem from '@/systems/PauseSystem'
import { CharacterProfile, WorldConfig, PortalConfig, SpawnerConfig } from '@/types'
import { loadWorldConfig } from '@/systems/WorldLoader'
import townConfig from '@/data/worlds/town.json'
import HotbarUI from '@/ui/Hotbar'
import OrbsUI from '@/ui/Orbs'
import { loadHotbar, saveHotbar } from '@/systems/Inventory'
import { computeDerivedStats } from '@/systems/Stats'
import StatsPanel from '@/ui/StatsPanel'
import ShopUI from '@/ui/Shop'
import { listItems } from '@/systems/ItemDB'
import { getMonster } from '@/systems/MonsterDB'
import { getSkill, listSkills } from '@/systems/SkillDB'
import { upsertCharacter } from '@/systems/SaveSystem'
import { executeSkill } from '@/systems/SkillRuntime'
import SkillsMenuUI from '@/ui/SkillsMenu'
import SkillsOverviewUI from '@/ui/SkillsOverview'
import skillsRaw from '@/data/skills.json'
import passivesRaw from '@/data/passives.json'
import { applyDamageReduction } from '@/systems/Stats'
import { expRequiredForLevel } from '@/systems/Experience'
import { executeEffectByRef } from '@/systems/Effects'
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
  private maxHp = 100
  private baseMoveSpeed = 220
  private critChance = 0
  private attackSpeedScale = 1
  private armor = 0
  private resistAll = 0
  private damageMultiplier = 1
  private elementResists: Record<string, number> = {}
  private meleeDR = 0
  private rangedDR = 0
  private eliteDR = 0
  private dodgeChance = 0
  private blockChance = 0
  private blockAmount = 0
  private critDamageMult = 1.5
  private healthPerSecond = 0
  private healthOnHit = 0
  private magnetRadius = 120
  private goldMagnetRadius = 120
  private areaDamagePct = 0
  private thornsDamage = 0
  private thornsRadius = 180
  private regenCarryover = 0
  private level = 1
  private exp = 0
  private expBarBg!: Phaser.GameObjects.Rectangle
  private expBarFg!: Phaser.GameObjects.Rectangle
  private expText!: Phaser.GameObjects.Text
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
  private orbs?: OrbsUI
  private hotbarCfg: { potionRefId?: string; primaryRefId?: string; primaryRuneRefId?: string; secondaryRefId?: string; secondaryRuneRefId?: string; skillRefIds: (string | undefined)[]; runeRefIds?: (string | undefined)[] } = { potionRefId: undefined, skillRefIds: [], runeRefIds: [undefined, undefined, undefined, undefined] }
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
  private maxMana = 100
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
    // XP UI
    const barWidth = Math.floor(this.scale.width * 0.6)
    const barHeight = 6
    const barX = Math.floor((this.scale.width - barWidth) / 2)
    const barY = this.scale.height - 1
    this.expBarBg = this.add.rectangle(barX, barY, barWidth, barHeight, 0x1a1f36, 0.95).setOrigin(0, 1).setScrollFactor(0).setDepth(1700)
    this.expBarFg = this.add.rectangle(barX, barY, 1, barHeight, 0x5577ff, 1).setOrigin(0, 1).setScrollFactor(0).setDepth(1701)
    this.expText = this.add.text(this.scale.width / 2, barY - barHeight / 2, '', { fontFamily: 'monospace', color: '#cfe1ff', fontSize: '11px' }).setOrigin(0.5).setScrollFactor(0).setDepth(1702)
    this.layoutExpUi()
    this.updateExpUi()
    // Re-layout on resize to stay anchored at bottom center
    this.scale.on('resize', () => { this.layoutExpUi(); this.updateExpUi() })

    // Persist on shutdown
    this.events.once('shutdown', () => this.persistCharacter())

    // Load world config (import for known ids; fetch fallback for others)
    if (this.worldId === 'town' || this.worldId === 'town_default') {
      this.worldConfig = townConfig as WorldConfig
    } else {
      this.worldConfig = await loadWorldConfig(`/src/data/worlds/${this.worldId}.json`)
    }
    const w = this.worldConfig.width, h = this.worldConfig.height
    this.physics.world.setBounds(0, 0, w, h)
    this.walls = this.physics.add.staticGroup()
    this.enemies = this.physics.add.group({ maxSize: 200, runChildUpdate: false })
    this.projectiles = this.physics.add.group({ maxSize: 100, allowGravity: false })
    const ENABLE_PROJECTILE_OVERLAP = false // defer registration until after player is created
    this.pickups = this.physics.add.group()

    const ENABLE_WALLS = true
    if (ENABLE_WALLS) {
      // Build borders (placeholder until tilemaps) using static physics sprites to guarantee bodies
      const tile = 32
      const addWall = (x: number, y: number) => {
        const s = this.physics.add.staticImage(x, y, 'player').setVisible(false)
        try { (s as any).refreshBody?.() } catch {}
        this.walls.add(s)
        return s
      }
      for (let x = 0; x < w; x += tile) { addWall(x + tile / 2, tile / 2); addWall(x + tile / 2, h - tile / 2) }
      for (let y = tile; y < h - tile; y += tile) { addWall(tile / 2, y + tile / 2); addWall(w - tile / 2, y + tile / 2) }
      try { (this.walls as any).refresh?.() } catch {}
      console.log('[World] walls created', (this.walls.getChildren?.() || []).length)
      // Simple visual border so walls are visible
      const gw = this.add.graphics({ x: 0, y: 0 })
      gw.lineStyle(2, 0x3a3a3a, 1)
      gw.strokeRect(1, 1, w - 2, h - 2)
      gw.setDepth(5)
    } else {
      console.log('[World] walls disabled for debug')
    }

    // Player
    this.player = this.physics.add.sprite(w / 2, h / 2, 'player').setTint(0x55ccff)
    this.player.body.setCircle(12)
    this.player.setCollideWorldBounds(true)
    this.player.setDataEnabled(); this.player.setData('faction', 'player')
    // Now that player exists, safely register projectile overlap
    try {
      console.log('[World] registering projectile overlap (post-player)')
      this.physics.add.overlap(this.player, this.projectiles, (_p, proj) => {
        const tier = 'normal'
        const isElite = false
        const incoming = 8
        const el = ((proj as any).getData?.('element') as string) || 'physical'
        const source = ((proj as any).getData?.('source') as any) || 'ranged'
        const reduced = applyDamageReduction(incoming, this.armor, this.resistAll, this.level, {
          element: el as any,
          elementResists: this.elementResists as any,
          source,
          isElite,
          dodgeChance: this.dodgeChance,
          blockChance: this.blockChance,
          blockAmount: this.blockAmount,
          meleeDamageReductionPct: this.meleeDR,
          rangedDamageReductionPct: this.rangedDR,
          eliteDamageReductionPct: this.eliteDR,
        })
        this.playerHp = Math.max(0, this.playerHp - reduced)
        this.hpText.setText(`HP: ${this.playerHp}`)
        this.persistCharacter()
        ;(proj as any).destroy?.()
        if (this.playerHp <= 0) this.handleDeath()
      })
    } catch (e) { console.error('[World] projectile overlap registration failed (post-player)', e) }
    this.isDead = false
    this.invulnerableUntilMs = 0

    // Derived stats (HP/move feel)
    if (this.character) {
      const s = this.character.stats
      this.level = Number(this.character.level ?? 1)
      this.exp = Number(this.character.exp ?? 0)
      const d = computeDerivedStats(s, this.character.class, this.level)
      const computedMaxHp = Math.max(1, Math.floor(100 + s.vitality * d.lifePerVitality))
      this.maxHp = computedMaxHp
      const persistedHp = Number(this.character.hp ?? computedMaxHp)
      this.playerHp = Math.max(1, Math.min(this.maxHp, Number.isFinite(persistedHp) ? persistedHp : computedMaxHp))
      this.armor = d.armor
      this.resistAll = d.resistAll
      this.damageMultiplier = d.damageMultiplier
      this.baseMoveSpeed *= d.moveSpeedMult
      this.attackSpeedScale *= d.attackSpeedMult
      this.critChance = d.critChance
      this.elementResists = d.elementResists as any
      this.meleeDR = d.meleeDamageReductionPct
      this.rangedDR = d.rangedDamageReductionPct
      this.eliteDR = d.eliteDamageReductionPct
      this.dodgeChance = d.dodgeChance
      this.blockChance = d.blockChance
      this.blockAmount = d.blockAmount
      this.critDamageMult = d.critDamageMult
      this.healthPerSecond = d.healthPerSecond
      this.healthOnHit = d.healthOnHit
      ;(this as any).healthOnKill = d.healthOnKill
      this.magnetRadius = d.globeMagnetRadius
      this.goldMagnetRadius = d.goldMagnetRadius
      this.areaDamagePct = d.areaDamagePct
      this.thornsDamage = d.thornsDamage
      this.hpText.setText(`HP: ${this.playerHp}`)
      this.updateExpUi()
      // Stash the snapshot so it's available on subsequent loads
      this.character.derived = {
        damageMultiplier: this.damageMultiplier,
        armor: this.armor,
        resistAll: this.resistAll,
        lifePerVitality: d.lifePerVitality,
        elementDamageMultipliers: d.elementDamageMultipliers as any,
        elementResists: d.elementResists as any,
        moveSpeedMult: this.baseMoveSpeed / 220,
        attackSpeedMult: this.attackSpeedScale,
        critChance: this.critChance,
        critDamageMult: this.critDamageMult,
        magicFindPct: d.magicFindPct,
        healthPerSecond: this.healthPerSecond,
        healthOnHit: this.healthOnHit,
        globeMagnetRadius: this.magnetRadius,
        goldMagnetRadius: this.goldMagnetRadius,
        dodgeChance: this.dodgeChance,
        blockChance: this.blockChance,
        blockAmount: this.blockAmount,
        crowdControlReductionPct: d.crowdControlReductionPct,
        eliteDamageReductionPct: this.eliteDR,
        meleeDamageReductionPct: this.meleeDR,
        rangedDamageReductionPct: this.rangedDR,
        thornsDamage: this.thornsDamage,
        areaDamagePct: this.areaDamagePct,
      }
    }

    // Hotbar
    this.hotbarCfg = loadHotbar(this.character?.id ?? 0)
    this.hotbar = new HotbarUI(this)
    this.orbs = new OrbsUI(this)
    const cfgToUse = (this.hotbarCfg.potionRefId || this.hotbarCfg.skillRefIds.length) ? this.hotbarCfg : { potionRefId: 'potion_small', skillRefIds: ['skill_dash', undefined, undefined, undefined] as (string | undefined)[] }
    this.hotbar.mount(cfgToUse)
    this.orbs.mount({ hotbarBounds: this.hotbar.getBounds(), hp: this.playerHp, maxHp: this.maxHp, mana: this.mana, maxMana: this.maxMana })
    this.scale.on('resize', () => this.orbs?.relayout(this.hotbar?.getBounds()))
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
    if (ENABLE_WALLS) {
      try {
        const wallsChildren = ((this.walls.getChildren?.() || []) as any[]).filter(c => !!c && !!(c as any).body)
        if (wallsChildren.length > 0) {
          let pc = 0, ec = 0
          for (const wChild of wallsChildren) {
            try { this.physics.add.collider(this.player, wChild); pc++ } catch (e) { console.warn('[World] player-wall collider fail', e) }
            try { this.physics.add.collider(this.enemies, wChild); ec++ } catch (e) { console.warn('[World] enemies-wall collider fail', e) }
          }
          console.log('[World] per-wall colliders registered count', pc, ec)
        } else {
          console.warn('[World] no walls children; skipping colliders')
        }
      } catch (err) {
        console.error('[World] error adding per-wall colliders', err)
      }
    }
    try {
      this.physics.world.on('collide', (_o1: any, _o2: any) => {
        // Occasional debug spam prevention using throttle
        if ((this as any).__lastCollideLogAt && this.time.now - (this as any).__lastCollideLogAt < 200) return
        ;(this as any).__lastCollideLogAt = this.time.now
        console.log('[World] collide event fired', !!_o1, !!_o2)
      })
    } catch {}
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
        const runeId = (this.hotbarCfg.runeRefIds || [])[i]
        const ptr = this.input.activePointer
        executeSkill(
          skill,
          {
            scene: this,
            caster: this.player as any,
            cursor: { x: ptr.worldX, y: ptr.worldY },
            projectiles: this.projectiles,
            enemies: this.enemies,
            onAoeDamage: (x, y, radius, damage, _opts) => {
              // Damage enemies in radius
              this.enemies.children.iterate((child): boolean => {
                const e = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined
                if (!e || !e.body) return true
                const dx = e.x - x, dy = e.y - y
                if (Math.hypot(dx, dy) <= radius) {
                  const hp = Number(e.getData('hp') || 1)
                  const newHp = Math.max(0, hp - damage)
                  e.setData('hp', newHp)
                  const t = this.add.text(e.x, e.y - 10, `${damage}`, { fontFamily: 'monospace', color: '#77ff77' }).setDepth(900)
                  this.tweens.add({ targets: t, y: e.y - 26, alpha: 0, duration: 350, onComplete: () => t.destroy() })
                  if (newHp <= 0) {
                    // Award XP and persist when kills happen via AoE
                    this.gainExperience(Math.max(1, Math.floor((Number(e.getData('level') || 1) + 1) * 5)))
                  }
                }
                return true
              })
            }
          },
          { runeId }
        )
      }
    }

    // Interact
    if (!this.uiModalOpen && Phaser.Input.Keyboard.JustDown(this.eKey)) { console.log('[World] E pressed; attempting talk'); this.tryTalk() }

    // Regen
    if (!this.isDead && this.healthPerSecond > 0) {
      this.regenCarryover += (this.healthPerSecond * delta) / 1000
      if (this.regenCarryover >= 1) {
        const heal = Math.floor(this.regenCarryover)
        this.regenCarryover -= heal
          this.playerHp = Math.min(this.maxHp, this.playerHp + heal)
        this.hpText.setText(`HP: ${this.playerHp}`)
        this.orbs?.update(this.playerHp, this.maxHp, this.mana, this.maxMana)
          this.persistCharacter()
      }
    }

    // Enemy brains tick + touch damage
    this.enemies.children.iterate((child): boolean => {
      const enemy = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined
      if (!enemy || !enemy.body) return true
      // Tick brain if available
      try {
        // Lazy import cached at first use
        const anyScene = this as any
        if (!anyScene.__monsterTick) {
          import('@/systems/MonsterRegistry').then(mod => { anyScene.__monsterTick = (mod as any).tickMonster })
        }
        const tick: any = anyScene.__monsterTick
        if (typeof tick === 'function') {
          tick(this, enemy, { player: this.player as any, projectiles: this.projectiles, enemies: this.enemies, now: this.time.now })
        }
      } catch {}
      // Damage on touch with brief i-frames
      const ex = enemy.x - this.player.x, ey = enemy.y - this.player.y
      const dist = Math.hypot(ex, ey) || 1
      const now = this.time.now
      if (!this.isDead && now >= this.invulnerableUntilMs && dist < 16) {
        const incoming = 10
        const tier = (enemy.getData('tier') as string) || 'normal'
        const isElite = tier === 'champion' || tier === 'rare' || tier === 'unique'
        const reduced = applyDamageReduction(incoming, this.armor, this.resistAll, this.level, {
          element: 'physical' as any,
          elementResists: this.elementResists as any,
          source: 'melee',
          isElite,
          dodgeChance: this.dodgeChance,
          blockChance: this.blockChance,
          blockAmount: this.blockAmount,
          meleeDamageReductionPct: this.meleeDR,
          rangedDamageReductionPct: this.rangedDR,
          eliteDamageReductionPct: this.eliteDR,
        })
        this.playerHp = Math.max(0, this.playerHp - reduced)
        this.hpText.setText(`HP: ${this.playerHp}`)
        this.orbs?.update(this.playerHp, this.maxHp, this.mana, 100)
        this.invulnerableUntilMs = now + 500
        this.player.setTint(0xffe066)
        this.time.delayedCall(120, () => this.player.setTint(0x55ccff))
        if (this.playerHp <= 0) this.handleDeath()
        // Thorns reflect on contact
        if (this.thornsDamage > 0) {
          // Reflect to the attacker and also deal AoE around the player
          const reflect = Math.round(this.thornsDamage)
          const showHit = (x: number, y: number, dmg: number) => {
            const t = this.add.text(x, y - 8, `${dmg}`, { fontFamily: 'monospace', color: '#ff8844' }).setDepth(900)
            this.tweens.add({ targets: t, y: y - 24, alpha: 0, duration: 400, onComplete: () => t.destroy() })
          }
          // Hit the attacker
          showHit(enemy.x, enemy.y, reflect)
          enemy.destroy()
          // AoE pulse around the player so ranged also take damage
          const r = this.thornsRadius
          const g = (this.add as any).graphics({ x: 0, y: 0 })
          g.fillStyle(0xff5533, 0.25); g.fillCircle(this.player.x, this.player.y, r)
          this.time.delayedCall(100, () => g.destroy())
          this.enemies.children.iterate((child): boolean => {
            const e = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined
            if (!e || !e.body) return true
            const dx = e.x - this.player.x, dy = e.y - this.player.y
            if (Math.hypot(dx, dy) <= r) {
              showHit(e.x, e.y, Math.max(1, Math.floor(reflect * 0.5)))
              e.destroy()
            }
            return true
          })
        }
      }
      return true
    })

    // Magnet pickups (gold/globes)
    this.pickups.children.iterate((child): boolean => {
      const item = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined
      if (!item || !item.body) return true
      const dx = this.player.x - item.x, dy = this.player.y - item.y
      const dist = Math.hypot(dx, dy)
      const radius = this.magnetRadius // unified for now
      if (dist < radius && dist > 2) {
        const nx = dx / dist, ny = dy / dist
        const pull = 180
        item.setVelocity(nx * pull, ny * pull)
      }
      return true
    })
  }

  private async performAttack(): Promise<void> {
    const now = this.time.now
    const cooldown = this.attackCooldownMs / Math.max(0.001, this.attackSpeedScale)
    if (now - this.lastAttackAt < cooldown) return
    this.lastAttackAt = now

    const baseDx = this.lastMoveDir.x || 1
    const baseDy = this.lastMoveDir.y || 0
    const baseAngle = Math.atan2(baseDy, baseDx)
    const strikes = this.multistrike
    for (let i = 0; i < strikes; i++) {
      const angleOffset = (strikes > 1) ? ((i - (strikes - 1) / 2) * 0.2) : 0
      const ang = baseAngle + angleOffset
      const isCrit = Math.random() < this.critChance
      const dmg = Math.round(10 * this.damageMultiplier * (isCrit ? this.critDamageMult : 1))
      // Use power registry for swing
      try {
        const anyPowers = await import('@/systems/Powers')
        const exec = (anyPowers as any).executePowerByRef
        if (typeof exec === 'function') {
          exec('melee.swing', { scene: this, caster: this.player as any, enemies: this.enemies }, { skill: { id: 'melee.swing', name: 'Melee', type: 'projectile' } as any, params: { offset: this.attackRangeOffset, angle: ang, damage: dmg, durationMs: 100, isCrit } })
          // Area proc via power too
          if (Math.random() < this.areaDamagePct) {
            exec('aoe.pulse', { scene: this, caster: this.player as any, enemies: this.enemies }, { skill: { id: 'aoe.pulse', name: 'Area', type: 'aoe' } as any, params: { x: this.player.x, y: this.player.y, radius: 60, damage: Math.round(dmg * 0.2), color: 0xffaa66, durationMs: 120 } })
          }
        }
      } catch {}
      // Health on hit moved into melee power on kill
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
        this.spawnMonsterFromSpawner(s)
        spawned++
      }
      this.time.delayedCall(start, () => {
        const evt = this.time.addEvent({ delay: every, loop: true, callback: () => {
          for (let i = 0; i < count; i++) {
            this.spawnMonsterFromSpawner(s)
            spawned++
            if (limit > 0 && spawned >= limit) { evt.remove(false); break }
          }
        } })
      })
    }
  }

  private spawnMonsterFromSpawner(spec: SpawnerConfig): void {
    // pick id from pool or fixed id
    const id = (spec.monsterPool && spec.monsterPool.length) ? spec.monsterPool[Math.floor(Math.random() * spec.monsterPool.length)] : spec.monsterId
    const cfg = getMonster(id)
    const x = Phaser.Math.Between(40, this.worldConfig!.width - 40)
    const y = Phaser.Math.Between(40, this.worldConfig!.height - 40)
    const e = this.physics.add.sprite(x, y, 'player').setTint(cfg?.tint ?? 0xff5555)
    e.body.setCircle(cfg?.bodyRadius ?? 12)
    e.setDataEnabled()
    if (cfg) {
      e.setData('configId', cfg.id)
      e.setData('brainId', cfg.brainId || cfg.behavior)
      // Scale stats by player level
      const lvl = this.level || 1
      const hp = Math.round((cfg.hp || 10) * (1 + lvl * 0.5))
      const spd = Math.round((cfg.speed || 80) * (1 + lvl * 0.02))
      e.setData('speed', spd)
      e.setData('hp', hp)
      e.setData('level', lvl)
      if (cfg.params) Object.keys(cfg.params).forEach(k => e.setData(k, (cfg.params as any)[k]))
      if (cfg.skills) e.setData('skills', cfg.skills)
      if (cfg.tier) e.setData('tier', cfg.tier)
      if (cfg.affixes) e.setData('affixes', cfg.affixes)
    }
    this.enemies.add(e)
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
    const skills = listSkills({ class: this.character?.class as any }).map((s: any) => ({ id: s.id, name: s.name, category: s.category, runes: s.runes }))
    const current = {
      primary: (this.hotbarCfg as any).primaryRefId,
      primaryRune: (this.hotbarCfg as any).primaryRuneRefId,
      secondary: (this.hotbarCfg as any).secondaryRefId,
      secondaryRune: (this.hotbarCfg as any).secondaryRuneRefId,
      slots: [...this.hotbarCfg.skillRefIds],
      runes: [...(this.hotbarCfg.runeRefIds || new Array(4).fill(undefined))],
      passives: [undefined, undefined, undefined, undefined, undefined] as (string | undefined)[]
    }
    this.uiModalOpen = true
    this.hotbar?.setAllowSkillClick(false)
    this.skillsOverview!.open({
      skillsList: skills,
      passivesList: ((passivesRaw as any).passives || []).filter((p: any) => !p.classRestriction || p.classRestriction === 'all' || p.classRestriction === (this.character?.class || 'melee')).map((p: any) => ({ id: p.id, name: p.name })),
      current,
      onUpdate: (next) => {
        console.log('[Overview] Accept next', JSON.stringify(next))
        const before = [...next.slots]
        // Do NOT mirror primary/secondary into action slots; those are independent
        next.slots = next.slots.map(v => (v == null ? undefined : v))
        console.log('[Overview] Slots before', JSON.stringify(before), 'after', JSON.stringify(next.slots))
        ;(this.hotbarCfg as any).primaryRefId = next.primary
        ;(this.hotbarCfg as any).primaryRuneRefId = next.primaryRune
        ;(this.hotbarCfg as any).secondaryRefId = next.secondary
        ;(this.hotbarCfg as any).secondaryRuneRefId = next.secondaryRune
        this.hotbarCfg.skillRefIds = next.slots
        this.hotbarCfg.runeRefIds = next.runes
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
    const current = { primary: this.hotbarCfg.skillRefIds[0], secondary: this.hotbarCfg.skillRefIds[1], slots: [...this.hotbarCfg.skillRefIds], runes: [...(this.hotbarCfg.runeRefIds || new Array(4).fill(undefined))], passives: [undefined, undefined, undefined, undefined, undefined] as (string | undefined)[] }
    this.skillsOverview!.open({
      skillsList: skills,
      passivesList: [{ id: 'pass_a', name: 'Ruthless' }, { id: 'pass_b', name: 'Berserker Rage' }],
      current,
      onUpdate: (next) => {
        if (typeof next.primary !== 'undefined') next.slots[0] = next.primary
        if (typeof next.secondary !== 'undefined') next.slots[1] = next.secondary
        this.hotbarCfg.skillRefIds = next.slots
        this.hotbarCfg.runeRefIds = next.runes
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
    // Restore defaults (persist hp)
    // Clamp HP to max when respawning
    this.playerHp = Math.max(1, Math.min(this.maxHp, this.playerHp))
    this.hpText.setText(`HP: ${this.playerHp}`)
    const pos = this.lastCheckpoint || { x: this.worldConfig!.width / 2, y: this.worldConfig!.height / 2 }
    this.player.setPosition(pos.x, pos.y)
    this.player.setTint(0x55ccff)
    this.player.body.enable = true
    this.invulnerableUntilMs = this.time.now + 1000
  }

  private persistCharacter(): void {
    if (!this.character) return
    try {
      const next = { ...this.character, level: this.level, exp: this.exp, hp: this.playerHp, mana: this.mana, maxMana: this.maxMana, derived: this.character.derived }
      upsertCharacter(next as any)
      this.character = next
    } catch {}
  }

  private updateStatsPanel(): void {
    const s = this.character?.stats
    if (!s || !this.statsPanel) return
    this.statsPanel.setData({
      name: this.character?.name,
      className: this.character?.class,
      level: this.level,
      base: { strength: s.strength, vitality: s.vitality, intelligence: s.intelligence, dexterity: s.dexterity },
      secondary: {
        armor: this.armor,
        resistAll: this.resistAll,
        damageMultiplier: this.damageMultiplier,
        critChance: this.critChance,
        critDamageMult: 1.5,
        attackSpeed: this.attackSpeedScale,
        moveSpeedMult: 1, // already applied to movement; display as 100%
      }
    })
  }

  private updateExpUi(): void {
    const need = expRequiredForLevel(this.level)
    const have = this.exp
    const frac = Math.max(0, Math.min(1, need > 0 ? have / need : 0))
    const fullW = this.expBarBg?.width || 220
    this.expBarFg?.setSize(fullW * frac, this.expBarFg.height)
    // keep left edge anchored when resizing with origin(0,0.5)
    this.expBarFg?.setPosition((this.expBarBg?.x as number) || 0, (this.expBarBg?.y as number) || 0)
    this.expText?.setText(`XP ${have}/${need} (Lv ${this.level})`)
  }

  private gainExperience(amount: number): void {
    this.exp += Math.max(0, Math.floor(amount))
    let need = expRequiredForLevel(this.level)
    while (need > 0 && this.exp >= need && this.level < 70) {
      this.exp -= need
      this.level += 1
      // Level-up visual
      try { executeEffectByRef('fx.levelUpBurst', { scene: this, caster: this.player as any }) } catch {}
      need = expRequiredForLevel(this.level)
    }
    this.updateExpUi()
    this.persistCharacter()
  }

  private layoutExpUi(): void {
    const barWidth = Math.floor(this.scale.width * 0.6)
    const barHeight = 6
    const barX = Math.floor((this.scale.width - barWidth) / 2)
    const barY = this.scale.height - 1
    this.expBarBg?.setSize(barWidth, barHeight)
    this.expBarBg?.setPosition(barX, barY)
    this.expBarFg?.setPosition(barX, barY)
    this.expBarFg?.setSize(Math.max(1, this.expBarFg?.width || 1), barHeight)
    this.expText?.setPosition(this.scale.width / 2, barY - barHeight / 2)
  }
}


