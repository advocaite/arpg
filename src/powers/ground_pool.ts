import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'

export const meta = { ref: 'ground.pool' }

export default function groundPool(ctx: PowerContext, args: PowerInvokeArgs): void {
  const radius = Number(args.params['radius'] ?? 80)
  const durationMs = Number(args.params['durationMs'] ?? 4000)
  const tickMs = Math.max(100, Number(args.params['tickMs'] ?? 500))
  const dps = Number(args.params['dps'] ?? 5)
  const color = Number(args.params['color'] ?? 0x55ff66)
  const element = String((args.params['element'] ?? args.skill.element ?? 'poison'))

  const x = (ctx as any).cursor?.x ?? ctx.caster.x
  const y = (ctx as any).cursor?.y ?? ctx.caster.y

  // Visual: persistent colored circle that gently pulses
  const g = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
  g.fillStyle(color, 0.28)
  g.fillCircle(x, y, radius)
  const tween = (ctx.scene.tweens as any).add({ targets: g, alpha: 0.18, yoyo: true, repeat: Math.floor(durationMs / 300), duration: 300 })

  // Periodic damage ticks
  const ticks = Math.max(1, Math.floor(durationMs / tickMs))
  for (let i = 1; i <= ticks; i++) {
    ctx.scene.time.delayedCall(i * tickMs, () => {
      // AoE damage application to whoever listens (e.g., player damage resolver)
      ctx.onAoeDamage?.(x, y, radius, dps, { element, source: 'spell' })
      // Optional lightning shocks if rune/params set
      const shock = Boolean(args.params['shock'])
      if (shock && ctx.enemies) {
        const shockCount = Number(args.params['shockCount'] ?? 2)
        const shockRange = Number(args.params['shockRange'] ?? radius + 120)
        const enemies = (ctx.enemies.children as any).entries || []
        let shocks = 0
        for (const obj of enemies) {
          if (shocks >= shockCount) break
          const e = obj as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
          if (!e || !(e as any).active) continue
          const dx = e.x - x, dy = e.y - y
          if (Math.hypot(dx, dy) <= shockRange) {
            // simple visual
            try {
              const gg = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
              gg.lineStyle(2, 0x66ccff, 0.9); gg.beginPath(); gg.moveTo(x, y); gg.lineTo(e.x, e.y); gg.strokePath(); ctx.scene.time.delayedCall(90, () => gg.destroy())
            } catch {}
            ctx.onAoeDamage?.(e.x, e.y, 0, Math.max(1, Math.floor(dps * 0.6)), { element: 'lightning', source: 'spell' })
            shocks++
          }
        }
      }
    })
  }

  // Cleanup
  ctx.scene.time.delayedCall(durationMs + 50, () => { try { tween?.stop(); g.destroy() } catch {} })
}


