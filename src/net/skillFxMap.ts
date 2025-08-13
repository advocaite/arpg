import { executeEffectByRef } from '@/systems/Effects'

type Vec2 = { x: number; y: number }

function pickWallFxId(params: any): string {
  const el = String(params?.element || params?.kind || '').toLowerCase()
  if (el.includes('fire')) return 'fx.wall_fire'
  if (el.includes('cold') || el.includes('ice')) return 'fx.wall_cold'
  if (el.includes('lightning')) return 'fx.wall_lightning'
  if (el.includes('arcane')) return 'fx.wall_arcane'
  return 'fx.wall_fire'
}

const colorByElement: Record<string, number> = {
  fire: 0xff6a33,
  cold: 0x66ccff,
  ice: 0x66ccff,
  lightning: 0x99ccff,
  poison: 0x55ff77,
  arcane: 0xaa77ff,
  physical: 0xffddaa,
}

const fxMap: Record<string, (scene: Phaser.Scene, caster: Vec2, cursor: Vec2, p: any) => void> = {
  // Dash (movement)
  'skill_dash': (scene, caster, _cursor, p) => {
    executeEffectByRef('fx.additiveTrail', { scene, caster: {} as any }, { target: (scene as any).player, lifeMs: 220, intervalMs: 14, alpha: 0.6, scale: 1.0, maxGhosts: 14 })
  },
  // Projectiles
  'projectile_shoot': (scene, caster, _cursor, p) => {
    executeEffectByRef('fx.simpleFlash', { scene, caster: {} as any }, { x: caster.x, y: caster.y, color: colorByElement[String(p.element || 'arcane').toLowerCase()] || 0x88ccff, durationMs: 100 })
  },
  'projectile_ring': (scene, caster, _cursor, p) => {
    executeEffectByRef('fx.ringPulse', { scene, caster: {} as any }, { x: caster.x, y: caster.y, radius: Number(p.radius || 80), color: 0x77aaff, durationMs: 240 })
  },
  'skill_ring': (scene, caster, _cursor, p) => {
    executeEffectByRef('fx.ringPulse', { scene, caster: {} as any }, { x: caster.x, y: caster.y, radius: Number(p.radius || 80), color: 0x77aaff, durationMs: 240 })
  },
  'projectile_cone': (scene, caster, _cursor, p) => {
    executeEffectByRef('fx.sweepArc', { scene, caster: {} as any }, { x: caster.x, y: caster.y, radius: Number(p.radius || 90), color: 0x77aaff, durationMs: 200 })
  },
  // AoE / Pools
  'skill_poison_pool': (scene, _caster, cursor, p) => {
    executeEffectByRef('fx.sweepArc', { scene, caster: {} as any }, { x: cursor.x, y: cursor.y, radius: Number(p.radius || 60), color: colorByElement.poison, durationMs: Number(p.durationMs || 500) })
  },
  'aoe_pulse': (scene, caster, _cursor, p) => {
    executeEffectByRef('fx.ringPulse', { scene, caster: {} as any }, { x: caster.x, y: caster.y, radius: Number(p.radius || 80), color: 0xffaa66, durationMs: 200 })
  },
  // Ring
  
  // Lightning
  'skill_chain_lightning': (scene, caster, cursor, _p) => {
    executeEffectByRef('fx.lightningBolt', { scene, caster: {} as any }, { x1: caster.x, y1: caster.y, x2: cursor.x, y2: cursor.y, color: colorByElement.lightning, thickness: 2 })
  },
  // Walls by element
  'wall_fire': (scene, _caster, cursor, p) => {
    executeEffectByRef('fx.wall_fire', { scene, caster: {} as any }, { x: cursor.x, y: cursor.y, angle: Number(p.angle || 0), length: Number(p.length || 160), durationMs: Number(p.durationMs || 1400) })
  },
  'skill_shoot': (scene, caster, _cursor, p) => {
    executeEffectByRef('fx.simpleFlash', { scene, caster: {} as any }, { x: caster.x, y: caster.y, color: colorByElement[String(p.element || 'physical').toLowerCase()] || 0xffddaa, durationMs: 100 })
  },
  'skill_mine': (scene, caster, _cursor, p) => {
    executeEffectByRef('fx.sweepArc', { scene, caster: {} as any }, { x: caster.x, y: caster.y, radius: Number(p.radius || 80), color: colorByElement[String(p.element || 'arcane').toLowerCase()] || 0xaa77ff, durationMs: 180 })
  },
  'skill_cone_shot': (scene, caster, _cursor, p) => {
    executeEffectByRef('fx.sweepArc', { scene, caster: {} as any }, { x: caster.x, y: caster.y, radius: Number(p.spreadDeg || 50), color: 0x77aaff, durationMs: 200 })
  },
  'skill_poison_pool': (scene, _caster, cursor, p) => {
    executeEffectByRef('fx.sweepArc', { scene, caster: {} as any }, { x: cursor.x, y: cursor.y, radius: Number(p.radius || 90), color: Number(p.color || colorByElement.poison), durationMs: Number(p.durationMs || 5000) })
  },
  'skill_wall': (scene, _caster, cursor, p) => {
    const el = String(p.element || 'fire').toLowerCase()
    const fxId = el === 'cold' ? 'fx.wall_cold' : el === 'lightning' ? 'fx.wall_lightning' : el === 'arcane' ? 'fx.wall_arcane' : el === 'poison' ? 'fx.wall_poison' : 'fx.wall_fire'
    executeEffectByRef(fxId, { scene, caster: {} as any }, { x: cursor.x, y: cursor.y, angle: Number(p.angle || 0), length: Number(p.length || 200), durationMs: Number(p.durationMs || 3000) })
  },
  'skill_zigzag': (scene, caster, _cursor, p) => {
    executeEffectByRef('fx.simpleFlash', { scene, caster: {} as any }, { x: caster.x, y: caster.y, color: colorByElement[String(p.element || 'physical').toLowerCase()] || 0xffddaa, durationMs: 100 })
  },
  'skill_follow': (scene, caster, _cursor, p) => {
    executeEffectByRef('fx.simpleFlash', { scene, caster: {} as any }, { x: caster.x, y: caster.y, color: colorByElement[String(p.element || 'arcane').toLowerCase()] || 0xaa77ff, durationMs: 100 })
  },
  'wall_cold': (scene, _caster, cursor, p) => {
    executeEffectByRef('fx.wall_cold', { scene, caster: {} as any }, { x: cursor.x, y: cursor.y, angle: Number(p.angle || 0), length: Number(p.length || 160), durationMs: Number(p.durationMs || 1400) })
  },
  'wall_lightning': (scene, _caster, cursor, p) => {
    executeEffectByRef('fx.wall_lightning', { scene, caster: {} as any }, { x: cursor.x, y: cursor.y, angle: Number(p.angle || 0), length: Number(p.length || 160), durationMs: Number(p.durationMs || 1400) })
  },
  'wall_arcane': (scene, _caster, cursor, p) => {
    executeEffectByRef('fx.wall_arcane', { scene, caster: {} as any }, { x: cursor.x, y: cursor.y, angle: Number(p.angle || 0), length: Number(p.length || 160), durationMs: Number(p.durationMs || 1400) })
  },
}

export function playCastFx(scene: Phaser.Scene, casterPos: Vec2, skillId: string, cursor: Vec2, params?: any): void {
  const sid = String(skillId)
  const p = params || {}
  try {
    // Exact id match first
    const exact = fxMap[sid]
    if (exact) { exact(scene, casterPos, cursor, p); return }
    if (sid.includes('movement.dash') || sid.includes('dash')) {
      executeEffectByRef('fx.additiveTrail', { scene, caster: {} as any }, { target: (scene as any).player, lifeMs: 200, intervalMs: 16, alpha: 0.6, scale: 1.0, maxGhosts: 12 })
      return
    }
    if (sid.includes('lightning.chain') || sid.includes('chain')) {
      executeEffectByRef('fx.lightningBolt', { scene, caster: {} as any }, { x1: casterPos.x, y1: casterPos.y, x2: cursor.x, y2: cursor.y, color: 0x66ccff, thickness: 2 })
      return
    }
    if (sid.includes('wall')) {
      const fxId = pickWallFxId(p)
      const len = Number(p.length || 160)
      executeEffectByRef(fxId, { scene, caster: {} as any }, { x: Number(cursor.x), y: Number(cursor.y), angle: Number(p.angle || 0), length: len, durationMs: Number(p.durationMs || 1400) })
      return
    }
    if (sid.includes('pool') || sid.includes('aoe')) {
      executeEffectByRef('fx.sweepArc', { scene, caster: {} as any }, { x: Number(cursor.x), y: Number(cursor.y), radius: Number(p.radius || 48), color: 0x55ff77, durationMs: Number(p.durationMs || 300) })
      return
    }
    if (sid.includes('ring')) {
      executeEffectByRef('fx.ringPulse', { scene, caster: {} as any }, { x: casterPos.x, y: casterPos.y, radius: Number(p.radius || 80), color: 0x77aaff, durationMs: 220 })
      return
    }
    if (sid.includes('projectile') || sid.includes('shoot')) {
      // Projectiles are mirrored via snapshot dots; add a small muzzle flash
      executeEffectByRef('fx.simpleFlash', { scene, caster: {} as any }, { x: casterPos.x, y: casterPos.y, color: 0x88ccff, durationMs: 90 })
      return
    }
  } catch {}
}


