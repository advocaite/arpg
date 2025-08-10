import type { BrainContext, BrainTickArgs } from '@/systems/BrainRegistry'
import { getSkill } from '@/systems/SkillDB'
import { executeSkill } from '@/systems/SkillRuntime'

export const meta = { ref: 'brain_boss_ring' }

export default function bossRingBrain(ctx: BrainContext, _args: BrainTickArgs): void {
  const enemy = ctx.enemy
  const player = ctx.player
  // Slow chase toward player
  const dx = player.x - enemy.x, dy = player.y - enemy.y
  const d = Math.hypot(dx, dy) || 1
  const spd = Number(enemy.getData('speed') ?? 80)
  enemy.setVelocity((dx / d) * spd * 0.7, (dy / d) * spd * 0.7)

  // Timed ring fire
  const nextAt = Number(enemy.getData('nextFireAt') || 0)
  if (nextAt === 0) { enemy.setData('nextFireAt', ctx.now + 1000); return }
  if (ctx.now + 16 >= nextAt && ctx.now < nextAt) { enemy.setTint(0xff66ff); return }
  if (ctx.now >= nextAt) {
    enemy.clearTint()
    const skill = getSkill('skill_ring')
    if (skill) executeSkill(skill, { scene: ctx.scene, caster: enemy as any, projectiles: ctx.projectiles, enemies: ctx.enemies })
    enemy.setData('nextFireAt', ctx.now + 1600)
  }
}


