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
}

export type ConversationNode = {
  id: string
  type: ConversationType
  title?: string
  lines: ConversationLine[]
  options?: ConversationOption[]
  cooldownMs?: number // for gossip repeat delay
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
export function openConversation(scene: Phaser.Scene, bundleId: string, startId?: string): void {
  const bundle = getConversationBundle(bundleId)
  if (!bundle) return
  const anyScene: any = scene as any
  const openNow = () => {
    const node = bundle.nodes.find(n => n.id === (startId || 'welcome')) || bundle.nodes[0]
    if (!node) return
    const Dialogue = anyScene.__DialogueCtor
    if (!Dialogue) return
    const ui = new Dialogue(scene)
    const lines = node.lines.map(l => l.text)
    // Read quest state synchronously to gate option visibility
    let questState: Array<{ id: string; progress: number; completed: boolean }> = []
    try { questState = JSON.parse(localStorage.getItem('quests.state') || '[]') || [] } catch {}
    const hasQuest = (id?: string) => !!id && questState.some(q => q.id === id)
    const isCompleted = (id?: string) => !!id && questState.some(q => q.id === id && q.completed)
    const opts = (node.options || [])
      .filter(o => {
        if (o.grantQuestId && hasQuest(o.grantQuestId)) return false
        if (o.completeQuestId && !isCompleted(o.completeQuestId)) return false
        return true
      })
      .map(o => ({ label: o.label, onSelect: () => {
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
        try { import('@/systems/Quests').then(mod => { (mod as any).grantQuest?.(o.grantQuestId); (scene as any).refreshQuestUI?.() }) } catch {}
      }
      if (o.completeQuestId) {
        try { import('@/systems/Quests').then(mod => { (mod as any).completeQuestIfReady?.(scene, o.completeQuestId, { onReward: () => (scene as any).refreshQuestUI?.() }) }) } catch {}
      }
      if (o.nextConversationId) { ui.close(); openConversation(scene, bundleId, o.nextConversationId); return }
      // If no next, close the dialogue to avoid stacking
      ui.close();
    } }))
    ui.open(node.title || 'Conversation', lines, opts, () => { try { (scene as any).uiModalOpen = false; (scene as any).hotbar?.setAllowSkillClick(true); (scene as any).refreshQuestUI?.() } catch {} })
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
        // pick a gossip node from bundle (first gossip node)
        const bundle = getConversationBundle(cfg.bundleId)
        const node = bundle?.nodes.find(n => n.type === 'gossip')
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


