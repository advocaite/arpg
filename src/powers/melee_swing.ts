import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'
import { executeEffectByRef } from '@/systems/Effects'

export const meta = { ref: 'melee.swing' }

export default function meleeSwing(ctx: PowerContext, args: PowerInvokeArgs): void {
  const offset = Number(args.params['offset'] ?? 24)
  const damage = Math.max(1, Number(args.params['damage'] ?? 8))
  const dirAng = Number(args.params['angle'] ?? 0)
  const durationMs = Number(args.params['durationMs'] ?? 100)
  const radius = Number(args.params['radius'] ?? 10)
  const crit = Boolean(args.params['isCrit'])
  const color = crit ? '#ff66ff' : '#ffd166'

  const nx = Math.cos(dirAng), ny = Math.sin(dirAng)
  const hbX = ctx.caster.x + nx * offset
  const hbY = ctx.caster.y + ny * offset
  const hitbox = (ctx.scene.physics as any).add.sprite(hbX, hbY, 'hitbox')
  hitbox.setDepth(1)
  ;(ctx.scene.time as any).delayedCall(durationMs, () => hitbox.destroy())

  if (!ctx.enemies) return
  const onHit = (_o1: any, o2: any) => {
    const target = o2 as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
    if ((target as any).isInvulnerable) return
    const hp = Number(target.getData('hp') || 1)
    const newHp = Math.max(0, hp - damage)
    target.setData('hp', newHp)
    try { executeEffectByRef('fx.damageNumber', { scene: ctx.scene, caster: ctx.caster }, { x: target.x, y: target.y - 10, value: `${damage}`, color, durationMs: 450, element: String((args.skill as any)?.element || 'physical'), crit }) } catch {}
    // Item procs on hit
    try {
      const sceneAny: any = ctx.scene
      if (Array.isArray(sceneAny.itemProcs)) {
        // Lazy-load once and cache on scene
        let exec = (sceneAny.__execPower as any)
        if (typeof exec !== 'function') {
          import('@/systems/Powers').then((mod) => { sceneAny.__execPower = (mod as any).executePowerByRef })
        }
        exec = (sceneAny.__execPower as any)
        for (const p of sceneAny.itemProcs) {
          if (Math.random() < (p.procChance || 0)) {
            if (typeof exec === 'function') {
              exec(p.powerRef, { scene: ctx.scene, caster: ctx.caster, enemies: ctx.enemies }, { skill: { id: p.powerRef, name: 'Proc', type: 'aoe' } as any, params: p.powerParams || {} })
            }
          }
        }
      }
    } catch {}
    if (newHp <= 0) {
      try {
        const anyScene: any = ctx.scene
        const healKill = Math.max(0, Number(anyScene.healthOnKill || 0))
        if (healKill > 0) {
          anyScene.playerHp = Math.min(anyScene.maxHp, anyScene.playerHp + healKill)
          anyScene.hpText?.setText(`HP: ${anyScene.playerHp}`)
          anyScene.orbs?.update(anyScene.playerHp, anyScene.maxHp, anyScene.mana, anyScene.maxMana || 100)
        }
        const award = Math.max(1, Math.floor(((target.getData('level') as number) || 1) * 5))
        anyScene.gainExperience?.(award)
        // Drop chance hook for any player-caused kill (lazy-load once)
        try {
          if (!(anyScene.__dropUtil)) {
            import('@/systems/DropSystem').then(mod => { anyScene.__dropUtil = mod })
          }
          const util = anyScene.__dropUtil
          if (util?.playerKillDrop) util.playerKillDrop(anyScene, target.x, target.y, 0.1)
        } catch {}
      } catch {}
      target.destroy()
    }
  }
  ;(ctx.scene.physics as any).add.overlap(hitbox, ctx.enemies, onHit)
}


