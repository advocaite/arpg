import Phaser from 'phaser'
import { CharacterProfile, PortalConfig, WorldConfig, ItemInstance } from '@/types'
import DialogueBox from '@/ui/Dialogue'
import townConfig from '@/data/worlds/town.json'
import PauseSystem from '@/systems/PauseSystem'
import HotbarUI from '@/ui/Hotbar'
import InventoryUI from '@/ui/Inventory'
import ShopUI from '@/ui/Shop'
// Old SkillSelect removed; Town uses simple inventory/shop only now
import { listItems } from '@/systems/ItemDB'
import skillsRaw from '@/data/skills.json'
import { loadInventory, saveInventory, loadHotbar, saveHotbar, loadEquipment, saveEquipment, addToInventory, countItemInInv } from '@/systems/Inventory'
import type { EquipmentConfig } from '@/types'

export default class TownScene extends Phaser.Scene {
  private character?: CharacterProfile
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>
  private escKey!: Phaser.Input.Keyboard.Key

  private walls!: Phaser.Physics.Arcade.StaticGroup
  private portals: Array<{ sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody; cfg: PortalConfig }> = []
  private npcs: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody[] = []
  private dialogue?: DialogueBox
  private worldConfig!: WorldConfig

  private fpsText!: Phaser.GameObjects.Text
  private hpText!: Phaser.GameObjects.Text
  private coinText!: Phaser.GameObjects.Text
  private playerHp = 100
  private coins = 0
  private pause!: PauseSystem

  private hotbar?: HotbarUI
  private invUI?: InventoryUI
  private shopUI?: ShopUI
  // private skillSelect?: SkillSelectUI
  private inventory: ItemInstance[] = []
  private equipment: EquipmentConfig = {}
  private hotbarCfg: { potionRefId?: string; skillRefIds: (string | undefined)[] } = { potionRefId: undefined, skillRefIds: [] }

  constructor() { super({ key: 'Town' }) }

  init(data: { character?: CharacterProfile }): void { this.character = data?.character }

  create(): void {
    console.log('[Town] create start', this.scene.key, 'char?', !!this.character)
    this.cameras.main.setBackgroundColor('#0b0f18')

    const kb = this.input.keyboard
    this.cursors = kb?.createCursorKeys() as any || ({} as any)
    this.wasd = (kb?.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>) || ({ W: {} as any, A: {} as any, S: {} as any, D: {} as any })
    this.escKey = (kb?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC) as any) || ({} as any)

    this.pause = new PauseSystem(this)
    this.fpsText = this.add.text(12, 12, 'FPS: --', { fontFamily: 'monospace', color: '#6cf' }).setScrollFactor(0).setDepth(1000)
    this.hpText = this.add.text(12, 32, `HP: ${this.playerHp}`, { fontFamily: 'monospace', color: '#fff' }).setScrollFactor(0).setDepth(1000)
    this.coins = Number(localStorage.getItem('coins') || 0)
    this.coinText = this.add.text(12, 52, `Coins: ${this.coins}`, { fontFamily: 'monospace', color: '#ffd166' }).setScrollFactor(0).setDepth(1000)

    this.worldConfig = townConfig as WorldConfig
    const w = this.worldConfig.width, h = this.worldConfig.height
    this.physics.world.setBounds(0, 0, w, h)
    this.walls = this.physics.add.staticGroup()

    const tile = 32
    for (let x = 0; x < w; x += tile) { this.walls.create(x + tile / 2, tile / 2, 'wall'); this.walls.create(x + tile / 2, h - tile / 2, 'wall') }
    for (let y = tile; y < h - tile; y += tile) { this.walls.create(tile / 2, y + tile / 2, 'wall'); this.walls.create(w - tile / 2, y + tile / 2, 'wall') }

    this.player = this.physics.add.sprite(w / 2, h / 2, 'player').setTint(0x55ccff)
    this.player.body.setCircle(12); this.player.setCollideWorldBounds(true)

    for (const p of this.worldConfig.portals) {
      const s = this.physics.add.sprite(p.x, p.y, 'player').setTint(0x66ffcc)
      s.body.setCircle(12)
      this.add.text(p.x, p.y - 30, p.name, { fontFamily: 'monospace', color: '#aaf' }).setOrigin(0.5)
      this.portals.push({ sprite: s, cfg: p })
      this.physics.add.overlap(this.player, s, () => this.scene.start(p.destinationScene, { character: this.character, portalId: p.destinationId }))
    }

    for (const n of this.worldConfig.npcs) {
      const s = this.physics.add.sprite(n.x, n.y, 'player').setTint(0xffcc66)
      s.body.setCircle(12)
      this.npcs.push(s)
    }

    this.physics.add.collider(this.player, this.walls)
    this.add.text(12, 72, 'Town: E talk | I inventory', { fontFamily: 'monospace', color: '#bbb' }).setScrollFactor(0)
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08)

    // Load per-character inventory/hotbar
    const charId = this.character?.id ?? 0
    this.inventory = loadInventory(charId)
    this.equipment = loadEquipment(charId)
    this.hotbarCfg = loadHotbar(charId)

    this.hotbar = new HotbarUI(this)
    const defaultCfg = { potionRefId: 'potion_small', skillRefIds: ['skill_dash', undefined, undefined, undefined] as (string | undefined)[] }
    const cfgToUse = (this.hotbarCfg.potionRefId || this.hotbarCfg.skillRefIds.length) ? this.hotbarCfg : defaultCfg
    this.hotbar.mount(cfgToUse)
    this.hotbar.setOnSkillClick((i) => this.openSkillSelect(i))
    if (cfgToUse.potionRefId) {
      try { this.hotbar.setPotionCount(countItemInInv(this.inventory, cfgToUse.potionRefId)) } catch { this.hotbar.setPotionCount(0) }
    }

    this.invUI = new InventoryUI(this)
    this.shopUI = new ShopUI(this)

    kb?.on('keydown-E', () => this.tryTalk())
    kb?.on('keydown-I', () => { this.hotbar?.setAllowSkillClick(false); this.openInventory() })
    // Remove K shortcut to avoid accidental skill UI while inventory open; hotbar slots remain clickable
    console.log('[Town] create done')
  }

  private openInventory(): void {
    this.hotbar?.setAllowSkillClick(false)
    this.invUI?.open(this.inventory, (items) => {
      this.inventory = items
      saveInventory(this.character?.id ?? 0, this.inventory)
    }, ({ itemId, x, y }) => this.tryAssignHotbar(itemId, x, y), this.equipment, (slot, itemId) => {
      if (slot === 'weapon') this.equipment.mainHandId = itemId
      if (slot === 'armor') this.equipment.chestId = itemId
      saveEquipment(this.character?.id ?? 0, this.equipment)
    })
  }

  private tryAssignHotbar(itemId: string, worldX: number, worldY: number): void {
    // Map screen coords of hotbar regions
    const screenX = worldX
    const screenY = worldY
    const barY = this.scale.height - 24
    if (Math.abs(screenY - barY) > 40) return
    // potion slot roughly at left within bar
    const potionRect = new Phaser.Geom.Rectangle(this.scale.width / 2 - 520 / 2 + 0, barY - 20, 60, 40)
    const skillRects = [0, 1, 2, 3].map((i) => new Phaser.Geom.Rectangle(this.scale.width / 2 - 520 / 2 + 120 + i * 90 - 40, barY - 20, 80, 40))

    const isPotion = listItems().find(item => item.id === itemId)?.type === 'potion'

    if (Phaser.Geom.Rectangle.Contains(potionRect, screenX, screenY)) {
      if (!isPotion) return
      this.hotbarCfg.potionRefId = itemId
      saveHotbar(this.character?.id ?? 0, this.hotbarCfg)
      this.hotbar?.mount(this.hotbarCfg)
      return
    }

    for (let i = 0; i < skillRects.length; i++) {
      if (Phaser.Geom.Rectangle.Contains(skillRects[i], screenX, screenY)) {
        // for now allow only skills ids (skill_*)
        if (!itemId.startsWith('skill_')) return
        this.hotbarCfg.skillRefIds[i] = itemId
        saveHotbar(this.character?.id ?? 0, this.hotbarCfg)
        this.hotbar?.mount(this.hotbarCfg)
        return
      }
    }
  }

  private openShop(): void {
    const stock = listItems().slice(0, 3)
    this.shopUI?.open('Shop', this.coins, stock, (it) => {
      const price = it.rarity === 'legendary' ? 100 : it.rarity === 'epic' ? 40 : it.rarity === 'rare' ? 15 : 5
      if (this.coins < price) return false
      this.coins -= price
      localStorage.setItem('coins', String(this.coins))
      this.coinText.setText(`Coins: ${this.coins}`)
      // stack-aware add
      const charId = this.character?.id ?? 0
      this.inventory = addToInventory(charId, this.inventory, it.id, 1)
      // Auto-assign potion to Q if empty
      if (!this.hotbarCfg.potionRefId && it.type === 'potion') {
        this.hotbarCfg.potionRefId = it.id
        saveHotbar(charId, this.hotbarCfg)
      }
      if (this.hotbarCfg.potionRefId === it.id) {
        const count = countItemInInv(this.inventory, it.id)
        // force refresh UI then update quantity text
        this.hotbar?.mount(this.hotbarCfg)
        this.hotbar?.setPotionCount(count)
      }
      // refresh inventory UI if open
      if (this.invUI) this.openInventory()
      return true
    })
  }

  private tryTalk(): void {
    const nearest = this.npcs.reduce<{ s: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null; d: number }>((acc, s) => {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y)
      if (d < acc.d) return { s, d }
      return acc
    }, { s: null, d: Infinity })
    if (nearest.s && nearest.d < 80) this.openNpcDialogue()
  }

  private openNpcDialogue(): void {
    if (this.dialogue) this.dialogue.close()
    this.dialogue = new DialogueBox(this)
    this.dialogue.open('Shopkeeper', ['Welcome, traveler!'], [
      { label: 'Open Shop', onSelect: () => this.openShop() },
      { label: 'Goodbye', onSelect: () => {} }
    ])
  }

  private openSkillSelect(_slotIndex: number): void {
    // In Town scene, we no longer open the skill picker; handled in World scene.
  }

  update(_time: number, delta: number): void {
    this.fpsText.setText(`FPS: ${Math.round(1000 / Math.max(1, delta))}`)
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) { if (this.pause.isPaused()) this.pause.resume('esc'); else this.pause.pause('esc') }
    if (this.pause.isPaused()) return

    const left = !!this.cursors.left?.isDown || this.wasd.A.isDown
    const right = !!this.cursors.right?.isDown || this.wasd.D.isDown
    const up = !!this.cursors.up?.isDown || this.wasd.W.isDown
    const down = !!this.cursors.down?.isDown || this.wasd.S.isDown

    const moveX = (right ? 1 : 0) - (left ? 1 : 0)
    const moveY = (down ? 1 : 0) - (up ? 1 : 0)

    const speed = 220
    const len = Math.hypot(moveX, moveY)
    if (len > 0) { const nx = moveX / len, ny = moveY / len; this.player.setVelocity(nx * speed, ny * speed) } else { this.player.setVelocity(0, 0) }
  }
}
