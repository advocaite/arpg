import Phaser from 'phaser'

export default class OrbsUI {
  private scene: Phaser.Scene
  private container?: Phaser.GameObjects.Container
  private leftMask?: Phaser.GameObjects.Graphics
  private rightMask?: Phaser.GameObjects.Graphics
  private hpFill?: Phaser.GameObjects.Graphics
  private manaFill?: Phaser.GameObjects.Graphics
  private hpCenter: { x: number; y: number; r: number } = { x: 0, y: 0, r: 34 }
  private manaCenter: { x: number; y: number; r: number } = { x: 0, y: 0, r: 34 }
  private hpText?: Phaser.GameObjects.Text
  private manaText?: Phaser.GameObjects.Text
  private hpRim?: Phaser.GameObjects.Graphics
  private hpSheen?: Phaser.GameObjects.Graphics
  private hpGlow?: Phaser.GameObjects.Graphics
  private manaRim?: Phaser.GameObjects.Graphics
  private manaSheen?: Phaser.GameObjects.Graphics
  private manaGlow?: Phaser.GameObjects.Graphics
  private leftCircleClip?: Phaser.GameObjects.Graphics
  private rightCircleClip?: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene) { this.scene = scene }

  mount(opts: { hotbarBounds: { x: number; y: number; width: number; height: number } | undefined, hp: number, maxHp: number, mana: number, maxMana: number }): void {
    this.unmount()
    const { hotbarBounds } = opts
    const centerX = hotbarBounds ? hotbarBounds.x : this.scene.scale.width / 2
    const baseY = hotbarBounds ? hotbarBounds.y : this.scene.scale.height - 24
    const offsetX = (hotbarBounds ? hotbarBounds.width : 680) / 2 + 60
    const orbRadius = 36

    const leftX = centerX - offsetX
    const rightX = centerX + offsetX

    const hpBg = this.makeOrb(leftX, baseY, orbRadius, 0x331111)
    const hpFill = this.makeOrb(leftX, baseY, orbRadius - 2, 0xaa3333)
    this.hpFill = hpFill
    this.leftMask = this.scene.add.graphics({ x: 0, y: 0 })
    this.leftMask.setVisible(false)
    this.leftMask.setScrollFactor(0)
    hpFill.setMask(new Phaser.Display.Masks.GeometryMask(this.scene, this.leftMask))
    this.hpText = this.scene.add.text(leftX, baseY, '', { fontFamily: 'monospace', color: '#ffd6d6', fontSize: '11px' }).setOrigin(0.5).setScrollFactor(0)
    this.hpCenter = { x: leftX, y: baseY, r: orbRadius - 2 }
    this.hpRim = this.scene.add.graphics(); this.hpSheen = this.scene.add.graphics(); this.hpGlow = this.scene.add.graphics()
    this.hpRim.setScrollFactor(0); this.hpSheen.setScrollFactor(0); this.hpGlow.setScrollFactor(0)
    // Circular clip so sheen/glow never spill outside the orb boundary
    this.leftCircleClip = this.scene.add.graphics({ x: 0, y: 0 })
    this.leftCircleClip.setVisible(false)
    this.leftCircleClip.setScrollFactor(0)
    this.leftCircleClip.fillStyle(0xffffff, 1); this.leftCircleClip.fillCircle(leftX, baseY, orbRadius - 1)
    const leftCircleMask = new Phaser.Display.Masks.GeometryMask(this.scene, this.leftCircleClip)
    this.hpSheen.setMask(leftCircleMask); this.hpGlow.setMask(leftCircleMask)
    this.drawOrbFx(this.hpRim, this.hpSheen, this.hpGlow, this.hpCenter)

    const manaBg = this.makeOrb(rightX, baseY, orbRadius, 0x111133)
    const manaFill = this.makeOrb(rightX, baseY, orbRadius - 2, 0x3355cc)
    this.manaFill = manaFill
    this.rightMask = this.scene.add.graphics({ x: 0, y: 0 })
    this.rightMask.setVisible(false)
    this.rightMask.setScrollFactor(0)
    manaFill.setMask(new Phaser.Display.Masks.GeometryMask(this.scene, this.rightMask))
    this.manaText = this.scene.add.text(rightX, baseY, '', { fontFamily: 'monospace', color: '#d6e8ff', fontSize: '11px' }).setOrigin(0.5).setScrollFactor(0)
    this.manaCenter = { x: rightX, y: baseY, r: orbRadius - 2 }
    this.manaRim = this.scene.add.graphics(); this.manaSheen = this.scene.add.graphics(); this.manaGlow = this.scene.add.graphics()
    this.manaRim.setScrollFactor(0); this.manaSheen.setScrollFactor(0); this.manaGlow.setScrollFactor(0)
    this.rightCircleClip = this.scene.add.graphics({ x: 0, y: 0 })
    this.rightCircleClip.setVisible(false)
    this.rightCircleClip.setScrollFactor(0)
    this.rightCircleClip.fillStyle(0xffffff, 1); this.rightCircleClip.fillCircle(rightX, baseY, orbRadius - 1)
    const rightCircleMask = new Phaser.Display.Masks.GeometryMask(this.scene, this.rightCircleClip)
    this.manaSheen.setMask(rightCircleMask); this.manaGlow.setMask(rightCircleMask)
    this.drawOrbFx(this.manaRim, this.manaSheen, this.manaGlow, this.manaCenter)

    this.container = this.scene.add.container(0, 0, [
      hpBg, hpFill, manaBg, manaFill,
      this.hpGlow, this.hpSheen, this.hpRim,
      this.manaGlow, this.manaSheen, this.manaRim,
      this.hpText, this.manaText,
    ] as any).setScrollFactor(0).setDepth(1650)
    this.update(opts.hp, opts.maxHp, opts.mana, opts.maxMana)
  }

  private makeOrb(x: number, y: number, r: number, color: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics({ x: 0, y: 0 })
    g.fillStyle(color, 1)
    g.fillCircle(x, y, r)
    g.setScrollFactor(0)
    return g
  }

  update(hp: number, maxHp: number, mana: number, maxMana: number): void {
    const hpFrac = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0))
    const manaFrac = Math.max(0, Math.min(1, maxMana > 0 ? mana / maxMana : 0))
    const drawMask = (mask: Phaser.GameObjects.Graphics, center: { x: number; y: number; r: number }, frac: number) => {
      const anyMask: any = mask as any
      anyMask.__frac = frac
      mask.clear(); mask.fillStyle(0xffffff, 1)
      const h = center.r * 2
      const filled = h * frac
      mask.fillRect(center.x - center.r, center.y + center.r - filled, center.r * 2, filled)
    }
    const tweenMask = (mask?: Phaser.GameObjects.Graphics, center?: { x: number; y: number; r: number }, targetFrac?: number) => {
      if (!mask || !center || targetFrac === undefined) return
      const duration = 160
      const state = { f: 0 }
      // read current by sampling via a hidden property on mask
      const anyMask: any = mask as any
      const hasPrev = typeof anyMask.__frac === 'number'
      const from = hasPrev ? anyMask.__frac : targetFrac
      if (!hasPrev) {
        // First draw: snap immediately to avoid filling from 0
        drawMask(mask, center, targetFrac)
        return
      }
      state.f = from
      this.scene.tweens.add({ targets: state, f: targetFrac, duration, onUpdate: () => {
        drawMask(mask, center, state.f)
      } })
    }
    tweenMask(this.leftMask, this.hpCenter, hpFrac)
    tweenMask(this.rightMask, this.manaCenter, manaFrac)
    if (this.hpText) this.hpText.setText(`${Math.floor(hp)}/${Math.floor(maxHp)}`)
    if (this.manaText) this.manaText.setText(`${Math.floor(mana)}/${Math.floor(maxMana)}`)
  }

  relayout(hotbarBounds?: { x: number; y: number; width: number; height: number }): void {
    if (!hotbarBounds) return
    const centerX = hotbarBounds.x
    const baseY = hotbarBounds.y
    const offsetX = hotbarBounds.width / 2 + 60
    const leftX = centerX - offsetX
    const rightX = centerX + offsetX
    this.hpText?.setPosition(leftX, baseY)
    this.manaText?.setPosition(rightX, baseY)
    this.hpCenter.x = leftX; this.hpCenter.y = baseY
    this.manaCenter.x = rightX; this.manaCenter.y = baseY
    // Force masks/clips to update with new center positions
    if (this.leftMask) { (this.leftMask as any).__frac = typeof (this.leftMask as any).__frac === 'number' ? (this.leftMask as any).__frac : 1; this.leftMask.clear() }
    if (this.rightMask) { (this.rightMask as any).__frac = typeof (this.rightMask as any).__frac === 'number' ? (this.rightMask as any).__frac : 1; this.rightMask.clear() }
    // Update circular clips
    if (this.leftCircleClip) { this.leftCircleClip.clear(); this.leftCircleClip.fillStyle(0xffffff, 1); this.leftCircleClip.fillCircle(leftX, baseY, this.hpCenter.r + 1) }
    if (this.rightCircleClip) { this.rightCircleClip.clear(); this.rightCircleClip.fillStyle(0xffffff, 1); this.rightCircleClip.fillCircle(rightX, baseY, this.manaCenter.r + 1) }
    this.drawOrbFx(this.hpRim!, this.hpSheen!, this.hpGlow!, this.hpCenter)
    this.drawOrbFx(this.manaRim!, this.manaSheen!, this.manaGlow!, this.manaCenter)
  }

  private drawOrbFx(rim: Phaser.GameObjects.Graphics, sheen: Phaser.GameObjects.Graphics, glow: Phaser.GameObjects.Graphics, center: { x: number; y: number; r: number }): void {
    if (!rim || !sheen || !glow) return
    const { x, y, r } = center
    rim.clear(); rim.lineStyle(2, 0xffffff, 0.12); rim.strokeCircle(x, y, r)
    glow.clear(); glow.setBlendMode(Phaser.BlendModes.ADD)
    for (let i = 0; i < 4; i++) {
      glow.lineStyle(2, 0xffffff, 0.05 - i * 0.01)
      glow.strokeCircle(x, y, r - 2 - i * 2)
    }
    sheen.clear(); sheen.setBlendMode(Phaser.BlendModes.SCREEN)
    // primary crescent highlight (clipped by circle mask)
    sheen.fillStyle(0xffffff, 0.14)
    const rr = r * 0.95
    const cx = x - r * 0.20
    const cy = y - r * 0.35
    sheen.beginPath(); sheen.arc(cx, cy, rr, Math.PI * 1.05, Math.PI * 1.90, false); sheen.fillPath()
    // small specular highlight
    sheen.fillStyle(0xffffff, 0.18)
    sheen.beginPath(); sheen.arc(x - r * 0.15, y - r * 0.55, r * 0.35, Math.PI * 1.0, Math.PI * 1.7, false); sheen.fillPath()
  }

  unmount(): void {
    this.container?.destroy(); this.container = undefined
    try { this.leftMask?.destroy(); this.rightMask?.destroy(); this.hpText?.destroy(); this.manaText?.destroy(); this.hpRim?.destroy(); this.hpSheen?.destroy(); this.hpGlow?.destroy(); this.manaRim?.destroy(); this.manaSheen?.destroy(); this.manaGlow?.destroy(); this.leftCircleClip?.destroy(); this.rightCircleClip?.destroy(); } catch {}
    this.leftMask = undefined; this.rightMask = undefined; this.hpText = undefined; this.manaText = undefined
    this.hpRim = undefined; this.hpSheen = undefined; this.hpGlow = undefined; this.manaRim = undefined; this.manaSheen = undefined; this.manaGlow = undefined
    this.leftCircleClip = undefined; this.rightCircleClip = undefined
  }
}


