export default class PauseSystem {
  private scene: Phaser.Scene
  private sources: Set<string> = new Set()
  private overlay?: Phaser.GameObjects.Container

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  isPaused(): boolean {
    return this.sources.size > 0
  }

  pause(source: string): void {
    if (!this.sources.has(source)) {
      this.sources.add(source)
      this.applyPausedState()
    }
  }

  resume(source?: string): void {
    if (source) {
      this.sources.delete(source)
    } else {
      this.sources.clear()
    }
    this.applyPausedState()
  }

  private applyPausedState(): void {
    const paused = this.isPaused()
    if (paused) {
      // Properly pause Arcade physics & timers
      const world: any = (this.scene.physics as any).world
      if (world && typeof world.pause === 'function') world.pause()
      this.scene.time.timeScale = 0
      this.showOverlay()
    } else {
      const world: any = (this.scene.physics as any).world
      if (world && typeof world.resume === 'function') world.resume()
      this.scene.time.timeScale = 1
      this.hideOverlay()
    }
  }

  private showOverlay(): void {
    if (this.overlay) return
    const w = this.scene.scale.width
    const h = this.scene.scale.height
    const bg = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0.4)
    const text = this.scene.add.text(0, -h / 2 + 40, 'Paused (ESC to resume)', { fontFamily: 'monospace', color: '#ffffff' }).setOrigin(0.5, 0)
    this.overlay = this.scene.add.container(w / 2, h / 2, [bg, text]).setScrollFactor(0).setDepth(3000)
  }

  private hideOverlay(): void {
    this.overlay?.destroy()
    this.overlay = undefined
  }
}
