import type { CharacterClass, Element, Stats } from '@/types'

export type DerivedCombatStats = {
  damageMultiplier: number
  armor: number
  resistAll: number
  lifePerVitality: number
  // Element-specific multipliers and resistances derived from base stats
  elementDamageMultipliers: Record<Element, number>
  elementResists: Record<Element, number>
  // Movement/attack and combat utility
  moveSpeedMult: number
  attackSpeedMult: number
  critChance: number // 0..1
  critDamageMult: number // e.g., 1.5 = +50%
  // Loot/combat sustain
  magicFindPct: number // 0..1
  healthPerSecond: number
  healthOnHit: number
  healthOnKill: number
  globeMagnetRadius: number
  goldMagnetRadius: number
  // Avoidance/mitigation
  dodgeChance: number // 0..1
  blockChance: number // 0..1
  blockAmount: number // flat damage blocked
  crowdControlReductionPct: number // 0..1
  eliteDamageReductionPct: number // 0..1
  meleeDamageReductionPct: number // 0..1
  rangedDamageReductionPct: number // 0..1
  thornsDamage: number
  areaDamagePct: number // 0..1
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

  // For now, scale all elemental damage by the same primary-based multiplier;
  // this can be specialized later per class/element balance.
  const elementDamageMultipliers: Record<Element, number> = {
    physical: damageMultiplier,
    fire: damageMultiplier,
    cold: damageMultiplier,
    lightning: damageMultiplier,
    poison: damageMultiplier,
    arcane: damageMultiplier,
  }
  const elementResists: Record<Element, number> = {
    physical: resistAll,
    fire: resistAll,
    cold: resistAll,
    lightning: resistAll,
    poison: resistAll,
    arcane: resistAll,
  }

  // Additional derived values (simple placeholder formulas; tune later)
  const moveSpeedMult = 1 + (stats.dexterity || 0) * 0.005
  const attackSpeedMult = 1 + (stats.dexterity || 0) * 0.005
  const critChance = 0.05 + (stats.dexterity || 0) * 0.001
  const critDamageMult = 1.5
  const magicFindPct = Math.min(0.5, (stats.intelligence || 0) * 0.001)
  const healthPerSecond = Math.max(0, (stats.vitality || 0) * 0.2)
  const healthOnHit = Math.max(0, (stats.strength || 0) * 0.05)
  const healthOnKill = Math.max(0, (stats.vitality || 0) * 0.2)
  const globeMagnetRadius = 120 + (stats.dexterity || 0) * 0.5
  const goldMagnetRadius = 120 + (stats.vitality || 0) * 0.4
  const dodgeChance = Math.min(0.4, (stats.dexterity || 0) * 0.0005)
  const blockChance = Math.min(0.35, (stats.strength || 0) * 0.0004)
  const blockAmount = (stats.strength || 0) * 0.6
  const crowdControlReductionPct = Math.min(0.5, (stats.intelligence || 0) * 0.001)
  const eliteDamageReductionPct = Math.min(0.5, (stats.vitality || 0) * 0.001)
  const meleeDamageReductionPct = Math.min(0.4, (stats.strength || 0) * 0.0005)
  const rangedDamageReductionPct = Math.min(0.4, (stats.dexterity || 0) * 0.0005)
  const thornsDamage = 0
  const areaDamagePct = 0

  return {
    damageMultiplier,
    armor,
    resistAll,
    lifePerVitality,
    elementDamageMultipliers,
    elementResists,
    moveSpeedMult,
    attackSpeedMult,
    critChance,
    critDamageMult,
    magicFindPct,
    healthPerSecond,
    healthOnHit,
    healthOnKill,
    globeMagnetRadius,
    goldMagnetRadius,
    dodgeChance,
    blockChance,
    blockAmount,
    crowdControlReductionPct,
    eliteDamageReductionPct,
    meleeDamageReductionPct,
    rangedDamageReductionPct,
    thornsDamage,
    areaDamagePct,
  }
}

export function applyDamageReduction(
  rawDamage: number,
  armor: number,
  resistAll: number,
  level: number,
  opts?: {
    element?: Element
    elementResists?: Record<Element, number>
    source?: 'melee' | 'ranged' | 'spell' | 'unknown'
    isElite?: boolean
    dodgeChance?: number
    blockChance?: number
    blockAmount?: number
    meleeDamageReductionPct?: number
    rangedDamageReductionPct?: number
    eliteDamageReductionPct?: number
  }
): number {
  // Simplified D3 formulas assuming monsterLevel ~= player level
  const monsterLevel = Math.max(1, level)
  // Dodge roll
  if (opts?.dodgeChance && Math.random() < opts.dodgeChance) return 0
  // Block flat amount
  let damage = Math.max(0, rawDamage - (opts?.blockChance && Math.random() < opts.blockChance ? (opts.blockAmount || 0) : 0))
  const armorDR = armor / (armor + 50 * monsterLevel)
  const elementResist = opts?.element && opts?.elementResists ? (opts.elementResists[opts.element] ?? resistAll) : resistAll
  const resistDR = elementResist / (elementResist + 5 * monsterLevel)
  let reduced = damage * (1 - armorDR) * (1 - resistDR)
  if (opts?.source === 'melee' && opts?.meleeDamageReductionPct) reduced *= (1 - opts.meleeDamageReductionPct)
  if (opts?.source === 'ranged' && opts?.rangedDamageReductionPct) reduced *= (1 - opts.rangedDamageReductionPct)
  if (opts?.isElite && opts?.eliteDamageReductionPct) reduced *= (1 - opts.eliteDamageReductionPct)
  return Math.max(0, Math.floor(reduced))
}



