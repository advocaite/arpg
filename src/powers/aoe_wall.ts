import Phaser from 'phaser'
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
  let element = String((args.params['element'] ?? (args.skill as any)?.element ?? 'fire'))
  const runeId = String(args.params['runeId'] || '')
  const rLong = Boolean(args.params['r_long_wall'])
  const rWide = Boolean(args.params['r_wide_wall'])
  const rFrost = Boolean(args.params['r_frost_wall'])
  const rLightning = Boolean(args.params['r_lightning_wall'])
  const rCursor = Boolean(args.params['r_cursor_wall'])

  // Ensure element reflects rune conversions from skills.json
  if (rLong) element = 'arcane'
  if (rWide) element = 'poison'
  if (rFrost) element = 'cold'
  if (rLightning) element = 'lightning'
  if (rCursor) element = 'physical'

  // Damage scaling
  const sceneAny: any = ctx.scene
  const base = 6 + Math.max(0, Number(sceneAny?.weaponFlatDamage || 0))
  const scaled = Math.max(1, Math.round(base * Math.max(0.1, Number(sceneAny?.damageMultiplier || 1))))
  const isCrit = Math.random() < Math.max(0, Number(sceneAny?.critChance || 0))
  let damage = isCrit ? Math.round(scaled * Math.max(1, Number(sceneAny?.critDamageMult || 1.5))) : scaled
  // Rune-based damage tweaks (+10%)
  if (rLong) damage = Math.round(damage * 1.1)
  if (rWide) damage = Math.round(damage * 1.1)

  // Visual: growing rectangle along direction (hidden by default; enable with params.showDebugRect)
  const g = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
  try { g.setVisible(Boolean(args.params['showDebugRect'])) } catch {}
  const startTs = ctx.scene.time.now

  // Visual effects for wall – created via effect modules for cleanliness
  let vfx: { update: (length: number) => void; destroy: () => void } | null = null

  const perpX = -dirY
  const perpY = dirX

  const drawWall = async (len: number) => {
    g.clear()
    g.fillStyle(color, 0.4)
    // Draw as a poly to avoid rotation state
    const halfWLocal = width / 2
    const aX = originX + perpX * (-halfWLocal)
    const aY = originY + perpY * (-halfWLocal)
    const bX = originX + perpX * (halfWLocal)
    const bY = originY + perpY * (halfWLocal)
    const cX = originX + dirX * len + perpX * (halfWLocal)
    const cY = originY + dirY * len + perpY * (halfWLocal)
    const dX = originX + dirX * len + perpX * (-halfWLocal)
    const dY = originY + dirY * len + perpY * (-halfWLocal)
    g.fillPoints([{ x: aX, y: aY }, { x: bX, y: bY }, { x: cX, y: cY }, { x: dX, y: dY }], true)

    // Place flame emitters along the current length at regular spacing
    const spacing = 28
    const needed = Math.max(1, Math.floor(len / spacing))
    // Ensure effect instance exists and update length
    if (!vfx) {
      if (element === 'cold') {
        const mod = await import('@/effects/wall_cold')
        vfx = (mod as any).default({ scene: ctx.scene } as any, { originX, originY, dirX, dirY, width })
      } else if (element === 'lightning') {
        const mod = await import('@/effects/wall_lightning')
        vfx = (mod as any).default({ scene: ctx.scene } as any, { originX, originY, dirX, dirY, width })
      } else if (element === 'poison') {
        const mod = await import('@/effects/wall_poison')
        vfx = (mod as any).default({ scene: ctx.scene } as any, { originX, originY, dirX, dirY, width })
      } else if (element === 'physical') {
        const mod = await import('@/effects/wall_physical')
        vfx = (mod as any).default({ scene: ctx.scene } as any, { originX, originY, dirX, dirY, width })
      } else if (element === 'arcane') {
        const mod = await import('@/effects/wall_arcane')
        vfx = (mod as any).default({ scene: ctx.scene } as any, { originX, originY, dirX, dirY, width })
      } else {
        const mod = await import('@/effects/wall_fire')
        vfx = (mod as any).default({ scene: ctx.scene } as any, { originX, originY, dirX, dirY, width, color })
      }
    }
    try { vfx?.update(len) } catch {}
  }

  const pointInWall = (ex: number, ey: number, len: number): boolean => {
    const relX = ex - originX
    const relY = ey - originY
    const localX = relX * dirX + relY * dirY // along wall
    const localY = relX * perpX + relY * perpY // across wall
    return localX >= 0 && localX <= len && Math.abs(localY) <= width / 2
  }

  // Animate growth, then keep at max until duration ends
  const step = async () => {
    const now = ctx.scene.time.now
    const elapsed = now - startTs
    const frac = Math.max(0, Math.min(1, growMs > 0 ? elapsed / growMs : 1))
    const currLen = Math.round(length * frac)
    await drawWall(currLen)
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
          let newHp = Math.max(0, hp - damage)
          e.setData('hp', newHp)
          try { executeEffectByRef('fx.damageNumber', { scene: ctx.scene, caster: ctx.caster }, { x: e.x, y: e.y - 12, value: `${damage}`, element, crit: isCrit }) } catch {}
          // Rune side-effects
          // Extra freeze chance for frost rune
          if (rFrost && Math.random() < 0.10) {
            try {
              (e.body as any).enable = false
              executeEffectByRef('fx.flash', { scene: ctx.scene, caster: e as any }, { tint: 0x66ccff, durationMs: 240 })
              ctx.scene.time.delayedCall(700, () => { try { (e.body as any).enable = true } catch {} })
            } catch {}
          }
          // Cold element baseline: strongly slow enemies while inside the wall area
          if (element === 'cold') {
            try {
              const bv = (e.body as any).velocity || { x: 0, y: 0 }
              ;(e as any).setVelocity?.(bv.x * 0.15, bv.y * 0.15)
            } catch {}
          }
          // Mild push outward for arcane variant
          if (element === 'arcane') {
            try {
              const nx = (e.x - originX), ny = (e.y - originY)
              const mag = Math.hypot(nx, ny) || 1
              const push = 60
              ;(e as any).setVelocity?.(nx / mag * push, ny / mag * push)
            } catch {}
          }
          // Lightning rune: random crackle strikes do bonus damage, gated by per-enemy cooldown
          if (rLightning) {
            const nowT = ctx.scene.time.now
            const cdUntil = Number(e.getData('lw_shockUntil') || 0)
            if (nowT >= cdUntil && Math.random() < 0.18) {
              try {
                const ox = e.x - (perpX * 10), oy = e.y - (perpY * 10)
                executeEffectByRef('fx.lightningBolt', { scene: ctx.scene, caster: e as any }, { x1: ox, y1: oy, x2: e.x, y2: e.y })
              } catch {}
              const extra = Math.round(damage * 2)
              newHp = Math.max(0, newHp - extra)
              e.setData('hp', newHp)
              try { executeEffectByRef('fx.damageNumber', { scene: ctx.scene, caster: ctx.caster }, { x: e.x + 6, y: e.y - 18, value: `${extra}`, element: 'lightning', crit: false }) } catch {}
              e.setData('lw_shockUntil', nowT + 450)
            }
          }
          // Poison element baseline: apply a small poison DoT on hit (once per enemy while inside)
          if (element === 'poison') {
            const nowT = ctx.scene.time.now
            const cdUntil = Number(e.getData('pw_poisonUntil') || 0)
            if (nowT >= cdUntil) {
              try {
                const perTick = Math.max(1, Math.floor(damage * 0.25))
                import('@/systems/Status').then(mod => { (mod as any).applyBleed?.(ctx.scene, e as any, { damagePerTick: perTick, ticks: 3, intervalMs: 500 }) })
              } catch {}
              e.setData('pw_poisonUntil', nowT + 1000)
            }
          }
          // Fire element baseline: small bleed chance on hit
          if (element === 'fire' && Math.random() < 0.05) {
            try {
              const perTick = Math.max(1, Math.floor(damage * 0.2))
              import('@/systems/Status').then(mod => { (mod as any).applyBleed?.(ctx.scene, e as any, { damagePerTick: perTick, ticks: 2, intervalMs: 380 }) })
            } catch {}
          }
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
  ctx.scene.time.delayedCall(durationMs, () => {
    try { growEvt.remove(false); dmgEvt.remove(false); g.destroy() } catch {}
    try { vfx?.destroy() } catch {}
  })
}


