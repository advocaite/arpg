import type { ItemInstance, HotbarConfig, EquipmentConfig } from '@/types'
import { isStackable, maxStack } from '@/systems/ItemDB'

const INV_KEY = (charId: number) => `arpg.inv.${charId}`
const HOTBAR_KEY = (charId: number) => `arpg.hotbar.${charId}`
const EQUIP_KEY = (charId: number) => `arpg.equip.${charId}`

export function loadInventory(charId: number): ItemInstance[] {
  try { const raw = localStorage.getItem(INV_KEY(charId)); return raw ? JSON.parse(raw) : [] } catch { return [] }
}

export function saveInventory(charId: number, inv: ItemInstance[]): void {
  localStorage.setItem(INV_KEY(charId), JSON.stringify(inv))
}

export function addToInventory(charId: number, inv: ItemInstance[], itemId: string, qty: number = 1): ItemInstance[] {
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
  inv.push({ id: `${Date.now()}_${Math.random()}`, itemId, qty })
  saveInventory(charId, inv)
  return inv
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
  try { const raw = localStorage.getItem(HOTBAR_KEY(charId)); return raw ? JSON.parse(raw) : { potionRefId: undefined, skillRefIds: [] } } catch { return { potionRefId: undefined, skillRefIds: [] } }
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
