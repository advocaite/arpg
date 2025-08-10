import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.damageNumber' }

const ELEMENT_COLORS: Record<string, string> = {
  physical: '#ffd166',
  fire: '#ff6b6b',
  cold: '#77ddff',
  lightning: '#66ccff',
  poison: '#77ff77',
  arcane: '#c792ea',
}

const ELEMENT_CRIT_COLORS: Record<string, string> = {
  physical: '#ffe28a',
  fire: '#ff9a6b',
  cold: '#b0ecff',
  lightning: '#9ad7ff',
  poison: '#a7ff9a',
  arcane: '#e1b0ff',
}

export default function damageNumber(ctx: EffectContext, params?: Record<string, number | string | boolean>): void {
  const x = Number(params?.['x'] ?? ctx.caster.x)
  const y = Number(params?.['y'] ?? ctx.caster.y)
  const value = String(params?.['value'] ?? '')
  const element = String(params?.['element'] ?? '')
  const crit = Boolean(params?.['crit'] ?? false)
  const fallback = String(params?.['color'] ?? (ELEMENT_COLORS[element] || '#ffffff'))
  const dur = Number(params?.['durationMs'] ?? 500)
  const float = Number(params?.['float'] ?? 18)

  // Style tweaks for crit
  const color = crit ? (ELEMENT_CRIT_COLORS[element] || '#ffec99') : fallback
  const fontSize = crit ? '16px' : '14px'
  const t = (ctx.scene.add as any).text(x, y, value, { fontFamily: 'monospace', color, fontSize }).setDepth(900)
  if (crit) {
    const glow = ELEMENT_CRIT_COLORS[element] || '#ffd166'
    try { (t as any).setShadow(0, 0, glow, 6, true, true) } catch {}
    try { (t as any).setStroke('#000000', 2) } catch {}
    try { (t as any).setScale(1.15) } catch {}
  }
  const targetY = y - float
  ;(ctx.scene.tweens as any).add({ targets: t, y: targetY, alpha: 0, duration: dur, ease: 'Quad.easeOut', onComplete: () => t.destroy() })
}


