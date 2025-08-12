import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.additiveTrail' }

export default function additiveTrail(ctx: EffectContext, params?: Record<string, any>): void {
  const target: any = params?.['target'] || ctx.caster
  const color = Number(params?.['color'] ?? 0xffffff)
  const lifeMs = Number(params?.['lifeMs'] ?? 320)
  const intervalMs = Number(params?.['intervalMs'] ?? 24)
  const scale = Number(params?.['scale'] ?? 1)
  const alpha = Number(params?.['alpha'] ?? 0.7)
  const maxGhosts = Number(params?.['maxGhosts'] ?? 18)
  const scene = ctx.scene
  if (!target || !scene || !(scene.add as any)?.sprite) return

  const ghosts: Phaser.GameObjects.Sprite[] = []

  const timer = scene.time.addEvent({ loop: true, delay: intervalMs, callback: () => {
    try {
      if (!(target as any).active || !(target as any).scene) return
      const ghost = (scene.add as any).sprite(target.x, target.y, target.texture?.key || 'projectile')
      if (!ghost) return
      ghost.setDepth((target.depth || 1) - 1)
      ghost.setTint(color)
      ghost.setAlpha(alpha)
      ghost.setScale((target.scaleX || scale) * scale, (target.scaleY || scale) * scale)
      ghost.setBlendMode(Phaser.BlendModes.ADD)
      try { if ((scene.lights as any)?.active) (ghost as any).setPipeline?.('Light2D') } catch {}
      scene.tweens.add({ targets: ghost, alpha: 0, duration: lifeMs, onComplete: () => ghost.destroy() })
      ghosts.push(ghost)
      if (ghosts.length > maxGhosts) { const g = ghosts.shift(); try { g?.destroy() } catch {} }
    } catch {}
  } })

  // Store a handle to stop later if needed
  try {
    (target as any).__trailTimer?.remove?.()
    ;(target as any).__trailTimer = timer
    if (typeof (target as any).once === 'function') {
      (target as any).once('destroy', () => { try { timer.remove(false) } catch {} })
    }
  } catch {}
}


