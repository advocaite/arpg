import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.squashImpact' }

export default function squashImpact(ctx: EffectContext, params?: Record<string, number | string | boolean>): void {
  const target: any = (params?.['target'] as any) || ctx.caster
  const scaleX = Number(params?.['scaleX'] ?? 1.15)
  const scaleY = Number(params?.['scaleY'] ?? 0.85)
  const durationMs = Number(params?.['durationMs'] ?? 110)
  if (!target || !target.setScale) return
  const ox = target.scaleX ?? 1
  const oy = target.scaleY ?? 1
  try {
    ctx.scene.tweens.add({ targets: target, scaleX: ox * scaleX, scaleY: oy * scaleY, duration: durationMs / 2, yoyo: true, ease: 'Quad.easeOut' })
  } catch {}
}



