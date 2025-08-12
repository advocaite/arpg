import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.cameraShake' }

export default function cameraShake(ctx: EffectContext, params?: Record<string, number | string | boolean>): void {
  const anyScene: any = ctx.scene as any
  if (anyScene && anyScene.__fxSettings && anyScene.__fxSettings.allowShake === false) return
  const intensity = Number(params?.['intensity'] ?? 0.006)
  const durationMs = Number(params?.['durationMs'] ?? 80)
  try { (ctx.scene.cameras?.main as any)?.shake?.(durationMs, intensity) } catch {}
}


