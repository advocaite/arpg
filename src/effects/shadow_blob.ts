import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.shadowBlob' }

function ensureShadowTexture(scene: Phaser.Scene): string {
  const key = 'shadow_blob_tex'
  if (scene.textures.exists(key)) return key
  const g = scene.add.graphics({ x: 0, y: 0 })
  const w = 64, h = 28
  for (let i = 0; i < 10; i++) {
    const t = i / 9
    const alpha = (1 - t) * 0.22
    g.fillStyle(0x000000, alpha)
    const rx = w * (0.5 + t * 0.5)
    const ry = h * (0.5 + t * 0.5)
    g.fillEllipse(w / 2, h / 2, rx, ry)
  }
  const rt = scene.make.renderTexture({ x: 0, y: 0, width: w, height: h }, false)
  rt.draw(g, 0, 0)
  rt.saveTexture(key)
  rt.destroy()
  g.destroy()
  return key
}

export default function shadowBlob(ctx: EffectContext, params?: Record<string, any>): void {
  const target: any = params?.['target'] || ctx.caster
  if (!target || !ctx.scene) return
  const scene = ctx.scene
  const texKey = ensureShadowTexture(scene)
  const offsetY = Number(params?.['offsetY'] ?? 10)
  const alpha = Number(params?.['alpha'] ?? 0.35)
  const baseRadius = Number(params?.['radius'] ?? (target.body?.circle?.radius || target.body?.radius || 12))
  const baseW = 64

  try {
    const img = scene.add.image(target.x, target.y + offsetY, texKey)
    img.setAlpha(alpha)
    img.setBlendMode(Phaser.BlendModes.MULTIPLY)
    img.setDepth((target.depth || 1) - 2)
    const sx = Math.max(0.4, (baseRadius * 2) / baseW)
    const sy = Math.max(0.25, sx * 0.6)
    img.setScale(sx, sy)
    const timer = scene.time.addEvent({ delay: 33, loop: true, callback: () => {
      if (!target.active || !img.active) { try { timer.remove(false) } catch {}; try { img.destroy() } catch {}; return }
      img.x = target.x
      img.y = target.y + offsetY
      img.setDepth((target.depth || 1) - 2)
    } })
    try { (target as any).once?.('destroy', () => { try { timer.remove(false) } catch {}; try { img.destroy() } catch {} }) } catch {}
  } catch {}
}


