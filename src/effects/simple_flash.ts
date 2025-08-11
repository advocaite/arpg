import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.flash' }

export default function simpleFlash(ctx: EffectContext, params?: Record<string, number | string | boolean>): void {
  const color = Number(params?.['tint'] ?? 0xffff66)
  const dur = Number(params?.['durationMs'] ?? 120)
  const target: any = (params?.['target'] as any) || ctx.caster
  const originalTint = target?.tintTopLeft
  try { target?.setTint?.(color) } catch {}
  ctx.scene.time.delayedCall(dur, () => { try { target?.setTint?.(originalTint || 0xffffff) } catch {} })
}


