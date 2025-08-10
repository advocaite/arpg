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
      } catch {}
      target.destroy()
    }
  }
  ;(ctx.scene.physics as any).add.overlap(hitbox, ctx.enemies, onHit)
}


