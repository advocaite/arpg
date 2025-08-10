export type WaveConfig = {
  index: number
  durationMs: number
  spawnEveryMs: number
  spawnCount: number
}

export default class WaveSystem {
  private scene: Phaser.Scene
  private waves: WaveConfig[]
  private currentIndex = 0
  private elapsedInWave = 0
  private elapsedSinceSpawn = 0
  private onSpawn: (wave: WaveConfig) => void
  private onWaveStart?: (wave: WaveConfig) => void
  private onWaveEnd?: (wave: WaveConfig) => void

  constructor(
    scene: Phaser.Scene,
    waves: WaveConfig[],
    onSpawn: (wave: WaveConfig) => void,
    onWaveStart?: (wave: WaveConfig) => void,
    onWaveEnd?: (wave: WaveConfig) => void
  ) {
    this.scene = scene
    this.waves = waves
    this.onSpawn = onSpawn
    this.onWaveStart = onWaveStart
    this.onWaveEnd = onWaveEnd
  }

  get current(): WaveConfig | null {
    return this.waves[this.currentIndex] ?? null
  }

  get currentNumber(): number {
    return this.current?.index ?? 0
  }

  get timeLeftMs(): number {
    const wave = this.current
    if (!wave) return 0
    return Math.max(0, wave.durationMs - this.elapsedInWave)
  }

  get isFinished(): boolean {
    return this.currentIndex >= this.waves.length
  }

  update(deltaMs: number): void {
    const wave = this.current
    if (!wave) return

    if (this.elapsedInWave === 0) {
      this.onWaveStart?.(wave)
    }

    this.elapsedInWave += deltaMs
    this.elapsedSinceSpawn += deltaMs

    while (this.elapsedSinceSpawn >= wave.spawnEveryMs) {
      this.elapsedSinceSpawn -= wave.spawnEveryMs
      for (let i = 0; i < wave.spawnCount; i++) {
        this.onSpawn(wave)
      }
    }

    if (this.elapsedInWave >= wave.durationMs) {
      this.onWaveEnd?.(wave)
      this.currentIndex += 1
      this.elapsedInWave = 0
      this.elapsedSinceSpawn = 0
    }
  }
}
