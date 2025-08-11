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


