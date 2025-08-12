import type Phaser from 'phaser'

export type ConversationActionParams = Record<string, number | string | boolean>

// Action registry for conversation-driven scripted hooks
type ActionHandler = (scene: Phaser.Scene, npc: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined, params: ConversationActionParams) => void

const registry: Record<string, ActionHandler> = {}

export function registerConversationAction(ref: string, handler: ActionHandler): void { registry[ref] = handler }

export function runConversationAction(scene: Phaser.Scene, npc: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined, ref: string, params: ConversationActionParams): void {
  const fn = registry[ref]
  if (!fn) return
  try { fn(scene, npc, params) } catch {}
}

// Built-in: move NPC to a location, then open a portal
registerConversationAction('npc.moveToAndOpenPortal', (scene, npc, params) => {
  const anyScene: any = scene
  const x = Number(params['x'] ?? (anyScene.player?.x || 0))
  const y = Number(params['y'] ?? (anyScene.player?.y || 0))
  const durationMs = Math.max(50, Number(params['durationMs'] ?? 1200))
  const portalName = String(params['portalName'] ?? 'Portal')
  const destinationScene = String(params['destinationScene'] ?? 'World')
  const destinationId = String(params['destinationId'] ?? 'dungeon_world')
  if (npc) {
    const dx = x - npc.x, dy = y - npc.y
    const dist = Math.hypot(dx, dy) || 1
    const spd = Math.max(40, Math.min(360, (dist / (durationMs / 1000))))
    const nx = dx / dist, ny = dy / dist
    npc.setVelocity(nx * spd, ny * spd)
    scene.time.delayedCall(durationMs, () => { try { npc.setVelocity(0, 0) } catch {} })
  }
  scene.time.delayedCall(durationMs + 50, async () => {
    const s = (scene.physics as any).add?.sprite?.(x, y, 'player')?.setTint?.(0x66ffcc)
    if (!s) return
    try { (s as any).body?.setCircle?.(12) } catch {}
    ;(s as any).isInvulnerable = true
    ;(scene as any).add?.text?.(x, y - 30, portalName, { fontFamily: 'monospace', color: '#aaf' })?.setOrigin?.(0.5)
    try {
      const fx = await import('@/systems/Effects')
      ;(fx as any).executeEffectByRef?.('fx.portalParticles', { scene, caster: s as any }, { x, y, colorOuter: 0x9a66ff, colorInner: 0x5f2aff, rate: 60 })
    } catch {}
    try { if ((scene.lights as any)?.active) (s as any).setPipeline?.('Light2D') } catch {}
    try {
      ;(scene as any).physics?.add?.overlap?.((scene as any).player, s, () => {
        try {
          const p = { id: 'tmp_portal', name: portalName, destinationScene, destinationId, x, y }
          ;(anyScene.teleport as any)?.(p)
        } catch {}
      })
    } catch {}
  })
})

// Toggle assist/follow mode for an NPC; while assisting, disable gossip and interaction
registerConversationAction('npc.setAssist', (scene, npc, params) => {
  if (!npc) return
  const enable = Boolean(params['enable'] ?? true)
  npc.setData('assistMode', enable)
  if (enable) {
    npc.setData('brainId', String(params['brainId'] || npc.getData('brainId') || 'brain_assist_player'))
  }
  // Persist assist flag by name to survive reloads
  try {
    const name = (npc as any).name || npc.getData('name')
    if (name) {
      const key = `npc.assist.${String(name)}`
      localStorage.setItem(key, enable ? '1' : '0')
    }
  } catch {}
})

// Spawn a new NPC (lightweight); optionally remove current one
registerConversationAction('npc.spawn', (scene, npc, params) => {
  const anyScene: any = scene
  const name = String(params['name'] || 'NPC')
  const role = String(params['role'] || 'questgiver')
  const x = Number(params['x'] ?? (npc ? npc.x : anyScene.player?.x || 0))
  const y = Number(params['y'] ?? (npc ? npc.y : anyScene.player?.y || 0))
  const brainId = params['brainId'] ? String(params['brainId']) : undefined
  const forcedId = params['id'] ? String(params['id']) : undefined
  const s = (scene.physics as any).add.sprite(x, y, 'player').setTint?.(0xffcc66)
  if (!s) return
  try { (s as any).body?.setCircle?.(12) } catch {}
  ;(s as any).isInvulnerable = true
  if (forcedId) (s as any).setData?.('id', forcedId)
  ;(s as any).setName?.(name); (s as any).setData?.('name', name)
  ;(s as any).setData?.('role', role)
  if (brainId) (s as any).setData?.('brainId', brainId)
  anyScene.npcs?.push?.(s)
  // Persist spawned state if id provided
  try {
    const id = forcedId
    if (id) {
      const raw = localStorage.getItem('npc.state')
      const list: Array<{ id: string; removed?: boolean }> = raw ? JSON.parse(raw) : []
      if (!list.some(e => e && e.id === id)) list.push({ id, removed: false })
      localStorage.setItem('npc.state', JSON.stringify(list))
    }
  } catch {}
  if (params['removeCurrent'] && npc) { try { npc.destroy() } catch {} }
})

// Despawn current NPC if conditions met
registerConversationAction('npc.despawn', (_scene, npc, _params) => {
  if (!npc) return
  try {
    const id = String(npc.getData('id') || '')
    if (id) {
      const raw = localStorage.getItem('npc.state')
      const list: Array<{ id: string; removed?: boolean }> = raw ? JSON.parse(raw) : []
      const idx = list.findIndex(e => e && e.id === id)
      if (idx >= 0) list[idx].removed = true; else list.push({ id, removed: true })
      localStorage.setItem('npc.state', JSON.stringify(list))
      // Also hide/destroy on-screen name label if present
      try {
        const labelName = `__npc_name_${id}`
        const sceneAny: any = _scene as any
        const label = sceneAny?.children?.getByName?.(labelName)
        label?.destroy?.()
      } catch {}
    }
  } catch {}
  try { npc.destroy() } catch {}
})

// Quest helpers
registerConversationAction('quest.markCompleted', (_scene, _npc, params) => {
  try {
    const id = String(params['id'] || '')
    if (!id) return
    const charId = localStorage.getItem('quests.activeCharId') || '0'
    import('@/systems/Quests').then(mod => {
      const def = (mod as any).getQuestDef?.(id)
      const raw = localStorage.getItem(`quests.state.${charId}`)
      const list: Array<{ id: string; progress: number; completed: boolean }> = raw ? JSON.parse(raw) : []
      const idx = list.findIndex(q => q && q.id === id)
      if (idx >= 0) {
        list[idx].completed = true
        const target = Math.max(1, Number(def?.requiredCount ?? 1))
        list[idx].progress = target
        localStorage.setItem(`quests.state.${charId}`, JSON.stringify(list))
      }
    })
  } catch {}
})

registerConversationAction('quest.grant', (_scene, _npc, params) => {
  try {
    const id = String(params['id'] || '')
    if (!id) return
    import('@/systems/Quests').then(mod => { (mod as any).grantQuest?.(id) })
  } catch {}
})

// Complete a quest (hand-in/remove from active) and grant the next quest; refresh UI (no despawn)
registerConversationAction('quest.completeAndGrant', (scene, _npc, params) => {
  const completeId = String(params['completeId'] || '')
  const grantId = String(params['grantId'] || '')
  try {
    if (completeId) {
      import('@/systems/Quests').then(mod => {
        const ok = (mod as any).completeQuestIfReady?.(scene, completeId, { onReward: () => (scene as any).refreshQuestUI?.() })
        if (!ok) {
          // Fallback: mark complete and remove from active list
          const charId = localStorage.getItem('quests.activeCharId') || '0'
          const def = (mod as any).getQuestDef?.(completeId)
          const raw = localStorage.getItem(`quests.state.${charId}`)
          const list: Array<{ id: string; progress: number; completed: boolean }> = raw ? JSON.parse(raw) : []
          const idx = list.findIndex(q => q && q.id === completeId)
          if (idx >= 0) {
            const target = Math.max(1, Number(def?.requiredCount ?? 1))
            list[idx].progress = target
            list[idx].completed = true
            localStorage.setItem(`quests.state.${charId}`, JSON.stringify(list))
            ;(mod as any).completeQuestIfReady?.(scene, completeId, { onReward: () => (scene as any).refreshQuestUI?.() })
          }
        }
      })
    }
  } catch {}
  try { if (grantId) import('@/systems/Quests').then(mod => { (mod as any).grantQuest?.(grantId); (scene as any).refreshQuestUI?.() }) } catch {}
  try { (scene as any).refreshQuestUI?.() } catch {}
})

registerConversationAction('quest.completeGrantAndDespawn', (scene, npc, params) => {
  const completeId = String(params['completeId'] || '')
  const grantId = String(params['grantId'] || '')
  // Mark current complete (best-effort) and fully hand-in (remove from active)
  try {
    if (completeId) {
      const charId = localStorage.getItem('quests.activeCharId') || '0'
      import('@/systems/Quests').then(mod => {
        const def = (mod as any).getQuestDef?.(completeId)
        const raw = localStorage.getItem(`quests.state.${charId}`)
        const list: Array<{ id: string; progress: number; completed: boolean }> = raw ? JSON.parse(raw) : []
        const idx = list.findIndex(q => q && q.id === completeId)
        if (idx >= 0) {
          const target = Math.max(1, Number(def?.requiredCount ?? 1))
          list[idx].progress = target
          list[idx].completed = true
          localStorage.setItem(`quests.state.${charId}`, JSON.stringify(list))
          // Now fully hand-in to remove from active and log completion
          const finished = (mod as any).completeQuestIfReady?.(scene, completeId, { onReward: () => (scene as any).refreshQuestUI?.() })
          if (!finished) { (scene as any).refreshQuestUI?.() }
        }
      })
    }
  } catch {}
  // Grant next quest after handing in the previous
  try { if (grantId) import('@/systems/Quests').then(mod => { (mod as any).grantQuest?.(grantId); (scene as any).refreshQuestUI?.() }) } catch {}
  // Refresh tracker UI if available
  try { (scene as any).refreshQuestUI?.() } catch {}
  // Despawn this NPC (inline to avoid circular calls)
  try {
    if (npc) {
      const id = String(npc.getData('id') || '')
      if (id) {
        const raw = localStorage.getItem('npc.state')
        const list: Array<{ id: string; removed?: boolean }> = raw ? JSON.parse(raw) : []
        const idx = list.findIndex((e: any) => e && e.id === id)
        if (idx >= 0) list[idx].removed = true; else list.push({ id, removed: true })
        localStorage.setItem('npc.state', JSON.stringify(list))
        // remove name label
        try {
          const sceneAny: any = scene as any
          const label = sceneAny?.children?.getByName?.(`__npc_name_${id}`)
          label?.destroy?.()
        } catch {}
      }
      try { npc.destroy() } catch {}
    }
  } catch {}
})


