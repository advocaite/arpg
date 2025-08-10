import Phaser from 'phaser'
import type { RuneConfig, SkillConfig } from '@/types'

export type PowerInvokeArgs = {
  skill: SkillConfig
  rune?: RuneConfig
  params: Record<string, number | string | boolean>
}

export type PowerContext = {
  scene: Phaser.Scene
  caster: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  target?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  projectiles?: Phaser.Physics.Arcade.Group
  enemies?: Phaser.Physics.Arcade.Group
  onAoeDamage?: (x: number, y: number, radius: number, damage: number, opts?: { element?: string; source?: 'melee' | 'ranged' | 'spell' | 'unknown'; isElite?: boolean }) => void
}

type PowerHandler = (ctx: PowerContext, args: PowerInvokeArgs) => void

const registry: Record<string, PowerHandler> = {}

export function registerPower(ref: string, handler: PowerHandler): void {
  registry[ref] = handler
}

export function executePowerByRef(ref: string, ctx: PowerContext, args: PowerInvokeArgs): void {
  const fn = registry[ref]
  if (fn) { fn(ctx, args); return }
  // Unknown power: no-op
}

// Auto-register powers from src/powers (files export default function(ctx,args))
try {
  const modules: Record<string, any> = import.meta.glob('../powers/**/*.ts', { eager: true })
  Object.values(modules).forEach((m: any) => {
    const meta: { ref?: string } | undefined = m.meta || m.powerMeta
    const fn: PowerHandler | undefined = m.default
    if (meta?.ref && typeof fn === 'function') registerPower(meta.ref, fn)
  })
} catch {}


