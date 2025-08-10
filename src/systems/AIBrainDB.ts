import brainsRaw from '@/data/ai_brains.json'
import { AIBrain } from '@/types'

const db: Record<string, AIBrain> = {}
;(brainsRaw as any).brains.forEach((b: AIBrain) => { db[b.id] = b })

export function getBrain(id: string): AIBrain | undefined { return db[id] }

