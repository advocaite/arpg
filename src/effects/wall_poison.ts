import Phaser from 'phaser'
import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.wall.poison' }

export default function wallPoison(ctx: EffectContext, params?: Record<string, any>): { update: (length: number) => void; destroy: () => void } {
  const originX = Number(params?.originX ?? ctx.caster.x)
  const originY = Number(params?.originY ?? ctx.caster.y)
  const dirX = Number(params?.dirX ?? 1)
  const dirY = Number(params?.dirY ?? 0)
  const width = Number(params?.width ?? 36)
  const tintMain = 0x66ff66
  const tintDark = 0x2d7f2d

  const perpX = -dirY
  const perpY = dirX
  const halfW = width / 2
  const spacing = 28
  const mists: any[] = []
  const droplets: any[] = []

  const ensure = (need: number) => {
    while (mists.length < need) {
      const p = ctx.scene.add.particles(0, 0, 'particle', {
        lifespan: { min: 900, max: 1800 },
        speed: { min: 10, max: 40 },
        gravityY: 0,
        quantity: 1,
        frequency: 90,
        scale: { start: 1.2, end: 2.4 },
        alpha: { start: 0.3, end: 0 },
        tint: tintMain,
        blendMode: Phaser.BlendModes.SCREEN
      }) as any
      try { if ((ctx.scene.lights as any)?.active) (p as any).setPipeline?.('Light2D') } catch {}
      mists.push(p)
    }
    while (droplets.length < need) {
      const p = ctx.scene.add.particles(0, 0, 'particle', {
        lifespan: { min: 400, max: 900 },
        speed: { min: 30, max: 60 },
        gravityY: 0,
        quantity: 1,
        frequency: 120,
        scale: { start: 1.1, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: tintDark,
        blendMode: Phaser.BlendModes.ADD
      }) as any
      try { if ((ctx.scene.lights as any)?.active) (p as any).setPipeline?.('Light2D') } catch {}
      droplets.push(p)
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
      const d = droplets[i]
      if (!on) { try { (m.emitters?.first as any).on = false; (d.emitters?.first as any).on = false } catch {}; continue }
      m.setPosition(px, py)
      d.setPosition(px, py)
      try { (m.emitters?.first as any).on = true; (m.emitters?.first as any).setAngle?.(degNormal - 10, degNormal + 10) } catch {}
      try { (d.emitters?.first as any).on = true; (d.emitters?.first as any).setAngle?.(degNormal - 20, degNormal + 20) } catch {}
    }
  }

  const destroy = () => { try { mists.forEach(m => m.destroy()); droplets.forEach(d => d.destroy()) } catch {} }
  return { update, destroy }
}


