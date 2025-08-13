import type { NetEntity } from '@/net/protocol'

export type Room = {
  id: string
  worldId: string
  seed: string
  ents: Map<string, NetEntity>
  tick: number
}

export class Simulation {
  private rooms: Map<string, Room> = new Map()

  getOrCreateRoom(id: string, worldId: string, seed: string): Room {
    let r = this.rooms.get(id)
    if (!r) {
      r = { id, worldId, seed, ents: new Map(), tick: 0 }
      this.rooms.set(id, r)
    }
    return r
  }

  step(roomId: string, dtMs: number): Room | null {
    const r = this.rooms.get(roomId)
    if (!r) return null
    r.tick += 1
    // Future: integrate inputs, advance entities, AI, collisions, etc.
    return r
  }
}


