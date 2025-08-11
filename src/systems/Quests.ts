import type Phaser from 'phaser'

export type QuestDef = {
  id: string
  name: string
  description?: string
  type: 'kill'
  targetMonsterId: string
  requiredCount: number
  rewards?: { xp?: number; coins?: number; itemId?: string }
}

export type QuestState = {
  id: string
  progress: number
  completed: boolean
}

const questDefs: Record<string, QuestDef> = {}

export function loadQuestDefs(scene: Phaser.Scene): void {
  try {
    const json: any = (scene.cache as any).json?.get?.('quests')
    const arr: QuestDef[] = Array.isArray(json?.quests) ? json.quests : []
    for (const q of arr) questDefs[q.id] = q
  } catch {}
}

export function getQuestDef(id: string): QuestDef | undefined { return questDefs[id] }
export function listQuestDefs(): QuestDef[] { return Object.values(questDefs) }

function loadState(): QuestState[] {
  try { return JSON.parse(localStorage.getItem('quests.state') || '[]') } catch { return [] }
}
function saveState(list: QuestState[]): void {
  try { localStorage.setItem('quests.state', JSON.stringify(list)) } catch {}
}

export function getActiveQuests(): QuestState[] { return loadState().filter(q => !q.completed) }
export function getQuestState(id: string): QuestState | undefined { return loadState().find(q => q.id === id) }
export function getAllQuestStates(): QuestState[] { return loadState() }

export function grantQuest(id: string): void {
  const list = loadState()
  if (list.some(q => q.id === id)) return
  list.push({ id, progress: 0, completed: false })
  saveState(list)
}

export function notifyMonsterKilled(monsterId: string): void {
  const list = loadState()
  let changed = false
  for (const q of list) {
    const def = questDefs[q.id]
    if (!def || q.completed) continue
    if (def.type === 'kill' && def.targetMonsterId === monsterId) {
      try { console.log('[Quests] kill notify', monsterId, 'quest', q.id, 'before', q.progress, '/', def.requiredCount) } catch {}
      q.progress = Math.min(def.requiredCount, q.progress + 1)
      if (q.progress >= def.requiredCount) q.completed = true
      try { console.log('[Quests] progress', q.id, q.progress, '/', def.requiredCount, 'completed?', q.completed) } catch {}
      changed = true
    }
  }
  if (changed) saveState(list)
}

export function completeQuestIfReady(scene: Phaser.Scene, id: string, opts?: { onReward?: (r: NonNullable<QuestDef['rewards']>) => void }): boolean {
  const list = loadState()
  const idx = list.findIndex(q => q.id === id)
  if (idx < 0) return false
  const state = list[idx]
  const def = questDefs[id]
  if (!def || !state.completed) return false
  // Apply rewards
  const reward = def.rewards || {}
  try {
    if (typeof reward.coins === 'number') {
      const cur = Number(localStorage.getItem('coins') || 0)
      localStorage.setItem('coins', String(cur + reward.coins))
    }
    if (typeof reward.xp === 'number') {
      const anyScene: any = scene as any
      anyScene.gainExperience?.(reward.xp)
    }
    if (reward.itemId) {
      const anyScene: any = scene as any
      const charId = anyScene.character?.id ?? 0
      const inv = anyScene.inventory || []
      try {
        import('@/systems/Inventory').then(mod => { anyScene.inventory = (mod as any).addToInventory(charId, inv, reward.itemId, 1, { magicFindPct: 0 }) })
      } catch {}
    }
  } catch {}
  // Remove from active list
  list.splice(idx, 1)
  saveState(list)
  opts?.onReward?.(reward as any)
  return true
}


