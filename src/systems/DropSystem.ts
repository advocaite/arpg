import { listItems } from '@/systems/ItemDB'
import type { ItemConfig, ItemRarity } from '@/types'

type RarityWeights = Record<ItemRarity, number>

const BASE_WEIGHTS: RarityWeights = {
  common: 0.8,
  rare: 0.15,
  epic: 0.045,
  legendary: 0.005,
}

function applyMagicFind(weights: RarityWeights, mfPct: number): RarityWeights {
  const w = { ...weights }
  const f = Math.max(0, Math.min(0.7, mfPct * 0.5))
  const take = w.common * f
  w.common -= take
  w.rare += take * 0.6
  w.epic += take * 0.3
  w.legendary += take * 0.1
  return w
}

function rollRarity(weights: RarityWeights): ItemRarity {
  const entries: Array<[ItemRarity, number]> = Object.entries(weights) as any
  const total = entries.reduce((s, [, v]) => s + v, 0)
  let r = Math.random() * total
  for (const [k, v] of entries) {
    r -= v
    if (r <= 0) return k
  }
  return 'common'
}

export function rollItemDropId(mfPct: number = 0): string | null {
  const weights = applyMagicFind(BASE_WEIGHTS, mfPct)
  const rarity = rollRarity(weights)
  const pool = listItems().filter((i: ItemConfig) => (i.type === 'weapon' || i.type === 'armor') && i.rarity === rarity)
  if (!pool.length) return null
  const pick = pool[Math.floor(Math.random() * pool.length)]
  return pick.id
}

// Unified helper that powers can call on kill to spawn drops via scene
export function playerKillDrop(scene: any, x: number, y: number, baseItemChance: number = 0.1): void {
  try {
    const mfTotal = Math.max(0, Number(scene?.character?.derived?.magicFindPct ?? 0)) + Math.max(0, Number(scene?.magicFindBonusPct ?? 0))
    const itemChance = baseItemChance * (1 + mfTotal)
    if (typeof scene.spawnDropsAt === 'function') {
      scene.spawnDropsAt(x, y, { coins: (scene.Phaser?.Math?.Between?.(1, 5) ?? 3), hearts: Math.random() < 0.15 ? 1 : 0, itemChance })
      return
    }
    // Fallback: simple coin/heart drops without inventory integration
    if (Math.random() < 0.6) {
      const coins = Math.floor(1 + Math.random() * 4)
      for (let i = 0; i < coins; i++) {
        const p = scene.physics.add.sprite(x + (Math.random() * 16 - 8), y + (Math.random() * 16 - 8), 'coin')
        p.setData('drop', { type: 'coin', amount: 1 })
        scene.pickups.add(p)
      }
    }
    if (Math.random() < 0.2) {
      const p = scene.physics.add.sprite(x, y, 'heart')
      p.setData('drop', { type: 'heart', heal: 10 })
      scene.pickups.add(p)
    }
    if (Math.random() < itemChance) {
      const baseId = rollItemDropId(mfTotal)
      if (baseId) {
        const p = scene.physics.add.sprite(x, y, 'icon_armor')
        p.setData('drop', { type: 'item', itemId: baseId })
        scene.pickups.add(p)
      }
    }
  } catch {}
}


