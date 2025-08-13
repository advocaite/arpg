export type UUID = string

export type ClientMsg =
  | { t: 'join'; name: string; worldId: string; version: string }
  | { t: 'invite.create'; worldId: string }
  | { t: 'invite.accept'; inviteId: UUID }
  | { t: 'input'; seq: number; dt: number; keys: { up: boolean; down: boolean; left: boolean; right: boolean; dash: boolean }; aim?: { x: number; y: number } }
  | { t: 'cast'; seq: number; skillId: string; atMs: number; cursor?: { x: number; y: number }; params?: Record<string, any> }
  | { t: 'portal.enter'; portalId?: string; destinationId: string }

export type ServerMsg =
  | { t: 'hello'; playerId: UUID; worldSeed: string; tickRate: number; serverTime?: number }
  | { t: 'invite'; inviteId: UUID; url: string }
  | { t: 'snapshot'; tick: number; ackSeq: number; ents: NetEntity[] }
  | { t: 'event'; ev: NetEvent }
  | { t: 'combat'; kind: 'melee'; x: number; y: number; radius: number; kills: number }

export type NetEntity = { id: UUID; kind: 'player' | 'enemy' | 'projectile' | 'pickup' | 'npc'; x: number; y: number; vx?: number; vy?: number; hp?: number; facing?: number; meta?: any }

export type NetEvent =
  | { t: 'player.joined'; id: UUID; name: string }
  | { t: 'player.left'; id: UUID }
  | { t: 'chat'; from: UUID; text: string }

export type InviteInfo = { id: UUID; worldId: string; createdAt: number }


