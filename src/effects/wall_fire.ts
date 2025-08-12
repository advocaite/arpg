import Phaser from 'phaser'
import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.wall.fire' }

export default function wallFire(ctx: EffectContext, params?: Record<string, any>): { update: (length: number) => void; destroy: () => void } {
  const originX = Number(params?.originX ?? ctx.caster.x)
  const originY = Number(params?.originY ?? ctx.caster.y)
  const dirX = Number(params?.dirX ?? 1)
  const dirY = Number(params?.dirY ?? 0)
  const width = Number(params?.width ?? 36)
  const color = Number(params?.color ?? 0xff7733)

  const perpX = -dirY
  const perpY = dirX
  const halfW = width / 2
  const spacing = 28
  const flames: any[] = []
  const smokes: any[] = []
  const glows: any[] = []

  const ensureCount = (needed: number) => {
    while (flames.length < needed) {
      const man = ctx.scene.add.particles(0, 0, 'particle', {
        lifespan: { min: 500, max: 900 },
        speed: { min: 60, max: 120 },
        gravityY: 0,
        quantity: 2,
        frequency: 60,
        scale: { start: 1.6, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: color,
        blendMode: Phaser.BlendModes.ADD
      }) as any
      try { if ((ctx.scene.lights as any)?.active) (man as any).setPipeline?.('Light2D') } catch {}
      flames.push(man)
    }
    while (smokes.length < needed) {
      const man = ctx.scene.add.particles(0, 0, 'particle', {
        lifespan: { min: 900, max: 1600 },
        speed: { min: 20, max: 60 },
        gravityY: 0,
        quantity: 1,
        frequency: 120,
        scale: { start: 0.9, end: 2.2 },
        alpha: { start: 0.25, end: 0 },
        tint: 0x666666,
        blendMode: Phaser.BlendModes.NORMAL
      }) as any
      try { if ((ctx.scene.lights as any)?.active) (man as any).setPipeline?.('Light2D') } catch {}
      smokes.push(man)
    }
    while (glows.length < needed) {
      const glow = ctx.scene.add.particles(0, 0, 'particle', {
        lifespan: { min: 300, max: 600 },
        speed: { min: 0, max: 20 },
        gravityY: 0,
        quantity: 1,
        frequency: 100,
        scale: { start: 2.2, end: 0 },
        alpha: { start: 0.35, end: 0 },
        tint: color,
        blendMode: Phaser.BlendModes.ADD
      }) as any
      try { if ((ctx.scene.lights as any)?.active) (glow as any).setPipeline?.('Light2D') } catch {}
      glows.push(glow)
    }
  }

  const update = (length: number) => {
    const needed = Math.max(1, Math.floor(length / spacing))
    ensureCount(needed)
    for (let i = 0; i < flames.length; i++) {
      const on = i < needed
      const f = flames[i]
      const s = smokes[i]
      const g = glows[i]
      if (!on) {
        try { (f.emitters?.first as any).on = false; (s.emitters?.first as any).on = false; (g.emitters?.first as any).on = false } catch {}
        continue
      }
      const t = (i + 0.5) / needed
      const along = length * t
      const off = (Math.random() * 2 - 1) * (halfW - 4)
      const px = originX + dirX * along + perpX * off
      const py = originY + dirY * along + perpY * off
      f.setPosition(px, py)
      s.setPosition(px, py)
      g.setPosition(px, py)
      const degNormal = Phaser.Math.RadToDeg(Math.atan2(-perpY, -perpX))
      try { (f.emitters?.first as any).on = true; (f.emitters?.first as any).setAngle?.(degNormal - 18, degNormal + 18) } catch {}
      try { (s.emitters?.first as any).on = true; (s.emitters?.first as any).setAngle?.(degNormal - 12, degNormal + 12) } catch {}
      try { (g.emitters?.first as any).on = true } catch {}
    }
  }

  const destroy = () => { try { flames.forEach(f => f.destroy()); smokes.forEach(s => s.destroy()); glows.forEach(x => x.destroy()) } catch {} }

  return { update, destroy }
}


