import Phaser from 'phaser'

export type ActionSpec = { ref: string; params?: Record<string, any> }

type ActionHandler = (scene: Phaser.Scene, params?: Record<string, any>) => Promise<void> | void

const registry: Record<string, ActionHandler> = {}

export function registerAction(ref: string, handler: ActionHandler): void {
  registry[ref] = handler
}

export async function runActions(scene: Phaser.Scene, actions?: ActionSpec[] | null): Promise<void> {
  if (!Array.isArray(actions) || !actions.length) return
  for (const a of actions) {
    const fn = a && typeof a.ref === 'string' ? registry[a.ref] : undefined
    if (!fn) continue
    try { await fn(scene, a.params || {}) } catch (e) { try { console.warn('[ScriptRunner] action failed', a.ref, e) } catch {} }
  }
}

// Built-in actions
registerAction('waitMs', async (_scene, params) => {
  const ms = Math.max(0, Number(params?.ms ?? 0))
  if (ms <= 0) return
  await new Promise<void>(resolve => setTimeout(resolve, ms))
})

registerAction('grantQuest', async (scene, params) => {
  const id = String(params?.id || '')
  if (!id) return
  try { const mod = await import('./Quests'); (mod as any).acceptQuest?.(scene, id) } catch {}
})

registerAction('completeQuest', async (scene, params) => {
  const id = String(params?.id || '')
  if (!id) return
  try { const mod = await import('./Quests'); (mod as any).completeQuestIfReady?.(scene, id) } catch {}
})

registerAction('playGossip', async (scene: Phaser.Scene, params) => {
  const anyScene: any = scene as any
  const text = String(params?.text || '')
  const npcId = String(params?.npcId || '')
  let x = Number(params?.x ?? NaN)
  let y = Number(params?.y ?? NaN)
  if ((!Number.isFinite(x) || !Number.isFinite(y)) && npcId) {
    try {
      const list = (anyScene.npcs as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody[]) || []
      const found = list.find(s => `npc_${(s as any).name || ''}` === npcId)
      if (found) { x = found.x; y = found.y - 28 }
    } catch {}
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  const t = scene.add.text(x, y, text || '...', { fontFamily: 'monospace', color: '#ffd166' }).setOrigin(0.5)
  t.setDepth(1500)
  try { (scene.tweens as any).add({ targets: t, y: y - 20, alpha: 0, duration: 1200, onComplete: () => t.destroy() }) } catch { setTimeout(() => t.destroy(), 1200) }
})

registerAction('spawnEnemy', async (scene, params) => {
  const anyScene: any = scene as any
  const id = String(params?.monsterId || '')
  let x = Number(params?.x ?? NaN)
  let y = Number(params?.y ?? NaN)
  // Support spawning near an NPC id with optional dx/dy offsets
  const npcId = String(params?.npcId || '')
  const dx = Number(params?.dx ?? 16)
  const dy = Number(params?.dy ?? 0)
  if ((!Number.isFinite(x) || !Number.isFinite(y)) && npcId) {
    try {
      const list = (anyScene.npcs as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody[]) || []
      const found = list.find((s: any) => `npc_${(s.name || s.getData('name'))}` === npcId)
      if (found) { x = found.x + dx; y = found.y + dy }
    } catch {}
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    x = Number(anyScene.player?.x || 0)
    y = Number(anyScene.player?.y || 0)
  }
  if (!id || !anyScene.physics) return
  try {
    const mdb = await import('./MonsterDB')
    const cfg = (mdb as any).getMonster?.(id)
    const e = anyScene.physics.add.sprite(x, y, 'player').setTint(cfg?.tint ?? 0xff5555)
    e.body.setCircle(cfg?.bodyRadius ?? 12)
    try { if ((anyScene.lights as any)?.active) (e as any).setPipeline?.('Light2D') } catch {}
    e.setDataEnabled()
    e.setData('faction', 'enemy')
    e.setData('configId', id)
    const lvl = Number(anyScene.level || 1)
    const hp = Math.round((cfg?.hp || 10) * (1 + lvl * 0.5))
    const spd = Math.round((cfg?.speed || 80) * (1 + lvl * 0.02))
    e.setData('speed', spd)
    e.setData('hp', hp)
    e.setData('level', lvl)
    if (cfg?.params) Object.keys(cfg.params).forEach(k => e.setData(k, (cfg.params as any)[k]))
    if (cfg?.skills) e.setData('skills', cfg.skills)
    if (cfg?.tier) e.setData('tier', cfg.tier)
    anyScene.enemies?.add?.(e)
    try { const fx = await import('./Effects'); (fx as any).executeEffectByRef?.('fx.shadowBlob', { scene, caster: e as any }, { target: e, offsetY: 10, alpha: 0.28 }) } catch {}
  } catch {}
})

registerAction('spawnEnemies', async (scene, params) => {
  const count = Math.max(1, Number(params?.count ?? 1))
  const id = String(params?.monsterId || '')
  const cx = Number(params?.x ?? (params?.area?.x))
  const cy = Number(params?.y ?? (params?.area?.y))
  const radius = Number(params?.area?.radius ?? 100)
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2
    const r = Math.random() * radius
    const x = Number.isFinite(cx) ? cx + Math.cos(ang) * r : (scene as any).player?.x || 0
    const y = Number.isFinite(cy) ? cy + Math.sin(ang) * r : (scene as any).player?.y || 0
    await registry['spawnEnemy']?.(scene, { monsterId: id, x, y })
  }
})

// Open a temporary portal at coordinates (visual + overlap to teleport). Auto-destroys after durationMs.
registerAction('openPortal', async (scene, params) => {
  const anyScene: any = scene as any
  const x = Number(params?.x ?? (anyScene.player?.x || 0))
  const y = Number(params?.y ?? (anyScene.player?.y || 0))
  const destinationScene = String(params?.destinationScene || 'World')
  const destinationId = String(params?.destinationId || 'town')
  const life = Math.max(500, Number(params?.durationMs ?? 8000))
  const s = anyScene.physics?.add?.sprite(x, y, 'player')
  if (!s) return
  s.setTint(0x66ffcc)
  s.body.setCircle(12)
  try { if ((anyScene.lights as any)?.active) (s as any).setPipeline?.('Light2D') } catch {}
  anyScene.add.text(x, y - 30, params?.name || 'Portal', { fontFamily: 'monospace', color: '#aaf' }).setOrigin(0.5)
  try { const fx = await import('./Effects'); (fx as any).executeEffectByRef?.('fx.portalParticles', { scene, caster: s as any }, { x, y, colorOuter: 0x66e3ff, colorInner: 0x2a86ff, rate: 60 }) } catch {}
  const overlap = anyScene.physics.add.overlap(anyScene.player, s, () => {
    try {
      // Teleport using same logic as WorldScene.teleport
      const payload = { character: anyScene.character }
      if (destinationScene === 'World' && destinationId) { anyScene.scene.start('World', { ...payload, worldId: destinationId }) }
      else { anyScene.scene.start(destinationScene, { ...payload, portalId: destinationId }) }
    } catch {}
  })
  scene.time.delayedCall(life, () => { try { overlap?.destroy?.(); s.destroy() } catch {} })
})

// Move an NPC to a point, with optional speed and wait after arrival
registerAction('moveNpcTo', async (scene, params) => {
  const anyScene: any = scene as any
  const npcId = String(params?.npcId || '') // form: npc_<Name>
  const x = Number(params?.x)
  const y = Number(params?.y)
  const speed = Math.max(10, Number(params?.speed ?? 80))
  if (!npcId || !Number.isFinite(x) || !Number.isFinite(y)) return
  const npc = ((anyScene.npcs as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody[]) || []).find((s: any) => `npc_${(s.name || s.getData('name'))}` === npcId)
  if (!npc) return
  // Simple tween-based move
  const dist = Math.hypot(npc.x - x, npc.y - y)
  const duration = Math.max(1, Math.round((dist / speed) * 1000))
  await new Promise<void>(resolve => {
    try { scene.tweens.add({ targets: npc, x, y, duration, onComplete: () => resolve() }) } catch { resolve() }
  })
  const wait = Math.max(0, Number(params?.waitMs ?? 0))
  if (wait > 0) await new Promise<void>(r => setTimeout(r, wait))
})

// Force quest progress (e.g., scripted advancement)
registerAction('forceQuestProgress', async (_scene, params) => {
  const id = String(params?.id || '')
  const delta = Number(params?.delta ?? 1)
  if (!id) return
  try { const mod = await import('./Quests'); (mod as any).forceQuestProgress?.(id, delta) } catch {}
})

// Flags: set/get (get is via predicates in conversations; here we set)
registerAction('setFlag', async (_scene, params) => {
  const key = String(params?.key || '')
  const value = params?.value
  if (!key) return
  try { localStorage.setItem(`flag.${key}`, JSON.stringify(value)) } catch {}
})

// Dynamically import and run a module export for complex scripts
// params: { path: string, export?: string, args?: any }
registerAction('runModule', async (scene, params) => {
  const path = String(params?.path || '')
  const exportName = String(params?.export || 'default')
  const args = (params as any)?.args
  if (!path) return
  try {
    const mod: any = await import(/* @vite-ignore */ path)
    const fn = mod?.[exportName]
    if (typeof fn === 'function') {
      // Convention: fn(scene, args)
      await fn(scene, args)
    }
  } catch (e) {
    try { console.warn('[ScriptRunner] runModule failed', path, exportName, e) } catch {}
  }
})


