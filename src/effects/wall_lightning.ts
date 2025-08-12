import Phaser from 'phaser'
import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.wall.lightning' }

export default function wallLightning(ctx: EffectContext, params?: Record<string, any>): { update: (length: number) => void; destroy: () => void } {
  const originX = Number(params?.originX ?? ctx.caster.x)
  const originY = Number(params?.originY ?? ctx.caster.y)
  const dirX = Number(params?.dirX ?? 1)
  const dirY = Number(params?.dirY ?? 0)
  const width = Number(params?.width ?? 36)
  const length = Number(params?.length ?? 200)

  const perpX = -dirY
  const perpY = dirX
  const halfW = width / 2
  const spacing = 36
  const arcs: Phaser.GameObjects.Graphics[] = []

  const update = (lengthNow: number) => {
    // destroy old arcs
    try { arcs.forEach(a => a.destroy()); (arcs as any).length = 0 } catch {}
    const needed = Math.max(1, Math.floor(lengthNow / spacing))
    for (let i = 0; i < needed; i++) {
      const t = (i + 0.5) / needed
      const along = lengthNow * t
      const off = (Math.random() * 2 - 1) * (halfW - 4)
      const px = originX + dirX * along + perpX * off
      const py = originY + dirY * along + perpY * off
      const g = (ctx.scene.add as any).graphics({ x: 0, y: 0 }) as Phaser.GameObjects.Graphics
      g.setDepth(7)
      g.lineStyle(3, 0x88ddff, 1)
      const segs = 5
      const lenArc = 18
      const nx = -perpX, ny = -perpY // outward
      g.beginPath()
      g.moveTo(px, py)
      for (let s = 1; s <= segs; s++) {
        const jx = (Math.random() * 2 - 1) * 4
        const jy = (Math.random() * 2 - 1) * 4
        g.lineTo(px + nx * (lenArc * s / segs) + jx, py + ny * (lenArc * s / segs) + jy)
      }
      g.strokePath()
      ctx.scene.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() })
      arcs.push(g)
    }
  }

  return { update, destroy: () => { try { arcs.forEach(a => a.destroy()) } catch {} } }
}


