import type { CharacterClass, Stats } from '@/types'

export type DerivedCombatStats = {
  damageMultiplier: number
  armor: number
  resistAll: number
  lifePerVitality: number
}

export function getPrimaryStatForClass(charClass: CharacterClass, s: Stats): number {
  if (charClass === 'melee') return s.strength
  if (charClass === 'ranged') return s.dexterity
  return s.intelligence
}

export function getLifePerVitality(level: number): number {
  // D3-style: 1–35 => +10 life per VIT; 36–60 increases by +1 per level up to +35 at 60; 60+ stays at +35
  if (level <= 35) return 10
  const scaled = 10 + (level - 35)
  return Math.min(35, Math.max(10, scaled))
}

export function computeDerivedStats(stats: Stats, charClass: CharacterClass, level: number): DerivedCombatStats {
  const primary = getPrimaryStatForClass(charClass, stats)
  const damageMultiplier = 1 + (primary / 100)
  const armor = (stats.strength || 0) + (stats.dexterity || 0)
  const resistAll = Math.floor((stats.intelligence || 0) / 10)
  const lifePerVitality = getLifePerVitality(level)
  return { damageMultiplier, armor, resistAll, lifePerVitality }
}

export function applyDamageReduction(rawDamage: number, armor: number, resistAll: number, level: number): number {
  // Simplified D3 formulas assuming monsterLevel ~= player level
  const monsterLevel = Math.max(1, level)
  const armorDR = armor / (armor + 50 * monsterLevel)
  const resistDR = resistAll / (resistAll + 5 * monsterLevel)
  const reduced = rawDamage * (1 - armorDR) * (1 - resistDR)
  return Math.max(0, Math.floor(reduced))
}



