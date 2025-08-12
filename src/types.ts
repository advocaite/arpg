// Support legacy broad archetypes and Diablo 3 class names
export type CharacterClass =
  | 'melee'
  | 'ranged'
  | 'magic'
  | 'barbarian'
  | 'crusader'
  | 'demon_hunter'
  | 'monk'
  | 'necromancer'
  | 'witch_doctor'
  | 'wizard'

export type Stats = {
  strength: number
  vitality: number
  intelligence: number
  dexterity: number
}

export type DerivedStatsSnapshot = {
  damageMultiplier: number
  armor: number
  resistAll: number
  lifePerVitality: number
  elementDamageMultipliers: Record<Element, number>
  elementResists: Record<Element, number>
  moveSpeedMult: number
  attackSpeedMult: number
  critChance: number
  critDamageMult: number
  magicFindPct: number
  healthPerSecond: number
  manaPerSecond?: number
  healthOnHit: number
  globeMagnetRadius: number
  goldMagnetRadius: number
  dodgeChance: number
  blockChance: number
  blockAmount: number
  crowdControlReductionPct: number
  eliteDamageReductionPct: number
  meleeDamageReductionPct: number
  rangedDamageReductionPct: number
  thornsDamage: number
  areaDamagePct: number
}

export type CharacterProfile = {
  id: number
  name: string
  class: CharacterClass
  level?: number
  exp?: number
  hp?: number
  mana?: number
  maxMana?: number
  derived?: DerivedStatsSnapshot
  stats: Stats
}

export type PortalConfig = {
  id?: string
  name: string
  destinationScene: string
  destinationId?: string
  x: number
  y: number
}

export type NpcRole = 'shopkeeper' | 'blacksmith' | 'trainer' | 'healer' | 'questgiver' | 'flavor'

export type NpcConfig = {
  id: string
  name: string
  role: NpcRole
  x: number
  y: number
  // Optional AI brain for NPCs (patterned after monster brains)
  brainId?: string
  // Optional parameters for the NPC brain and behavior
  params?: Record<string, number | string | boolean>
  // Optional list of conversation bundle ids to consider for this NPC
  conversationBundles?: string[]
}

export type WorldConfig = {
  id: string
  name: string
  width: number
  height: number
  tilemapUrl?: string
  tilesetKey?: string
  // Optional background music per world
  music?: {
    key: string
    urls?: string[]
    volume?: number
    combatKey?: string
    combatUrls?: string[]
    combatVolume?: number
  }
  // Optional ambient light color (0xRRGGBB); only used if WebGL lights are enabled
  ambientLight?: number
  portals: PortalConfig[]
  npcs: NpcConfig[]
  obstacles?: { x: number; y: number }[]
  spawners?: SpawnerConfig[]
  checkpoints?: CheckpointConfig[]
  // Optional static lights/props (e.g., torches)
  lights?: LightConfig[]
  // Optional non-colliding decorative props
  decor?: DecorConfig[]
  // Optional starting spawn point for the player
  start?: { x: number; y: number }
}

export type LightConfig = {
  x: number
  y: number
  color?: number // default warm torch color
  radius?: number // default 180
  intensity?: number // default 1
  flicker?: boolean // default true
  // Optional types: 'point' behaves like torch; 'sky' follows camera to simulate skylight
  type?: 'point' | 'sky'
  followCamera?: boolean
}

export type DecorConfig = {
  x: number
  y: number
  kind?: string
  tint?: number
}

export type SpawnerConfig = {
  monsterId: string
  everyMs: number
  count: number
  limit?: number
  startDelayMs?: number
  // Optional: choose randomly from a set instead of fixed id
  monsterPool?: string[]
  // Optional: enforce or randomize tiers
  tier?: 'normal' | 'champion' | 'rare' | 'unique'
  randomTier?: boolean
}

export type CheckpointConfig = {
  id?: string
  x: number
  y: number
  name?: string
}

export type MonsterBehavior = 'chaser' | 'shooter' | 'boss'

// Elements for damage/resistance and visual themes
export type Element = 'physical' | 'fire' | 'cold' | 'lightning' | 'poison' | 'arcane'

export type SkillCategory =
  | 'primary'
  | 'secondary'
  | 'defensive'
  | 'might'
  | 'tactics'
  | 'rage'
  | 'utility'
  | 'other'

export type RuneConfig = {
  id: string
  name: string
  description?: string
  icon?: string
  classRestriction?: CharacterClass | 'all'
  // References to modular code
  effectRef?: string
  powerRef?: string
  params?: Record<string, number | string | boolean>
}

export type SkillConfig = {
  id: string
  name: string
  description?: string
  icon?: string
  type: 'projectile' | 'dash' | 'aoe' | 'buff'
  category?: SkillCategory
  classRestriction?: CharacterClass | 'all'
  element?: Element
  cooldownMs?: number
  // If provided, runtime will dispatch to modular powers/effect on use registry instead of builtin switch
  effectRef?: string
  powerRef?: string
  params?: Record<string, number | string | boolean>
  runes?: RuneConfig[]
}

export type MonsterSkill = {
  id: string
  params?: Record<string, number | string | boolean>
}

export type AIBrain = {
  id: string
  behavior: MonsterBehavior
  params?: Record<string, number | string | boolean>
}

export type MonsterConfig = {
  id: string
  name: string
  behavior: MonsterBehavior
  brainId?: string
  tint?: number
  speed: number
  hp: number
  range?: number
  fireCooldownMs?: number
  projectileSpeed?: number
  bodyRadius?: number
  scale?: number
  skills?: MonsterSkill[]
  chaseMode?: 'always' | 'onSight'
  sightRange?: number
  dropPoolId?: string
  // Optional brain parameters and gameplay modifiers
  params?: Record<string, number | string | boolean>
  tier?: 'normal' | 'champion' | 'rare' | 'unique'
  affixes?: string[]
}

export type ItemType = 'weapon' | 'armor' | 'potion' | 'trinket'
export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary'

export type ItemConfig = {
  id: string
  name: string
  type: ItemType
  rarity: ItemRarity
  icon?: string
  lore?: string
  subtype?: string
  stackable?: boolean
  maxStack?: number
  value?: number
  params?: Record<string, number | string | boolean>
}

export type ItemInstance = {
  id: string // instance id
  itemId: string
  qty?: number
  // Optional per-instance rolls/metadata
  affixes?: ItemAffixRoll[]
  setId?: string
}

// Item affixes (data-driven)
export type AffixCategory = 'primary' | 'secondary' | 'legendary' | 'set'

export type AffixConfig = {
  id: string
  category: AffixCategory
  label: string
  // If this modifies a stat or item param directly
  statKey?: string // e.g., 'strength', 'hp', 'damage', 'healthOnKill', 'attackSpeedMult', etc.
  valueType?: 'flat' | 'percent'
  min?: number
  max?: number
  // Constraints
  allowedTypes?: ItemType[] // e.g., ['weapon']
  allowedSubtypes?: string[] // e.g., ['mainHand', 'chest']
  weight?: number // selection weight for RNG
  // Legendary proc/power support
  powerRef?: string
  procChance?: number // 0..1
  powerParams?: Record<string, number | string | boolean>
}

export type ItemAffixRoll = {
  affixId: string
  value?: number
}

// Item sets (data-driven)
export type SetBonus = {
  count: number
  stats?: Record<string, number>
  powerRef?: string
  powerParams?: Record<string, number | string | boolean>
}

export type ItemSetConfig = {
  id: string
  name: string
  itemIds: string[]
  bonuses: SetBonus[]
}

export type HotbarConfig = {
  potionRefId?: string
  // primary/secondary are independent of the 1-4 action slots
  primaryRefId?: string
  primaryRuneRefId?: string
  secondaryRefId?: string
  secondaryRuneRefId?: string
  skillRefIds: (string | undefined)[] // action slots 1-4
  runeRefIds?: (string | undefined)[] // runes for action slots 1-4
}

export type EquipmentConfig = {
  // legacy
  weaponId?: string
  armorId?: string
  // detailed slots
  mainHandId?: string
  mainHandAffixes?: ItemAffixRoll[]
  offHandId?: string
  offHandAffixes?: ItemAffixRoll[]
  helmId?: string
  helmAffixes?: ItemAffixRoll[]
  chestId?: string
  chestAffixes?: ItemAffixRoll[]
  pantsId?: string
  pantsAffixes?: ItemAffixRoll[]
  bootsId?: string
  bootsAffixes?: ItemAffixRoll[]
  glovesId?: string
  glovesAffixes?: ItemAffixRoll[]
  beltId?: string
  beltAffixes?: ItemAffixRoll[]
  amuletId?: string
  amuletAffixes?: ItemAffixRoll[]
  shouldersId?: string
  shouldersAffixes?: ItemAffixRoll[]
}

// Passive skills (always-on or timed) – data-driven with modular code hooks
export type PassiveConfig = {
  id: string
  name: string
  description?: string
  icon?: string
  classRestriction?: CharacterClass | 'all'
  // Optional category or tags in future
  effectRef?: string
  powerRef?: string
  params?: Record<string, number | string | boolean>
}
