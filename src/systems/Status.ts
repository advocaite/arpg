import Phaser from 'phaser'
import { executeEffectByRef } from '@/systems/Effects'

export function applyBleed(scene: any, target: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody, opts: { damagePerTick: number; ticks?: number; intervalMs?: number }): void {
  const dmg = Math.max(0, Math.floor(Number(opts.damagePerTick || 0)))
  if (dmg <= 0) return
  const ticks = Math.max(1, Math.floor(Number(opts.ticks ?? 3)))
  const intervalMs = Math.max(120, Math.floor(Number(opts.intervalMs ?? 400)))
  let remaining = ticks
  const evt = scene.time.addEvent({ delay: intervalMs, loop: true, callback: () => {
    try {
      if (!target || !(target as any).active) { evt.remove(false); return }
      const hp = Number(target.getData('hp') || 1)
      const after = Math.max(0, hp - dmg)
      target.setData('hp', after)
      try { executeEffectByRef('fx.damageNumber', { scene, caster: (scene.player as any) || target }, { x: (target as any).x, y: (target as any).y - 12, value: String(dmg), color: '#ff4444', durationMs: 380, element: 'physical' }) } catch {}
      if (after <= 0) {
        // Award XP, quests, and drops
        try {
          const award = Math.max(1, Math.floor((((target as any).getData?.('level') as number) || 1) * 5))
          scene.gainExperience?.(award)
          import('@/systems/Quests').then(qm => { (qm as any).notifyMonsterKilled?.(String((target as any).getData?.('configId') || '')); (scene as any).refreshQuestUI?.() })
          import('@/systems/DropSystem').then(mod => { (mod as any).playerKillDrop?.(scene, (target as any).x, (target as any).y, 0.1) })
        } catch {}
        try { (target as any).destroy?.() } catch {}
        evt.remove(false)
        return
      }
      remaining -= 1
      if (remaining <= 0) { evt.remove(false) }
    } catch { evt.remove(false) }
  } })
}


