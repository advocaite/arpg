import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'

export const meta = { ref: 'movement.dash' }

export default function movementDash(ctx: PowerContext, args: PowerInvokeArgs): void {
  const distance = Number(args.params['distance'] ?? 120)
  const duration = Number(args.params['duration'] ?? 160)
  const damageOnPass = Number(args.params['damageOnPass'] ?? 0)
  const passRadius = Number(args.params['passRadius'] ?? 18)
  const ox = ctx.caster.x, oy = ctx.caster.y
  let nx = 1, ny = 0
  if (ctx.target) { const dx = ctx.target.x - ox, dy = ctx.target.y - oy; const d = Math.hypot(dx, dy) || 1; nx = dx / d; ny = dy / d }
  const vx = (nx * distance) / (duration / 1000)
  const vy = (ny * distance) / (duration / 1000)
  if (ctx.caster?.active && ctx.caster.body) ctx.caster.setVelocity(vx, vy)
  ctx.scene.time.delayedCall(duration, () => {
    if (ctx.caster && (ctx.caster as any).active && (ctx.caster as any).body) ctx.caster.setVelocity(0, 0)
  })

  // Optional: deal damage to enemies we pass through during dash
  if (damageOnPass > 0 && (ctx as any).enemies) {
    const enemies = (ctx as any).enemies as Phaser.Physics.Arcade.Group
    const sceneAny: any = ctx.scene
    const isCrit = Math.random() < (sceneAny.critChance || 0)
    const finalDmg = Math.round(damageOnPass * Math.max(0.001, sceneAny.damageMultiplier || 1) * (isCrit ? (sceneAny.critDamageMult || 1.5) : 1))
    const g = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
    g.fillStyle(0xaadfff, 0.15); g.fillCircle(ox, oy, passRadius)
    ctx.scene.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() })
    enemies.children.iterate((child: any) => {
      const e = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
      if (!e || !e.body) return true
      const d = Phaser.Math.Distance.Between(ox, oy, e.x, e.y)
      const extra = (e.body as any).radius || (e.body as any).halfWidth || 0
      if (d <= passRadius + extra) {
        const hp = Number(e.getData('hp') || 1)
        const newHp = Math.max(0, hp - finalDmg)
        e.setData('hp', newHp)
        try { import('@/systems/Effects').then(m => (m as any).executeEffectByRef?.('fx.damageNumber', { scene: ctx.scene, caster: ctx.caster }, { x: e.x, y: e.y - 8, value: `${finalDmg}`, color: '#77ddff', durationMs: 350, element: String((args.skill as any)?.element || 'physical'), crit: isCrit })) } catch {}
        if (newHp <= 0) {
          try { import('@/systems/DropSystem').then(mod => { (mod as any).playerKillDrop?.(sceneAny, e.x, e.y, 0.1) }) } catch {}
          try { import('@/systems/Quests').then(mod => { (mod as any).notifyMonsterKilled?.(String(e.getData('configId')||'')); (sceneAny as any).refreshQuestUI?.() }) } catch {}
          e.destroy()
        }
      }
      return true
    })
  }
}


