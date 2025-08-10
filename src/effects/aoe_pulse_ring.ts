import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.aoePulse' }

export default function aoePulseRing(ctx: EffectContext, params?: Record<string, number | string | boolean>): void {
  const x = Number(params?.['x'] ?? ctx.caster.x)
  const y = Number(params?.['y'] ?? ctx.caster.y)
  const radius = Number(params?.['radius'] ?? 60)
  const color = Number(params?.['color'] ?? 0xffaa66)
  const duration = Number(params?.['durationMs'] ?? 120)
  const g = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
  g.fillStyle(color, 0.35); g.fillCircle(x, y, radius)
  ;(ctx.scene.time as any).delayedCall(duration, () => g.destroy())
}


