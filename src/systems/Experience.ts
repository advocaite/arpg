import table from '@/data/exp_table.json'

// Returns exp required to go from level -> level+1. Caps at last defined entry.
export function expRequiredForLevel(level: number): number {
  const arr = (table as any).levels as number[]
  if (!Array.isArray(arr) || arr.length === 0) return 100
  const idx = Math.max(0, Math.min(level, arr.length - 1))
  return arr[idx]
}


