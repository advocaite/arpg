import Phaser from 'phaser'

export type BrainContext = {
  scene: Phaser.Scene
  enemy: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  projectiles?: Phaser.Physics.Arcade.Group
  enemies?: Phaser.Physics.Arcade.Group
  now: number
}

export type BrainTickArgs = {
  params?: Record<string, number | string | boolean>
  skills?: Array<{ id: string; params?: Record<string, number | string | boolean> }>
}

type BrainHandler = (ctx: BrainContext, args: BrainTickArgs) => void

const registry: Record<string, BrainHandler> = {}

export function registerBrain(ref: string, handler: BrainHandler): void {
  registry[ref] = handler
}

export function hasBrain(ref: string): boolean { return !!registry[ref] }

export function executeBrainTickByRef(ref: string, ctx: BrainContext, args: BrainTickArgs): void {
  const fn = registry[ref]
  if (fn) fn(ctx, args)
}

// Auto-register brains from src/brains
try {
  const modules: Record<string, any> = import.meta.glob('../brains/**/*.ts', { eager: true })
  Object.values(modules).forEach((m: any) => {
    const meta: { ref?: string } | undefined = m.meta || m.brainMeta
    const fn: BrainHandler | undefined = m.default
    if (meta?.ref && typeof fn === 'function') registerBrain(meta.ref, fn)
  })
} catch {}


// NPC brain support using the same registry. Adapts an NPC context to the generic brain handler.
export type NpcBrainContext = {
  scene: Phaser.Scene
  npc: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  projectiles?: Phaser.Physics.Arcade.Group
  enemies?: Phaser.Physics.Arcade.Group
  now: number
}

export function executeNpcBrainTickByRef(ref: string, ctx: NpcBrainContext, args: BrainTickArgs): void {
  const fn = registry[ref]
  if (!fn) return
  const adapted: BrainContext = { scene: ctx.scene, enemy: ctx.npc as any, player: ctx.player as any, projectiles: ctx.projectiles, enemies: ctx.enemies, now: ctx.now }
  fn(adapted, args)
}

