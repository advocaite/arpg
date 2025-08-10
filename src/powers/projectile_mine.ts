import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'

export const meta = { ref: 'projectile.mine' }

export default function projectileMine(ctx: PowerContext, args: PowerInvokeArgs): void {
  const fuseMs = Number(args.params['fuseMs'] ?? 1200)
  const radius = Number(args.params['radius'] ?? 80)
  const damage = Number(args.params['damage'] ?? 10)
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
    ctx.onAoeDamage?.(p.x, p.y, radius, damage, { element: 'arcane', source: 'spell' })
    p.destroy()
  })
}


