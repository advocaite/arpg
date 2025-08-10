import itemsRaw from '@/data/items.json'
import type { ItemConfig } from '@/types'

const db: Record<string, ItemConfig> = {}
;(itemsRaw as any).items.forEach((it: ItemConfig) => { db[it.id] = it })

export function getItem(id: string): ItemConfig | undefined { return db[id] }
export function listItems(): ItemConfig[] { return Object.values(db) }
export function isStackable(id: string): boolean { const c = db[id]; return !!c && !!c.stackable }
export function maxStack(id: string): number { const c = db[id]; return c?.maxStack ? Number(c.maxStack) : 99 }
