import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'

export const meta = { ref: 'projectile.zigzag' }

export default function projectileZigzag(ctx: PowerContext, args: PowerInvokeArgs): void {
  const speed = Number(args.params['speed'] ?? 280)
  const amplitude = Number(args.params['amplitude'] ?? 24)
  const wavelength = Number(args.params['wavelength'] ?? 120)
  const decayMs = Number(args.params['decayMs'] ?? 2000)
  const element = String((args.params['element'] ?? ((args.skill as any)?.element ?? 'physical')))

  const ox = ctx.caster.x, oy = ctx.caster.y
  let dirX = 1, dirY = 0
  const anyCtx: any = ctx as any
  const cursor = anyCtx.cursor as { x: number; y: number } | undefined
  if (cursor) { const dx = cursor.x - ox, dy = cursor.y - oy; const d = Math.hypot(dx, dy) || 1; dirX = dx / d; dirY = dy / d }
  else if (ctx.target) { const dx = ctx.target.x - ox, dy = ctx.target.y - oy; const d = Math.hypot(dx, dy) || 1; dirX = dx / d; dirY = dy / d }

  const perpX = -dirY
  const perpY = dirX

  const p = (ctx.scene.physics as any).add.sprite(ox, oy, 'projectile')
  p.setDepth(1)
  // Tag projectile faction based on caster (player vs enemy)
  try {
    p.setDataEnabled()
    const casterFaction = (ctx.caster as any)?.getData?.('faction') || 'player'
    p.setData('faction', casterFaction)
    p.setData('element', element)
    p.setData('source', 'ranged')
  } catch {}
  if (ctx.projectiles) ctx.projectiles.add(p)

  const startTs = ctx.scene.time.now
  const updater = () => {
    if (!(p as any).active || !(p as any).body) return
    const t = (ctx.scene.time.now - startTs) / 1000
    const forward = speed * t
    const sway = Math.sin((forward / Math.max(1, wavelength)) * Math.PI * 2) * amplitude
    const x = ox + dirX * forward + perpX * sway
    const y = oy + dirY * forward + perpY * sway
    p.setPosition(x, y)
  }
  const evt = ctx.scene.time.addEvent({ delay: 16, loop: true, callback: updater })
  ctx.scene.time.delayedCall(decayMs, () => { try { evt.remove(false) } catch {}; p.destroy() })
}


