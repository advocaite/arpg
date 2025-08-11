import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'
import { executeEffectByRef } from '@/systems/Effects'

export const meta = { ref: 'projectile.follow' }

export default function projectileFollow(ctx: PowerContext, args: PowerInvokeArgs): void {
  const speed = Number(args.params['speed'] ?? 240)
  const turnRate = Number(args.params['turnRate'] ?? 6) // higher = tighter
  const decayMs = Number(args.params['decayMs'] ?? 2500)
  const element = String((args.params['element'] ?? ((args.skill as any)?.element ?? 'physical')))

  const ox = ctx.caster.x, oy = ctx.caster.y
  const p = (ctx.scene.physics as any).add.sprite(ox, oy, 'projectile')
  p.setDepth(1)
  // Tag projectile faction based on caster (player vs enemy)
  try {
    p.setDataEnabled()
    const casterFaction = (ctx.caster as any)?.getData?.('faction') || 'player'
    p.setData('faction', casterFaction)
    p.setData('element', element)
    p.setData('source', 'ranged')
  } catch {}
  try { p.setDataEnabled(); p.setData('faction', 'player'); p.setData('element', element); p.setData('source', 'ranged') } catch {}
  if (ctx.projectiles) ctx.projectiles.add(p)

  let vx = speed, vy = 0
  const sceneAny: any = ctx.scene
  const base = 5 + Math.max(0, Number(sceneAny?.weaponFlatDamage || 0))
  const scaled = Math.max(1, Math.round(base * Math.max(0.1, Number(sceneAny?.damageMultiplier || 1))))
  const isCrit = Math.random() < Math.max(0, Number(sceneAny?.critChance || 0))
  const dmg = isCrit ? Math.round(scaled * Math.max(1, Number(sceneAny?.critDamageMult || 1.5))) : scaled

  const evt = ctx.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
    if (!(p as any).active || !(p as any).body) return
    let tx = p.x + vx, ty = p.y + vy
    const target = ctx.target
    if (target && (target as any).active) {
      const dx = target.x - p.x
      const dy = target.y - p.y
      const d = Math.hypot(dx, dy) || 1
      const nx = dx / d, ny = dy / d
      // Adjust velocity gradually towards target
      vx = vx + (nx * speed - vx) * Math.min(1, turnRate * 0.016)
      vy = vy + (ny * speed - vy) * Math.min(1, turnRate * 0.016)
      const mag = Math.hypot(vx, vy) || 1
      vx = (vx / mag) * speed; vy = (vy / mag) * speed
      tx = p.x + vx * 0.016; ty = p.y + vy * 0.016
    }
    p.setPosition(tx, ty)
    // Check damage on overlap distance (simple proximity since custom motion)
    if (target && (target as any).active && Math.hypot(target.x - p.x, target.y - p.y) < 12) {
      const hp = Number(target.getData('hp') || 1)
      const newHp = Math.max(0, hp - dmg)
      target.setData('hp', newHp)
      try { executeEffectByRef('fx.damageNumber', { scene: ctx.scene, caster: ctx.caster }, { x: target.x, y: target.y - 10, value: `${dmg}`, element, crit: isCrit }) } catch {}
      if (newHp <= 0) { try { const anyScene: any = ctx.scene; anyScene.gainExperience?.(Math.max(1, Math.floor(((target.getData('level') as number) || 1) * 5))) } catch {}; try { import('@/systems/Quests').then(qm => { (qm as any).notifyMonsterKilled?.(String(target.getData('configId') || '')) }) } catch {}; target.destroy(); try { evt.remove(false) } catch {}; p.destroy() }
    }
  } })
  ctx.scene.time.delayedCall(decayMs, () => { try { evt.remove(false) } catch {}; p.destroy() })
}


