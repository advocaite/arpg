import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.sfx' }

// Params: key (audio key), volume (0..1), rate, detune, duck(bus, amount, durationMs)
export default function sfx(ctx: EffectContext, params?: Record<string, any>): void {
  const key = String(params?.key || '')
  if (!key) return
  const anyScene: any = ctx.scene as any
  try {
    if (!anyScene.__audio) return
    anyScene.__audio.playSfx(key, {
      volume: Number(params?.volume ?? 1),
      rate: Number(params?.rate ?? 1),
      detune: Number(params?.detune ?? 0),
      duck: params?.duck ? { bus: String(params.duck.bus || 'bgm') as any, amount: Number(params.duck.amount ?? 0.4), durationMs: Number(params.duck.durationMs ?? 200) } : undefined
    })
  } catch {}
}


