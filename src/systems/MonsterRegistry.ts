import type { MonsterConfig } from '@/types'
import { getMonster } from '@/systems/MonsterDB'
import { executeBrainTickByRef } from '@/systems/BrainRegistry'
import { getAffix } from '@/systems/MonsterAffixDB'
import { executePowerByRef } from '@/systems/Powers'

export function tickMonster(scene: Phaser.Scene, enemy: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody, args: { player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody; projectiles?: Phaser.Physics.Arcade.Group; enemies?: Phaser.Physics.Arcade.Group; now: number }): void {
  const id = (enemy.getData('configId') as string) || ''
  const cfg = id ? getMonster(id) : undefined
  const brainId = (enemy.getData('brainId') as string) || cfg?.brainId || ''
  if (!brainId) return
  const skills = cfg?.skills?.map(s => ({ id: s.id, params: s.params })) || []
  const params = { ...(cfg as MonsterConfig | undefined)?.['params'] } as Record<string, number | string | boolean> | undefined
  // Apply affix-driven powers probabilistically and with cooldowns
  const affixes: string[] = (enemy.getData('affixes') as string[]) || []
  for (const a of affixes) {
    const cfgA = getAffix(a)
    // Apply movement/cooldown modifiers
    if (cfgA?.modifiers?.speedMult && !enemy.getData('__speedApplied')) {
      const base = Number(enemy.getData('speed') || cfg?.speed || 100)
      enemy.setData('speed', base * cfgA.modifiers.speedMult)
    }
    if (cfgA?.powers && cfgA.powers.length) {
      for (const p of cfgA.powers) {
        const key = `affix_cd_${a}_${p.ref}`
        const cdUntil = Number(enemy.getData(key) || 0)
        if (args.now < cdUntil) continue
        const chance = Number(p.chance ?? 0.05)
        if (Math.random() < chance) {
          executePowerByRef(p.ref, { scene, caster: enemy as any, target: args.player as any, projectiles: args.projectiles, enemies: args.enemies }, { skill: { id: p.ref, name: p.ref, type: 'aoe' } as any, rune: undefined, params: p.params || {} })
          enemy.setData(key, args.now + Number(p.cooldownMs ?? 2500))
        }
      }
    }
  }
  executeBrainTickByRef(brainId, { scene, enemy, player: args.player, projectiles: args.projectiles, enemies: args.enemies, now: args.now }, { params, skills })
  // Death hook: if hp <= 0, trigger on-death effects (e.g., explosion)
  const hp = Number(enemy.getData('hp') || 0)
  if (hp <= 0) {
    const deathHandled = enemy.getData('deathHandled') as boolean
    if (!deathHandled) {
      enemy.setData('deathHandled', true)
      // Simple on-death AoE if affix shocking (example)
      if (affixes.includes('shocking')) {
        const x = enemy.x, y = enemy.y
        const g = (scene.add as any).graphics({ x: 0, y: 0 })
        g.fillStyle(0x66ccff, 0.3); g.fillCircle(x, y, 80)
        ;(scene.time as any).delayedCall(120, () => g.destroy())
        // Damage nearby player (placeholder)
        const dx = (args.player.x - x), dy = (args.player.y - y)
        if (Math.hypot(dx, dy) <= 80) {
          // could emit an event for centralized damage handling
        }
      }
      // Award XP to player via scene hook if provided
      try {
        const anyScene: any = scene
        const award = Math.max(1, Math.floor(((enemy.getData('level') as number) || 1) * 5))
        anyScene?.gainExperience?.(award)
      } catch {}
      enemy.destroy()
    }
  }
}


