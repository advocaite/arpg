import skillsRaw from '@/data/skills.json'
import { SkillConfig } from '@/types'

const db: Record<string, SkillConfig> = {}
;(skillsRaw as any).skills.forEach((s: SkillConfig) => { db[s.id] = s })

export function getSkill(id: string): SkillConfig | undefined { return db[id] }

