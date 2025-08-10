import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'

export const meta = { ref: 'projectile.ring' }

export default function projectileRing(ctx: PowerContext, args: PowerInvokeArgs): void {
  const count = Number(args.params['count'] ?? 12)
  const speed = Number(args.params['speed'] ?? 280)
  const decayMs = Number(args.params['decayMs'] ?? 3000)
  const ox = ctx.caster.x, oy = ctx.caster.y
  if (!ctx.projectiles) return
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count
    const nx = Math.cos(angle), ny = Math.sin(angle)
    const p = (ctx.scene.physics as any).add.sprite(ox, oy, 'projectile')
    p.setDepth(1)
    p.setVelocity(nx * speed, ny * speed)
    ctx.projectiles.add(p)
    ctx.scene.time.delayedCall(decayMs, () => p.destroy())
  }
}


