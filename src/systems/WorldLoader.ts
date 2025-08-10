import { WorldConfig } from '@/types'

export async function loadWorldConfig(path: string): Promise<WorldConfig> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Failed to load world config: ${path}`)
  return res.json()
}

