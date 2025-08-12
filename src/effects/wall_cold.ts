import Phaser from 'phaser'
import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.wall.cold' }

export default function wallCold(ctx: EffectContext, params?: Record<string, any>): { update: (length: number) => void; destroy: () => void } {
  const originX = Number(params?.originX ?? ctx.caster.x)
  const originY = Number(params?.originY ?? ctx.caster.y)
  const dirX = Number(params?.dirX ?? 1)
  const dirY = Number(params?.dirY ?? 0)
  const width = Number(params?.width ?? 36)
  const length = Number(params?.length ?? 200)

  const color = 0x88ccff
  const perpX = -dirY
  const perpY = dirX
  const halfW = width / 2
  const spacing = 32
  const mists: any[] = []

  const ensureCount = (needed: number) => {
    while (mists.length < needed) {
      const mist = ctx.scene.add.particles(0, 0, 'particle', {
        lifespan: { min: 800, max: 1500 },
        speed: { min: 10, max: 40 },
        gravityY: 0,
        quantity: 1,
        frequency: 90,
        scale: { start: 1.4, end: 2.4 },
        alpha: { start: 0.35, end: 0 },
        tint: color,
        blendMode: Phaser.BlendModes.SCREEN
      }) as any
      try { if ((ctx.scene.lights as any)?.active) (mist as any).setPipeline?.('Light2D') } catch {}
      mists.push(mist)
    }
  }

  const update = (lengthNow: number) => {
    const needed = Math.max(1, Math.floor(lengthNow / spacing))
    ensureCount(needed)
    const degNormal = Phaser.Math.RadToDeg(Math.atan2(-perpY, -perpX))
    for (let i = 0; i < mists.length; i++) {
      const on = i < needed
      const mist = mists[i]
      if (!on) { try { (mist.emitters?.first as any).on = false } catch {}; continue }
      const t = (i + 0.5) / needed
      const along = lengthNow * t
      const off = (Math.random() * 2 - 1) * (halfW - 4)
      const px = originX + dirX * along + perpX * off
      const py = originY + dirY * along + perpY * off
      mist.setPosition(px, py)
      try { (mist.emitters?.first as any).on = true; (mist.emitters?.first as any).setAngle?.(degNormal - 25, degNormal + 25) } catch {}
    }
  }

  return { update, destroy: () => { try { mists.forEach(m => m.destroy()) } catch {} } }
}


