import Phaser from 'phaser'
import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.wall.arcane' }

export default function wallArcane(ctx: EffectContext, params?: Record<string, any>): { update: (length: number) => void; destroy: () => void } {
  const originX = Number(params?.originX ?? ctx.caster.x)
  const originY = Number(params?.originY ?? ctx.caster.y)
  const dirX = Number(params?.dirX ?? 1)
  const dirY = Number(params?.dirY ?? 0)
  const width = Number(params?.width ?? 36)

  const perpX = -dirY
  const perpY = dirX
  const halfW = width / 2
  const spacing = 28

  const mists: any[] = []
  const sparkles: any[] = []

  const ensure = (need: number) => {
    while (mists.length < need) {
      const p = ctx.scene.add.particles(0, 0, 'particle', {
        lifespan: { min: 800, max: 1600 },
        speed: { min: 10, max: 40 },
        gravityY: 0,
        quantity: 1,
        frequency: 90,
        scale: { start: 1.3, end: 2.4 },
        alpha: { start: 0.28, end: 0 },
        tint: 0xaa88ff,
        blendMode: Phaser.BlendModes.SCREEN
      }) as any
      try { if ((ctx.scene.lights as any)?.active) (p as any).setPipeline?.('Light2D') } catch {}
      mists.push(p)
    }
    while (sparkles.length < need) {
      const p = ctx.scene.add.particles(0, 0, 'particle', {
        lifespan: { min: 300, max: 700 },
        speed: { min: 0, max: 30 },
        gravityY: 0,
        quantity: 1,
        frequency: 70,
        scale: { start: 1.2, end: 0 },
        alpha: { start: 0.95, end: 0 },
        tint: 0xffffff,
        blendMode: Phaser.BlendModes.ADD
      }) as any
      try { if ((ctx.scene.lights as any)?.active) (p as any).setPipeline?.('Light2D') } catch {}
      sparkles.push(p)
    }
  }

  const update = (len: number) => {
    const need = Math.max(1, Math.floor(len / spacing))
    ensure(need)
    const degNormal = Phaser.Math.RadToDeg(Math.atan2(-perpY, -perpX))
    for (let i = 0; i < mists.length; i++) {
      const on = i < need
      const a = (i + 0.5) / need
      const along = len * a
      const off = (Math.random() * 2 - 1) * (halfW - 4)
      const px = originX + dirX * along + perpX * off
      const py = originY + dirY * along + perpY * off
      const m = mists[i]
      const s = sparkles[i]
      if (!on) { try { (m.emitters?.first as any).on = false; (s.emitters?.first as any).on = false } catch {}; continue }
      m.setPosition(px, py)
      s.setPosition(px, py)
      try { (m.emitters?.first as any).on = true; (m.emitters?.first as any).setAngle?.(degNormal - 14, degNormal + 14) } catch {}
      try { (s.emitters?.first as any).on = true } catch {}
    }
  }

  const destroy = () => { try { mists.forEach(m => m.destroy()); sparkles.forEach(s => s.destroy()) } catch {} }
  return { update, destroy }
}


