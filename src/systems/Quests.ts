import type Phaser from 'phaser'

export type QuestDef = {
  id: string
  name: string
  description?: string
  type: 'kill'
  targetMonsterId: string
  requiredCount: number
  rewards?: { xp?: number; coins?: number; itemId?: string }
  // Whether this quest can be taken again after completion
  repeatable?: boolean
  // If true, the quest will be automatically handed-in when requirements are met
  autoHandIn?: boolean
  onAccept?: { ref: string; params?: Record<string, any> }[]
  onComplete?: { ref: string; params?: Record<string, any> }[]
}

export type QuestState = {
  id: string
  progress: number
  completed: boolean
}

const questDefs: Record<string, QuestDef> = {}
let __sceneForHooks: Phaser.Scene | undefined
let __activeCharacterId: number = 0

export function loadQuestDefs(scene: Phaser.Scene): void {
  try {
    const json: any = (scene.cache as any).json?.get?.('quests')
    const arr: QuestDef[] = Array.isArray(json?.quests) ? json.quests : []
    for (const q of arr) questDefs[q.id] = q
  } catch {}
  // Capture active character id for per-character quest state
  try {
    const anyScene: any = scene
    const id = Number(anyScene?.character?.id || 0)
    __activeCharacterId = Number.isFinite(id) ? id : 0
    localStorage.setItem('quests.activeCharId', String(__activeCharacterId))
  } catch {}
  // Keep a scene reference for auto-handin hooks
  __sceneForHooks = scene
}

export function getQuestDef(id: string): QuestDef | undefined { return questDefs[id] }
export function listQuestDefs(): QuestDef[] { return Object.values(questDefs) }

function keyFor(suffix: 'state' | 'completed'): string {
  const idRaw = localStorage.getItem('quests.activeCharId')
  const id = Number.isFinite(Number(idRaw)) ? String(idRaw) : String(__activeCharacterId || 0)
  return suffix === 'state' ? `quests.state.${id}` : `quests.completed.${id}`
}
function loadState(): QuestState[] {
  try { return JSON.parse(localStorage.getItem(keyFor('state')) || '[]') } catch { return [] }
}
function saveState(list: QuestState[]): void { try { localStorage.setItem(keyFor('state'), JSON.stringify(list)) } catch {} }

type QuestCompletion = { id: string; times: number; lastAt: number }
function loadCompleted(): QuestCompletion[] { try { return JSON.parse(localStorage.getItem(keyFor('completed')) || '[]') } catch { return [] } }
function saveCompleted(list: QuestCompletion[]): void { try { localStorage.setItem(keyFor('completed'), JSON.stringify(list)) } catch {} }
function addCompleted(id: string): void {
  const list = loadCompleted()
  const now = Date.now()
  const idx = list.findIndex(e => e.id === id)
  if (idx >= 0) { list[idx].times += 1; list[idx].lastAt = now } else { list.push({ id, times: 1, lastAt: now }) }
  saveCompleted(list)
}
export function hasCompletedQuest(id: string): boolean { return loadCompleted().some(e => e.id === id) }
export function getQuestCompletedCount(id: string): number { const e = loadCompleted().find(x => x.id === id); return e ? e.times : 0 }

export function getActiveQuests(): QuestState[] { return loadState().filter(q => !q.completed) }
export function getQuestState(id: string): QuestState | undefined { return loadState().find(q => q.id === id) }
export function getAllQuestStates(): QuestState[] { return loadState() }

export function grantQuest(id: string): void {
  const list = loadState()
  if (list.some(q => q.id === id)) return
  // Prevent granting non-repeatable quests if already completed in the past
  const def = questDefs[id]
  if (def && def.repeatable === false && hasCompletedQuest(id)) {
    try { console.log('[Quests] grant skipped non-repeatable already completed', id) } catch {}
    return
  }
  list.push({ id, progress: 0, completed: false })
  saveState(list)
}

// Convenience wrapper to grant quest and run onAccept actions
export function acceptQuest(scene: Phaser.Scene, id: string): void {
  grantQuest(id)
  const def = questDefs[id]
  if (def && Array.isArray(def.onAccept) && def.onAccept.length) {
    try { import('./ScriptRunner').then(mod => { (mod as any).runActions?.(scene, def.onAccept) }) } catch {}
  }
  __sceneForHooks = scene
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
      // Auto hand-in if configured and scene available
      if (q.completed && def.autoHandIn && __sceneForHooks) {
        try { completeQuestIfReady(__sceneForHooks, q.id, { onReward: () => { try { ( (__sceneForHooks as any).refreshQuestUI?.() ) } catch {} } }) } catch {}
      }
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
  // Record completion for repeatability checks
  addCompleted(id)
  // onComplete script
  const def2 = questDefs[id]
  if (def2 && Array.isArray(def2.onComplete) && def2.onComplete.length) {
    try { import('./ScriptRunner').then(mod => { (mod as any).runActions?.(scene, def2.onComplete) }) } catch {}
  }
  opts?.onReward?.(reward as any)
  return true
}

// Force progress for a specific quest by id (data-driven scripting support)
export function forceQuestProgress(id: string, delta: number = 1): void {
  const list = loadState()
  const idx = list.findIndex(q => q.id === id)
  if (idx < 0) return
  const state = list[idx]
  const def = questDefs[id]
  if (!def || state.completed) return
  const add = Math.max(0, Math.floor(delta))
  state.progress = Math.max(0, Math.min(def.requiredCount, state.progress + add))
  if (state.progress >= def.requiredCount) state.completed = true
  saveState(list)
  if (state.completed && def.autoHandIn && __sceneForHooks) {
    try { completeQuestIfReady(__sceneForHooks, id, { onReward: () => { try { ( (__sceneForHooks as any).refreshQuestUI?.() ) } catch {} } }) } catch {}
  }
}


