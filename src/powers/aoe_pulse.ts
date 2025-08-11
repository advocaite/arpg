import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'
import { executeEffectByRef } from '@/systems/Effects'
import { notifyMonsterKilled } from '@/systems/Quests'

export const meta = { ref: 'aoe.pulse' }

export default function aoePulse(ctx: PowerContext, args: PowerInvokeArgs): void {
  const x = Number(args.params['x'] ?? ctx.caster.x)
  const y = Number(args.params['y'] ?? ctx.caster.y)
  const radius = Number(args.params['radius'] ?? 60)
  const damage = Math.max(1, Number(args.params['damage'] ?? 4))
  const color = Number(args.params['color'] ?? 0xffaa66)
  const duration = Number(args.params['durationMs'] ?? 120)

  try { executeEffectByRef('fx.aoePulse', { scene: ctx.scene, caster: ctx.caster }, { x, y, radius, color, durationMs: duration }) } catch {}

  // Damage enemies and award XP on kills
  if (ctx.enemies) {
    ctx.enemies.children.iterate((child: any) => {
      const e = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
      if (!e || !e.body) return true
      const dx = e.x - x, dy = e.y - y
      if (Math.hypot(dx, dy) <= radius) {
        const hp = Number(e.getData('hp') || 1)
        const newHp = Math.max(0, hp - damage)
        e.setData('hp', newHp)
        // CC/Bleed hooks
        try {
          const anyScene: any = ctx.scene
          const roll = (p: number) => Math.random() < Math.max(0, Math.min(1, p))
          if (roll(anyScene.freezeChance || 0)) { (e.body as any).enable = false; executeEffectByRef('fx.flash', { scene: ctx.scene, caster: e as any }, { tint: 0x66ccff, durationMs: 250 }); ctx.scene.time.delayedCall(600, () => { try { (e.body as any).enable = true } catch {} }) }
          else if (roll(anyScene.stunChance || 0)) { (e.body as any).enable = false; executeEffectByRef('fx.flash', { scene: ctx.scene, caster: e as any }, { tint: 0xffff66, durationMs: 200 }); ctx.scene.time.delayedCall(500, () => { try { (e.body as any).enable = true } catch {} }) }
          if (roll(anyScene.confuseChance || 0)) { const vx = (Math.random() * 2 - 1) * 80, vy = (Math.random() * 2 - 1) * 80; try { (e as any).setVelocity?.(vx, vy) } catch {}; executeEffectByRef('fx.flash', { scene: ctx.scene, caster: e as any }, { tint: 0xff66ff, durationMs: 150 }); ctx.scene.time.delayedCall(600, () => { try { (e as any).setVelocity?.(0, 0) } catch {} }) }
          if (roll(anyScene.bleedChance || 0)) { const bleed = Math.max(0, Math.floor(Number(anyScene.bleedDamageFlat || 0))); if (bleed > 0) { import('@/systems/Status').then(mod => { (mod as any).applyBleed?.(ctx.scene, e, { damagePerTick: bleed, ticks: 3, intervalMs: 450 }) }) } }
        } catch {}
        // Item procs on hit (AoE)
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
            try { console.log('[Kill] aoe_pulse death', { monsterId: String(e.getData('configId')||''), level: e.getData('level'), damage }) } catch {}
            const healKill = Math.max(0, Number(anyScene.healthOnKill || 0))
            if (healKill > 0) {
              anyScene.playerHp = Math.min(anyScene.maxHp, anyScene.playerHp + healKill)
              anyScene.hpText?.setText(`HP: ${anyScene.playerHp}`)
              anyScene.orbs?.update(anyScene.playerHp, anyScene.maxHp, anyScene.mana, anyScene.maxMana || 100)
            }
            anyScene.gainExperience?.(Math.max(1, Math.floor(((e.getData('level') as number) || 1) * 5)))
            // Notify quest system of kill
            try { notifyMonsterKilled(String(e.getData('configId') || '')); (anyScene as any).refreshQuestUI?.() } catch {}
            // Drop chance hook for AoE kills (lazy-load once)
            try {
              if (!(anyScene.__dropUtil)) {
                import('@/systems/DropSystem').then(mod => { anyScene.__dropUtil = mod })
              }
              const util = anyScene.__dropUtil
              if (util?.playerKillDrop) util.playerKillDrop(anyScene, e.x, e.y, 0.1)
            } catch {}
            // damage number at AoE kill position
            executeEffectByRef('fx.damageNumber', { scene: ctx.scene, caster: ctx.caster }, { x: e.x, y: e.y - 10, value: `${damage}`, element: 'physical' })
          } catch {}
          e.destroy()
        }
      }
      return true
    })
  }
}


