import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.torchParticles' }

export default function torchParticles(ctx: EffectContext, params?: Record<string, any>): void {
  const x = Number(params?.['x'] ?? ctx.caster.x)
  const y = Number(params?.['y'] ?? ctx.caster.y)
  const color = Number(params?.['color'] ?? 0xff9933)
  // Lower rate for a calmer flame
  const rate = Number(params?.['rate'] ?? 25)
  const scene = ctx.scene

  // Main embers: slow rise, warm tint
  const embers = scene.add.particles(0, 0, 'particle', {
    x, y,
    lifespan: { min: 800, max: 1600 },
    speedY: { min: -20, max: -50 },
    speedX: { min: -8, max: 8 },
    gravityY: 0,
    scale: { start: 1.4, end: 0 },
    quantity: 1,
    frequency: Math.max(8, Math.floor(1000 / rate)),
    tint: color,
    alpha: { start: 0.9, end: 0 },
    angle: { min: -20, max: 20 },
    blendMode: Phaser.BlendModes.ADD
  })
  embers.setDepth(6)
  try { if ((scene.lights as any)?.active) (embers as any).setPipeline?.('Light2D') } catch {}

  // Occasional sparks: brighter, faster
  const sparks = scene.add.particles(0, 0, 'particle', {
    x, y,
    lifespan: { min: 400, max: 800 },
    speedY: { min: -80, max: -140 },
    speedX: { min: -30, max: 30 },
    gravityY: 0,
    scale: { start: 1.0, end: 0 },
    quantity: 1,
    frequency: 380,
    tint: 0xffdd88,
    alpha: { start: 1, end: 0 },
    blendMode: Phaser.BlendModes.ADD
  })
  sparks.setDepth(7)
  try { if ((scene.lights as any)?.active) (sparks as any).setPipeline?.('Light2D') } catch {}

  // Light smoke: slow drift upward, normal blend
  const smoke = scene.add.particles(0, 0, 'particle', {
    x, y,
    lifespan: { min: 1200, max: 2200 },
    speedY: { min: -10, max: -30 },
    speedX: { min: -20, max: 20 },
    gravityY: 0,
    scale: { start: 1.2, end: 2.6 },
    quantity: 1,
    frequency: 120,
    tint: 0x666666,
    alpha: { start: 0.28, end: 0 },
    blendMode: Phaser.BlendModes.NORMAL
  })
  smoke.setDepth(5)
  // Smoke should also be affected slightly by lights for consistency
  try { if ((scene.lights as any)?.active) (smoke as any).setPipeline?.('Light2D') } catch {}

  // Clean up on scene shutdown
  try {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { try { embers.destroy() } catch {}; try { sparks.destroy() } catch {}; try { smoke.destroy() } catch {} })
  } catch {}
}


