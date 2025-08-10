export type CharacterClass = 'melee' | 'ranged' | 'magic'

export type Stats = {
  strength: number
  vitality: number
  intelligence: number
  dexterity: number
}

export type CharacterProfile = {
  id: number
  name: string
  class: CharacterClass
  level?: number
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
}

export type WorldConfig = {
  id: string
  name: string
  width: number
  height: number
  tilemapUrl?: string
  tilesetKey?: string
  portals: PortalConfig[]
  npcs: NpcConfig[]
  obstacles?: { x: number; y: number }[]
  spawners?: SpawnerConfig[]
  checkpoints?: CheckpointConfig[]
}

export type SpawnerConfig = {
  monsterId: string
  everyMs: number
  count: number
  limit?: number
  startDelayMs?: number
}

export type CheckpointConfig = {
  id?: string
  x: number
  y: number
  name?: string
}

export type MonsterBehavior = 'chaser' | 'shooter' | 'boss'

export type SkillConfig = {
  id: string
  name: string
  type: 'projectile' | 'dash' | 'aoe'
  cooldownMs?: number
  params?: Record<string, number | string | boolean>
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
  params?: Record<string, number | string | boolean>
}

export type ItemInstance = {
  id: string // instance id
  itemId: string
  qty?: number
}

export type HotbarConfig = {
  potionRefId?: string
  // primary/secondary are independent of the 1-4 action slots
  primaryRefId?: string
  secondaryRefId?: string
  skillRefIds: (string | undefined)[] // action slots 1-4
}

export type EquipmentConfig = {
  // legacy
  weaponId?: string
  armorId?: string
  // detailed slots
  mainHandId?: string
  offHandId?: string
  helmId?: string
  chestId?: string
  pantsId?: string
  bootsId?: string
  glovesId?: string
  beltId?: string
  amuletId?: string
  shouldersId?: string
}
