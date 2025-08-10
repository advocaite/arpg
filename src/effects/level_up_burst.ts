import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.levelUpBurst' }

export default function levelUpBurst(ctx: EffectContext): void {
  const x = ctx.caster.x, y = ctx.caster.y
  const g = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
  g.lineStyle(3, 0xffee88, 1)
  g.strokeCircle(x, y, 24)
  g.strokeCircle(x, y, 48)
  g.strokeCircle(x, y, 72)
  ctx.scene.tweens.add({ targets: g, alpha: 0, duration: 500, onComplete: () => g.destroy() })
}


