import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'
import { executeEffectByRef } from '@/systems/Effects'

export const meta = { ref: 'projectile.mine' }

export default function projectileMine(ctx: PowerContext, args: PowerInvokeArgs): void {
  const fuseMs = Number(args.params['fuseMs'] ?? 1200)
  const radius = Number(args.params['radius'] ?? 80)
  const sceneAny: any = ctx.scene
  const base = 8 + Math.max(0, Number(sceneAny?.weaponFlatDamage || 0))
  const scaled = Math.max(1, Math.round(base * Math.max(0.1, Number(sceneAny?.damageMultiplier || 1))))
  const isCrit = Math.random() < Math.max(0, Number(sceneAny?.critChance || 0))
  const damage = isCrit ? Math.round(scaled * Math.max(1, Number(sceneAny?.critDamageMult || 1.5))) : scaled
  const ox = ctx.caster.x, oy = ctx.caster.y
  const p = (ctx.scene.physics as any).add.sprite(ox, oy, 'projectile')
  p.setDepth(1)
  p.setVelocity(0, 0)
  ctx.projectiles?.add(p)
  ctx.scene.time.delayedCall(fuseMs, () => {
    if (!(p as any).active) return
    const g = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
    g.fillStyle(0xff8844, 0.5); g.fillCircle(p.x, p.y, radius)
    ctx.scene.time.delayedCall(150, () => g.destroy())
    if (ctx.onAoeDamage) {
      ctx.onAoeDamage(p.x, p.y, radius, damage, { element: 'arcane', source: 'spell' })
    } else {
      // Fallback: manual damage and XP/drop handling
      try {
        const enemies = (ctx.enemies?.children as any)?.entries || []
        for (const obj of enemies) {
          const e = obj as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
          if (!e || !(e as any).active) continue
          const dx = e.x - p.x, dy = e.y - p.y
          if (Math.hypot(dx, dy) <= radius) {
            const hp = Number(e.getData('hp') || 1)
            const newHp = Math.max(0, hp - damage)
            e.setData('hp', newHp)
            try { executeEffectByRef('fx.damageNumber', { scene: ctx.scene, caster: ctx.caster }, { x: e.x, y: e.y - 10, value: `${damage}`, element: 'arcane', crit: isCrit }) } catch {}
            // Item procs on hit
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
            if (newHp <= 0) {
              const anyScene: any = ctx.scene
              const award = Math.max(1, Math.floor(((e.getData('level') as number) || 1) * 5))
              anyScene.gainExperience?.(award)
              try { import('@/systems/Quests').then(qm => { (qm as any).notifyMonsterKilled?.(String(e.getData('configId') || '')); (anyScene as any).refreshQuestUI?.() }) } catch {}
              if (!(anyScene.__dropUtil)) { import('@/systems/DropSystem').then(mod => { anyScene.__dropUtil = mod }) }
              const util = anyScene.__dropUtil
              if (util?.playerKillDrop) util.playerKillDrop(anyScene, e.x, e.y, 0.1)
              e.destroy()
            }
          }
        }
      } catch {}
    }
    p.destroy()
  })
}


