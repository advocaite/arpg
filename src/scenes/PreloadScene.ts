import Phaser from 'phaser'

export default class PreloadScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics
  private progressBox!: Phaser.GameObjects.Graphics

  constructor() {
    super({ key: 'Preload' })
  }

  preload(): void {
    const { width, height } = this.scale

    this.progressBox = this.add.graphics(); this.progressBox.fillStyle(0x222222, 0.8); this.progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50)
    this.progressBar = this.add.graphics()
    this.load.on('progress', (value: number) => { this.progressBar.clear(); this.progressBar.fillStyle(0xffffff, 1); this.progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30) })
    this.load.on('complete', () => { this.progressBar.destroy(); this.progressBox.destroy() })

    const g = this.add.graphics({ x: 0, y: 0 }); g.fillStyle(0xffffff, 1); g.fillCircle(12, 12, 12); g.generateTexture('player', 24, 24); g.destroy()
    const gh = this.add.graphics({ x: 0, y: 0 }); gh.fillStyle(0xffff00, 1); gh.fillRect(0, 0, 16, 16); gh.generateTexture('hitbox', 16, 16); gh.destroy()
    const gp = this.add.graphics({ x: 0, y: 0 }); gp.fillStyle(0xff8844, 1); gp.fillCircle(4, 4, 4); gp.generateTexture('projectile', 8, 8); gp.destroy()
    const gw = this.add.graphics({ x: 0, y: 0 }); gw.fillStyle(0x2a2f40, 1); gw.fillRect(0, 0, 32, 32); gw.lineStyle(1, 0x111420, 1); gw.strokeRect(0, 0, 32, 32); gw.generateTexture('wall', 32, 32); gw.destroy()
    const gc = this.add.graphics({ x: 0, y: 0 }); gc.fillStyle(0xf1c40f, 1); gc.fillCircle(6, 6, 6); gc.lineStyle(2, 0xffe680, 1); gc.strokeCircle(6, 6, 5); gc.generateTexture('coin', 12, 12); gc.destroy()
    const ghc = this.add.graphics({ x: 0, y: 0 }); ghc.fillStyle(0xff3b3b, 1); ghc.fillRect(0, 0, 12, 12); ghc.generateTexture('heart', 12, 12); ghc.destroy()
    const gpt = this.add.graphics({ x: 0, y: 0 }); gpt.fillStyle(0xffffff, 1); gpt.fillRect(0, 0, 2, 2); gpt.generateTexture('particle', 2, 2); gpt.destroy()

    // UI icons
    const ip = this.add.graphics({ x: 0, y: 0 }); ip.fillStyle(0xcc3333, 1); ip.fillRect(0, 0, 24, 24); ip.lineStyle(2, 0xff6666, 1); ip.strokeRect(0, 0, 24, 24); ip.generateTexture('icon_potion', 24, 24); ip.destroy()
    const iw = this.add.graphics({ x: 0, y: 0 }); iw.fillStyle(0x888888, 1); iw.fillRect(0, 0, 24, 24); iw.lineStyle(3, 0xb0b0b0, 1); iw.strokeTriangle(4, 18, 12, 6, 20, 18); iw.generateTexture('icon_weapon', 24, 24); iw.destroy()
    const ia = this.add.graphics({ x: 0, y: 0 }); ia.fillStyle(0x3355aa, 1); ia.fillRect(0, 0, 24, 24); ia.lineStyle(2, 0x88aaff, 1); ia.strokeRoundedRect(2, 3, 20, 18, 6); ia.generateTexture('icon_armor', 24, 24); ia.destroy()
    const isk = this.add.graphics({ x: 0, y: 0 }); isk.fillStyle(0x8844cc, 1); isk.fillRect(0, 0, 24, 24); isk.lineStyle(2, 0xcc99ff, 1); isk.strokeRect(0, 0, 24, 24); isk.generateTexture('icon_skill', 24, 24); isk.destroy()

    // VO/SFX preload (place files under /assets/sounds)
    try {
      this.load.audio('vo_gossip_shopkeeper', [
        'assets/sounds/vo_gossip_shopkeeper.ogg',
        'assets/sounds/vo_gossip_shopkeeper.mp3'
      ])
    } catch {}

    // Conversations JSON
    try {
      this.load.json('npc_conversations', 'src/data/npc_conversations.json')
    } catch {}

    // Generic BGM preloads (optional). Worlds can also supply custom URLs which we'll load on demand.
    try {
      this.load.audio('bgm_town', [
        'assets/music/bgm_town.ogg',
        'assets/music/bgm_town.mp3'
      ])
    } catch {}
  }

  create(): void { this.scene.start('MainMenu') }
}
