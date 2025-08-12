import Phaser from 'phaser'
import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.portalParticles' }

export default function portalParticles(ctx: EffectContext, params?: Record<string, any>): void {
  const x = Number(params?.['x'] ?? ctx.caster.x)
  const y = Number(params?.['y'] ?? ctx.caster.y)
  const colorOuter = Number(params?.['colorOuter'] ?? 0x66e3ff)
  const colorInner = Number(params?.['colorInner'] ?? 0x2a86ff)
  const life = Number(params?.['lifeMs'] ?? 900)
  const rate = Number(params?.['rate'] ?? 40)

  const scene = ctx.scene
  const emit = (tint: number, radius: number, speed: number, alpha: number) => {
    const p = scene.add.particles(0, 0, 'particle', {
      x, y,
      lifespan: { min: life * 0.6, max: life * 1.2 },
      speed: { min: speed * 0.6, max: speed * 1.4 },
      radial: true,
      gravityY: 0,
      scale: { start: 1.2, end: 0 },
      quantity: 1,
      frequency: Math.max(10, Math.floor(1000 / rate)),
      tint,
      alpha: { start: alpha, end: 0 },
      angle: { min: 0, max: 360 },
      emitZone: ({ type: 'edge', source: new Phaser.Geom.Circle(0, 0, radius) } as any)
    })
    p.setDepth(7)
    try { if ((scene.lights as any)?.active) (p as any).setPipeline?.('Light2D') } catch {}
    return p
  }

  const outer = emit(colorOuter, 30, 40, 0.8)
  const inner = emit(colorInner, 12, 20, 0.9)
  try { (ctx.caster as any).once?.('destroy', () => { try { outer.destroy() } catch {}; try { inner.destroy() } catch {} }) } catch {}
}


