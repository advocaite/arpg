import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'
import { notifyMonsterKilled } from '@/systems/Quests'

export const meta = { ref: 'projectile.ring' }

export default function projectileRing(ctx: PowerContext, args: PowerInvokeArgs): void {
  const count = Number(args.params['count'] ?? 12)
  const speed = Number(args.params['speed'] ?? 280)
  const decayMs = Number(args.params['decayMs'] ?? 3000)
  const ox = ctx.caster.x, oy = ctx.caster.y
  if (!ctx.projectiles) return
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count
    const nx = Math.cos(angle), ny = Math.sin(angle)
    const p = (ctx.scene.physics as any).add.sprite(ox, oy, 'projectile')
    p.setDepth(1)
    p.setVelocity(nx * speed, ny * speed)
    ctx.projectiles.add(p)
    ctx.scene.time.delayedCall(decayMs, () => p.destroy())
    // Register overlap to apply damage and detect kills
    try {
      (ctx.scene.physics as any).add.overlap(p, ctx.enemies, (_p: any, obj: any) => {
        const enemy = obj as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
        const hp = Number(enemy.getData('hp') || 1)
        const newHp = Math.max(0, hp - 5)
        enemy.setData('hp', newHp)
        if (newHp <= 0) { try { notifyMonsterKilled(String(enemy.getData('configId') || '')); (ctx.scene as any).refreshQuestUI?.() } catch {}; enemy.destroy() }
      })
    } catch {}
  }
}


