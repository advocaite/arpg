import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'
import { executeEffectByRef } from '@/systems/Effects'

export const meta = { ref: 'projectile.cone' }

export default function projectileCone(ctx: PowerContext, args: PowerInvokeArgs): void {
  const count = Math.max(1, Number(args.params['count'] ?? 3))
  const spreadDeg = Number(args.params['spreadDeg'] ?? 40)
  const speed = Number(args.params['speed'] ?? 300)
  const decayMs = Number(args.params['decayMs'] ?? 1800)
  const ox = ctx.caster.x, oy = ctx.caster.y
  if (!ctx.projectiles) return

  // Aim direction: towards target if any, else to the right
  let aimX = 1, aimY = 0
  if (ctx.target) { const dx = ctx.target.x - ox, dy = ctx.target.y - oy; const d = Math.hypot(dx, dy) || 1; aimX = dx / d; aimY = dy / d }
  const aimAng = Math.atan2(aimY, aimX)
  const spreadRad = (spreadDeg * Math.PI) / 180
  const start = aimAng - spreadRad / 2
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    const ang = start + t * spreadRad
    const nx = Math.cos(ang), ny = Math.sin(ang)
    const p = (ctx.scene.physics as any).add.sprite(ox, oy, 'projectile')
    p.setDepth(1)
    try { p.setDataEnabled(); p.setData('faction', 'player'); p.setData('element', String((args.skill as any)?.element || 'physical')); p.setData('source', 'ranged') } catch {}
    ctx.projectiles.add(p)
    p.setVelocity(nx * speed, ny * speed)
    ctx.scene.time.delayedCall(decayMs, () => p.destroy())
    // Add overlap for kill accounting similar to projectile_shoot
    try {
      (ctx.scene.physics as any).add.overlap(p, ctx.enemies, (_p: any, obj: any) => {
        const enemy = obj as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
        const hp = Number(enemy.getData('hp') || 1)
        const sceneAny: any = ctx.scene
        const base = 5 + Math.max(0, Number(sceneAny?.weaponFlatDamage || 0))
        const scaled = Math.max(1, Math.round(base * Math.max(0.1, Number(sceneAny?.damageMultiplier || 1))))
        const isCrit = Math.random() < Math.max(0, Number(sceneAny?.critChance || 0))
        const dmg = isCrit ? Math.round(scaled * Math.max(1, Number(sceneAny?.critDamageMult || 1.5))) : scaled
        const newHp = Math.max(0, hp - dmg)
        enemy.setData('hp', newHp)
        try { executeEffectByRef('fx.damageNumber', { scene: ctx.scene, caster: ctx.caster }, { x: enemy.x, y: enemy.y - 10, value: `${dmg}`, element: String((args.skill as any)?.element || 'physical'), crit: isCrit }) } catch {}
        // CC/Bleed hooks
        try {
          const anyScene: any = ctx.scene
          const roll = (p: number) => Math.random() < Math.max(0, Math.min(1, p))
          if (roll(anyScene.freezeChance || 0)) { (enemy.body as any).enable = false; executeEffectByRef('fx.flash', { scene: ctx.scene, caster: enemy as any }, { tint: 0x66ccff, durationMs: 250 }); ctx.scene.time.delayedCall(600, () => { try { (enemy.body as any).enable = true } catch {} }) }
          else if (roll(anyScene.stunChance || 0)) { (enemy.body as any).enable = false; executeEffectByRef('fx.flash', { scene: ctx.scene, caster: enemy as any }, { tint: 0xffff66, durationMs: 200 }); ctx.scene.time.delayedCall(500, () => { try { (enemy.body as any).enable = true } catch {} }) }
          if (roll(anyScene.confuseChance || 0)) { const vx = (Math.random() * 2 - 1) * 80, vy = (Math.random() * 2 - 1) * 80; try { (enemy as any).setVelocity?.(vx, vy) } catch {}; executeEffectByRef('fx.flash', { scene: ctx.scene, caster: enemy as any }, { tint: 0xff66ff, durationMs: 150 }); ctx.scene.time.delayedCall(600, () => { try { (enemy as any).setVelocity?.(0, 0) } catch {} }) }
          if (roll(anyScene.bleedChance || 0)) { const bleed = Math.max(0, Math.floor(Number(anyScene.bleedDamageFlat || 0))); if (bleed > 0) { import('@/systems/Status').then(mod => { (mod as any).applyBleed?.(ctx.scene, enemy, { damagePerTick: bleed, ticks: 3, intervalMs: 450 }) }) } }
        } catch {}
        // Item procs on hit
        try {
          const sceneAny: any = ctx.scene
          if (Array.isArray(sceneAny.itemProcs) && sceneAny.itemProcs.length) {
            let exec = (sceneAny.__execPower as any)
            if (typeof exec !== 'function') { import('@/systems/Powers').then((mod) => { sceneAny.__execPower = (mod as any).executePowerByRef }) }
            exec = (sceneAny.__execPower as any)
            for (const pr of sceneAny.itemProcs) {
              if (Math.random() < (pr.procChance || 0)) {
                if (typeof exec === 'function') {
                  exec(pr.powerRef, { scene: ctx.scene, caster: ctx.caster, enemies: ctx.enemies }, { skill: { id: pr.powerRef, name: 'Proc', type: 'aoe' } as any, params: pr.powerParams || {} })
                }
              }
            }
          }
        } catch {}
        if (newHp <= 0) {
          try {
            const anyScene: any = ctx.scene
            const award = Math.max(1, Math.floor(((enemy.getData('level') as number) || 1) * 5))
            anyScene.gainExperience?.(award)
            try { import('@/systems/Quests').then(qm => { (qm as any).notifyMonsterKilled?.(String(enemy.getData('configId') || '')); (anyScene as any).refreshQuestUI?.() }) } catch {}
            if (!(anyScene.__dropUtil)) { import('@/systems/DropSystem').then(mod => { anyScene.__dropUtil = mod }) }
            const util = anyScene.__dropUtil
            if (util?.playerKillDrop) util.playerKillDrop(anyScene, enemy.x, enemy.y, 0.1)
          } catch {}
          enemy.destroy()
        }
      })
    } catch {}
  }
}


