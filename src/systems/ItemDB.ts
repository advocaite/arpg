import itemsRaw from '@/data/items.json'
import type { ItemConfig, ItemRarity, AffixConfig, ItemSetConfig, ItemInstance } from '@/types'
import affixesRaw from '@/data/affixes.json'
import setsRaw from '@/data/item_sets.json'

const db: Record<string, ItemConfig> = {}
;(itemsRaw as any).items.forEach((it: ItemConfig) => { db[it.id] = it })
const affixDb: Record<string, AffixConfig> = {}
;(affixesRaw as any).affixes?.forEach((a: AffixConfig) => { affixDb[a.id] = a })
const setDb: Record<string, ItemSetConfig> = {}
;(setsRaw as any).sets?.forEach((s: ItemSetConfig) => { setDb[s.id] = s })

export function getItem(id: string): ItemConfig | undefined { return db[id] }
export function listItems(): ItemConfig[] { return Object.values(db) }
export function getItemValue(id: string): number { const it = db[id]; const base = Number((it as any)?.value ?? 0); return Number.isFinite(base) ? Math.max(0, Math.floor(base)) : 0 }

export function computeSellValue(inst: ItemInstance): number {
  const cfg = db[inst.itemId]
  if (!cfg) return 0
  const base = getItemValue(cfg.id)
  const rarityMult: Record<ItemRarity, number> = { common: 1, rare: 2, epic: 4, legendary: 8 }
  let value = base * (rarityMult[cfg.rarity] || 1)
  const rolls = inst.affixes || []
  for (const r of rolls) {
    const a = affixDb[r.affixId]
    if (!a) continue
    const v = typeof r.value === 'number' ? r.value : 0
    if (a.category === 'legendary') {
      value += 50
    } else if (a.valueType === 'percent') {
      value += Math.round(v * 2)
    } else {
      value += Math.round(v * 1)
    }
  }
  return Math.max(0, Math.floor(value))
}
export function isStackable(id: string): boolean { const c = db[id]; return !!c && !!c.stackable }
export function maxStack(id: string): number {
  const c = db[id]
  if (!c) return 1
  if (!c.stackable) return 1
  const n = Number(c.maxStack ?? 20)
  return Number.isFinite(n) && n > 0 ? n : 20
}

export function rarityToColor(r: ItemRarity): number {
  switch (r) {
    case 'common': return 0x9aa0a6
    case 'rare': return 0x66aaff
    case 'epic': return 0xc266ff
    case 'legendary': return 0xffaa33
    default: return 0xffffff
  }
}

export function getAffix(id: string): AffixConfig | undefined { return affixDb[id] }
export function listAffixes(): AffixConfig[] { return Object.values(affixDb) }
export function getItemSet(id: string): ItemSetConfig | undefined { return setDb[id] }
export function listItemSets(): ItemSetConfig[] { return Object.values(setDb) }

// Simple RNG helper
function pickWeighted<T>(items: T[], weightFn: (t: T) => number): T | undefined {
  const weights = items.map(weightFn)
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0)
  if (total <= 0) return items[0]
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) { r -= Math.max(0, weights[i]); if (r <= 0) return items[i] }
  return items[items.length - 1]
}

export function rollAffixesForItem(base: ItemConfig, magicFindPct: number = 0): { primary: string[]; secondary: string[]; legendary?: string } {
  // Affix counts by rarity
  // normal/common: 1 primary, 1 secondary
  // rare: 2 primary, 2 secondary
  // epic: 3 primary, 3 secondary
  // legendary: 3 primary, 3 secondary + legendary power
  const table: Record<ItemRarity, { pri: number; sec: number; allowLeg: boolean }> = {
    common: { pri: 1, sec: 1, allowLeg: false },
    rare: { pri: 2, sec: 2, allowLeg: false },
    epic: { pri: 3, sec: 3, allowLeg: false },
    legendary: { pri: 3, sec: 3, allowLeg: true },
  }
  const plan = table[base.rarity] || table.common
  const primaryCount = plan.pri
  const secondaryCount = plan.sec
  // Scale legendary allowance/chances slightly with magic find
  const allowLegendary = plan.allowLeg
  const allowedPri = listAffixes().filter(a => a.category === 'primary' && (!a.allowedTypes || a.allowedTypes.includes(base.type)) && (!a.allowedSubtypes || a.allowedSubtypes.includes(base.subtype || '')))
  const allowedSec = listAffixes().filter(a => a.category === 'secondary' && (!a.allowedTypes || a.allowedTypes.includes(base.type)) && (!a.allowedSubtypes || a.allowedSubtypes.includes(base.subtype || '')))
  const pri: string[] = []
  const sec: string[] = []
  for (let i = 0; i < primaryCount && allowedPri.length > 0; i++) {
    const a = pickWeighted(allowedPri.filter(x => !pri.includes(x.id)), x => x.weight ?? 1)
    if (a) pri.push(a.id)
  }
  for (let i = 0; i < secondaryCount && allowedSec.length > 0; i++) {
    const a = pickWeighted(allowedSec.filter(x => !sec.includes(x.id)), x => x.weight ?? 1)
    if (a) sec.push(a.id)
  }
  let legendary: string | undefined
  if (allowLegendary) {
    const legs = listAffixes().filter(a => a.category === 'legendary')
    // modest MF effect: scale weight by (1 + magicFindPct)
    legendary = pickWeighted(legs, x => (x.weight ?? 1) * (1 + magicFindPct))?.id
  }
  return { primary: pri, secondary: sec, legendary }
}

// Internal helper for Inventory.ts to peek min/max when rolling placeholder values
;(rollAffixesForItem as any).__lookup = function(id: string) {
  return affixDb[id]
}
