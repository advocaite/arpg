import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'

export const meta = { ref: 'projectile.cone' }

export default function projectileCone(ctx: PowerContext, args: PowerInvokeArgs): void {
  const count = Math.max(1, Number(args.params['count'] ?? 3))
  const spreadDeg = Number(args.params['spreadDeg'] ?? 40)
  const speed = Number(args.params['speed'] ?? 300)
  const decayMs = Number(args.params['decayMs'] ?? 1800)
  const ox = ctx.caster.x, oy = ctx.caster.y
  if (!ctx.projectiles) return

  // Aim direction: towards target if any, else to the right
  let aimX = 1, aimY = 0
  if (ctx.target) { const dx = ctx.target.x - ox, dy = ctx.target.y - oy; const d = Math.hypot(dx, dy) || 1; aimX = dx / d; aimY = dy / d }
  const aimAng = Math.atan2(aimY, aimX)
  const spreadRad = (spreadDeg * Math.PI) / 180
  const start = aimAng - spreadRad / 2
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    const ang = start + t * spreadRad
    const nx = Math.cos(ang), ny = Math.sin(ang)
    const p = (ctx.scene.physics as any).add.sprite(ox, oy, 'projectile')
    p.setDepth(1)
    try { p.setDataEnabled(); p.setData('faction', 'player'); p.setData('element', String(args.skill.element || 'physical')); p.setData('source', 'ranged') } catch {}
    ctx.projectiles.add(p)
    p.setVelocity(nx * speed, ny * speed)
    ctx.scene.time.delayedCall(decayMs, () => p.destroy())
  }
}


