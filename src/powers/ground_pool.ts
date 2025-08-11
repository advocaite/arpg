import { notifyMonsterKilled } from '@/systems/Quests'
import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'

export const meta = { ref: 'ground.pool' }

export default function groundPool(ctx: PowerContext, args: PowerInvokeArgs): void {
  const radius = Number(args.params['radius'] ?? 80)
  const durationMs = Number(args.params['durationMs'] ?? 4000)
  const tickMs = Math.max(100, Number(args.params['tickMs'] ?? 500))
  const dps = Number(args.params['dps'] ?? 5)
  const color = Number(args.params['color'] ?? 0x55ff66)
  const element = String((args.params['element'] ?? args.skill.element ?? 'poison'))

  const x = (ctx as any).cursor?.x ?? ctx.caster.x
  const y = (ctx as any).cursor?.y ?? ctx.caster.y

  // Visual: persistent colored circle that gently pulses
  const g = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
  g.fillStyle(color, 0.28)
  g.fillCircle(x, y, radius)
  const tween = (ctx.scene.tweens as any).add({ targets: g, alpha: 0.18, yoyo: true, repeat: Math.floor(durationMs / 300), duration: 300 })

  // Periodic damage ticks
  const ticks = Math.max(1, Math.floor(durationMs / tickMs))
  for (let i = 1; i <= ticks; i++) {
    ctx.scene.time.delayedCall(i * tickMs, () => {
      // AoE damage application to whoever listens (e.g., player damage resolver)
      if (ctx.onAoeDamage) { ctx.onAoeDamage(x, y, radius, dps, { element, source: 'spell' }) }
      // Item procs on tick
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
      // Optional lightning shocks if rune/params set
      const shock = Boolean(args.params['shock'])
      if (shock && ctx.enemies) {
        const shockCount = Number(args.params['shockCount'] ?? 2)
        const shockRange = Number(args.params['shockRange'] ?? radius + 120)
        const enemies = (ctx.enemies.children as any).entries || []
        let shocks = 0
        for (const obj of enemies) {
          if (shocks >= shockCount) break
          const e = obj as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
          if (!e || !(e as any).active) continue
          const dx = e.x - x, dy = e.y - y
          if (Math.hypot(dx, dy) <= shockRange) {
            // simple visual
            try {
              const gg = (ctx.scene.add as any).graphics({ x: 0, y: 0 })
              gg.lineStyle(2, 0x66ccff, 0.9); gg.beginPath(); gg.moveTo(x, y); gg.lineTo(e.x, e.y); gg.strokePath(); ctx.scene.time.delayedCall(90, () => gg.destroy())
            } catch {}
            const dd = Math.max(1, Math.floor(dps * 0.6))
            if (ctx.onAoeDamage) {
              ctx.onAoeDamage(e.x, e.y, 0, dd, { element: 'lightning', source: 'spell' })
            } else {
              const hp = Number(e.getData('hp') || 1)
              const newHp = Math.max(0, hp - dd)
              e.setData('hp', newHp)
              if (newHp <= 0) {
                const anyScene: any = ctx.scene
                const award = Math.max(1, Math.floor(((e.getData('level') as number) || 1) * 5))
                anyScene.gainExperience?.(award)
                try { notifyMonsterKilled(String(e.getData('configId') || '')); (anyScene as any).refreshQuestUI?.() } catch {}
                if (!(anyScene.__dropUtil)) { import('@/systems/DropSystem').then(mod => { anyScene.__dropUtil = mod }) }
                const util = anyScene.__dropUtil
                if (util?.playerKillDrop) util.playerKillDrop(anyScene, e.x, e.y, 0.1)
                e.destroy()
              }
            }
            shocks++
          }
        }
      }
    })
  }

  // Cleanup
  ctx.scene.time.delayedCall(durationMs + 50, () => { try { tween?.stop(); g.destroy() } catch {} })
}


