export function parseInviteFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const v = params.get('invite')
    return v && v.length > 0 ? v : null
  } catch { return null }
}

export function setInviteToUrl(inviteId: string): void {
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('invite', inviteId)
    window.history.replaceState({}, '', url.toString())
  } catch {}
}


