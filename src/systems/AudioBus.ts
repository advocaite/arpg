import Phaser from 'phaser'

type BusKey = 'bgm' | 'sfx' | 'ui'

export default class AudioBus {
  private scene: Phaser.Scene
  private busVolume: Record<BusKey, number> = { bgm: 1, sfx: 1, ui: 1 }
  private duckUntil: Record<BusKey, number> = { bgm: 0, sfx: 0, ui: 0 }
  private bgm?: Phaser.Sound.BaseSound
  private bgmCombat?: Phaser.Sound.BaseSound

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  setVolume(bus: BusKey, volume: number): void { this.busVolume[bus] = Math.max(0, Math.min(1, volume)) ; this.applyVolumes() }

  private applyVolumes(): void {
    const now = this.scene.time.now
    const volFor = (bus: BusKey): number => {
      const base = this.busVolume[bus]
      if (now < this.duckUntil[bus]) return base * 0.5
      return base
    }
    try { if (this.bgm) (this.bgm as any).setVolume?.(volFor('bgm')) } catch {}
  }

  duck(bus: BusKey, amount: number, durationMs: number): void {
    const now = this.scene.time.now
    const reduce = Math.max(0, Math.min(0.95, amount))
    // Store end time; effective volume is applied lazily in applyVolumes()
    this.duckUntil[bus] = Math.max(this.duckUntil[bus], now + Math.max(50, durationMs))
    // Apply immediately via tween on bgm if applicable for smoothness
    if (bus === 'bgm' && this.bgm) {
      const target = Math.max(0, Math.min(1, (this.busVolume.bgm) * (1 - reduce)))
      try { this.scene.tweens.add({ targets: this.bgm as any, volume: target, duration: 60, yoyo: false }) } catch {}
      this.scene.time.delayedCall(durationMs, () => {
        try { this.scene.tweens.add({ targets: this.bgm as any, volume: this.busVolume.bgm, duration: 120 }) } catch {}
      })
    }
  }

  // Convenience wrappers for common ducks
  duckForUIOpen(): void { this.duck('bgm', 0.4, 260) }
  duckForImpact(): void { this.duck('bgm', 0.35, 180) }

  playSfx(key: string, opts?: { volume?: number; rate?: number; detune?: number; loop?: boolean; bus?: BusKey; duck?: { bus?: BusKey; amount?: number; durationMs?: number } }): void {
    const bus = opts?.bus || 'sfx'
    try {
      if (!this.scene.sound || !this.scene.sound.get || (!this.scene.cache.audio.exists(key) && !this.scene.sound.get(key))) return
      const s = this.scene.sound.add(key, { loop: !!opts?.loop })
      const baseVol = (opts?.volume ?? 1) * (this.busVolume[bus] ?? 1)
      s.setVolume(Math.max(0, Math.min(1, baseVol)))
      if (typeof opts?.rate === 'number') s.setRate(opts.rate)
      if (typeof opts?.detune === 'number') (s as any).setDetune?.(opts.detune)
      s.once(Phaser.Sound.Events.COMPLETE, () => { try { s.destroy() } catch {} })
      s.play()
      const d = opts?.duck
      if (d && d.amount && d.durationMs) this.duck(d.bus || 'bgm', d.amount, d.durationMs)
    } catch {}
  }

  playBgm(key: string, opts?: { loop?: boolean; volume?: number }): void {
    try {
      if (!this.scene.sound) return
      this.bgm?.stop(); this.bgm?.destroy()
      this.bgm = this.scene.sound.add(key, { loop: opts?.loop ?? true, volume: opts?.volume ?? (this.busVolume.bgm) })
      this.bgm.play()
    } catch {}
  }

  ensureCombatLayer(key: string, volume: number): void {
    try {
      if (!this.scene.sound) return
      if (this.bgmCombat && (this.bgmCombat as any).key === key) return
      this.bgmCombat?.stop(); this.bgmCombat?.destroy()
      this.bgmCombat = this.scene.sound.add(key, { loop: true, volume: 0 })
      this.bgmCombat.play()
      // fade to target
      this.scene.tweens.add({ targets: this.bgmCombat as any, volume: Math.max(0, Math.min(1, volume)), duration: 400 })
    } catch {}
  }

  fadeOutCombatLayer(durationMs = 600): void {
    try {
      if (!this.bgmCombat) return
      const t = this.scene.tweens.add({ targets: this.bgmCombat as any, volume: 0, duration: durationMs })
      t.on('complete', () => { try { this.bgmCombat?.stop(); this.bgmCombat?.destroy(); this.bgmCombat = undefined } catch {} })
    } catch {}
  }

  // Stop and destroy any currently playing BGM stems immediately (used on scene shutdown/teleport)
  stopAll(): void {
    try { this.bgmCombat?.stop(); this.bgmCombat?.destroy(); this.bgmCombat = undefined } catch {}
    try { this.bgm?.stop(); this.bgm?.destroy(); this.bgm = undefined } catch {}
  }
}


