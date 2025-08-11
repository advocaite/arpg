import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'
import { executeEffectByRef } from '@/systems/Effects'
import { notifyMonsterKilled } from '@/systems/Quests'

export const meta = { ref: 'lightning.chain' }

export default function lightningChain(ctx: PowerContext, args: PowerInvokeArgs): void {
  const maxBounces = Number(args.params['bounces'] ?? 4)
  const range = Number(args.params['range'] ?? 260)
  const sceneAny: any = ctx.scene
  const base = 6 + Math.max(0, Number(sceneAny?.weaponFlatDamage || 0))
  const scaled = Math.max(1, Math.round(base * Math.max(0.1, Number(sceneAny?.damageMultiplier || 1))))
  const isCrit = Math.random() < Math.max(0, Number(sceneAny?.critChance || 0))
  const damage = isCrit ? Math.round(scaled * Math.max(1, Number(sceneAny?.critDamageMult || 1.5))) : scaled
  const elementVal = 'lightning'
  const effectRef = String(args.params['effectRef'] ?? 'fx.lightningBolt')

  const enemies = ctx.scene.physics.add.group()
  // Prefer provided group if available
  const pool = (ctx as any).enemies || enemies

  const visited = new Set<Phaser.GameObjects.GameObject>()
  let fromX = ctx.caster.x
  let fromY = ctx.caster.y
  let current: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined = ctx.target

  for (let hop = 0; hop < maxBounces; hop++) {
    // Find nearest target within range
    let candidate: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined
    let bestDist = Number.POSITIVE_INFINITY
    const children = (pool.children as any).entries || []
    for (const obj of children) {
      const t = obj as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
      if (!t || !(t as any).active) continue
      if (visited.has(t)) continue
      const dx = t.x - fromX, dy = t.y - fromY
      const d = Math.hypot(dx, dy)
      if (d <= range && d < bestDist) { bestDist = d; candidate = t }
    }
      if (!candidate) break
    // Render effect from (fromX, fromY) to candidate
    executeEffectByRef(effectRef, { scene: ctx.scene, caster: ctx.caster }, { x1: fromX, y1: fromY, x2: candidate.x, y2: candidate.y })
    // Apply damage through AoE callback if provided
    if (ctx.onAoeDamage) {
      ctx.onAoeDamage(candidate.x, candidate.y, 0, damage)
    } else {
      // Fallback: directly modify HP and award XP/drops on kill
      try {
        const hp = Number(candidate.getData('hp') || 1)
        const newHp = Math.max(0, hp - damage)
        candidate.setData('hp', newHp)
        // Item procs on hit (single target)
        try {
          const sceneAny: any = ctx.scene
          if (Array.isArray(sceneAny.itemProcs) && sceneAny.itemProcs.length) {
            let exec = (sceneAny.__execPower as any)
            if (typeof exec !== 'function') { import('@/systems/Powers').then((mod) => { sceneAny.__execPower = (mod as any).executePowerByRef }) }
            exec = (sceneAny.__execPower as any)
            for (const pr of sceneAny.itemProcs) {
              if (Math.random() < (pr.procChance || 0)) {
                if (typeof exec === 'function') {
                  exec(pr.powerRef, { scene: ctx.scene, caster: ctx.caster, enemies: ctx.enemies }, { skill: { id: pr.powerRef, name: 'Proc', type: 'aoe' } as any, params: pr.powerParams || {} })
                }
              }
            }
          }
        } catch {}
        try { executeEffectByRef('fx.damageNumber', { scene: ctx.scene, caster: ctx.caster }, { x: candidate.x, y: candidate.y - 10, value: `${damage}`, element: elementVal, crit: isCrit }) } catch {}
        if (newHp <= 0) {
          const anyScene: any = ctx.scene
          try { console.log('[Kill] lightning_chain death', { monsterId: String(candidate.getData('configId')||''), level: candidate.getData('level'), damage }) } catch {}
          const healKill = Math.max(0, Number(anyScene.healthOnKill || 0))
          if (healKill > 0) {
            anyScene.playerHp = Math.min(anyScene.maxHp, anyScene.playerHp + healKill)
            anyScene.hpText?.setText(`HP: ${anyScene.playerHp}`)
            anyScene.orbs?.update(anyScene.playerHp, anyScene.maxHp, anyScene.mana, anyScene.maxMana || 100)
          }
          const award = Math.max(1, Math.floor(((candidate.getData('level') as number) || 1) * 5))
          anyScene.gainExperience?.(award)
          if (!(anyScene.__dropUtil)) { import('@/systems/DropSystem').then(mod => { anyScene.__dropUtil = mod }) }
          const util = anyScene.__dropUtil
          if (util?.playerKillDrop) util.playerKillDrop(anyScene, candidate.x, candidate.y, 0.1)
          try { notifyMonsterKilled(String(candidate.getData('configId') || '')); (anyScene as any).refreshQuestUI?.() } catch {}
          candidate.destroy()
        }
      } catch {}
    }
    visited.add(candidate)
    fromX = candidate.x; fromY = candidate.y
    current = candidate
  }
}


