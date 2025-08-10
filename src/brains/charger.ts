import type { BrainContext, BrainTickArgs } from '@/systems/BrainRegistry'
import { getSkill } from '@/systems/SkillDB'
import { executeSkill } from '@/systems/SkillRuntime'

export const meta = { ref: 'brain_charger' }

export default function chargerBrain(ctx: BrainContext, args: BrainTickArgs): void {
  const enemy = ctx.enemy
  const player = ctx.player
  const dx = player.x - enemy.x, dy = player.y - enemy.y
  const d = Math.hypot(dx, dy) || 1
  const spd = Number(enemy.getData('speed') ?? 90)
  // Chase
  if (d > 2) enemy.setVelocity((dx / d) * spd, (dy / d) * spd)

  // Dash at intervals when close enough
  const sight = Number(enemy.getData('sightRange') || args.params?.['sightRange'] || 360)
  const cd = Number(args.params?.['cooldownMs'] ?? enemy.getData('cooldownMs') ?? 1400)
  const lastDashAt = Number(enemy.getData('lastDashAt') || 0)
  if (d < sight * 0.6 && ctx.now - lastDashAt > cd) {
    const skill = getSkill('skill_dash')
    if (skill) executeSkill(skill, { scene: ctx.scene, caster: enemy as any, target: player as any, enemies: ctx.enemies })
    enemy.setData('lastDashAt', ctx.now)
  }
}


