import type { BrainContext, BrainTickArgs } from '@/systems/BrainRegistry'
import { getSkill } from '@/systems/SkillDB'
import { executeSkill } from '@/systems/SkillRuntime'

export const meta = { ref: 'brain_shooter' }

export default function shooterBrain(ctx: BrainContext, args: BrainTickArgs): void {
  const enemy = ctx.enemy
  const player = ctx.player
  const dx = player.x - enemy.x, dy = player.y - enemy.y
  const d = Math.hypot(dx, dy) || 1
  const range = Number(args.params?.['range'] ?? enemy.getData('range') ?? 320)
  const speed = Number(enemy.getData('speed') ?? 80)
  const sight = Number(args.params?.['sightRange'] ?? enemy.getData('sightRange') ?? range)
  const cdMs = Number(args.params?.['cooldownMs'] ?? enemy.getData('cooldownMs') ?? 900)
  const telegraphMs = Number(args.params?.['telegraphMs'] ?? enemy.getData('telegraphMs') ?? 300)
  // Move slightly toward player if in sight
  if (d < sight) { const nx = dx / d, ny = dy / d; enemy.setVelocity(nx * Math.min(speed, 80), ny * Math.min(speed, 80)) } else { enemy.setVelocity(0, 0) }
  if (d > range) return
  const nextAt = Number(enemy.getData('pendingFireAt') || 0)
  if (nextAt > 0 && ctx.now >= nextAt) {
    const skillId = args.skills?.[0]?.id || 'skill_shoot'
    const skill = getSkill(skillId)
    if (skill) executeSkill(skill, { scene: ctx.scene, caster: enemy as any, target: player as any, projectiles: ctx.projectiles, enemies: ctx.enemies })
    enemy.setData('pendingFireAt', 0)
    enemy.setData('cooldownUntil', ctx.now + cdMs)
    enemy.setTint((enemy.getData('baseTint') as number) || 0xffffff)
    return
  }
  const cdUntil = Number(enemy.getData('cooldownUntil') || 0)
  if (cdUntil === 0) enemy.setData('cooldownUntil', ctx.now)
  if (ctx.now >= cdUntil && nextAt === 0) {
    enemy.setTint(0xffe066)
    enemy.setData('pendingFireAt', ctx.now + telegraphMs)
  }
}


