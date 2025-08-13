import type { ClientMsg, ServerMsg, UUID } from './protocol'

export type NetClientOptions = {
  url: string
  onOpen?: () => void
  onClose?: (code?: number, reason?: string) => void
  onError?: (err?: any) => void
  onHello?: (msg: Extract<ServerMsg, { t: 'hello' }>) => void
  onInvite?: (msg: Extract<ServerMsg, { t: 'invite' }>) => void
  onSnapshot?: (msg: Extract<ServerMsg, { t: 'snapshot' }>) => void
  onEvent?: (msg: Extract<ServerMsg, { t: 'event' }>) => void
  onCombat?: (msg: Extract<ServerMsg, { t: 'combat' }>) => void
}

export class NetClient {
  private ws?: WebSocket
  private opts: NetClientOptions
  private seqCounter = 1
  private lastAckSeq = 0
  public playerId: UUID | null = null
  private pendingQueue: ClientMsg[] = []

  constructor(opts: NetClientOptions) { this.opts = opts }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return
    const url = this.buildUrl(this.opts.url)
    this.ws = new WebSocket(url)
    this.ws.binaryType = 'arraybuffer'
    this.ws.onopen = () => { this.opts.onOpen?.(); this.flushQueue() }
    this.ws.onclose = (ev) => this.opts.onClose?.(ev.code, ev.reason)
    this.ws.onerror = (ev) => this.opts.onError?.(ev)
    this.ws.onmessage = (ev) => this.handleMessage(ev.data)
  }

  ensureConnected(): void { this.connect() }

  isOpen(): boolean { return !!this.ws && this.ws.readyState === WebSocket.OPEN }

  private handleMessage(data: any): void {
    try {
      const msg = JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data)) as ServerMsg
      switch (msg.t) {
        case 'hello': this.playerId = msg.playerId; this.opts.onHello?.(msg); break
        case 'invite': this.opts.onInvite?.(msg); break
        case 'snapshot': this.lastAckSeq = msg.ackSeq; this.opts.onSnapshot?.(msg); break
        case 'event': this.opts.onEvent?.(msg); break
        case 'combat': this.opts.onCombat?.(msg as any); break
      }
    } catch {}
  }

  private buildUrl(raw: string): string {
    // If raw already starts with ws:// or wss://, trust it. Otherwise, coerce to ws/wss based on page protocol.
    if (/^wss?:\/\//i.test(raw)) return raw
    const isSecure = window.location.protocol === 'https:'
    const scheme = isSecure ? 'wss' : 'ws'
    if (/^:\d+/.test(raw)) return `${scheme}://${window.location.hostname}${raw}`
    if (/^\d+$/.test(raw)) return `${scheme}://${window.location.hostname}:${raw}`
    if (/^[a-zA-Z0-9_.-]+:\d+$/.test(raw)) return `${scheme}://${raw}`
    if (/^[a-zA-Z0-9_.-]+$/.test(raw)) return `${scheme}://${raw}:5177`
    return raw
  }

  // Update callbacks without recreating the websocket
  setHandlers(partial: Partial<NetClientOptions>): void {
    this.opts = { ...this.opts, ...partial }
  }

  send(msg: ClientMsg): void {
    try {
      if (this.isOpen()) this.ws!.send(JSON.stringify(msg))
      else this.pendingQueue.push(msg)
    } catch {}
  }

  private flushQueue(): void {
    if (!this.isOpen()) return
    try { for (const m of this.pendingQueue) this.ws!.send(JSON.stringify(m)) } catch {}
    this.pendingQueue.length = 0
  }

  requestInvite(worldId: string): void { this.send({ t: 'invite.create', worldId }) }

  acceptInvite(inviteId: UUID): void { this.send({ t: 'invite.accept', inviteId }) }

  join(name: string, worldId: string, version: string): void { this.send({ t: 'join', name, worldId, version }) }

  sendInput(dt: number, keys: { up: boolean; down: boolean; left: boolean; right: boolean; dash: boolean }, aim?: { x: number; y: number }): number {
    const seq = this.seqCounter++
    this.send({ t: 'input', seq, dt, keys, aim })
    return seq
  }

  cast(skillId: string, atMs: number, params?: Record<string, any>): number {
    const seq = this.seqCounter++
    this.send({ t: 'cast', seq, atMs, skillId, params })
    return seq
  }
}


