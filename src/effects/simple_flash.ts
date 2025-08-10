import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.flash' }

export default function simpleFlash(ctx: EffectContext, params?: Record<string, number | string | boolean>): void {
  const color = Number(params?.['tint'] ?? 0xffff66)
  const dur = Number(params?.['durationMs'] ?? 120)
  const originalTint = (ctx.caster as any).tintTopLeft
  ctx.caster.setTint(color)
  ctx.scene.time.delayedCall(dur, () => ctx.caster.setTint(originalTint || 0xffffff))
}


