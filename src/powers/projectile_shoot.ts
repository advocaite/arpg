import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'
import { notifyMonsterKilled } from '@/systems/Quests'

export const meta = { ref: 'projectile.shoot' }

export default function projectileShoot(ctx: PowerContext, args: PowerInvokeArgs): void {
  const speed = Number(args.params['speed'] ?? 300)
  let nx = 1, ny = 0
  const ox = ctx.caster.x, oy = ctx.caster.y
  if (ctx.target) {
    const dx = ctx.target.x - ox, dy = ctx.target.y - oy
    const d = Math.hypot(dx, dy) || 1
    nx = dx / d; ny = dy / d
  }
  const p = (ctx.scene.physics as any).add.sprite(ox, oy, 'projectile')
  p.setDepth(1)
  ctx.scene.time.delayedCall(0, () => { if ((p as any).active && (p as any).body) p.setVelocity(nx * speed, ny * speed) })
  ctx.projectiles?.add(p)
  const decayMs = Number(args.params['decayMs'] ?? 2000)
  ctx.scene.time.delayedCall(decayMs, () => p.destroy())
  try {
    (ctx.scene.physics as any).add.overlap(p, ctx.enemies, (_p: any, obj: any) => {
      const enemy = obj as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
      const hp = Number(enemy.getData('hp') || 1)
      const newHp = Math.max(0, hp - 8)
      enemy.setData('hp', newHp)
      if (newHp <= 0) { try { notifyMonsterKilled(String(enemy.getData('configId') || '')); (ctx.scene as any).refreshQuestUI?.() } catch {}; enemy.destroy() }
    })
  } catch {}
}


