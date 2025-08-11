import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'
import { notifyMonsterKilled } from '@/systems/Quests'
import { executeEffectByRef } from '@/systems/Effects'

export const meta = { ref: 'projectile.shoot' }

export default function projectileShoot(ctx: PowerContext, args: PowerInvokeArgs): void {
  const speed = Number(args.params['speed'] ?? 300)
  const elementVal = String((args.params['element'] ?? ((args.skill as any)?.element ?? 'physical')))
  // Base damage scales with scene multipliers similar to melee
  const sceneAny: any = ctx.scene
  const base = 6 + Math.max(0, Number(sceneAny?.weaponFlatDamage || 0))
  const scaled = Math.max(1, Math.round(base * Math.max(0.1, Number(sceneAny?.damageMultiplier || 1))))
  const isCrit = Math.random() < Math.max(0, Number(sceneAny?.critChance || 0))
  const dmgFinal = isCrit ? Math.round(scaled * Math.max(1, Number(sceneAny?.critDamageMult || 1.5))) : scaled
  let nx = 1, ny = 0
  const ox = ctx.caster.x, oy = ctx.caster.y
  // Prefer explicit cursor direction if provided on context
  if ((ctx as any).cursor && typeof (ctx as any).cursor.x === 'number') {
    const dx = (ctx as any).cursor.x - ox, dy = (ctx as any).cursor.y - oy
    const d = Math.hypot(dx, dy) || 1
    nx = dx / d; ny = dy / d
  } else if (ctx.target) {
    const dx = ctx.target.x - ox, dy = ctx.target.y - oy
    const d = Math.hypot(dx, dy) || 1
    nx = dx / d; ny = dy / d
  }
  const p = (ctx.scene.physics as any).add.sprite(ox, oy, 'projectile')
  p.setDepth(1)
  // Tag projectile faction based on caster (player vs enemy)
  try {
    p.setDataEnabled()
    const casterFaction = (ctx.caster as any)?.getData?.('faction') || 'player'
    p.setData('faction', casterFaction)
    p.setData('element', elementVal)
    p.setData('source', 'ranged')
  } catch {}
  // Phaser sometimes needs physics body ready before setting velocity; defer one tick
  ctx.scene.time.delayedCall(0, () => { if ((p as any).active && (p as any).body) p.setVelocity(nx * speed, ny * speed) })
  ctx.projectiles?.add(p)
  const decayMs = Number(args.params['decayMs'] ?? 2000)
  ctx.scene.time.delayedCall(decayMs, () => p.destroy())
  try {
    // Only register enemy overlap when the projectile is from the player
    const isPlayerProj = ((p as any).getData?.('faction') || 'player') === 'player'
    if (isPlayerProj) (ctx.scene.physics as any).add.overlap(p, ctx.enemies, (_p: any, obj: any) => {
      const enemy = obj as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
      const hp = Number(enemy.getData('hp') || 1)
      const newHp = Math.max(0, hp - dmgFinal)
      enemy.setData('hp', newHp)
      try { executeEffectByRef('fx.damageNumber', { scene: ctx.scene, caster: ctx.caster }, { x: enemy.x, y: enemy.y - 10, value: `${dmgFinal}`, element: elementVal, crit: isCrit }) } catch {}
      // CC/Bleed application
      try {
        const anyScene: any = ctx.scene
        const roll = (p: number) => Math.random() < Math.max(0, Math.min(1, p))
        if (roll(anyScene.freezeChance || 0)) { (enemy.body as any).enable = false; executeEffectByRef('fx.flash', { scene: ctx.scene, caster: enemy as any }, { tint: 0x66ccff, durationMs: 250 }); ctx.scene.time.delayedCall(600, () => { try { (enemy.body as any).enable = true } catch {} }) }
        else if (roll(anyScene.stunChance || 0)) { (enemy.body as any).enable = false; executeEffectByRef('fx.flash', { scene: ctx.scene, caster: enemy as any }, { tint: 0xffff66, durationMs: 200 }); ctx.scene.time.delayedCall(500, () => { try { (enemy.body as any).enable = true } catch {} }) }
        if (roll(anyScene.confuseChance || 0)) { const vx = (Math.random() * 2 - 1) * 80, vy = (Math.random() * 2 - 1) * 80; try { (enemy as any).setVelocity?.(vx, vy) } catch {} ; executeEffectByRef('fx.flash', { scene: ctx.scene, caster: enemy as any }, { tint: 0xff66ff, durationMs: 150 }); ctx.scene.time.delayedCall(600, () => { try { (enemy as any).setVelocity?.(0, 0) } catch {} }) }
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
          try { notifyMonsterKilled(String(enemy.getData('configId') || '')); (anyScene as any).refreshQuestUI?.() } catch {}
          if (!(anyScene.__dropUtil)) { import('@/systems/DropSystem').then(mod => { anyScene.__dropUtil = mod }) }
          const util = anyScene.__dropUtil
          if (util?.playerKillDrop) util.playerKillDrop(anyScene, enemy.x, enemy.y, 0.1)
        } catch {}
        enemy.destroy()
      }
    })
  } catch {}
}


