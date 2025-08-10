import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.ringPulse' }

export default function ringPulse(ctx: EffectContext, params?: Record<string, number | string | boolean>): void {
  const x = ctx.caster.x, y = ctx.caster.y
  const radius = Number(params?.['radius'] ?? 80)
  const color = Number(params?.['color'] ?? 0x66ccff)
  const g = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
  g.lineStyle(2, color, 0.9)
  g.strokeCircle(x, y, radius)
  ctx.scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() })
}


