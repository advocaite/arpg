import Phaser from 'phaser'
import type { ItemInstance, EquipmentConfig, ItemAffixRoll } from '@/types'
import Tooltip from '@/ui/Tooltip'
import { getItem, rarityToColor, getAffix, getItemValue } from '@/systems/ItemDB'

export default class InventoryUI {
  private scene: Phaser.Scene
  private container?: Phaser.GameObjects.Container
  private items: ItemInstance[] = []
  private onChange?: (items: ItemInstance[]) => void
  private onDrop?: (payload: { itemId: string; x: number; y: number }) => void
  private onEquip?: (slot: 'weapon' | 'armor', itemId: string, affixes?: ItemAffixRoll[], slotKey?: string) => void
  private onUnequip?: (slotKey: string) => void
  private tooltip: Tooltip
  private equipment: EquipmentConfig = {}
  private equipRects: { weapon: Phaser.Geom.Rectangle; armor: Phaser.Geom.Rectangle } | null = null
  private iconNodes: Phaser.GameObjects.Image[] = []
  private allEquipSlots: { id: string; rect: Phaser.Geom.Rectangle; type: 'weapon' | 'armor'; subtype?: string; node: Phaser.GameObjects.Rectangle; icon?: Phaser.GameObjects.Image }[] = []
  private hoverIdx: number | null = null
  private hoverOutline?: Phaser.GameObjects.Rectangle
  private gridMeta?: { w: number; h: number; cols: number; rows: number; pitch: number; cell: number; originCX: number; originCY: number }
  private moveHandler?: (p: Phaser.Input.Pointer) => void
  private downHandler?: (p: Phaser.Input.Pointer) => void
  private upHandler?: (p: Phaser.Input.Pointer) => void

  private dragIcon?: Phaser.GameObjects.Text
  private dragIndex: number | null = null
  private dragFromEquipId: string | null = null
  private dragItemId: string | null = null
  private lastClickIdx: number | null = null
  private lastClickAt = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.tooltip = new Tooltip(scene)
  }

  open(items: ItemInstance[], onChange?: (items: ItemInstance[]) => void, onDrop?: (payload: { itemId: string; x: number; y: number }) => void, equipment?: EquipmentConfig, onEquip?: (slot: 'weapon' | 'armor', itemId: string, affixes?: ItemAffixRoll[], slotKey?: string) => void, onUnequip?: (slotKey: string) => void): void {
    this.close()
    this.items = [...items]
    this.onChange = onChange
    this.onDrop = onDrop
    this.onEquip = onEquip
    this.onUnequip = onUnequip
    this.equipment = { ...(equipment ?? {}) }

    const w = 420, h = 300
    const x = this.scene.scale.width / 2, y = this.scene.scale.height / 2
    const bg = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0.9).setStrokeStyle(1, 0xffffff, 0.2)

    const cells: Phaser.GameObjects.Rectangle[] = []
    const labels: Phaser.GameObjects.Text[] = []

    const cols = 7, rows = 4
    this.gridMeta = { w, h, cols, rows, pitch: 55, cell: 50, originCX: -w / 2 + 30, originCY: -h / 2 + 30 }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c
        const cell = this.scene.add.rectangle(-w / 2 + 30 + c * 55, -h / 2 + 30 + r * 55, 50, 50, 0x1a1a1a, 1).setStrokeStyle(1, 0x333333, 1)
        cell.setInteractive({ useHandCursor: true }); this.scene.input.setDraggable(cell)
        cell.on('pointerover', (p: Phaser.Input.Pointer) => { this.hoverIdx = idx; this.showTooltip(idx, p); this.updateHoverOutline() })
        cell.on('pointerdown', (p: Phaser.Input.Pointer) => this.onCellClick(idx, p))
        cell.on('pointerout', () => { if (this.hoverIdx === idx) { this.hoverIdx = null; this.tooltip.hide(); this.updateHoverOutline() } })
        cell.on('dragstart', () => this.onDragStart(idx))
        cell.on('drag', (pointer: Phaser.Input.Pointer) => this.onDragMove(pointer.x, pointer.y))
        cell.on('dragend', (pointer: Phaser.Input.Pointer) => this.onDragEnd(pointer.x, pointer.y, { cols, rows, gridW: w, gridH: h }))
        cells.push(cell)
        const it = this.items[idx]
        const icon = this.scene.add.image(cell.x, cell.y, this.iconKeyForItem(it?.itemId)).setDisplaySize(34, 34)
        icon.setInteractive({ useHandCursor: true }); this.scene.input.setDraggable(icon)
        icon.on('pointerover', (p: Phaser.Input.Pointer) => { this.hoverIdx = idx; this.showTooltip(idx, p); this.updateHoverOutline() })
        icon.on('pointerdown', (p: Phaser.Input.Pointer) => this.onCellClick(idx, p))
        icon.on('pointerout', () => { if (this.hoverIdx === idx) { this.hoverIdx = null; this.tooltip.hide(); this.updateHoverOutline() } })
        icon.on('dragstart', () => this.onDragStart(idx))
        icon.on('drag', (pointer: Phaser.Input.Pointer) => this.onDragMove(pointer.x, pointer.y))
        icon.on('dragend', (pointer: Phaser.Input.Pointer) => this.onDragEnd(pointer.x, pointer.y, { cols, rows, gridW: w, gridH: h }))
        this.iconNodes.push(icon)
        // quantity badge
        if (it?.qty && it.qty > 1) {
          const qty = this.scene.add.text(cell.x + 16, cell.y + 16, String(it.qty), { fontFamily: 'monospace', color: '#fff', fontSize: '10px' }).setOrigin(1, 1)
          labels.push(qty)
        }
      }
    }

    const hint = this.scene.add.text(0, h / 2 - 18, 'Drag to rearrange. Drag near bottom bar to assign hotbar. Esc to close', { fontFamily: 'monospace', color: '#bbb' }).setOrigin(0.5)

    // Equipment panel on the left (detailed slots) — same visual cadence as grid
    const equipWidth = 220
    const equipHeight = h - 20
    const equipX = -w / 2 - 100
    const equipY = 0
    const equipBg = this.scene.add.rectangle(equipX, equipY, equipWidth, equipHeight, 0x0a0a0a, 0.96).setStrokeStyle(1, 0x333333, 1)
    const slotW = 60, slotH = 40
    const mkRect = (row: number, col: number) => new Phaser.Geom.Rectangle(
      equipX - slotW + col * 80,
      equipY - equipHeight / 2 + 40 + row * 60,
      slotW,
      slotH
    )
    const helm = mkRect(0, 0)
    const shoulders = mkRect(0, 1)
    const chest = mkRect(1, 0)
    const gloves = mkRect(1, 1)
    const pants = mkRect(2, 0)
    const boots = mkRect(2, 1)
    const belt = mkRect(3, 0)
    const amulet = mkRect(3, 1)
    const mainHand = mkRect(4, 0)
    const offHand = mkRect(4, 1)
    // legacy map for onEquip callback shape
    this.equipRects = { weapon: mainHand, armor: chest }
    const drawSlot = (slotId: string, r: Phaser.Geom.Rectangle, label: string, iconKey: string | null, type: 'weapon' | 'armor', subtype?: string) => {
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2
      const rect = this.scene.add.rectangle(cx, cy, r.width, r.height, 0x1a1a1a, 1).setStrokeStyle(2, 0x333333, 1).setDepth(5)
      const hoverFill = this.scene.add.rectangle(cx, cy, r.width, r.height, 0xffffff, 0.05).setVisible(false).setDepth(4)
      rect.setInteractive({ useHandCursor: true }); this.scene.input.setDraggable(rect)
      rect.on('pointerdown', (p: Phaser.Input.Pointer) => {
        try { console.log('[Inventory] equip slot mousedown', { slotId, pointer: { x: p.worldX, y: p.worldY } }) } catch {}
      })
      rect.on('pointerover', (p: Phaser.Input.Pointer) => { console.log('[Inventory] slot over', slotId); rect.setStrokeStyle(2, 0x66ccff, 1); hoverFill.setVisible(true); if (this.hoverOutline) { this.hoverOutline.setSize(r.width, r.height); this.hoverOutline.setPosition(rect.x, rect.y).setVisible(true) } this.showEquipTooltip(slotId, p) })
      rect.on('pointerout', () => { console.log('[Inventory] slot out', slotId); rect.setStrokeStyle(2, 0x333333, 1); hoverFill.setVisible(false); if (this.hoverOutline) this.hoverOutline.setVisible(false); this.tooltip.hide() })
      // Allow dragging from the empty slot area to unequip
      rect.on('dragstart', () => this.onEquipDragStart(slotId))
      rect.on('drag', (pointer: Phaser.Input.Pointer) => this.onDragMove(pointer.x, pointer.y))
      rect.on('dragend', (pointer: Phaser.Input.Pointer) => this.onDragEnd(pointer.x, pointer.y, { cols, rows, gridW: w, gridH: h }))
      const txt = this.scene.add.text(r.x - 26, r.y - 24, label, { fontFamily: 'monospace', color: '#bbb', fontSize: '10px' }).setDepth(3)
      let icon: Phaser.GameObjects.Image | undefined
      const currentItemId = (this.equipment as any)[slotId] as string | undefined
      const displayKey = currentItemId ? (type === 'weapon' ? 'icon_weapon' : 'icon_armor') : iconKey || undefined
      if (displayKey) {
        icon = this.scene.add.image(cx, cy, displayKey).setDisplaySize(28, 28).setInteractive({ useHandCursor: true }).setDepth(6)
        this.scene.input.setDraggable(icon)
        icon.on('pointerdown', (p: Phaser.Input.Pointer) => {
          try { console.log('[Inventory] equip icon mousedown', { slotId, pointer: { x: p.worldX, y: p.worldY } }) } catch {}
        })
        icon.on('pointerover', (p: Phaser.Input.Pointer) => { rect.emit('pointerover', p) })
        icon.on('pointerout', () => { rect.emit('pointerout') })
        icon.on('dragstart', () => this.onEquipDragStart(slotId))
      icon.on('drag', (pointer: Phaser.Input.Pointer) => this.onDragMove(pointer.x, pointer.y))
      icon.on('dragend', (pointer: Phaser.Input.Pointer) => this.onDragEnd(pointer.x, pointer.y, { cols, rows, gridW: w, gridH: h }))
      }
      this.allEquipSlots.push({ id: slotId, rect: r, type, subtype, node: rect, icon })
      // ensure tooltip on slot hover even if icon is not present
      rect.on('pointerover', (p: Phaser.Input.Pointer) => { const eqId = (this.equipment as any)[slotId] as string | undefined; if (!eqId) return; this.showEquipTooltip(slotId, p) })
      return icon ? [rect, hoverFill, txt, icon] : [rect, hoverFill, txt]
    }
    const eqNodes: Phaser.GameObjects.GameObject[] = []
    eqNodes.push(...drawSlot('helmId', helm, 'Helm', this.equipment.helmId ? 'icon_armor' : null, 'armor', 'helm'))
    eqNodes.push(...drawSlot('shouldersId', shoulders, 'Shoulders', this.equipment.shouldersId ? 'icon_armor' : null, 'armor', 'shoulders'))
    eqNodes.push(...drawSlot('chestId', chest, 'Chest', this.equipment.chestId ? 'icon_armor' : null, 'armor', 'chest'))
    eqNodes.push(...drawSlot('glovesId', gloves, 'Gloves', this.equipment.glovesId ? 'icon_armor' : null, 'armor', 'gloves'))
    eqNodes.push(...drawSlot('pantsId', pants, 'Pants', this.equipment.pantsId ? 'icon_armor' : null, 'armor', 'pants'))
    eqNodes.push(...drawSlot('bootsId', boots, 'Boots', this.equipment.bootsId ? 'icon_armor' : null, 'armor', 'boots'))
    eqNodes.push(...drawSlot('beltId', belt, 'Belt', this.equipment.beltId ? 'icon_armor' : null, 'armor', 'belt'))
    eqNodes.push(...drawSlot('amuletId', amulet, 'Amulet', this.equipment.amuletId ? 'icon_armor' : null, 'armor', 'amulet'))
    eqNodes.push(...drawSlot('mainHandId', mainHand, 'Main', this.equipment.mainHandId ? 'icon_weapon' : null, 'weapon', 'mainHand'))
    eqNodes.push(...drawSlot('offHandId', offHand, 'Off', this.equipment.offHandId ? 'icon_weapon' : null, 'weapon', 'offHand'))

    this.hoverOutline = this.scene.add.rectangle(0, 0, this.gridMeta.cell, this.gridMeta.cell, 0x66ccff, 0.08).setStrokeStyle(2, 0x66ccff, 0.9).setVisible(false)
    // Compose children so that icons render above cell backgrounds
    const gridIcons: Phaser.GameObjects.Image[] = [...this.iconNodes]
    this.container = this.scene.add.container(x, y, [bg, ...cells, ...gridIcons, equipBg, ...eqNodes, this.hoverOutline, ...labels, hint]).setScrollFactor(0).setDepth(2000)
    console.log('[Inventory] open with equipment', this.equipment)

    this.moveHandler = (p: Phaser.Input.Pointer) => this.onPointerMove(p)
    this.downHandler = (p: Phaser.Input.Pointer) => this.onPointerDown(p)
    this.upHandler = (p: Phaser.Input.Pointer) => this.onPointerUp(p)
    this.scene.input.on('pointermove', this.moveHandler)
    this.scene.input.on('pointerdown', this.downHandler)
    this.scene.input.on('pointerup', this.upHandler)
    // When inventory opens, disable hotbar skill clicks
    try { (this.scene as any).hotbar?.setAllowSkillClick?.(false) } catch {}

    const esc = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    esc?.once('down', () => { this.close(); try { (this.scene as any).__suppressEscUntil = (this.scene as any).time?.now + 150 } catch {} })
  }

  private showTooltip(idx: number, p: Phaser.Input.Pointer): void {
    const it = this.items[idx]
    if (!it) return
    const cfg = getItem(it.itemId)
    const qty = it.qty && it.qty > 1 ? `\nQty: ${it.qty}` : ''
    const content = cfg ? this.formatItemTooltip(cfg, qty, it) : it.itemId
    const border = this.effectiveBorderColor(cfg, it)
    this.tooltip.show(content, p.worldX, p.worldY, { borderColor: border })
  }

  private onDragStart(idx: number): void {
    this.dragIndex = idx
    const it = this.items[idx]
    const label = it ? it.itemId : ''
    const p = this.scene.input.activePointer
    this.dragIcon = this.scene.add.text(p.x, p.y, label, { fontFamily: 'monospace', color: '#ffd166', fontSize: '12px' }).setDepth(3002).setScrollFactor(0)
  }

  private onDragMove(x: number, y: number): void {
    this.dragIcon?.setPosition(x, y)
  }

  private onDragEnd(x: number, y: number, grid?: { cols: number; rows: number; gridW: number; gridH: number }): void {
    if (this.dragIcon) this.dragIcon.destroy(); this.dragIcon = undefined
    // Unequip flow: if dragging from an equipment slot, allow dropping into a specific grid cell
    if (this.dragFromEquipId && this.dragItemId) {
      const localX = x - (this.container?.x ?? 0)
      const localY = y - (this.container?.y ?? 0)
      let placed = false
      if (grid) {
        // Prefer the exact same index math the grid uses
        const viaPointerIndex = this.pointerToIndex(localX, localY)
        // Keep the old rounding approach for logging/backup
        const colApprox = Math.round((localX + grid.gridW / 2 - 30) / 55)
        const rowApprox = Math.round((localY + grid.gridH / 2 - 30) / 55)
        const approxIdx = (colApprox >= 0 && colApprox < grid.cols && rowApprox >= 0 && rowApprox < grid.rows)
          ? rowApprox * grid.cols + colApprox
          : null
        try { console.log('[Inventory] equip→grid drop', { local: { x: localX, y: localY }, pointerIdx: viaPointerIndex, approx: { col: colApprox, row: rowApprox, idx: approxIdx } }) } catch {}
        const targetIdx = viaPointerIndex ?? approxIdx
        if (typeof targetIdx === 'number') {
          const occupied = !!this.items[targetIdx]
          try { console.log('[Inventory] equip→grid target check', { targetIdx, occupied, existing: this.items[targetIdx] }) } catch {}
          if (!occupied) {
            const aff = (this.equipment as any)[this.dragFromEquipId + 'Affixes'] as ItemAffixRoll[] | undefined
            const inst = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, itemId: this.dragItemId, qty: 1, affixes: aff } as ItemInstance
            ;(this.items as any)[targetIdx] = inst
            placed = true
            try { console.log('[Inventory] equip→grid placed', { slotId: this.dragFromEquipId, itemId: this.dragItemId, targetIdx }) } catch {}
          } else {
            try { console.warn('[Inventory] equip→grid blocked: target occupied', { targetIdx }) } catch {}
          }
        }
      }
      if (!placed) {
        const aff = (this.equipment as any)[this.dragFromEquipId + 'Affixes'] as ItemAffixRoll[] | undefined
        try { console.log('[Inventory] equip→grid fallback: add to first free', { slotId: this.dragFromEquipId, itemId: this.dragItemId }) } catch {}
        this.addItemToGrid(this.dragItemId, aff)
      }
      // Clear equipment slot and persist via callback
      ;(this.equipment as any)[this.dragFromEquipId] = undefined
      ;(this.equipment as any)[this.dragFromEquipId + 'Affixes'] = undefined
      this.onUnequip?.(this.dragFromEquipId)
      this.onChange?.(this.items.filter(Boolean) as ItemInstance[])
      this.open([...this.items.filter(Boolean)], this.onChange, this.onDrop, this.equipment, this.onEquip, this.onUnequip)
      this.dragFromEquipId = null
      this.dragItemId = null
      return
    }
    if (this.dragIndex !== null) {
      const it = this.items[this.dragIndex]
      if (it) {
        // Unified equip detection for all equip slots
        const localX = x - (this.container?.x ?? 0)
        const localY = y - (this.container?.y ?? 0)
        console.log('[Inventory] drop end', { global: { x, y }, local: { x: localX, y: localY }, dragIndex: this.dragIndex, itemId: it.itemId })
        const slot = this.allEquipSlots.find(s => this.pointInRectPadded(s.rect, localX, localY, 4))
        if (slot) {
          const cfg = getItem(it.itemId)
          const type = cfg?.type
          const sub = (cfg?.subtype as string | undefined) || undefined
          const typeOK = (slot.type === 'weapon' && type === 'weapon') || (slot.type === 'armor' && type === 'armor')
          const subOK = slot.subtype ? (slot.subtype === sub) : true
          const valid = !!typeOK && !!subOK
          console.log('[Inventory] drop over slot', { slot: { id: slot.id, type: slot.type, sub: slot.subtype, rect: slot.rect }, item: { type, sub }, valid })
          if (valid) {
            const prevId = (this.equipment as any)[slot.id] as string | undefined
            const prevAff = (this.equipment as any)[slot.id + 'Affixes'] as ItemAffixRoll[] | undefined
            ;(this.equipment as any)[slot.id] = it.itemId
            // Store affixes locally so tooltips and future swaps preserve them
            const newAff = (it as any).affixes as ItemAffixRoll[] | undefined
            ;(this.equipment as any)[slot.id + 'Affixes'] = newAff
            try { console.log('[Inventory] equip drop', { slot: slot.id, itemId: it.itemId, newAff, prevId, prevAff }) } catch {}
            this.onEquip?.(slot.type, it.itemId, newAff, slot.id)
            // Swap: put previous equipped back into the same grid index we took from
            if (this.dragIndex !== null) {
              if (prevId) {
                const inst = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, itemId: prevId, qty: 1, affixes: prevAff } as ItemInstance
                ;(this.items as any)[this.dragIndex] = inst
                try { console.log('[Inventory] swap back to grid', { toIndex: this.dragIndex, prevId, prevAff }) } catch {}
              } else {
                // If no previous item, clear the grid cell
                this.items[this.dragIndex] = undefined as any
                try { console.log('[Inventory] equip from grid into empty slot → cleared dragged cell', { idx: this.dragIndex }) } catch {}
              }
            } else {
              // No known drag index; fallback to push previous into grid if exists
              if (prevId) {
                this.addItemToGrid(prevId, prevAff)
                try { console.log('[Inventory] swap back with unknown source index → pushed previous into first free', { prevId }) } catch {}
              }
            }
            // persist
            this.onChange?.(this.items.filter(Boolean) as ItemInstance[])
            // refresh UI
            this.dragIndex = null
            this.open([...this.items.filter(Boolean)], this.onChange, this.onDrop, this.equipment, this.onEquip, this.onUnequip)
          // show tooltip for equipped (use world coords, center of slot)
          const centerWX = (this.container?.x ?? 0) + slot.rect.x + slot.rect.width / 2
          const centerWY = (this.container?.y ?? 0) + slot.rect.y + slot.rect.height / 2
          const fakePointer = { worldX: centerWX, worldY: centerWY } as Phaser.Input.Pointer
            this.showEquipTooltip(slot.id, fakePointer)
            console.log('[Inventory] equipped OK')
            return
          } else {
            this.flashInvalid(slot.type)
            console.warn('[Inventory] invalid drop for slot/type', { slot: { id: slot.id, type: slot.type, sub: slot.subtype }, item: { type, sub } })
          }
        } else {
          // try hotbar drop via external handler
          console.log('[Inventory] drop not over equip slots → delegate to hotbar handler')
          this.onDrop?.({ itemId: it.itemId, x, y })
        }
        // Handle unequip drag: if we were dragging from equip and did not equip elsewhere, add to grid
        if (this.dragFromEquipId && this.dragItemId) {
          const aff = (this.equipment as any)[this.dragFromEquipId + 'Affixes'] as ItemAffixRoll[] | undefined
          try { console.log('[Inventory] unequip by drag', { slotId: this.dragFromEquipId, itemId: this.dragItemId, aff }) } catch {}
          this.addItemToGrid(this.dragItemId, aff)
          ;(this.equipment as any)[this.dragFromEquipId] = undefined
          ;(this.equipment as any)[this.dragFromEquipId + 'Affixes'] = undefined
          this.onUnequip?.(this.dragFromEquipId)
          this.onChange?.(this.items.filter(Boolean) as ItemInstance[])
          this.open([...this.items.filter(Boolean)], this.onChange, this.onDrop, this.equipment, this.onEquip, this.onUnequip)
          this.dragFromEquipId = null
          this.dragItemId = null
          return
        }
        // Reorder inside inventory grid if dropped over another cell
        if (grid) {
          const localX = x - (this.container?.x ?? 0)
          const localY = y - (this.container?.y ?? 0)
          const col = Math.round((localX + grid.gridW / 2 - 30) / 55)
          const row = Math.round((localY + grid.gridH / 2 - 30) / 55)
          if (col >= 0 && col < grid.cols && row >= 0 && row < grid.rows) {
            const targetIdx = row * grid.cols + col
            if (targetIdx !== this.dragIndex) {
              const tmp = this.items[targetIdx]
              this.items[targetIdx] = this.items[this.dragIndex]
              this.items[this.dragIndex] = tmp
              // refresh UI
              const itemsCopy = [...this.items]
              const onChange = this.onChange
              const onDrop = this.onDrop
              const equip = this.equipment
              const onEquip = this.onEquip
              const onUnequip = this.onUnequip
              this.open(itemsCopy, onChange, onDrop, equip, onEquip, onUnequip)
              this.onChange?.(this.items)
              return
            }
          }
        }
      }
    }
    this.dragIndex = null
    this.dragFromEquipId = null
    this.dragItemId = null
    this.tooltip.hide()
    this.onChange?.(this.items)
  }

  close(): void {
    this.tooltip.hide()
    this.container?.destroy(); this.container = undefined
    this.iconNodes.forEach(n => n.destroy()); this.iconNodes = []
    if (this.moveHandler) this.scene.input.off('pointermove', this.moveHandler)
    if (this.downHandler) this.scene.input.off('pointerdown', this.downHandler)
    if (this.upHandler) this.scene.input.off('pointerup', this.upHandler)
    try { (this.scene as any).hotbar?.setAllowSkillClick?.(true) } catch {}
  }

  private iconKeyForItem(itemId?: string): string {
    if (!itemId) return 'particle'
    const cfg = getItem(itemId)
    if (!cfg) return 'particle'
    if (cfg.type === 'potion') return 'icon_potion'
    if (cfg.type === 'weapon') return 'icon_weapon'
    if (cfg.type === 'armor') return 'icon_armor'
    return 'particle'
  }

  private updateEquipHover(slotId: string | null): void {
    if (!this.hoverOutline) return
    if (!slotId) { this.hoverOutline.setVisible(false); return }
    const slot = this.allEquipSlots.find(s => s.id === slotId)
    if (!slot) { this.hoverOutline.setVisible(false); return }
    const node = slot.node
    this.hoverOutline.setSize(node.width, node.height).setPosition(node.x, node.y).setVisible(true)
  }

  private onEquipDragStart(slotId: string): void {
    const itemId = (this.equipment as any)[slotId] as string | undefined
    if (!itemId) return
    this.dragFromEquipId = slotId
    this.dragItemId = itemId
    const p = this.scene.input.activePointer
    try { console.log('[Inventory] equip dragstart', { slotId, itemId, pointer: { x: p.worldX, y: p.worldY } }) } catch {}
    this.dragIcon = this.scene
      .add.text(p.worldX, p.worldY, itemId, { fontFamily: 'monospace', color: '#ffd166', fontSize: '12px' })
      .setDepth(3002)
      .setScrollFactor(0)
  }

  private showEquipTooltip(slotId: string, p: Phaser.Input.Pointer): void {
    const itemId = (this.equipment as any)[slotId] as string | undefined
    if (!itemId) { this.tooltip.hide(); return }
    const cfg = getItem(itemId)
    if (!cfg) { this.tooltip.hide(); return }
    const aff = (this.equipment as any)[slotId + 'Affixes'] as ItemAffixRoll[] | undefined
    try { console.log('[Inventory] showEquipTooltip', { slotId, itemId, hasAffixes: !!aff, affixes: aff }) } catch {}
    const content = this.formatItemTooltip(cfg, '', aff ? { id: 'eq', itemId, affixes: aff } as any : undefined)
    const border = this.effectiveBorderColor(cfg, aff ? { id: 'eq', itemId, affixes: aff } as any : undefined)
    this.tooltip.show(content, p.worldX, p.worldY, { borderColor: border })
  }

  private effectiveBorderColor(cfg: any, inst?: ItemInstance): number {
    // Legendary affix overrides border color to legendary even if base item rarity is lower
    const hasLegendaryAffix = !!(inst?.affixes || []).find(r => (getAffix(r.affixId)?.category === 'legendary'))
    if (hasLegendaryAffix) return rarityToColor('legendary' as any)
    return cfg ? rarityToColor(cfg.rarity) : 0xffffff
  }

  private formatItemTooltip(cfg: any, qtyLine: string, inst?: ItemInstance): string {
    const name = cfg?.name || 'Unknown'
    const rarity = cfg?.rarity || 'common'
    const lines: string[] = []
    lines.push(`${name} [${rarity}]${qtyLine}`)
    const p = cfg?.params || {}
    const paramEntries = Object.entries(p)
      .filter(([k, v]) => typeof v === 'number' || typeof v === 'string')
      .map(([k, v]) => `- ${k}: ${v}`)
    // Value line
    const value = getItemValue(cfg.id)
    if (value > 0) lines.push(`
Value: ${value} coins`)
    if (paramEntries.length) {
      lines.push(paramEntries.join('\n'))
    }
    // Affixes
    const rolls = inst?.affixes || []
    if (rolls.length) {
      lines.push('')
      for (const r of rolls) {
        const a = getAffix(r.affixId)
        if (!a) continue
        const v = (typeof r.value !== 'undefined') ? r.value : undefined
        const suffix = (v != null) ? (a.valueType === 'percent' ? ` +${v}%` : ` +${v}`) : ''
        lines.push(`• ${a.label}${suffix}`)
      }
    }
    const lore = cfg?.lore || ''
    if (lore) lines.push(lore)
    return lines.join('\n')
  }

  private flashInvalid(slot: 'weapon' | 'armor'): void {
    if (!this.equipRects) return
    const r = slot === 'weapon' ? this.equipRects.weapon : this.equipRects.armor
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2
    const rect = this.scene.add.rectangle(cx, cy, r.width, r.height, 0xff0000, 0.15).setStrokeStyle(2, 0xff4444, 1)
    rect.setDepth(3001)
    this.scene.tweens.add({ targets: rect, alpha: 0, duration: 280, onComplete: () => rect.destroy() })
  }

  private pointInRect(r: Phaser.Geom.Rectangle, x: number, y: number): boolean {
    return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height
  }

  private pointInRectPadded(r: Phaser.Geom.Rectangle, x: number, y: number, pad: number): boolean {
    return x >= r.x - pad && x <= r.x + r.width + pad && y >= r.y - pad && y <= r.y + r.height + pad
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (!this.container || !this.gridMeta) return
    const localX = p.x - this.container.x
    const localY = p.y - this.container.y
    const idx = this.pointerToIndex(localX, localY)
    if (idx !== this.hoverIdx) {
      this.hoverIdx = idx
      if (idx !== null) { this.showTooltip(idx, p); this.hoverOutline?.setStrokeStyle(2, 0x66ccff, 1) } else { this.tooltip.hide() }
      this.updateHoverOutline()
    }
    // Equip slot hover when NOT dragging and not over grid → cyan outline + tooltip if equipped
    if (this.allEquipSlots.length > 0 && !(this.dragIndex !== null || this.dragItemId) && this.hoverIdx === null) {
      const sOver = this.allEquipSlots.find(s => this.pointInRectPadded(s.rect, localX, localY, 4))
      if (sOver) {
        if (this.hoverOutline) {
          this.hoverOutline
            .setStrokeStyle(2, 0x66ccff, 1)
            .setSize(sOver.rect.width, sOver.rect.height)
            .setPosition(sOver.rect.x + sOver.rect.width / 2, sOver.rect.y + sOver.rect.height / 2)
            .setVisible(true)
        }
        const eqId = (this.equipment as any)[sOver.id] as string | undefined
        if (eqId) {
          // Use the same equip tooltip renderer (with affixes + quality border)
          this.showEquipTooltip(sOver.id, p)
        } else {
          this.tooltip.hide()
        }
      } else {
        if (this.hoverOutline) this.hoverOutline.setVisible(false)
      }
    }
    // live highlight for equip slots during drag (unified per-slot logic)
    if (this.allEquipSlots.length > 0 && (this.dragIndex !== null || this.dragItemId)) {
      const draggingItemId = this.dragIndex !== null ? this.items[this.dragIndex]?.itemId : this.dragItemId
      const cfg = draggingItemId ? getItem(draggingItemId) : undefined
      const type = cfg?.type
      const sub = (cfg?.subtype as string | undefined) || undefined
      this.allEquipSlots.forEach(s => {
        const over = this.pointInRectPadded(s.rect, localX, localY, 4)
        const typeOK = type ? ((s.type === 'weapon' && type === 'weapon') || (s.type === 'armor' && type === 'armor')) : false
        const subOK = s.subtype ? (s.subtype === sub) : true
        const valid = typeOK && subOK
        s.node.setStrokeStyle(2, over ? (valid ? 0x66ff99 : 0xff6666) : 0x333333, 1)
      })
    }
    if (this.dragIcon) this.onDragMove(p.x, p.y)
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (!this.container || !this.gridMeta) return
    const localX = p.x - this.container.x
    const localY = p.y - this.container.y
    const idx = this.pointerToIndex(localX, localY)
    if (idx !== null) {
      try { console.log('[Inventory] grid dragstart', { idx, pointer: { x: p.x, y: p.y } }) } catch {}
      this.onDragStart(idx)
      return
    }
    // Not over grid: if over an equipped slot, start equip drag
    const sOver = this.allEquipSlots.find(s => this.pointInRectPadded(s.rect, localX, localY, 4))
    if (sOver) {
      const eqId = (this.equipment as any)[sOver.id] as string | undefined
      if (eqId) {
        try { console.log('[Inventory] equip dragstart (pointerdown)', { slotId: sOver.id, itemId: eqId, pointer: { x: p.x, y: p.y } }) } catch {}
        this.onEquipDragStart(sOver.id)
        return
      }
    }
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    if (this.dragIndex !== null || (this.dragFromEquipId && this.dragItemId)) {
      try { console.log('[Inventory] pointerup → drop', { fromGrid: this.dragIndex !== null, fromEquip: !!(this.dragFromEquipId && this.dragItemId) }) } catch {}
      this.onDragEnd(p.x, p.y, this.gridMeta && { cols: this.gridMeta.cols, rows: this.gridMeta.rows, gridW: this.gridMeta.w, gridH: this.gridMeta.h })
    }
  }

  private pointerToIndex(localX: number, localY: number): number | null {
    if (!this.gridMeta) return null
    const { cols, rows, pitch, cell, originCX, originCY } = this.gridMeta
    const startX = originCX - cell / 2
    const startY = originCY - cell / 2
    const col = Math.floor((localX - startX) / pitch)
    const row = Math.floor((localY - startY) / pitch)
    if (col < 0 || col >= cols || row < 0 || row >= rows) return null
    const cx = originCX + col * pitch
    const cy = originCY + row * pitch
    if (Math.abs(localX - cx) <= cell / 2 && Math.abs(localY - cy) <= cell / 2) return row * cols + col
    return null
  }

  private updateHoverOutline(): void {
    if (!this.hoverOutline || !this.gridMeta) return
    if (this.hoverIdx === null) { this.hoverOutline.setVisible(false); return }
    const { cols, pitch, cell, originCX, originCY } = this.gridMeta
    const c = this.hoverIdx % cols
    const r = Math.floor(this.hoverIdx / cols)
    // Grid cell center (matches green/red validity highlight logic which uses cell bounds)
    const cx = originCX + c * pitch
    const cy = originCY + r * pitch
    this.hoverOutline
      .setStrokeStyle(2, 0x66ccff, 0.9)
      .setSize(cell, cell)
      .setPosition(cx, cy)
      .setVisible(true)
  }

  private onCellClick(idx: number, _p: Phaser.Input.Pointer): void {
    const now = Date.now()
    if (this.lastClickIdx === idx && now - this.lastClickAt < 300) {
      const it = this.items[idx]
      if (it) this.autoEquip(it.itemId)
      this.lastClickIdx = null; this.lastClickAt = 0
      return
    }
    this.lastClickIdx = idx; this.lastClickAt = now
  }

  private autoEquip(itemId: string): void {
    const cfg = getItem(itemId)
    if (!cfg) return
    // Find best slot by subtype first, then type fallback
    let target = this.allEquipSlots.find(s => (cfg.type === s.type) && (!!s.subtype ? s.subtype === cfg.subtype : true))
    if (!target) target = this.allEquipSlots.find(s => cfg.type === s.type)
    if (!target) return
    console.log('[Inventory] autoEquip', { itemId, type: cfg.type, sub: cfg.subtype, target: { id: target.id, type: target.type, sub: target.subtype } })
    const prevId = (this.equipment as any)[target.id] as string | undefined
    const prevAff = (this.equipment as any)[target.id + 'Affixes'] as ItemAffixRoll[] | undefined
    ;(this.equipment as any)[target.id] = itemId
    const invInst = this.items.find(i => i && i.itemId === itemId)
    const newAff = (invInst as any)?.affixes as ItemAffixRoll[] | undefined
    ;(this.equipment as any)[target.id + 'Affixes'] = newAff
    try { console.log('[Inventory] autoEquip', { target: target.id, itemId, newAff, prevId, prevAff }) } catch {}
    this.onEquip?.(target.type, itemId, newAff, target.id)
    // remove one instance from inventory
    const idx = this.items.findIndex(i => i && i.itemId === itemId)
    if (idx >= 0) {
      if (prevId) {
        // swap into same slot regardless of base id equality
        const inst = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, itemId: prevId, qty: 1, affixes: prevAff } as ItemInstance
        ;(this.items as any)[idx] = inst
        try { console.log('[Inventory] autoEquip swap back to grid', { toIndex: idx, prevId, prevAff }) } catch {}
      } else {
        this.items[idx] = undefined as any
        try { console.log('[Inventory] autoEquip into empty slot → cleared dragged cell', { idx }) } catch {}
      }
    } else if (prevId && prevId !== itemId) {
      this.addItemToGrid(prevId, prevAff)
    }
    this.onChange?.(this.items.filter(Boolean) as ItemInstance[])
    // refresh UI
    this.open([...this.items.filter(Boolean)], this.onChange, this.onDrop, this.equipment, this.onEquip, this.onUnequip)
  }

  private addItemToGrid(itemId: string, affixes?: ItemAffixRoll[]): void {
    const emptyIdx = this.items.findIndex(i => !i)
    const inst = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, itemId, qty: 1, affixes } as ItemInstance
    try { console.log('[Inventory] addItemToGrid', { itemId, affixes, usedIndex: emptyIdx }) } catch {}
    if (emptyIdx >= 0) (this.items as any)[emptyIdx] = inst
    else (this.items as any).push(inst)
  }
}
