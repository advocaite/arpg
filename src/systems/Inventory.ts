import type { ItemInstance, HotbarConfig, EquipmentConfig } from '@/types'
import { isStackable, maxStack, rollAffixesForItem, getItem, getAffix } from '@/systems/ItemDB'

const INV_KEY = (charId: number) => `arpg.inv.${charId}`
const HOTBAR_KEY = (charId: number) => `arpg.hotbar.${charId}`
const EQUIP_KEY = (charId: number) => `arpg.equip.${charId}`

export function loadInventory(charId: number): ItemInstance[] {
  try { const raw = localStorage.getItem(INV_KEY(charId)); return raw ? JSON.parse(raw) : [] } catch { return [] }
}

export function saveInventory(charId: number, inv: ItemInstance[]): void {
  // Persist full instances including affixes
  localStorage.setItem(INV_KEY(charId), JSON.stringify(inv))
}

export function addToInventory(charId: number, inv: ItemInstance[], itemId: string, qty: number = 1, opts?: { magicFindPct?: number }): ItemInstance[] {
  // Stack if stackable, else push new instances
  if (isStackable(itemId)) {
    let remaining = qty
    for (const it of inv) {
      if (it.itemId !== itemId) continue
      const cap = maxStack(itemId)
      const curr = Number(it.qty || 1)
      const add = Math.min(cap - curr, remaining)
      if (add > 0) { it.qty = curr + add; remaining -= add }
      if (remaining <= 0) break
    }
    while (remaining > 0) {
      const add = Math.min(maxStack(itemId), remaining)
      inv.push({ id: `${Date.now()}_${Math.random()}`, itemId, qty: add })
      remaining -= add
    }
    saveInventory(charId, inv)
    return inv
  }
  // Non-stackable items can roll affixes at creation
  const base = getItem(itemId)
  const inst = { id: `${Date.now()}_${Math.random()}`, itemId, qty } as ItemInstance
  if (base && base.type !== 'potion') {
    const bundles = rollAffixesForItem(base, Math.max(0, Number(opts?.magicFindPct ?? 0)))
    const rolls: any[] = []
    // TODO: value rolls; for now, sample mid-range as placeholder
    const all = [...bundles.primary, ...bundles.secondary]
    for (const id of all) {
      const ax = getAffix(id)
      let value: number | undefined = undefined
      if (typeof ax?.min === 'number' && typeof ax?.max === 'number') {
        const min = Math.floor(ax.min)
        const max = Math.floor(ax.max)
        value = Math.floor(min + Math.random() * Math.max(0, (max - min + 1)))
      }
      rolls.push(value != null ? { affixId: id, value } : { affixId: id })
    }
    if (bundles.legendary) rolls.push({ affixId: bundles.legendary })
    if (rolls.length) (inst as any).affixes = rolls
  }
  inv.push(inst)
  saveInventory(charId, inv)
  return inv
}

// Inventory capacity logic (matches UI grid 7x4)
export function inventoryCapacity(): number { return 28 }

export function countFreeSlots(inv: ItemInstance[]): number {
  const cap = inventoryCapacity()
  const occupied = inv.filter(i => Number(i.qty || 1) > 0).length
  return Math.max(0, cap - occupied)
}

export function canAddItem(inv: ItemInstance[], itemId: string, qty: number = 1): boolean {
  if (isStackable(itemId)) {
    // Compute how many new stacks are needed after filling existing ones
    let remaining = qty
    const cap = maxStack(itemId)
    for (const it of inv) {
      if (it.itemId !== itemId) continue
      const curr = Number(it.qty || 1)
      const space = Math.max(0, cap - curr)
      const use = Math.min(space, remaining)
      remaining -= use
      if (remaining <= 0) break
    }
    if (remaining <= 0) return true
    const neededNewStacks = Math.ceil(remaining / Math.max(1, maxStack(itemId)))
    return countFreeSlots(inv) >= neededNewStacks
  }
  // Non-stackable items require one free slot per item
  return countFreeSlots(inv) >= qty
}

export function countItemInInv(inv: unknown, itemId: string): number {
  if (!Array.isArray(inv)) return 0
  let sum = 0
  for (const raw of inv) {
    if (!raw || typeof raw !== 'object') continue
    const anyIt = raw as any
    if (anyIt.itemId !== itemId) continue
    const qtyNum = Number(anyIt.qty ?? 1)
    sum += isNaN(qtyNum) ? 1 : qtyNum
  }
  return sum
}

export function consumeFromInventory(charId: number, inv: ItemInstance[], itemId: string, qty: number = 1): ItemInstance[] {
  let remaining = qty
  for (const it of inv) {
    if (remaining <= 0) break
    if (it.itemId !== itemId) continue
    const curr = Number(it.qty || 1)
    const take = Math.min(curr, remaining)
    const newQty = curr - take
    remaining -= take
    if (newQty <= 0) { it.qty = 0 as any }
    else { it.qty = newQty }
  }
  // remove emptied
  const newInv = inv.filter(i => Number(i.qty || 1) > 0)
  saveInventory(charId, newInv)
  return newInv
}

export function loadHotbar(charId: number): HotbarConfig {
  try {
    const raw = localStorage.getItem(HOTBAR_KEY(charId))
    const base = raw ? JSON.parse(raw) : { potionRefId: undefined, skillRefIds: [] }
    // ensure new fields exist
    if (!('runeRefIds' in base)) base.runeRefIds = new Array(4).fill(undefined)
    return base
  } catch {
    return { potionRefId: undefined, skillRefIds: [], runeRefIds: new Array(4).fill(undefined) as (string | undefined)[] }
  }
}

export function saveHotbar(charId: number, cfg: HotbarConfig): void {
  localStorage.setItem(HOTBAR_KEY(charId), JSON.stringify(cfg))
}

export function loadEquipment(charId: number): EquipmentConfig {
  try { const raw = localStorage.getItem(EQUIP_KEY(charId)); return raw ? JSON.parse(raw) : {} } catch { return {} }
}

export function saveEquipment(charId: number, equip: EquipmentConfig): void {
  localStorage.setItem(EQUIP_KEY(charId), JSON.stringify(equip))
}
