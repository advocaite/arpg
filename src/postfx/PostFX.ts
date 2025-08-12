import Phaser from 'phaser'
import GradingPipeline from '@/postfx/GradingPipeline'

type FogConfig = { color: number; intensity: number }

export default class PostFX {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private vignette?: Phaser.GameObjects.Graphics
  private fog?: Phaser.GameObjects.Graphics
  private grainTS1?: Phaser.GameObjects.TileSprite
  private grainTS2?: Phaser.GameObjects.TileSprite
  private grainBaseAlphaMain = 0.25
  private grainBaseAlphaCoarse = 0.1
  private enabledVignette = true
  private enabledFog = true
  private enabledGrain = true
  private enabledGrade = true
  private fogCfg: FogConfig = { color: 0x8899aa, intensity: 0.06 }
  private grade?: GradingPipeline

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(1800)
    this.buildAll()
    try { this.scene.scale.on('resize', () => this.rebuild()) } catch {}
  }

  setVignetteEnabled(on: boolean): void { this.enabledVignette = on; this.vignette?.setVisible(on) }
  setFogEnabled(on: boolean): void { this.enabledFog = on; this.fog?.setVisible(on) }
  setGrainEnabled(on: boolean): void {
    this.enabledGrain = on
    this.grainTS1?.setVisible(on)
    this.grainTS2?.setVisible(on)
  }
  setGrainIntensity(alpha: number): void {
    const a = Math.max(0, Math.min(1, alpha))
    this.grainBaseAlphaMain = a
    this.grainBaseAlphaCoarse = Math.max(0, Math.min(1, a * 0.45))
    if (this.grainTS1) this.grainTS1.setAlpha(this.grainBaseAlphaMain)
    if (this.grainTS2) this.grainTS2.setAlpha(this.grainBaseAlphaCoarse)
    const vis = a > 0.0001
    this.grainTS1?.setVisible(vis)
    this.grainTS2?.setVisible(vis)
  }
  getGrainIntensity(): number { return this.grainBaseAlphaMain }
  setGrainScale(scale: number): void {
    const s = Math.max(0.25, Math.min(8, scale))
    try {
      const g1: any = this.grainTS1
      const g2: any = this.grainTS2
      if (g1 && typeof g1.setTileScale === 'function') g1.setTileScale(s, s)
      if (g2 && typeof g2.setTileScale === 'function') g2.setTileScale(Math.max(0.25, Math.min(8, s * 1.8)), Math.max(0.25, Math.min(8, s * 1.8)))
    } catch {}
  }
  setGradeEnabled(on: boolean): void { this.enabledGrade = on; this.applyGradeToggle() }
  setGradeParams(opts: Partial<{ desat: number; amount: number; cool: [number, number, number]; warm: [number, number, number]; strength: number }>): void {
    if (!this.grade) return
    this.grade.setParams(opts)
  }

  setFog(cfg: Partial<FogConfig>): void {
    this.fogCfg = { ...this.fogCfg, ...(cfg as any) }
    this.rebuild()
  }

  setVignetteStrength(mult: number): void {
    // strength 0..1 controls edge darkness; rebuild cheaply by alpha scale
    if (!this.vignette) return
    const clamp = Math.max(0, Math.min(1, mult))
    this.vignette.setAlpha(0.6 * clamp)
  }

  update(delta: number): void {
    if (!this.enabledGrain) return
    const t = (this.scene.time.now % 1000) / 1000
    // Softer flicker, lower amplitude
    const flicker1 = this.grainBaseAlphaMain * (0.97 + 0.03 * Math.sin(t * Math.PI * 2 * 1.4))
    const flicker2 = this.grainBaseAlphaCoarse * (0.97 + 0.03 * Math.cos(t * Math.PI * 2 * 1.2))
    if (this.grainTS1) this.grainTS1.setAlpha(flicker1)
    if (this.grainTS2) this.grainTS2.setAlpha(flicker2)
    // Slight random UV drift to avoid fixed pattern
    const drift = (Math.random() - 0.5) * 0.2
    if (this.grainTS1) { this.grainTS1.tilePositionX += drift; this.grainTS1.tilePositionY += -drift * 0.5 }
    if (this.grainTS2) { this.grainTS2.tilePositionX += -drift * 0.4; this.grainTS2.tilePositionY += drift * 0.3 }
  }

  destroy(): void { try { this.root.destroy(true) } catch {} }

  private rebuild(): void {
    try { this.vignette?.destroy() } catch {}
    try { this.fog?.destroy() } catch {}
    try { this.grainTS1?.destroy() } catch {}
    try { this.grainTS2?.destroy() } catch {}
    this.buildAll()
  }

  private buildAll(): void {
    const w = this.scene.scale.width
    const h = this.scene.scale.height

    // Vignette: concentric circles darkening edges
    this.vignette = this.scene.add.graphics({ x: 0, y: 0 })
    const cx = Math.floor(w / 2)
    const cy = Math.floor(h / 2)
    const maxR = Math.hypot(cx, cy)
    for (let i = 0; i < 18; i++) {
      const t = i / 17
      const r = maxR * (0.45 + t * 0.55)
      const a = Math.min(1, t * 1.2)
      this.vignette.fillStyle(0x000000, a * 0.06)
      this.vignette.fillCircle(cx, cy, r)
    }
    this.vignette.setScrollFactor(0)
    this.vignette.setDepth(0)
    this.vignette.setAlpha(0.3)

    // Fog: subtle tint overlay
    this.fog = this.scene.add.graphics({ x: 0, y: 0 })
    const color = this.fogCfg.color
    const intensity = Math.max(0, Math.min(0.5, this.fogCfg.intensity))
    this.fog.fillStyle(color, intensity)
    this.fog.fillRect(0, 0, w, h)
    // soft center fade: erase a translucent circle
    try {
      const r2 = Math.min(w, h) * 0.35
      this.fog.fillStyle(0x000000, -0.2) // negative alpha has no effect; emulate by layering circles on vignette instead
      // fallback: reduce alpha near center via extra clear rects
      const cx2 = cx, cy2 = cy
      const clearG = this.scene.add.graphics({ x: 0, y: 0 })
      for (let i = 0; i < 6; i++) {
        const t2 = i / 5
        const rr = r2 * (1 - t2 * 0.9)
        clearG.fillStyle(0xffffff, 0.02)
        clearG.fillCircle(cx2, cy2, rr)
      }
      const rt = this.scene.make.renderTexture({ x: 0, y: 0, width: w, height: h }, false)
      rt.draw(this.fog, 0, 0)
      rt.draw(clearG, 0, 0)
      this.fog.destroy(); clearG.destroy()
      this.fog = this.scene.add.graphics()
      rt.setScrollFactor(0).setDepth(0)
      this.root.add(rt)
    } catch {
      this.fog.setScrollFactor(0).setDepth(0)
      this.root.add(this.fog)
    }

    // Grain: simple tileSprites with MULTIPLY (dark-only), controllable alpha
    try {
      this.grainTS1 = this.scene.add.tileSprite(0, 0, w, h, 'dotnoise').setOrigin(0, 0)
      this.grainTS1.setScrollFactor(0)
      this.grainTS1.setDepth(0)
      const t1: any = this.grainTS1
      try { if (typeof t1.setTileScale === 'function') t1.setTileScale(3, 3) } catch {}
      this.grainTS1.setBlendMode(Phaser.BlendModes.MULTIPLY)
      this.grainTS1.setAlpha(this.grainBaseAlphaMain)

      this.grainTS2 = this.scene.add.tileSprite(0, 0, w, h, 'dotnoise').setOrigin(0, 0)
      this.grainTS2.setScrollFactor(0)
      this.grainTS2.setDepth(0)
      const t2: any = this.grainTS2
      try { if (typeof t2.setTileScale === 'function') t2.setTileScale(5, 5) } catch {}
      this.grainTS2.setBlendMode(Phaser.BlendModes.MULTIPLY)
      this.grainTS2.setAlpha(this.grainBaseAlphaCoarse)
    } catch {}

    // Attach to root container
    this.root.removeAll(true)
    // Order: vignette (bottom), fog (middle), grain (top)
    this.root.add([this.vignette])
    if (this.fog && !this.fog.scene) {
      // already replaced by RT; keep as-is
    } else if (this.fog) {
      this.root.add(this.fog)
    }
    if (this.grainTS1) this.root.add(this.grainTS1)
    if (this.grainTS2) this.root.add(this.grainTS2)

    this.setVignetteEnabled(this.enabledVignette)
    this.setFogEnabled(this.enabledFog)
    this.setGrainEnabled(this.enabledGrain)
    this.setupGrading()
    this.applyGradeToggle()
  }

  private setupGrading(): void {
    try {
      const game = this.scene.game
      if (!this.grade) {
        // Register once per game instance
        const key = 'GradingPipeline'
        const renderer: any = game.renderer
        const exists = renderer?.pipelines?.hasPostPipeline(key)
        if (!exists) renderer?.pipelines?.addPostPipeline(key, GradingPipeline)
        this.grade = new GradingPipeline(game)
        // Default D2-esque tone; if LUT present, prefer it at moderate strength
        const hasNeutral = this.scene.textures.exists('lut_neutral')
        if (hasNeutral) {
          try { this.grade.setLUT('lut_neutral', 16, 16) } catch {}
          this.grade.setParams({ strength: 0.6 })
        } else {
          this.grade.setParams({ desat: 0.28, amount: 0.4, cool: [0.95, 1.04, 1.12], warm: [1.1, 1.0, 0.9], strength: 0.6 })
        }
      }
    } catch {}
  }

  private applyGradeToggle(): void {
    try {
      const cam: any = this.scene.cameras?.main
      if (!cam) return
      const key = 'GradingPipeline'
      if (this.enabledGrade) {
        if (!cam.postPipeline?.find((p: any) => p instanceof GradingPipeline)) {
          cam.setPostPipeline(key)
        }
      } else {
        cam.removePostPipeline(GradingPipeline as any)
      }
    } catch {}
  }
}


