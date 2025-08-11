import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'
import { executeEffectByRef } from '@/systems/Effects'

export const meta = { ref: 'aoe.wall' }

export default function aoeWall(ctx: PowerContext, args: PowerInvokeArgs): void {
  let originX = ctx.caster.x
  let originY = ctx.caster.y
  // Direction towards cursor/target based on caster as reference; fall back to facing right
  let dirX = 1, dirY = 0
  const anyCtx: any = ctx as any
  const cursor = anyCtx.cursor as { x: number; y: number } | undefined
  const atCursor = Boolean(args.params['atCursor'])
  if (cursor) {
    const dx = cursor.x - ctx.caster.x
    const dy = cursor.y - ctx.caster.y
    const d = Math.hypot(dx, dy) || 1
    dirX = dx / d; dirY = dy / d
    if (atCursor) { originX = cursor.x; originY = cursor.y }
  } else if (ctx.target) {
    const dx = ctx.target.x - ctx.caster.x
    const dy = ctx.target.y - ctx.caster.y
    const d = Math.hypot(dx, dy) || 1
    dirX = dx / d; dirY = dy / d
    if (atCursor) { originX = ctx.target.x; originY = ctx.target.y }
  }

  const length = Number(args.params['length'] ?? 180)
  const width = Number(args.params['width'] ?? 36)
  const growMs = Math.max(0, Number(args.params['growMs'] ?? 300))
  const durationMs = Math.max(growMs, Number(args.params['durationMs'] ?? 900))
  const tickMs = Math.max(60, Number(args.params['tickMs'] ?? 120))
  const color = Number(args.params['color'] ?? 0xff7733)
  const element = String((args.params['element'] ?? (args.skill as any)?.element ?? 'fire'))

  // Damage scaling
  const sceneAny: any = ctx.scene
  const base = 6 + Math.max(0, Number(sceneAny?.weaponFlatDamage || 0))
  const scaled = Math.max(1, Math.round(base * Math.max(0.1, Number(sceneAny?.damageMultiplier || 1))))
  const isCrit = Math.random() < Math.max(0, Number(sceneAny?.critChance || 0))
  const damage = isCrit ? Math.round(scaled * Math.max(1, Number(sceneAny?.critDamageMult || 1.5))) : scaled

  // Visual: growing rectangle along direction
  const g = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
  const startTs = ctx.scene.time.now

  const perpX = -dirY
  const perpY = dirX

  const drawWall = (len: number) => {
    g.clear()
    g.fillStyle(color, 0.4)
    // Draw as a poly to avoid rotation state
    const halfW = width / 2
    const aX = originX + perpX * (-halfW)
    const aY = originY + perpY * (-halfW)
    const bX = originX + perpX * (halfW)
    const bY = originY + perpY * (halfW)
    const cX = originX + dirX * len + perpX * (halfW)
    const cY = originY + dirY * len + perpY * (halfW)
    const dX = originX + dirX * len + perpX * (-halfW)
    const dY = originY + dirY * len + perpY * (-halfW)
    g.fillPoints([{ x: aX, y: aY }, { x: bX, y: bY }, { x: cX, y: cY }, { x: dX, y: dY }], true)
  }

  const pointInWall = (ex: number, ey: number, len: number): boolean => {
    const relX = ex - originX
    const relY = ey - originY
    const localX = relX * dirX + relY * dirY // along wall
    const localY = relX * perpX + relY * perpY // across wall
    return localX >= 0 && localX <= len && Math.abs(localY) <= width / 2
  }

  // Animate growth, then keep at max until duration ends
  const step = () => {
    const now = ctx.scene.time.now
    const elapsed = now - startTs
    const frac = Math.max(0, Math.min(1, growMs > 0 ? elapsed / growMs : 1))
    const currLen = Math.round(length * frac)
    drawWall(currLen)
  }

  const damageTick = () => {
    const now = ctx.scene.time.now
    const elapsed = now - startTs
    const frac = Math.max(0, Math.min(1, growMs > 0 ? Math.min(elapsed / growMs, 1) : 1))
    const currLen = Math.round(length * frac)
    if (ctx.enemies) {
      (ctx.enemies.children as any).iterate((child: any) => {
        const e = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
        if (!e || !(e as any).active) return true
        if (pointInWall(e.x, e.y, currLen)) {
          const hp = Number(e.getData('hp') || 1)
          const newHp = Math.max(0, hp - damage)
          e.setData('hp', newHp)
          try { executeEffectByRef('fx.damageNumber', { scene: ctx.scene, caster: ctx.caster }, { x: e.x, y: e.y - 12, value: `${damage}`, element, crit: isCrit }) } catch {}
          if (newHp <= 0) {
            try {
              const anyScene: any = ctx.scene
              const award = Math.max(1, Math.floor(((e.getData('level') as number) || 1) * 5))
              anyScene.gainExperience?.(award)
              import('@/systems/Quests').then(qm => { (qm as any).notifyMonsterKilled?.(String(e.getData('configId') || '')); (anyScene as any).refreshQuestUI?.() })
              if (!(anyScene.__dropUtil)) { import('@/systems/DropSystem').then(mod => { anyScene.__dropUtil = mod }) }
              const util = anyScene.__dropUtil
              if (util?.playerKillDrop) util.playerKillDrop(anyScene, e.x, e.y, 0.1)
            } catch {}
            e.destroy()
          }
        }
        return true
      })
    }
  }

  // Timers
  const growEvt = ctx.scene.time.addEvent({ delay: 16, loop: true, callback: step })
  const dmgEvt = ctx.scene.time.addEvent({ delay: tickMs, loop: true, callback: damageTick })
  ctx.scene.time.delayedCall(durationMs, () => { try { growEvt.remove(false); dmgEvt.remove(false); g.destroy() } catch {} })
}


