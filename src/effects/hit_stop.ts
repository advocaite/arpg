import type { EffectContext } from '@/systems/Effects'

export const meta = { ref: 'fx.hitStop' }

export default function hitStop(ctx: EffectContext, params?: Record<string, number | string | boolean>): void {
  const scene: any = ctx.scene as any
  if (scene && scene.__fxSettings && scene.__fxSettings.allowHitStop === false) return

  const durationMs = Number(params?.['durationMs'] ?? 90)
  const clamped = Math.max(10, Math.min(200, durationMs))

  try {
    // Use an unscaled timeout to restore, so gameplay timers (which are scaled) don't stall the restore.
    // Maintain a single hit-stop window that can be extended by overlapping hits.
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
    const until = now + clamped

    if (typeof scene.__hitStopPrevScale !== 'number' || scene.time.timeScale >= 0.999) {
      // Capture previous scale only when not already in hit-stop
      scene.__hitStopPrevScale = scene.time.timeScale
    }
    scene.__hitStopEndAt = Math.max(Number(scene.__hitStopEndAt || 0), until)
    // Apply slow time immediately (do NOT touch physics.world.timeScale)
    scene.time.timeScale = 0.0001

    if (!scene.__hitStopRestoreScheduled) {
      scene.__hitStopRestoreScheduled = true
      const checkRestore = () => {
        try {
          const t = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
          if (t >= Number(scene.__hitStopEndAt || 0)) {
            const restore = (typeof scene.__hitStopPrevScale === 'number') ? scene.__hitStopPrevScale : 1
            scene.time.timeScale = restore
            scene.__hitStopEndAt = 0
            scene.__hitStopPrevScale = undefined
            scene.__hitStopRestoreScheduled = false
            return
          }
          // Schedule next check shortly, without tying to scaled game time
          const remaining = Math.max(1, Number(scene.__hitStopEndAt) - t)
          setTimeout(checkRestore, Math.min(remaining, 32))
        } catch {
          // On any error, fail-safe restore
          scene.time.timeScale = 1
          scene.__hitStopEndAt = 0
          scene.__hitStopPrevScale = undefined
          scene.__hitStopRestoreScheduled = false
        }
      }
      setTimeout(checkRestore, Math.min(clamped, 32))
    }
  } catch {
    // Fallback: brief flash if timer/scaling manipulation fails
    try { (scene.cameras?.main as any)?.flash?.(clamped / 2, 255, 255, 255, false) } catch {}
  }
}


