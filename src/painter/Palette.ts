export type PlaceableType = 'obstacle' | 'light' | 'portal' | 'npc' | 'decor' | 'spawner' | 'checkpoint' | 'start'

export type PlaceableDef = {
  id: string
  type: PlaceableType
  label: string
  defaults: Record<string, any>
}

// Data-driven palette; extend freely
export const PALETTE: PlaceableDef[] = [
  {
    id: 'obstacle_block',
    type: 'obstacle',
    label: 'Obstacle Block',
    defaults: { width: 32, height: 32 }
  },
  {
    id: 'light_torch',
    type: 'light',
    label: 'Torch Light',
    defaults: { color: 0xffaa55, radius: 200, intensity: 1, flicker: true }
  },
  {
    id: 'light_sky',
    type: 'light',
    label: 'Sky Light (camera-follow)',
    defaults: { type: 'sky', color: 0x93a0b8, radius: 5200, intensity: 0.7, followCamera: true }
  },
  {
    id: 'portal_generic',
    type: 'portal',
    label: 'Portal',
    defaults: { name: 'Portal', destinationScene: 'World', destinationId: 'town' }
  },
  {
    id: 'npc_shopkeeper',
    type: 'npc',
    label: 'NPC: Shopkeeper',
    defaults: { name: 'Shopkeeper', role: 'shopkeeper' }
  }
  ,
  {
    id: 'decor_leaves',
    type: 'decor',
    label: 'Decor: Leaves',
    defaults: { kind: 'leaves' }
  }
  ,
  {
    id: 'decor_tree',
    type: 'decor',
    label: 'Decor: Tree',
    defaults: { kind: 'tree', tint: 0x447744 }
  },
  {
    id: 'decor_rock',
    type: 'decor',
    label: 'Decor: Rock',
    defaults: { kind: 'rock', tint: 0x888888 }
  },
  {
    id: 'decor_banner',
    type: 'decor',
    label: 'Decor: Banner',
    defaults: { kind: 'banner', tint: 0xaa3344 }
  },
  {
    id: 'spawner_default',
    type: 'spawner',
    label: 'Spawner',
    defaults: { monsterId: 'chaser_basic', everyMs: 1200, count: 1, limit: 20, startDelayMs: 0 }
  },
  {
    id: 'checkpoint_default',
    type: 'checkpoint',
    label: 'Checkpoint',
    defaults: { name: 'Checkpoint' }
  },
  {
    id: 'start_point',
    type: 'start',
    label: 'Start Point',
    defaults: {}
  }
]


