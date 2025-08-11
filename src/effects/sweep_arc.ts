import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.sweepArc' }

export default function sweepArc(ctx: EffectContext, params?: Record<string, number | string | boolean>): void {
  const x = ctx.caster.x
  const y = ctx.caster.y
  const radius = Number(params?.['radius'] ?? 36)
  const angle = Number(params?.['angle'] ?? 0) // radians
  const spreadDeg = Number(params?.['spreadDeg'] ?? 75)
  const color = Number(params?.['color'] ?? 0xffd166)

  const g = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
  g.fillStyle(color, 0.25)
  g.slice(x, y, radius, angle - Phaser.Math.DegToRad(spreadDeg / 2), angle + Phaser.Math.DegToRad(spreadDeg / 2))
  g.fillPath()
  g.lineStyle(2, color, 0.9)
  g.beginPath()
  g.arc(x, y, radius, angle - Phaser.Math.DegToRad(spreadDeg / 2), angle + Phaser.Math.DegToRad(spreadDeg / 2))
  g.strokePath()
  ctx.scene.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() })
}


