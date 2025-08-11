import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'
import { executeEffectByRef } from '@/systems/Effects'
import { notifyMonsterKilled } from '@/systems/Quests'

export const meta = { ref: 'melee.swing' }

export default function meleeSwing(ctx: PowerContext, args: PowerInvokeArgs): void {
  const offset = Number(args.params['offset'] ?? 28)
  const damage = Math.max(1, Number(args.params['damage'] ?? 8))
  const dirAng = Number(args.params['angle'] ?? 0)
  const durationMs = Number(args.params['durationMs'] ?? 100)
  const radius = Number(args.params['radius'] ?? 28)
  const spreadDeg = Number(args.params['spreadDeg'] ?? 45)
  const crit = Boolean(args.params['isCrit'])
  const dmgColor = crit ? '#ff66ff' : '#ffd166'

  // Draw the sweep arc once for visuals
  try { executeEffectByRef('fx.sweepArc', { scene: ctx.scene, caster: ctx.caster }, { radius: radius + offset, angle: dirAng, spreadDeg, color: crit ? 0xff66ff : 0xffd166 }) } catch {}

  if (!ctx.enemies) return
  // Iterate enemies; apply arc/distance filter and damage
  ctx.enemies.children.iterate((child): boolean => {
    const target = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined
    if (!target || !target.body || (target as any).isInvulnerable) return true
    const dx = target.x - ctx.caster.x
    const dy = target.y - ctx.caster.y
    const dist = Math.hypot(dx, dy)
    if (dist > radius + offset) return true
    const angTo = Math.atan2(dy, dx)
    const diff = Phaser.Math.Angle.Wrap(angTo - dirAng)
    if (Math.abs(Phaser.Math.RadToDeg(diff)) > spreadDeg / 2) return true

    const hp = Number(target.getData('hp') || 1)
    const newHp = Math.max(0, hp - damage)
    target.setData('hp', newHp)
    try { executeEffectByRef('fx.damageNumber', { scene: ctx.scene, caster: ctx.caster }, { x: target.x, y: target.y - 10, value: `${damage}`, color: dmgColor, durationMs: 450, element: String((args.skill as any)?.element || 'physical'), crit }) } catch {}
    // Item procs on hit
    try {
      const sceneAny: any = ctx.scene
      if (Array.isArray(sceneAny.itemProcs)) {
        let exec = (sceneAny.__execPower as any)
        if (typeof exec !== 'function') { import('@/systems/Powers').then((mod) => { sceneAny.__execPower = (mod as any).executePowerByRef }) }
        exec = (sceneAny.__execPower as any)
        for (const p of sceneAny.itemProcs) {
          if (Math.random() < (p.procChance || 0)) {
            if (typeof exec === 'function') exec(p.powerRef, { scene: ctx.scene, caster: ctx.caster, enemies: ctx.enemies }, { skill: { id: p.powerRef, name: 'Proc', type: 'aoe' } as any, params: p.powerParams || {} })
          }
        }
      }
    } catch {}
    // Crowd-control and bleed rolls
    try {
      const anyScene: any = ctx.scene
      const roll = (p: number) => Math.random() < Math.max(0, Math.min(1, p))
      if (roll(anyScene.freezeChance || 0)) {
        (target.body as any).enable = false
        executeEffectByRef('fx.flash', { scene: ctx.scene, caster: target as any }, { tint: 0x66ccff, durationMs: 250 })
        ctx.scene.time.delayedCall(600, () => { try { (target.body as any).enable = true } catch {} })
      } else if (roll(anyScene.stunChance || 0)) {
        (target.body as any).enable = false
        executeEffectByRef('fx.flash', { scene: ctx.scene, caster: target as any }, { tint: 0xffff66, durationMs: 200 })
        ctx.scene.time.delayedCall(500, () => { try { (target.body as any).enable = true } catch {} })
      }
      if (roll(anyScene.confuseChance || 0)) {
        // Apply brief erratic movement
        const vx = (Math.random() * 2 - 1) * 80, vy = (Math.random() * 2 - 1) * 80
        try { (target as any).setVelocity?.(vx, vy) } catch {}
        executeEffectByRef('fx.flash', { scene: ctx.scene, caster: target as any }, { tint: 0xff66ff, durationMs: 150 })
        ctx.scene.time.delayedCall(600, () => { try { (target as any).setVelocity?.(0, 0) } catch {} })
      }
      if (roll(anyScene.bleedChance || 0)) {
        const bleed = Math.max(0, Math.floor(Number(anyScene.bleedDamageFlat || 0)))
        if (bleed > 0) {
          import('@/systems/Status').then(mod => { (mod as any).applyBleed?.(ctx.scene, target, { damagePerTick: bleed, ticks: 3, intervalMs: 450 }) })
        }
      }
    } catch {}

    if (newHp <= 0) {
      try {
        const anyScene: any = ctx.scene
        try { console.log('[Kill] melee death', { monsterId: String(target.getData('configId')||''), level: target.getData('level'), damage }) } catch {}
        const healKill = Math.max(0, Number(anyScene.healthOnKill || 0))
        if (healKill > 0) {
          anyScene.playerHp = Math.min(anyScene.maxHp, anyScene.playerHp + healKill)
          anyScene.hpText?.setText(`HP: ${anyScene.playerHp}`)
          anyScene.orbs?.update(anyScene.playerHp, anyScene.maxHp, anyScene.mana, anyScene.maxMana || 100)
        }
        const award = Math.max(1, Math.floor(((target.getData('level') as number) || 1) * 5))
        anyScene.gainExperience?.(award)
        try { notifyMonsterKilled(String(target.getData('configId') || '')); (anyScene as any).refreshQuestUI?.() } catch {}
        try {
          if (!(anyScene.__dropUtil)) { import('@/systems/DropSystem').then(mod => { anyScene.__dropUtil = mod }) }
          const util = anyScene.__dropUtil
          if (util?.playerKillDrop) util.playerKillDrop(anyScene, target.x, target.y, 0.1)
        } catch {}
      } catch {}
      target.destroy()
    }
    return true
  })
}


