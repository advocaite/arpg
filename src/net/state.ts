export function isMpEnabled(): boolean {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('invite')) return true
  } catch {}
  try { return localStorage.getItem('mp.enabled') === '1' } catch {}
  return false
}

export function setMpEnabled(on: boolean): void {
  try { if (on) localStorage.setItem('mp.enabled', '1'); else localStorage.removeItem('mp.enabled') } catch {}
}


