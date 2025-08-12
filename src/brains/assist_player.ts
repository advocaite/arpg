import type Phaser from 'phaser'
import type { BrainContext, BrainTickArgs } from '@/systems/BrainRegistry'
import { executePowerByRef } from '@/systems/Powers'

export const meta = { ref: 'brain_assist_player' }

export default function assistPlayerBrain(ctx: BrainContext, args: BrainTickArgs): void {
  const npc = ctx.enemy
  const player = ctx.player
  // Follow within radius
  const followRadius = Math.max(10, Number((args.params as any)?.followRadius ?? npc.getData('followRadius') ?? 160))
  const keepDistance = Math.max(0, Number((args.params as any)?.keepDistance ?? npc.getData('keepDistance') ?? 40))
  const dx = player.x - npc.x, dy = player.y - npc.y
  const d = Math.hypot(dx, dy) || 1
  const speed = Math.max(20, Number(npc.getData('speed') ?? (args.params as any)?.speed ?? 90))
  if (d > followRadius) {
    npc.setVelocity((dx / d) * speed, (dy / d) * speed)
  } else if (d < keepDistance) {
    npc.setVelocity(-(dx / d) * speed * 0.8, -(dy / d) * speed * 0.8)
  } else {
    npc.setVelocity(0, 0)
  }
  // Simple assist attack: swing when enemy nearby
  const enemies: Phaser.Physics.Arcade.Group | undefined = ctx.enemies
  if (!enemies) return
  const now = ctx.now
  const lastAtk = Number(npc.getData('__assist_lastAtk') || 0)
  const cooldown = Math.max(200, Number((args.params as any)?.attackCooldownMs ?? npc.getData('attackCooldownMs') ?? 900))
  if (now - lastAtk < cooldown) return
  let nearestDist = Infinity
  let nx = 0, ny = 0
  enemies.children.iterate((child: any) => {
    const e = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
    if (!e || !e.body) return true
    const ex = e.x - npc.x, ey = e.y - npc.y
    const dist = Math.hypot(ex, ey)
    if (dist < nearestDist) { nearestDist = dist; nx = ex; ny = ey }
    return true
  })
  const engageRange = Math.max(24, Number((args.params as any)?.engageRange ?? npc.getData('engageRange') ?? 140))
  if (nearestDist <= engageRange) {
    const ang = Math.atan2(ny, nx)
    const pseudoSkill = { id: 'melee.swing', name: 'Melee', type: 'projectile' } as any
    executePowerByRef('melee.swing', { scene: ctx.scene, caster: npc as any, enemies }, { skill: pseudoSkill, params: { offset: 20, angle: ang, damage: Number((args.params as any)?.damage ?? 6), durationMs: 90, spreadDeg: 60 } })
    npc.setData('__assist_lastAtk', now)
  }
}


