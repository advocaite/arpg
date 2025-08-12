import Phaser from 'phaser'
import { RuneConfig, SkillConfig } from '@/types'
import { executePowerByRef } from './Powers'
import { executeEffectByRef } from './Effects'

export type SkillContext = {
  scene: Phaser.Scene
  caster: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  target?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  cursor?: { x: number; y: number }
  projectiles?: Phaser.Physics.Arcade.Group
  onAoeDamage?: (x: number, y: number, radius: number, damage: number, opts?: { element?: string; source?: 'melee' | 'ranged' | 'spell' | 'unknown'; isElite?: boolean }) => void
  enemies?: Phaser.Physics.Arcade.Group
}

export function executeSkill(cfg: SkillConfig, ctx: SkillContext, opts?: { runeId?: string }): void {
  // If skill (or selected rune) references a modular power, prefer that
  const selectedRune: RuneConfig | undefined = opts?.runeId && cfg.runes
    ? cfg.runes.find(r => r.id === opts!.runeId)
    : undefined

  const powerRef = selectedRune?.powerRef || cfg.powerRef
  const effectRef = selectedRune?.effectRef || cfg.effectRef
  if (powerRef) {
    const mergedParams = { ...(cfg.params || {}) } as Record<string, number | string | boolean>
    if (selectedRune?.params) {
      Object.assign(mergedParams, selectedRune.params)
    }
    // Always include rune id and a boolean flag for easy checks in powers
    if (selectedRune && typeof selectedRune.id === 'string') {
      const runeId = selectedRune.id
      mergedParams['runeId'] = runeId
      const flagKey = runeId.startsWith('r_') ? runeId : (`r_${runeId}` as string)
      // Only set if not already provided by the rune params
      if (typeof mergedParams[flagKey] === 'undefined') mergedParams[flagKey] = true
    }
    executePowerByRef(powerRef, ctx, { skill: cfg, rune: selectedRune, params: mergedParams })
    if (effectRef) executeEffectByRef(effectRef, { scene: ctx.scene, caster: ctx.caster }, mergedParams)
    return
  }

  // Fallback to built-in implementations
  switch (cfg.type) {
    case 'projectile':
      executeProjectile(cfg, ctx)
      break
    case 'dash':
      executeDash(cfg, ctx)
      break
    case 'aoe':
      executeAoe(cfg, ctx)
      break
    case 'buff':
      // pure effect when no powerRef provided
      if (effectRef) {
        const mergedParams = { ...(cfg.params || {}) } as Record<string, number | string | boolean>
        if (selectedRune?.params) Object.assign(mergedParams, selectedRune.params)
        executeEffectByRef(effectRef, { scene: ctx.scene, caster: ctx.caster }, mergedParams)
      }
      break
  }
}

function executeProjectile(cfg: SkillConfig, ctx: SkillContext): void {
  const pattern = String(cfg.params?.['pattern'] ?? 'single')
  const count = Number(cfg.params?.['count'] ?? 1)
  const speed = Number(cfg.params?.['speed'] ?? 260)
  const decayMs = Number(cfg.params?.['decayMs'] ?? 3000)
  const originX = ctx.caster.x
  const originY = ctx.caster.y
  if (!ctx.projectiles) return

  if (pattern === 'ring') {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count
      const nx = Math.cos(angle), ny = Math.sin(angle)
      const p = (ctx.scene.physics as any).add.sprite(originX, originY, 'projectile')
      p.setDepth(1)
      p.setVelocity(nx * speed, ny * speed)
      ctx.projectiles.add(p)
      ctx.scene.time.delayedCall(decayMs, () => p.destroy())
    }
    return
  }

  if (pattern === 'mine') {
    const fuseMs = Number(cfg.params?.['fuseMs'] ?? 1200)
    const radius = Number(cfg.params?.['radius'] ?? 80)
    const damage = Number(cfg.params?.['damage'] ?? 10)
    const p = (ctx.scene.physics as any).add.sprite(originX, originY, 'projectile')
    p.setDepth(1)
    p.setVelocity(0, 0)
    ctx.projectiles.add(p)
    ctx.scene.time.delayedCall(fuseMs, () => {
      if (!(p as any).active) return
      const g = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
      g.fillStyle(0xff8844, 0.5); g.fillCircle(p.x, p.y, radius)
      ctx.scene.time.delayedCall(150, () => g.destroy())
      ctx.onAoeDamage?.(p.x, p.y, radius, damage)
      p.destroy()
    })
    return
  }

  // default: single toward target if present (explicit cos/sin to avoid Phaser version diffs)
  let nx = 1, ny = 0
  if (ctx.target) {
    const dx = ctx.target.x - originX, dy = ctx.target.y - originY
    const mag = Math.abs(dx) + Math.abs(dy)
    if (mag < 0.001) {
      const ang = Math.random() * Math.PI * 2
      nx = Math.cos(ang); ny = Math.sin(ang)
    } else {
      const d = Math.hypot(dx, dy) || 1
      nx = dx / d; ny = dy / d
    }
  }
  const p = (ctx.scene.physics as any).add.sprite(originX, originY, 'projectile')
  p.setDepth(1)
  try { p.setDataEnabled(); p.setData('faction', 'player'); p.setData('element', String(cfg.element || 'physical')); p.setData('source', 'ranged') } catch {}
  ctx.scene.time.delayedCall(0, () => {
    if ((p as any).active && (p as any).body) p.setVelocity(nx * speed, ny * speed)
  })
  ctx.projectiles.add(p)
  ctx.scene.time.delayedCall(decayMs, () => p.destroy())
}

function executeDash(cfg: SkillConfig, ctx: SkillContext): void {
  const distance = Number(cfg.params?.['distance'] ?? 120)
  const duration = Number(cfg.params?.['duration'] ?? 160)
  const originX = ctx.caster.x, originY = ctx.caster.y
  let nx = 1, ny = 0
  if (ctx.target) { const dx = ctx.target.x - originX, dy = ctx.target.y - originY; const d = Math.hypot(dx, dy) || 1; nx = dx / d; ny = dy / d }
  const vx = (nx * distance) / (duration / 1000)
  const vy = (ny * distance) / (duration / 1000)
  if (ctx.caster?.active && ctx.caster.body) ctx.caster.setVelocity(vx, vy)
  ctx.scene.time.delayedCall(duration, () => {
    if (ctx.caster && (ctx.caster as any).active && (ctx.caster as any).body) {
      ctx.caster.setVelocity(0, 0)
    }
  })
}

function executeAoe(cfg: SkillConfig, ctx: SkillContext): void {
  const radius = Number(cfg.params?.['radius'] ?? 60)
  const damage = Number(cfg.params?.['damage'] ?? 5)
  const x = ctx.caster.x, y = ctx.caster.y
  const g = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
  g.fillStyle(0xff8888, 0.5); g.fillCircle(x, y, radius)
  ctx.onAoeDamage?.(x, y, radius, damage, { element: String(cfg.element || 'physical'), source: 'spell' })
  ctx.scene.time.delayedCall(120, () => g.destroy())
}
