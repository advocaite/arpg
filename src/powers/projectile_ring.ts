import type { PowerContext, PowerInvokeArgs } from '@/systems/Powers'
import { notifyMonsterKilled } from '@/systems/Quests'
import { executeEffectByRef } from '@/systems/Effects'

export const meta = { ref: 'projectile.ring' }

export default function projectileRing(ctx: PowerContext, args: PowerInvokeArgs): void {
  const count = Number(args.params['count'] ?? 12)
  const speed = Number(args.params['speed'] ?? 280)
  const decayMs = Number(args.params['decayMs'] ?? 3000)
  const element = String((args.params['element'] ?? (args.skill as any)?.element ?? 'physical'))
  const orbit = Boolean(args.params['orbit'])
  const orbitRadius = Number(args.params['orbitRadius'] ?? 48)
  const orbitSpeedDeg = Number(args.params['orbitSpeedDeg'] ?? 180) // degrees/sec
  const healOnHit = Math.max(0, Number(args.params['healOnHit'] ?? 0))
  const ox = ctx.caster.x, oy = ctx.caster.y
  // Choose a projectile group: prefer ctx.projectiles, else scene.projectiles if present
  const projGroup: Phaser.Physics.Arcade.Group | undefined = (ctx.projectiles as any) || ((ctx.scene as any).projectiles as any)
  if (!projGroup) {
    try { (ctx.scene as any).console?.warn?.('[Power] projectile_ring: no projectile group available'); } catch {}
  }
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count
    const nx = Math.cos(angle), ny = Math.sin(angle)
    const p = (ctx.scene.physics as any).add.sprite(ox, oy, 'projectile')
    p.setDepth(1)
    try { p.setDataEnabled(); p.setData('faction', 'player'); p.setData('element', element); p.setData('source', 'ranged') } catch {}
    if (!orbit) {
      // Fire outward
      ctx.scene.time.delayedCall(0, () => { if ((p as any).active && (p as any).body) p.setVelocity(nx * speed, ny * speed) })
    } else {
      // Orbit around the caster
      const startAng = angle
      const createdAt = ctx.scene.time.now
      const updater = () => {
        if (!(p as any).active) return
        const now = ctx.scene.time.now
        const elapsedSec = (now - createdAt) / 1000
        const ang = startAng + (orbitSpeedDeg * Math.PI / 180) * elapsedSec
        p.setPosition(ctx.caster.x + Math.cos(ang) * orbitRadius, ctx.caster.y + Math.sin(ang) * orbitRadius)
      }
      // Update every frame
      const evt = ctx.scene.time.addEvent({ delay: 16, loop: true, callback: updater })
      ctx.scene.time.delayedCall(decayMs, () => { try { evt.remove(false) } catch {}; p.destroy() })
    }
    if (projGroup) projGroup.add(p)
    if (!orbit) ctx.scene.time.delayedCall(decayMs, () => p.destroy())
    // Register overlap to apply damage and detect kills
    try {
      (ctx.scene.physics as any).add.overlap(p, ctx.enemies, (_p: any, obj: any) => {
        const enemy = obj as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
        const hp = Number(enemy.getData('hp') || 1)
        const sceneAny: any = ctx.scene
        const base = 4 + Math.max(0, Number(sceneAny?.weaponFlatDamage || 0))
        const scaled = Math.max(1, Math.round(base * Math.max(0.1, Number(sceneAny?.damageMultiplier || 1))))
        const isCrit = Math.random() < Math.max(0, Number(sceneAny?.critChance || 0))
        const dmg = isCrit ? Math.round(scaled * Math.max(1, Number(sceneAny?.critDamageMult || 1.5))) : scaled
        const newHp = Math.max(0, hp - dmg)
        enemy.setData('hp', newHp)
        try { executeEffectByRef('fx.damageNumber', { scene: ctx.scene, caster: ctx.caster }, { x: enemy.x, y: enemy.y - 10, value: `${dmg}`, element, crit: isCrit }) } catch {}
        // Heal on hit (orbit rune behavior)
        if (healOnHit > 0) {
          try {
            const anyScene: any = ctx.scene
            anyScene.playerHp = Math.min(anyScene.maxHp, anyScene.playerHp + healOnHit)
            anyScene.hpText?.setText(`HP: ${anyScene.playerHp}`)
            anyScene.orbs?.update(anyScene.playerHp, anyScene.maxHp, anyScene.mana, anyScene.maxMana || 100)
          } catch {}
        }
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
}


