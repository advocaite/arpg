import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.emissiveGlow' }

export default function emissiveGlow(ctx: EffectContext, params?: Record<string, any>): void {
  const target: any = params?.['target'] || ctx.caster
  const color = Number(params?.['color'] ?? 0xffcc66)
  const scale = Number(params?.['scale'] ?? 1.4)
  const alpha = Number(params?.['alpha'] ?? 0.5)
  const durationMs = Number(params?.['durationMs'] ?? 350)
  const scene = ctx.scene
  if (!target || !scene) return

  try {
    const glow = scene.add.sprite(target.x, target.y, target.texture?.key || 'player')
    glow.setTint(color)
    glow.setBlendMode(Phaser.BlendModes.ADD)
    glow.setDepth((target.depth || 1) - 1)
    glow.setAlpha(alpha)
    glow.setScale((target.scaleX || 1) * scale, (target.scaleY || 1) * scale)
    try { if ((scene.lights as any)?.active) (glow as any).setPipeline?.('Light2D') } catch {}
    scene.tweens.add({ targets: glow, alpha: 0, duration: durationMs, onComplete: () => glow.destroy() })
  } catch {}
}


