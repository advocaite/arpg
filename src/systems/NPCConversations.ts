import type Phaser from 'phaser'

export type ConversationType = 'normal' | 'gossip' | 'quest'

export type ConversationLine = {
  id: string
  speaker?: string
  text: string
  soundKey?: string // Optional SFX/VO key
}

export type ConversationOption = {
  id: string
  label: string
  nextConversationId?: string
  openShop?: boolean
  openRepair?: boolean
  openCraft?: boolean
  grantQuestId?: string
  completeQuestId?: string
  onSelectRef?: string // optional code hook ref
  // Optional action hook for scripted behaviors (data-driven)
  actionRef?: string
  actionParams?: Record<string, number | string | boolean>
}

export type ConversationNode = {
  id: string
  type: ConversationType
  title?: string
  lines: ConversationLine[]
  options?: ConversationOption[]
  cooldownMs?: number // for gossip repeat delay
  // Optional predicate reference or simple quest conditions for node visibility
  require?: {
    questCompletedIds?: string[]
    questNotCompletedIds?: string[]
    questActiveIds?: string[]
    questNotActiveIds?: string[]
    predicateRef?: string
    predicateParams?: Record<string, number | string | boolean>
  }
}

export type ConversationBundle = {
  id: string
  nodes: ConversationNode[]
}

export type GossipConfig = {
  radius: number
  cooldownMs: number
}

export type NpcConversationConfig = {
  npcId: string
  bundleId: string
  gossip?: GossipConfig
}

const bundles: Record<string, ConversationBundle> = {}
const npcConfs: Record<string, NpcConversationConfig> = {}
// Predicate registry for data-driven gating
type PredicateHandler = (scene: Phaser.Scene, npc: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined, params: Record<string, number | string | boolean>) => boolean
const predicateRegistry: Record<string, PredicateHandler> = {}

// Load JSON config (optional); guard if not present
export async function loadConversationData(scene: Phaser.Scene): Promise<void> {
  try {
    const json: any = (scene.cache as any).json?.get?.('npc_conversations')
    if (!json) return
    const bs = Array.isArray(json?.bundles) ? json.bundles : []
    const ns = Array.isArray(json?.npcs) ? json.npcs : []
    for (const b of bs) registerConversationBundle(b)
    for (const n of ns) registerNpcConversation(n)
  } catch {}
}

export function registerConversationBundle(b: ConversationBundle): void { bundles[b.id] = b }
export function getConversationBundle(id: string): ConversationBundle | undefined { return bundles[id] }
export function registerNpcConversation(cfg: NpcConversationConfig): void { npcConfs[cfg.npcId] = cfg }
export function getNpcConversation(npcId: string): NpcConversationConfig | undefined { return npcConfs[npcId] }
export function registerConversationPredicate(ref: string, fn: PredicateHandler): void { predicateRegistry[ref] = fn }
export function evaluateConversationPredicate(scene: Phaser.Scene, npc: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined, ref?: string, params?: Record<string, number | string | boolean>): boolean {
  if (!ref) return true
  const fn = predicateRegistry[ref]
  if (typeof fn !== 'function') return true
  try { return !!fn(scene, npc, params || {}) } catch { return false }
}
// Built-in predicate: flag check stored in localStorage
registerConversationPredicate('flag.equals', (_scene, _npc, params) => {
  try {
    const key = String((params as any)?.key || '')
    const want = (params as any)?.value
    if (!key) return false
    const raw = localStorage.getItem(`flag.${key}`)
    if (raw == null) return want == null
    const got = JSON.parse(raw)
    return JSON.stringify(got) === JSON.stringify(want)
  } catch { return false }
})
export function openConversation(scene: Phaser.Scene, bundleId: string, startId?: string, npc?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody): void {
  const bundle = getConversationBundle(bundleId)
  if (!bundle) return
  const anyScene: any = scene as any
  const openNow = () => {
    const node = bundle.nodes.find(n => n.id === (startId || 'welcome')) || bundle.nodes[0]
    console.log('[Convo] openConversation bundle', bundleId, 'startId', startId, 'node', node?.id)
    if (!node) {
      try { (scene as any).uiModalOpen = false; (scene as any).hotbar?.setAllowSkillClick(true) } catch {}
      return
    }
    const Dialogue = anyScene.__DialogueCtor
    if (!Dialogue) return
    const ui = new Dialogue(scene)
    const lines = node.lines.map(l => l.text)
    // Read per-character quest state synchronously to gate option visibility
    const charId = localStorage.getItem('quests.activeCharId') || '0'
    let questState: Array<{ id: string; progress: number; completed: boolean }> = []
    try { questState = JSON.parse(localStorage.getItem(`quests.state.${charId}`) || '[]') || [] } catch {}
    const hasQuest = (id?: string) => !!id && questState.some(q => q.id === id)
    const isCompleted = (id?: string) => !!id && questState.some(q => q.id === id && q.completed)
    // Node-level visibility based on quest requirements and optional predicateRef
    if (!nodeMeetsRequirements(scene, npc, node)) {
      console.log('[Convo] node requirements not met for', node.id)
      try { (scene as any).uiModalOpen = false; (scene as any).hotbar?.setAllowSkillClick(true) } catch {}
      return
    }

    // Parse completed log for non-repeatability checks
    let completedLog: Array<{ id: string; times?: number; lastAt?: number }> = []
    try { completedLog = JSON.parse(localStorage.getItem(`quests.completed.${charId}`) || '[]') || [] } catch {}
    const hasCompletedEver = (id?: string) => !!id && completedLog.some(e => e && e.id === id)

    const opts = (node.options || [])
      .filter(o => {
        // Show grant option only if not already active or ever completed
        if (o.grantQuestId && (hasQuest(o.grantQuestId) || hasCompletedEver(o.grantQuestId))) return false
        // Show complete option only if quest is active (hand-in)
        if (o.completeQuestId && !(hasQuest(o.completeQuestId))) return false
        return true
      })
      .map(o => ({ label: o.label, onSelect: () => {
      console.log('[Convo] option selected', o)
      try {
      if (o.openShop) {
        try {
          // Close dialogue first, then open shop and mark modal open
          ui.close()
          ;(scene as any).uiModalOpen = true
          ;(scene as any).openShop?.()
        } catch {}
        return
      }
      if (o.grantQuestId) {
        try { import('@/systems/Quests').then(mod => { console.log('[Convo] acceptQuest', o.grantQuestId); (mod as any).acceptQuest?.(scene, o.grantQuestId); (scene as any).refreshQuestUI?.() }) } catch {}
      }
      if (o.completeQuestId) {
        try {
          import('@/systems/Quests').then(mod => {
            const ok = (mod as any).completeQuestIfReady?.(scene, o.completeQuestId, { onReward: () => { console.log('[Convo] onReward complete', o.completeQuestId); (scene as any).refreshQuestUI?.() } })
            if (!ok) {
              // If not logically completed by rules, attempt to mark it complete for linear story nodes
              import('./NPCActionRunner').then(r => { console.log('[Convo] force markCompleted', o.completeQuestId); (r as any).runConversationAction?.(scene, npc, 'quest.markCompleted', { id: o.completeQuestId }) ; (scene as any).refreshQuestUI?.() })
            }
          })
        } catch {}
      }
      if (o.actionRef) {
        try { import('./NPCActionRunner').then(r => { console.log('[Convo] run action', o.actionRef, o.actionParams || {}); (r as any).runConversationAction?.(scene, npc, o.actionRef!, o.actionParams || {}) }) } catch {}
      }
      if (o.nextConversationId) {
        ui.close();
        // Defer next open slightly to avoid double-click swallow or modal race
        scene.time.delayedCall(10, () => { console.log('[Convo] chaining to', o.nextConversationId); openConversation(scene, bundleId, o.nextConversationId, npc) })
        return
      }
      // Script actions (data-driven)
      try {
        const acts: any[] = (o as any).actions
        if (Array.isArray(acts) && acts.length) {
          import('@/systems/ScriptRunner').then(mod => { (mod as any).runActions?.(scene, acts) })
        }
      } catch {}
      // If no next, close the dialogue to avoid stacking
      ui.close();
      // After selection, refresh quest UI and icons promptly
      try { (scene as any).refreshQuestUI?.() } catch {}
      } finally {
        // Safety: ensure input is re-enabled even if a path above early-returns
        try { (scene as any).uiModalOpen = false; (scene as any).hotbar?.setAllowSkillClick(true) } catch {}
      }
    } }))
    ui.open(node.title || 'Conversation', lines, opts, () => { try { (scene as any).uiModalOpen = false; (scene as any).hotbar?.setAllowSkillClick(true); (scene as any).refreshQuestUI?.() } catch {} })
    // ensure modal open flag is set while dialogue is shown
    try { (scene as any).uiModalOpen = true; (scene as any).hotbar?.setAllowSkillClick(false) } catch {}
  }
  if (!anyScene.__DialogueCtor) {
    import('@/ui/Dialogue').then((mod) => { anyScene.__DialogueCtor = (mod as any).default; openNow() })
  } else {
    openNow()
  }
}

export function summarizeBundleQuests(bundleId: string): { offers: string[]; turnins: string[] } {
  const result = { offers: [] as string[], turnins: [] as string[] }
  const b = bundles[bundleId]
  if (!b) return result
  for (const n of b.nodes) {
    for (const o of (n.options || [])) {
      if (o.grantQuestId) result.offers.push(o.grantQuestId)
      if (o.completeQuestId) result.turnins.push(o.completeQuestId)
    }
  }
  return result
}

export function findTurnInNode(bundleId: string, questId: string): string | undefined {
  const b = bundles[bundleId]
  if (!b) return undefined
  for (const n of b.nodes) {
    if ((n.options || []).some(o => o.completeQuestId === questId)) return n.id
  }
  return undefined
}

// Select an appropriate bundle for a given NPC based on world state and optional per-NPC configured bundles
export function selectNpcBundle(scene: Phaser.Scene, npc: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody): { npcId: string; bundleId: string } | undefined {
  const npcName = (npc as any).name || npc.getData('name')
  const npcId = `npc_${npcName}`
  // 1) If explicit bundle mapping exists in JSON, prefer it
  const jsonCfg = getNpcConversation(npcId)
  if (jsonCfg) return { npcId, bundleId: jsonCfg.bundleId }
  // 2) Otherwise, check sprite-provided conversationBundles list
  const bundlesList: string[] = (npc.getData('conversationBundles') as any) || []
  if (Array.isArray(bundlesList) && bundlesList.length) {
    // Filter to bundles whose start node meets requirements
    const applicable = bundlesList.filter(b => bundleStartMeetsRequirements(scene, npc, b))
    // Quest-aware selection: pick a bundle with a turn-in (active or completed) first, then one offering a new quest, else first applicable
    let questState: Array<{ id: string; progress: number; completed: boolean }> = []
    try { questState = JSON.parse(localStorage.getItem('quests.state') || '[]') || [] } catch {}
    const isActive = (id?: string) => !!id && questState.some(q => q.id === id)
    // turn-in preferred (active or completed)
    for (const b of applicable) {
      const sum = summarizeBundleQuests(b)
      if ((sum.turnins || []).some(id => isActive(id))) return { npcId, bundleId: b }
    }
    // offer next
    for (const b of applicable) {
      const sum = summarizeBundleQuests(b)
      if ((sum.offers || []).some(id => !questState.some(q => q.id === id))) return { npcId, bundleId: b }
    }
    // fallback
    if (applicable.length) return { npcId, bundleId: applicable[0] }
    return { npcId, bundleId: bundlesList[0] }
  }
  return undefined
}

// Built-in predicates
registerConversationPredicate('npc.isAssisting', (_scene, npc, _params) => {
  return !!npc?.getData('assistMode')
})
registerConversationPredicate('quest.completedAtLeast', (_scene, _npc, params) => {
  try {
    const id = String(params['id'] || '')
    const min = Math.max(1, Number(params['times'] ?? 1))
    const list = JSON.parse(localStorage.getItem('quests.completed') || '[]') || []
    const e = list.find((x: any) => x && x.id === id)
    return !!e && Number(e.times || 0) >= min
  } catch { return false }
})

// Internal helpers
function nodeMeetsRequirements(scene: Phaser.Scene, npc: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined, node: ConversationNode): boolean {
  try {
    const req: any = (node as any).require
    if (!req) return true
    const charId = localStorage.getItem('quests.activeCharId') || '0'
    let qs: Array<{ id: string; progress: number; completed: boolean }> = []
    try { qs = JSON.parse(localStorage.getItem(`quests.state.${charId}`) || '[]') || [] } catch {}
    const completed: Array<{ id: string; times: number; lastAt: number }> = JSON.parse(localStorage.getItem(`quests.completed.${charId}`) || '[]') || []
    const hasCompleted = (id: string) => completed.some((e: any) => e.id === id)
    const isActive = (id: string) => qs.some(q => q.id === id)
    if (Array.isArray(req.questCompletedIds) && !req.questCompletedIds.every(hasCompleted)) return false
    if (Array.isArray(req.questNotCompletedIds) && !req.questNotCompletedIds.every((id: string) => !hasCompleted(id))) return false
    if (Array.isArray(req.questActiveIds) && !req.questActiveIds.every(isActive)) return false
    if (Array.isArray(req.questNotActiveIds) && !req.questNotActiveIds.every((id: string) => !isActive(id))) return false
    if (req.predicateRef) return evaluateConversationPredicate(scene, npc as any, req.predicateRef, req.predicateParams)
    return true
  } catch { return true }
}

function bundleStartMeetsRequirements(scene: Phaser.Scene, npc: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | undefined, bundleId: string): boolean {
  const b = getConversationBundle(bundleId)
  if (!b) return false
  const node = b.nodes.find(n => n.id === 'welcome') || b.nodes[0]
  if (!node) return false
  return nodeMeetsRequirements(scene, npc, node)
}

// Fallback: scan all bundles to find one that fits this NPC and current quest state
export function autoSelectBundleForNpc(scene: Phaser.Scene, npc: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody): { npcId: string; bundleId: string } | undefined {
  const npcName = (npc as any).name || npc.getData('name')
  const npcId = `npc_${npcName}`
  const ids = Object.keys((bundles as any) || {})
  const candidates = ids.filter(id => bundleStartMeetsRequirements(scene, npc, id))
  if (candidates.length === 0) return undefined
  // Prefer bundles whose welcome node title matches NPC name
  const titled = candidates.filter(id => {
    const b = getConversationBundle(id)
    const node = b?.nodes.find(n => n.id === 'welcome') || b?.nodes[0]
    return (node?.title || '').toLowerCase() === String(npcName || '').toLowerCase()
  })
  const pool = titled.length ? titled : candidates
  // Turn-in preferred, then offer
  const charId = localStorage.getItem('quests.activeCharId') || '0'
  let questState: Array<{ id: string; progress: number; completed: boolean }> = []
  try { questState = JSON.parse(localStorage.getItem(`quests.state.${charId}`) || '[]') || [] } catch {}
  const isActive = (id?: string) => !!id && questState.some(q => q.id === id)
  for (const b of pool) { const sum = summarizeBundleQuests(b); if ((sum.turnins || []).some(id => isActive(id))) return { npcId, bundleId: b } }
  for (const b of pool) { const sum = summarizeBundleQuests(b); if ((sum.offers || []).some(id => !questState.some(q => q.id === id))) return { npcId, bundleId: b } }
  return { npcId, bundleId: pool[0] }
}

registerConversationPredicate('npc.named', (_scene, npc, params) => {
  try {
    const want = String(params['name'] || '')
    const npcName = (npc as any)?.name || npc?.getData('name')
    return !!want && String(npcName) === want
  } catch { return false }
})

// Lightweight gossip driver (attach per NPC sprite)
export function attachGossip(scene: Phaser.Scene, npc: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody, cfg: NpcConversationConfig): void {
  const lastSpokenKey = `npc.gossip.last.${cfg.npcId}`
  const radius = cfg.gossip?.radius ?? 120
  const cooldown = cfg.gossip?.cooldownMs ?? 10000
  ;(scene.time as any).addEvent({ loop: true, delay: 500, callback: () => {
    try {
      const player = (scene as any).player as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
      if (!player || !npc || !npc.body) return
      const dx = player.x - npc.x, dy = player.y - npc.y
      const inRange = Math.hypot(dx, dy) <= radius
      const now = Date.now()
      const last = Number(localStorage.getItem(lastSpokenKey) || 0)
      if (inRange && now - last >= cooldown) {
        // pick a gossip node from bundle (first gossip node that meets requirements)
        const bundle = getConversationBundle(cfg.bundleId)
        const node = bundle?.nodes.find(n => n.type === 'gossip' && nodeMeetsRequirements(scene, npc, n))
        if (!node) return
        showFloatingText(scene, npc.x, npc.y - 28, node.lines[0]?.text || '...')
        if (node.lines[0]?.soundKey) try { (scene.sound as any).play(node.lines[0].soundKey) } catch {}
        localStorage.setItem(lastSpokenKey, String(now))
      }
    } catch {}
  } })
}

function showFloatingText(scene: Phaser.Scene, x: number, y: number, text: string): void {
  const t = scene.add.text(x, y, text, { fontFamily: 'monospace', color: '#ffd166' }).setOrigin(0.5).setDepth(2000)
  scene.tweens.add({ targets: t, y: y - 20, alpha: 0.1, duration: 1600, onComplete: () => t.destroy() })
}


