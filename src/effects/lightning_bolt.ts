import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.lightningBolt' }

export default function lightningBolt(ctx: EffectContext, params?: Record<string, number | string | boolean>): void {
  const x1 = Number(params?.['x1'] ?? ctx.caster.x)
  const y1 = Number(params?.['y1'] ?? ctx.caster.y)
  const x2 = Number(params?.['x2'] ?? ctx.caster.x)
  const y2 = Number(params?.['y2'] ?? ctx.caster.y)
  const color = 0x66ccff
  const thickness = 2
  const segs = 6
  const jitter = 6

  const g = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
  g.lineStyle(thickness, color, 0.9)
  g.beginPath()
  g.moveTo(x1, y1)
  for (let i = 1; i < segs; i++) {
    const t = i / segs
    const mx = x1 + (x2 - x1) * t
    const my = y1 + (y2 - y1) * t
    const jx = (Math.random() * 2 - 1) * jitter
    const jy = (Math.random() * 2 - 1) * jitter
    g.lineTo(mx + jx, my + jy)
  }
  g.lineTo(x2, y2)
  g.strokePath()
  ctx.scene.time.delayedCall(80, () => g.destroy())
}


