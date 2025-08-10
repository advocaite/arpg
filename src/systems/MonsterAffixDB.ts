import affixesRaw from '@/data/monster_affixes.json'

export type MonsterAffixConfig = {
  id: string
  name: string
  description?: string
  modifiers?: { speedMult?: number; cooldownMult?: number }
  powers?: Array<{ ref: string; params?: Record<string, number | string | boolean>; chance?: number; cooldownMs?: number }>
}

const db: Record<string, MonsterAffixConfig> = {}
;(affixesRaw as any).affixes.forEach((a: MonsterAffixConfig) => { db[a.id] = a })

export function getAffix(id: string): MonsterAffixConfig | undefined { return db[id] }
export function listAffixes(): MonsterAffixConfig[] { return Object.values(db) }


