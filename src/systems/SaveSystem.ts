import { CharacterProfile } from '@/types'

const KEY = 'arpg.characters'

export function loadCharacters(): CharacterProfile[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
  } catch {
    return []
  }
}

export function saveCharacters(chars: CharacterProfile[]): void {
  localStorage.setItem(KEY, JSON.stringify(chars))
}

export function upsertCharacter(profile: CharacterProfile): void {
  const list = loadCharacters()
  const idx = list.findIndex((c) => c.id === profile.id)
  if (idx >= 0) list[idx] = profile
  else list.push(profile)
  saveCharacters(list)
}

export function deleteCharacter(id: number): void {
  const list = loadCharacters().filter((c) => c.id !== id)
  saveCharacters(list)
}

