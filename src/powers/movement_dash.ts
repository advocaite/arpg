import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'

export const meta = { ref: 'movement.dash' }

export default function movementDash(ctx: PowerContext, args: PowerInvokeArgs): void {
  const distance = Number(args.params['distance'] ?? 120)
  const duration = Number(args.params['duration'] ?? 160)
  const ox = ctx.caster.x, oy = ctx.caster.y
  let nx = 1, ny = 0
  if (ctx.target) { const dx = ctx.target.x - ox, dy = ctx.target.y - oy; const d = Math.hypot(dx, dy) || 1; nx = dx / d; ny = dy / d }
  const vx = (nx * distance) / (duration / 1000)
  const vy = (ny * distance) / (duration / 1000)
  if (ctx.caster?.active && ctx.caster.body) ctx.caster.setVelocity(vx, vy)
  ctx.scene.time.delayedCall(duration, () => {
    if (ctx.caster && (ctx.caster as any).active && (ctx.caster as any).body) ctx.caster.setVelocity(0, 0)
  })
}


