import Phaser from 'phaser'

export type EffectContext = {
  scene: Phaser.Scene
  caster: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
}

type EffectHandler = (ctx: EffectContext, params?: Record<string, any>) => void

const registry: Record<string, EffectHandler> = {}

export function registerEffect(ref: string, handler: EffectHandler): void {
  registry[ref] = handler
}

export function executeEffectByRef(ref: string, ctx: EffectContext, params?: Record<string, any>): void {
  const fn = registry[ref]
  if (fn) { fn(ctx, params); return }
  // default no-op if missing
}

// Auto-register effects from src/effects (files export default function(ctx,params))
try {
  const modules: Record<string, any> = import.meta.glob('../effects/**/*.ts', { eager: true })
  Object.values(modules).forEach((m: any) => {
    const meta: { ref?: string } | undefined = m.meta || m.effectMeta
    const fn: EffectHandler | undefined = m.default
    if (meta?.ref && typeof fn === 'function') registerEffect(meta.ref, fn)
  })
} catch {}


