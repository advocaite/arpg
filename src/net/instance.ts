import { NetClient, type NetClientOptions } from '@/net/client'

let singleton: NetClient | null = null

export function getNet(options?: Partial<NetClientOptions>): NetClient {
  if (!singleton) {
    const url = (import.meta as any).env?.VITE_WS_URL || '5177'
    singleton = new NetClient({ url })
    singleton.connect()
  }
  if (options) singleton.setHandlers(options)
  return singleton
}


