import type { EffectContext } from '@/systems/Effects'

// Fancy oval portal effect composed of pulsating ellipses and rotating arc bands
// Params:
// - x, y: world position (defaults to caster position)
// - width, height: ellipse size (defaults 64x96)
// - colorOuter, colorInner: ring colors (defaults cyan/blue)
// - swirlSpeed: degrees/sec for rotating arc group (default 110)
// - pulseMs: duration of pulse tween (default 900)
export const meta = { ref: 'fx.portalVortex' }

export default function portalVortex(ctx: EffectContext, params?: Record<string, number | string | boolean>): void {
  const anyParams: any = params || {}
  const x = Number(anyParams.x ?? ctx.caster.x)
  const y = Number(anyParams.y ?? ctx.caster.y)
  const width = Number(anyParams.width ?? 72)
  const height = Number(anyParams.height ?? 108)
  const colorOuter = Number(anyParams.colorOuter ?? 0x66e3ff)
  const colorInner = Number(anyParams.colorInner ?? 0x2a86ff)
  const swirlSpeedDeg = Number(anyParams.swirlSpeed ?? 110)
  const pulseMs = Number(anyParams.pulseMs ?? 900)

  const container = ctx.scene.add.container(x, y).setDepth(6)

  // Outer ellipse ring (pulses in alpha/scale)
  const gOuter = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
  gOuter.lineStyle(3, colorOuter, 0.9)
  gOuter.strokeEllipse(0, 0, width, height)
  container.add(gOuter)

  // Inner solid ellipse (soft glow)
  const gInner = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
  gInner.fillStyle(colorInner, 0.22)
  gInner.fillEllipse(0, 0, width * 0.8, height * 0.8)
  container.add(gInner)

  // Rotating arc bands to give a vortex feel
  const gSwirl = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
  gSwirl.lineStyle(4, colorInner, 0.65)
  const steps = 5
  for (let i = 0; i < steps; i++) {
    const start = (i / steps) * Math.PI * 2
    gSwirl.beginPath()
    gSwirl.arc(0, 0, Math.max(width, height) * 0.28, start, start + Math.PI / 3)
    gSwirl.strokePath()
  }
  container.add(gSwirl)

  // Animate: pulse outer ring and spin swirl group
  ctx.scene.tweens.add({ targets: gOuter, alpha: { from: 0.35, to: 1 }, duration: pulseMs, yoyo: true, repeat: -1 })
  ctx.scene.tweens.add({ targets: gInner, alpha: { from: 0.15, to: 0.35 }, duration: Math.floor(pulseMs * 0.85), yoyo: true, repeat: -1 })
  // Rotation using steady angular velocity
  const rotateEvt = ctx.scene.time.addEvent({ delay: 16, loop: true, callback: () => { try { gSwirl.rotation += (swirlSpeedDeg * Math.PI / 180) * (16 / 1000) } catch {} } })

  // Clean up when caster is destroyed
  try { (ctx.caster as any).once?.('destroy', () => { try { rotateEvt.remove(false) } catch {}; try { container.destroy() } catch {} }) } catch {}
}


