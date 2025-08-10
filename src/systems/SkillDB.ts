import skillsRaw from '@/data/skills.json'
import { CharacterClass, SkillConfig } from '@/types'

const db: Record<string, SkillConfig> = {}
;(skillsRaw as any).skills.forEach((s: SkillConfig) => { db[s.id] = s })

export function listSkillSummaries(): { id: string; name: string }[] {
  return Object.values(db).map(s => ({ id: s.id, name: s.name }))
}

export function getSkill(id: string): SkillConfig | undefined { return db[id] }

export function listSkills(filter?: { class?: CharacterClass }): SkillConfig[] {
  const all = Object.values(db)
  if (!filter?.class) return all
  return all.filter(s => !s.classRestriction || s.classRestriction === 'all' || s.classRestriction === filter.class)
}

export function getSkillRunes(skillId: string): { id: string; name: string }[] {
  const s = db[skillId]
  return (s?.runes || []).map(r => ({ id: r.id, name: r.name }))
}

