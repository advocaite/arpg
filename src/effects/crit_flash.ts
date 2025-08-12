import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.critFlash' }

export default function critFlash(ctx: EffectContext, params?: Record<string, number | string | boolean>): void {
  const target: any = (params?.['target'] as any) || ctx.caster
  const durationMs = Number(params?.['durationMs'] ?? 100)
  try { (ctx.scene.cameras?.main as any)?.flash?.(durationMs, 255, 255, 255, false) } catch {}
  try { ctx.scene.tweens.add({ targets: target, alpha: 0.6, duration: durationMs / 2, yoyo: true, ease: 'Sine.easeOut' }) } catch {}
}



