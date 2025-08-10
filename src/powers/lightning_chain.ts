import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'
import { executeEffectByRef } from '@/systems/Effects'

export const meta = { ref: 'lightning.chain' }

export default function lightningChain(ctx: PowerContext, args: PowerInvokeArgs): void {
  const maxBounces = Number(args.params['bounces'] ?? 4)
  const range = Number(args.params['range'] ?? 260)
  const damage = Number(args.params['damage'] ?? 8)
  const effectRef = String(args.params['effectRef'] ?? 'fx.lightningBolt')

  const enemies = ctx.scene.physics.add.group()
  // Prefer provided group if available
  const pool = (ctx as any).enemies || enemies

  const visited = new Set<Phaser.GameObjects.GameObject>()
  let fromX = ctx.caster.x
  let fromY = ctx.caster.y
  let current: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined = ctx.target

  for (let hop = 0; hop < maxBounces; hop++) {
    // Find nearest target within range
    let candidate: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined
    let bestDist = Number.POSITIVE_INFINITY
    const children = (pool.children as any).entries || []
    for (const obj of children) {
      const t = obj as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
      if (!t || !(t as any).active) continue
      if (visited.has(t)) continue
      const dx = t.x - fromX, dy = t.y - fromY
      const d = Math.hypot(dx, dy)
      if (d <= range && d < bestDist) { bestDist = d; candidate = t }
    }
    if (!candidate) break
    // Render effect from (fromX, fromY) to candidate
    executeEffectByRef(effectRef, { scene: ctx.scene, caster: ctx.caster }, { x1: fromX, y1: fromY, x2: candidate.x, y2: candidate.y })
    // Apply damage through AoE callback as a point target
    ctx.onAoeDamage?.(candidate.x, candidate.y, 0, damage)
    // If kill occurred via onAoeDamage handler, it will handle drops; also add a direct check in case handler is bypassed
    try {
      const hp = Number(candidate.getData('hp') || 1)
      const newHp = Math.max(0, hp - damage)
      if (newHp <= 0) {
        const anyScene: any = ctx.scene
        if (!(anyScene.__dropUtil)) { import('@/systems/DropSystem').then(mod => { anyScene.__dropUtil = mod }) }
        const util = anyScene.__dropUtil
        if (util?.playerKillDrop) util.playerKillDrop(anyScene, candidate.x, candidate.y, 0.1)
      }
    } catch {}
    visited.add(candidate)
    fromX = candidate.x; fromY = candidate.y
    current = candidate
  }
}


