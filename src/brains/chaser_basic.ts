import type { BrainContext, BrainTickArgs } from '@/systems/BrainRegistry'
import { getSkill } from '@/systems/SkillDB'
import { executeSkill } from '@/systems/SkillRuntime'

export const meta = { ref: 'brain_chaser' }

export default function chaserBrain(ctx: BrainContext, _args: BrainTickArgs): void {
  const enemy = ctx.enemy
  const player = ctx.player
  const dx = player.x - enemy.x, dy = player.y - enemy.y
  const d = Math.hypot(dx, dy) || 1
  const spd = Number(enemy.getData('speed') ?? 100)
  if (d > 2) enemy.setVelocity((dx / d) * spd, (dy / d) * spd)
  // Example dash if very close and off cooldown
  const sight = Number(enemy.getData('sightRange') || 360)
  const nowTs = ctx.now
  const lastDashAt = Number(enemy.getData('lastDashAt') || 0)
  const cd = Number(enemy.getData('dashCooldownMs') || 1400)
  if (d < sight * 0.5 && nowTs - lastDashAt > cd) {
    const skill = getSkill('skill_dash')
    if (skill) executeSkill(skill, { scene: ctx.scene, caster: enemy as any, target: player as any, enemies: ctx.enemies })
    enemy.setData('lastDashAt', nowTs)
  }
}


