import Phaser from 'phaser'
import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.wall.physical' }

export default function wallPhysical(ctx: EffectContext, params?: Record<string, any>): { update: (length: number) => void; destroy: () => void } {
  const originX = Number(params?.originX ?? ctx.caster.x)
  const originY = Number(params?.originY ?? ctx.caster.y)
  const dirX = Number(params?.dirX ?? 1)
  const dirY = Number(params?.dirY ?? 0)
  const width = Number(params?.width ?? 36)

  const perpX = -dirY
  const perpY = dirX
  const halfW = width / 2
  const spacing = 28
  const dusts: any[] = []

  const ensure = (need: number) => {
    while (dusts.length < need) {
      const p = ctx.scene.add.particles(0, 0, 'particle', {
        lifespan: { min: 500, max: 900 },
        speed: { min: 10, max: 30 },
        gravityY: 0,
        quantity: 1,
        frequency: 100,
        scale: { start: 1.2, end: 2.0 },
        alpha: { start: 0.22, end: 0 },
        tint: 0xaaaaaa,
        blendMode: Phaser.BlendModes.NORMAL
      }) as any
      try { if ((ctx.scene.lights as any)?.active) (p as any).setPipeline?.('Light2D') } catch {}
      dusts.push(p)
    }
  }

  const update = (len: number) => {
    const need = Math.max(1, Math.floor(len / spacing))
    ensure(need)
    const degNormal = Phaser.Math.RadToDeg(Math.atan2(-perpY, -perpX))
    for (let i = 0; i < dusts.length; i++) {
      const on = i < need
      const t = (i + 0.5) / need
      const along = len * t
      const off = (Math.random() * 2 - 1) * (halfW - 4)
      const px = originX + dirX * along + perpX * off
      const py = originY + dirY * along + perpY * off
      const p = dusts[i]
      if (!on) { try { (p.emitters?.first as any).on = false } catch {}; continue }
      p.setPosition(px, py)
      try { (p.emitters?.first as any).on = true; (p.emitters?.first as any).setAngle?.(degNormal - 10, degNormal + 10) } catch {}
    }
  }

  const destroy = () => { try { dusts.forEach(d => d.destroy()) } catch {} }
  return { update, destroy }
}


