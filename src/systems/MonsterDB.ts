import monstersRaw from '@/data/monsters.json'
import { MonsterConfig } from '@/types'

export type MonsterDB = { [id: string]: MonsterConfig }

const db: MonsterDB = {}
;(monstersRaw as any).monsters.forEach((m: MonsterConfig) => { db[m.id] = m })

export function getMonster(id: string): MonsterConfig | undefined { return db[id] }
export function listMonsters(): MonsterConfig[] { return Object.values(db) }

