import Phaser from 'phaser'
import { PALETTE, PlaceableDef } from '@/painter/Palette'
import { WorldConfig } from '@/types'

export default class PainterScene extends Phaser.Scene {
  private world: WorldConfig = { id: 'painter_world', name: 'Painter', width: 2000, height: 1400, portals: [], npcs: [], obstacles: [], spawners: [], checkpoints: [] }
  private selection?: PlaceableDef
  private ui!: Phaser.GameObjects.Container
  private gridSize = 32
  private objects: Array<{ def: PlaceableDef; x: number; y: number; params: Record<string, any>; visual?: Phaser.GameObjects.GameObject }> = []
  private panelWidth = 220
  private panelHeight = 220
  private inspector?: Phaser.GameObjects.Container
  private selected?: { obj: any; idx: number }
  private history: any[] = []
  private historyIdx = -1
  private isRestoring = false
  private wasd?: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>
  private leftPanelBg?: Phaser.GameObjects.Rectangle
  private rightPanelBg?: Phaser.GameObjects.Rectangle

  constructor() { super({ key: 'Painter' }) }

  init(data: { worldWidth?: number; worldHeight?: number }): void {
    if (data && typeof data.worldWidth === 'number' && data.worldWidth > 0) this.world.width = Math.floor(data.worldWidth)
    if (data && typeof data.worldHeight === 'number' && data.worldHeight > 0) this.world.height = Math.floor(data.worldHeight)
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#131722')
    // Allow RMB usage without browser menu
    try { (this.input.mouse as any)?.disableContextMenu?.() } catch {}
    this.add.text(12, 8, 'World Painter', { fontFamily: 'monospace', color: '#cfe1ff' }).setScrollFactor(0)
    this.ui = this.add.container(0, 0).setScrollFactor(0).setDepth(2000)
    this.buildPalette()
    this.buildInspector()
    // Start with inspector hidden until a selection is made
    try { this.inspector?.setVisible(false) } catch {}
    // Drag support
    this.input.on('dragstart', (_p: any, g: any) => {
      const idx = this.objects.findIndex(o => o.visual === g)
      if (idx >= 0) this.select(idx)
    })
    this.input.on('drag', (_p: Phaser.Input.Pointer, g: any, dx: number, dy: number) => {
      const idx = this.objects.findIndex(o => o.visual === g)
      if (idx < 0) return
      const o = this.objects[idx]
      const snappedX = Math.floor(g.x / this.gridSize) * this.gridSize + this.gridSize / 2
      const snappedY = Math.floor(g.y / this.gridSize) * this.gridSize + this.gridSize / 2
      o.x = snappedX; o.y = snappedY
      try { (o.visual as any).setPosition?.(o.x, o.y) } catch {}
      if (this.selected && this.selected.idx === idx) this.refreshInspector()
    })
    this.input.on('dragend', (_p: any, g: any) => {
      const idx = this.objects.findIndex(o => o.visual === g)
      if (idx >= 0) this.pushHistory()
    })
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // Ignore clicks on the palette panel (left) or inspector panel (right)
      if (p.x < this.panelWidth) return
      if (p.x > this.scale.width - this.panelWidth) return
      const hitIdx = this.objects.findIndex(o => o.visual && (o.visual as any).getBounds && Phaser.Geom.Rectangle.Contains((o.visual as any).getBounds(), p.worldX, p.worldY))
      const hit = hitIdx >= 0
      // If click on empty space, clear selection
      if (p.leftButtonDown() && !hit) {
        this.selected = undefined
        this.refreshInspector()
      }
      if (p.rightButtonDown()) { this.removeAt(p.worldX, p.worldY); return }
      // If clicking on an existing object, select it
      if (p.leftButtonDown() && hit) { this.select(hitIdx); return }
      // Only place when clicking empty space and a palette selection exists
      if (p.leftButtonDown() && !hit && this.selection) this.placeAt(p.worldX, p.worldY)
    })
    // Camera pan/zoom controls
    const cam = this.cameras.main
    let isPanning = false
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.middleButtonDown()) isPanning = true })
    this.input.on('pointerup', (_p: Phaser.Input.Pointer) => { isPanning = false })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (isPanning || this.input.keyboard?.checkDown(this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE), 0)) { cam.scrollX -= p.deltaX; cam.scrollY -= p.deltaY } })
    this.input.on('wheel', (_p: any, _dx: number, dy: number) => { const z = Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.4, 2.5); cam.setZoom(z) })
    // WASD panning
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>
    this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) => {
      const panSpeed = 520
      let dx = 0, dy = 0
      if (this.wasd?.A?.isDown) dx -= 1
      if (this.wasd?.D?.isDown) dx += 1
      if (this.wasd?.W?.isDown) dy -= 1
      if (this.wasd?.S?.isDown) dy += 1
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy) || 1
        cam.scrollX += (dx / len) * panSpeed * (delta / 1000)
        cam.scrollY += (dy / len) * panSpeed * (delta / 1000)
      }
    })

    // Keyboard shortcuts: Delete selected, Ctrl+Z/Ctrl+Y for undo/redo
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.undo(); return }
      if ((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.redo(); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.removeSelected(); return }
    })
    // Simple grid
    const g = this.add.graphics({ x: 0, y: 0 })
    g.lineStyle(1, 0x1c2234, 1)
    for (let x = 0; x < this.world.width; x += this.gridSize) g.lineBetween(x, 0, x, this.world.height)
    for (let y = 0; y < this.world.height; y += this.gridSize) g.lineBetween(0, y, this.world.width, y)
    g.setDepth(0)

    // Keep UI panels aligned on window resize (e.g., opening devtools changes viewport)
    this.scale.on('resize', () => {
      try {
        this.inspector?.setPosition(this.scale.width - this.panelWidth, 0)
        this.leftPanelBg?.setSize(this.panelWidth, this.scale.height)
        this.rightPanelBg?.setSize(this.panelWidth, this.scale.height)
      } catch {}
    })
  }

  private buildPalette(): void {
    const panel = this.add.rectangle(0, 0, this.panelWidth, this.scale.height, 0x0e1320, 0.9).setOrigin(0)
    panel.setScrollFactor(0)
    panel.setStrokeStyle(1, 0x2b324a, 1)
    panel.setInteractive({ useHandCursor: false })
    // Prevent global pointer handlers from acting when clicking inside the panel
    panel.on('pointerdown', (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation() })
    panel.setDepth(3000)
    this.ui.add(panel)
    this.leftPanelBg = panel
    let y = 20
    for (const def of PALETTE) {
      const btn = this.add.text(12, y, `[ ${def.label} ]`, {
        fontFamily: 'monospace',
        color: '#aaf',
        fontSize: '12px',
        wordWrap: { width: this.panelWidth - 24, useAdvancedWrap: true }
      }).setOrigin(0)
      btn.setScrollFactor(0)
      btn.setInteractive({ useHandCursor: true })
      btn.on('pointerdown', (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event?.stopPropagation();
        this.selection = def
        // Visual feedback: highlight current selection label
        try {
          this.ui.iterate((child: any) => {
            if (child?.style && typeof child.setStyle === 'function') child.setStyle({ color: '#aaf' })
          })
          btn.setStyle({ color: '#ffd166' })
        } catch {}
      })
      this.ui.add(btn)
      // Advance Y based on rendered height to avoid overflow
      const bounds = btn.getBounds()
      y += Math.ceil(bounds.height) + 6
    }
    // Clear Tool button to deselect current paint tool
    const clearTool = this.add.text(12, y + 6, '[ Clear Tool ]', { fontFamily: 'monospace', color: '#aaf', fontSize: '12px' }).setOrigin(0)
    clearTool.setScrollFactor(0)
    clearTool.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation(); this.selection = undefined })
    this.ui.add(clearTool)
    const exportBtn = this.add.text(12, this.scale.height - 88, '[ Export JSON ]', { fontFamily: 'monospace', color: '#ffd166', fontSize: '12px' }).setOrigin(0)
    exportBtn.setScrollFactor(0)
    exportBtn.setInteractive({ useHandCursor: true })
    exportBtn.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation(); this.exportJson() })
    this.ui.add(exportBtn)
    const saveBtn = this.add.text(12, this.scale.height - 64, '[ Save Session ]', { fontFamily: 'monospace', color: '#aaf', fontSize: '12px' }).setOrigin(0)
    saveBtn.setScrollFactor(0)
    saveBtn.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation(); this.saveSession() })
    const loadBtn = this.add.text(12, this.scale.height - 40, '[ Load Session ]', { fontFamily: 'monospace', color: '#aaf', fontSize: '12px' }).setOrigin(0)
    loadBtn.setScrollFactor(0)
    loadBtn.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation(); this.loadSession() })
    const undoBtn = this.add.text(this.panelWidth - 100, this.scale.height - 64, '[ Undo ]', { fontFamily: 'monospace', color: '#ffd166', fontSize: '12px' }).setOrigin(0)
    undoBtn.setScrollFactor(0)
    undoBtn.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation(); this.undo() })
    const redoBtn = this.add.text(this.panelWidth - 100, this.scale.height - 40, '[ Redo ]', { fontFamily: 'monospace', color: '#ffd166', fontSize: '12px' }).setOrigin(0)
    redoBtn.setScrollFactor(0)
    redoBtn.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation(); this.redo() })
    const loadWorldBtn = this.add.text(12, this.scale.height - 112, '[ Load World JSON ]', { fontFamily: 'monospace', color: '#ffd166', fontSize: '12px' }).setOrigin(0)
    loadWorldBtn.setScrollFactor(0)
    loadWorldBtn.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation(); this.openWorldFilePicker() })
    this.ui.add(loadWorldBtn); this.ui.add(saveBtn); this.ui.add(loadBtn); this.ui.add(undoBtn); this.ui.add(redoBtn)
  }

  private openWorldFilePicker(): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        this.loadWorldConfigIntoScene(data)
      } catch (e) {
        console.error('[Painter] Failed to load world JSON', e)
      }
    }
    input.click()
  }

  private loadWorldConfigIntoScene(cfg: any): void {
    // Update canvas/world size if provided
    try {
      if (typeof cfg.width === 'number' && typeof cfg.height === 'number') {
        this.world.width = Math.max(1, Math.floor(cfg.width))
        this.world.height = Math.max(1, Math.floor(cfg.height))
      }
      if (typeof cfg.id === 'string') this.world.id = cfg.id
      if (typeof cfg.name === 'string') this.world.name = cfg.name
    } catch {}
    // Build flat list for rebuild
    const list: any[] = []
    const push = (defId: string, type: string, x?: number, y?: number, params?: Record<string, any>) => {
      if (typeof x !== 'number' || typeof y !== 'number') return
      list.push({ defId, type, x, y, params: params || {} })
    }
    // Obstacles
    try { (cfg.obstacles || []).forEach((o: any) => push('obstacle_block', 'obstacle', o.x, o.y, {})) } catch {}
    // Lights (torch as default; sky lights supported via params.type === 'sky')
    try { (cfg.lights || []).forEach((L: any) => push(L?.type === 'sky' || L?.followCamera ? 'light_sky' : 'light_torch', 'light', L.x, L.y, { color: L.color, radius: L.radius, intensity: L.intensity, flicker: L.flicker, type: L.type, followCamera: L.followCamera })) } catch {}
    // Portals
    try { (cfg.portals || []).forEach((p: any) => push('portal_generic', 'portal', p.x, p.y, { name: p.name, destinationScene: p.destinationScene, destinationId: p.destinationId })) } catch {}
    // NPCs (default to shopkeeper role if missing)
    try {
      (cfg.npcs || []).forEach((n: any) => {
        const p = (n.params || {})
        push('npc_shopkeeper', 'npc', n.x, n.y, {
          name: n.name,
          role: n.role || 'shopkeeper',
          brainId: n.brainId,
          brainParams: p && typeof p === 'object' ? p : {},
          conversationBundles: Array.isArray(n.conversationBundles) ? n.conversationBundles : [],
          // Visibility requirements (either at root or inside params)
          requireActive: p.requireActive || n.requireActive || [],
          requireCompleted: p.requireCompleted || n.requireCompleted || [],
          requireNotActive: p.requireNotActive || n.requireNotActive || [],
          requireNotCompleted: p.requireNotCompleted || n.requireNotCompleted || []
        })
      })
    } catch {}
    // Decor (non-colliding)
    try { (cfg.decor || []).forEach((d: any) => push('decor_leaves', 'decor', d.x, d.y, { kind: d.kind, tint: d.tint })) } catch {}
		// Spawners
    try { (cfg.spawners || []).forEach((s: any) => push('spawner_default', 'spawner', s.x, s.y, { monsterId: s.monsterId, everyMs: s.everyMs, count: s.count, limit: s.limit, startDelayMs: s.startDelayMs })) } catch {}
    // Checkpoints
    try { (cfg.checkpoints || []).forEach((c: any) => push('checkpoint_default', 'checkpoint', c.x, c.y, { name: c.name })) } catch {}
		// Triggers
		try { (cfg.triggers || []).forEach((t: any) => push('trigger_area', 'trigger', t.x, t.y, { id: t.id, ref: t.ref, width: t.width, height: t.height, params: t.params || {}, once: !!t.once, persist: !!t.persist })) } catch {}
    // Start point (single)
    try { if (cfg.start && typeof cfg.start.x === 'number' && typeof cfg.start.y === 'number') { list.push({ defId: 'start_point', type: 'start', x: cfg.start.x, y: cfg.start.y, params: {} }) } } catch {}
    this.rebuildFromSerialized(list)
    this.pushHistory()
  }

  private placeAt(wx: number, wy: number, suppressHistory: boolean = false): void {
    if (!this.selection) return
    // Snap to tile center
    const x = Math.floor(wx / this.gridSize) * this.gridSize + this.gridSize / 2
    const y = Math.floor(wy / this.gridSize) * this.gridSize + this.gridSize / 2
    const obj = { def: this.selection, x, y, params: { ...this.selection.defaults } } as any
    // Enforce exclusivity for singletons (e.g., Start Point)
    if (obj.def.type === 'start') {
      for (let i = this.objects.length - 1; i >= 0; i--) {
        const o = this.objects[i]
        if (o.def.type === 'start') {
          try { (o.visual as any)?.destroy?.() } catch {}
          this.objects.splice(i, 1)
        }
      }
    }
    // Visual stub
    if (obj.def.type === 'light') {
      const c = this.add.circle(x, y, 6, 0x66ccff, 1)
      c.setDepth(10)
      obj.visual = c
    } else if (obj.def.type === 'obstacle') {
      const r = this.add.rectangle(x, y, this.gridSize, this.gridSize, 0x49516e, 1).setOrigin(0.5)
      r.setStrokeStyle(1, 0x1e2538, 1)
      r.setDepth(5)
      obj.visual = r
    } else if (obj.def.type === 'portal') {
      const p = this.add.rectangle(x, y, 14, 18, 0x66e3ff, 1).setDepth(8)
      p.setStrokeStyle(1, 0x2a86ff, 1)
      obj.visual = p
    } else if (obj.def.type === 'npc') {
      const n = this.add.circle(x, y, 6, 0xffd166, 1)
      n.setDepth(8)
      obj.visual = n
    } else if (obj.def.type === 'decor') {
      const d = this.add.circle(x, y, 4, 0x6fbf73, 0.9)
      d.setDepth(3)
      obj.visual = d
    } else if (obj.def.type === 'spawner') {
      const s = this.add.triangle(x, y, -6, 6, 6, 6, 0, -6, 0xff66aa, 1).setDepth(7)
      obj.visual = s
    } else if (obj.def.type === 'checkpoint') {
      const c = this.add.star(x, y, 5, 3, 7, 0x66aaff, 1).setDepth(6)
      obj.visual = c
		} else if (obj.def.type === 'start') {
      const st = this.add.rectangle(x, y, 10, 10, 0x33ffaa, 1).setDepth(9)
      st.setStrokeStyle(1, 0x117755, 1)
      obj.visual = st
		} else if (obj.def.type === 'trigger') {
			const w = Number(obj.params?.width ?? this.gridSize)
			const h = Number(obj.params?.height ?? this.gridSize)
			const r = this.add.rectangle(x, y, w, h, 0xff00ff, 0.18).setDepth(2)
			r.setStrokeStyle(1, 0xaa33aa, 1)
			obj.visual = r
    }
    this.objects.push(obj)
    // Interactions on the visual
    try {
      (obj.visual as any)?.setInteractive?.({ useHandCursor: true })
        ?.on?.('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if (pointer.rightButtonDown()) { this.removeAt(pointer.worldX, pointer.worldY); return }
          // Left click selects
          const idx = this.objects.indexOf(obj)
          this.select(idx)
        })
      this.input.setDraggable(obj.visual as any, true)
    } catch {}
		if (!suppressHistory && !this.isRestoring) this.pushHistory()
  }

  private removeAt(wx: number, wy: number): void {
    const x = Math.floor(wx / this.gridSize) * this.gridSize + this.gridSize / 2
    const y = Math.floor(wy / this.gridSize) * this.gridSize + this.gridSize / 2
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i]
      if (Math.abs(o.x - x) <= this.gridSize / 2 && Math.abs(o.y - y) <= this.gridSize / 2) {
        try { (o.visual as any)?.destroy?.() } catch {}
        this.objects.splice(i, 1)
        if (this.selected && this.selected.idx === i) { this.selected = undefined; this.refreshInspector() }
        this.pushHistory()
        break
      }
    }
  }

  private select(idx: number): void {
    if (idx < 0 || idx >= this.objects.length) { this.selected = undefined; this.refreshInspector(); return }
    this.selected = { obj: this.objects[idx], idx }
    // Highlight
    this.objects.forEach((o, i) => {
      try {
        if ((o.visual as any)?.setStrokeStyle) {
          ;(o.visual as any).setStrokeStyle(i === idx ? 2 : 1, i === idx ? 0xffd166 : 0x1e2538, 1)
        }
      } catch {}
    })
    if (this.inspector) this.inspector.setVisible(true)
    this.refreshInspector()
  }

  private buildInspector(): void {
    const x = this.scale.width - this.panelWidth, y = 0
    const panel = this.add.container(x, y)
    panel.setScrollFactor(0)
    const bg = this.add.rectangle(0, 0, this.panelWidth, this.scale.height, 0x0b1020, 0.95).setOrigin(0)
    bg.setScrollFactor(0)
    bg.setStrokeStyle(1, 0x2b324a, 1)
    bg.setInteractive({ useHandCursor: false }).on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation() })
    panel.add(bg)
    this.rightPanelBg = bg
    const title = this.add.text(12, 8, 'Inspector', { fontFamily: 'monospace', color: '#cfe1ff', fontSize: '12px' }).setOrigin(0)
    title.setScrollFactor(0)
    panel.add(title)
    const close = this.add.text(this.panelWidth - 18, 6, 'x', { fontFamily: 'monospace', color: '#ffd166', fontSize: '12px' }).setOrigin(0)
    close.setScrollFactor(0)
    close.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation(); this.selected = undefined; try { this.inspector?.setVisible(false) } catch {}; this.refreshInspector() })
    panel.add(close)
    this.ui.add(panel)
    this.inspector = panel
    this.refreshInspector()
  }

  private clearInspector(): void {
    if (!this.inspector) return
    this.inspector.removeAll(true)
    // Re-add panel bg and title
    const bg = this.add.rectangle(0, 0, this.panelWidth, this.scale.height, 0x0b1020, 0.95).setOrigin(0)
    bg.setScrollFactor(0)
    bg.setStrokeStyle(1, 0x2b324a, 1)
    const title = this.add.text(12, 8, 'Inspector', { fontFamily: 'monospace', color: '#cfe1ff', fontSize: '12px' }).setOrigin(0)
    title.setScrollFactor(0)
    const close = this.add.text(this.panelWidth - 18, 6, 'x', { fontFamily: 'monospace', color: '#ffd166', fontSize: '12px' }).setOrigin(0)
    close.setScrollFactor(0)
    close.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation(); this.selected = undefined; try { this.inspector?.setVisible(false) } catch {}; this.refreshInspector() })
    this.inspector.add(bg); this.inspector.add(title)
    this.inspector.add(close)
  }

  private addNumControl(label: string, value: number, onChange: (nv: number) => void, y: number, step = 10, min = 0, max = 9999): number {
    if (!this.inspector) return y
    let cur = value
    const t = this.add.text(12, y, `${label}: ${Math.round(cur)}`, { fontFamily: 'monospace', color: '#aab', fontSize: '12px' }).setOrigin(0)
    const minus = this.add.text(this.panelWidth - 90, y, '[-]', { fontFamily: 'monospace', color: '#ffd166', fontSize: '12px' }).setOrigin(0)
    const plus = this.add.text(this.panelWidth - 50, y, '[+]', { fontFamily: 'monospace', color: '#ffd166', fontSize: '12px' }).setOrigin(0)
    t.setScrollFactor(0); minus.setScrollFactor(0); plus.setScrollFactor(0)
    const update = (nv: number) => { const clamped = Math.max(min, Math.min(max, nv)); cur = clamped; onChange(clamped); t.setText(`${label}: ${Math.round(clamped)}`) }
    minus.setInteractive({ useHandCursor: true })
    plus.setInteractive({ useHandCursor: true })
    // Stop propagation so global pointer handler doesn't fire after opening devtools/resizing
    minus.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation(); update(cur - step); this.pushHistory() })
    plus.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation(); update(cur + step); this.pushHistory() })
    this.inspector.add(t); this.inspector.add(minus); this.inspector.add(plus)
    return y + 20
  }

  private addButton(label: string, y: number, onClick: () => void): number {
    if (!this.inspector) return y
    const b = this.add.text(12, y, `[ ${label} ]`, { fontFamily: 'monospace', color: '#aaf', fontSize: '12px' }).setOrigin(0)
    b.setScrollFactor(0)
    b.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation(); onClick() })
    this.inspector.add(b)
    return y + 22
  }

  private refreshInspector(): void {
    if (!this.inspector) return
    this.clearInspector()
    let y = 28
    if (!this.selected) {
      try { this.inspector?.setVisible(true) } catch {}
      const title = this.add.text(12, y, 'World Settings', { fontFamily: 'monospace', color: '#ffd166', fontSize: '12px' }).setOrigin(0)
      this.inspector.add(title); y += 22
      // ID/Name
      y = this.addButton(`ID: ${this.world.id}`, y, () => { const v = prompt('World id', this.world.id); if (v) { this.world.id = v; this.pushHistory() } })
      y = this.addButton(`Name: ${this.world.name}`, y, () => { const v = prompt('World name', this.world.name); if (v) { this.world.name = v; this.pushHistory() } })
      // Size
      y = this.addNumControl('Width', this.world.width, (nv) => { this.world.width = Math.max(32, nv) }, y, 32, 32, 20000)
      y = this.addNumControl('Height', this.world.height, (nv) => { this.world.height = Math.max(32, nv) }, y, 32, 32, 20000)
      // Ambient Light
      const amb = (this.world as any).ambientLight ?? 0x20242c
      y = this.addButton(`Ambient: 0x${Number(amb).toString(16)}`, y, () => {
        const v = prompt('Ambient light hex (e.g., #20242c or 0x20242c)', typeof amb === 'number' ? '0x' + Number(amb).toString(16) : String(amb))
        if (v !== null) {
          let parsed = NaN
          try { const s = v.trim(); parsed = s.startsWith('#') ? parseInt(s.slice(1), 16) : (s.startsWith('0x') ? parseInt(s.slice(2), 16) : parseInt(s, 16)) } catch {}
          if (!Number.isNaN(parsed)) { (this.world as any).ambientLight = parsed; this.pushHistory() }
        }
      })
      return
    }
    try { this.inspector?.setVisible(true) } catch {}
    const o = this.selected.obj
    const type = o.def.type
    const label = this.add.text(12, y, `${o.def.label}`, { fontFamily: 'monospace', color: '#ffd166', fontSize: '12px', wordWrap: { width: this.panelWidth - 24 } }).setOrigin(0)
    this.inspector.add(label); y += 22
    y = this.addNumControl('X', o.x, (nv) => { o.x = nv; (o.visual as any)?.setPosition?.(o.x, o.y) }, y, this.gridSize, 0, this.world.width)
    y = this.addNumControl('Y', o.y, (nv) => { o.y = nv; (o.visual as any)?.setPosition?.(o.x, o.y) }, y, this.gridSize, 0, this.world.height)
    if (type === 'light') {
      y = this.addNumControl('Radius', Number(o.params.radius ?? 200), (nv) => { o.params.radius = nv }, y, 20, 20, 8000)
      y = this.addNumControl('Intensity', Number(o.params.intensity ?? 1) * 100, (nv) => { o.params.intensity = nv / 100 }, y, 5, 0, 200)
      // Flicker toggle (evaluate live state each click)
      y = this.addButton(`Flicker: ${o.params.flicker === false ? 'Off' : 'On'}`, y, () => {
        const current = !(o.params.flicker === false)
        const next = !current
        o.params.flicker = next
        this.refreshInspector(); this.pushHistory()
      })
      // Type toggle: point/sky
      const isSky = (String(o.params.type || 'point') === 'sky') || (o.params.followCamera === true)
      y = this.addButton(`Type: ${isSky ? 'Sky' : 'Point'}`, y, () => {
        const wasSky = (String(o.params.type || 'point') === 'sky') || (o.params.followCamera === true)
        const nextIsSky = !wasSky
        if (nextIsSky) { o.params.type = 'sky'; o.params.followCamera = true } else { o.params.type = 'point'; delete o.params.followCamera }
        this.refreshInspector(); this.pushHistory()
      })
      // followCamera toggle (derive current each click)
      y = this.addButton(`Follow Camera: ${o.params.followCamera ? 'On' : 'Off'}`, y, () => {
        const nowFollow = !!o.params.followCamera
        o.params.followCamera = !nowFollow
        if (o.params.followCamera) o.params.type = 'sky'
        this.refreshInspector(); this.pushHistory()
      })
      y = this.addButton('Cycle Color', y, () => { const colors = [0xffaa55, 0x66ccff, 0x88ff66, 0xff66cc, 0xffffff]; const cur = Number(o.params.color ?? 0xffaa55); const idx = (colors.indexOf(cur) + 1) % colors.length; o.params.color = colors[idx]; try { (o.visual as any).setFillStyle?.(o.params.color, 1) } catch {}; this.pushHistory() })
      y = this.addButton('Set Color (hex)', y, () => {
        const current = (o.params.color ?? 0xffaa55)
        const v = prompt('Enter hex color (e.g., #ffaa55 or 0xffaa55)', typeof current === 'number' ? '0x' + current.toString(16) : String(current))
        if (v !== null) {
          let parsed = NaN
          try {
            const s = v.trim()
            parsed = s.startsWith('#') ? parseInt(s.slice(1), 16) : (s.startsWith('0x') ? parseInt(s.slice(2), 16) : parseInt(s, 16))
          } catch {}
          if (!Number.isNaN(parsed)) { o.params.color = parsed; try { (o.visual as any).setFillStyle?.(parsed, 1) } catch {}; this.pushHistory() }
        }
      })
      // Visibility by trigger
      y = this.addButton('Hidden By Trigger Id', y, () => { const v = prompt('Trigger id that hides this (persist=true once)', o.params.hiddenByTriggerId || ''); if (v !== null) { o.params.hiddenByTriggerId = v || undefined; this.pushHistory() } })
      y = this.addButton('Shown By Trigger Id', y, () => { const v = prompt('Trigger id that shows this (persist=true once)', o.params.shownByTriggerId || ''); if (v !== null) { o.params.shownByTriggerId = v || undefined; this.pushHistory() } })
    } else if (type === 'portal') {
      y = this.addButton('Set Name', y, () => { const v = prompt('Portal name', o.params.name || 'Portal'); if (v !== null) { o.params.name = v; this.pushHistory() } })
      y = this.addButton('Set Destination Scene', y, () => { const v = prompt('Destination scene (e.g., World)', o.params.destinationScene || 'World'); if (v !== null) { o.params.destinationScene = v; this.pushHistory() } })
      y = this.addButton('Set Destination Id', y, () => { const v = prompt('Destination world id', o.params.destinationId || 'town'); if (v !== null) { o.params.destinationId = v; this.pushHistory() } })
      // Visibility by trigger
      y = this.addButton('Hidden By Trigger Id', y, () => { const v = prompt('Trigger id that hides this (persist=true once)', o.params.hiddenByTriggerId || ''); if (v !== null) { o.params.hiddenByTriggerId = v || undefined; this.pushHistory() } })
      y = this.addButton('Shown By Trigger Id', y, () => { const v = prompt('Trigger id that shows this (persist=true once)', o.params.shownByTriggerId || ''); if (v !== null) { o.params.shownByTriggerId = v || undefined; this.pushHistory() } })
    } else if (type === 'npc') {
      y = this.addButton('Set Name', y, () => { const v = prompt('NPC name', o.params.name || 'NPC'); if (v !== null) { o.params.name = v; this.pushHistory() } })
      // Role presets as prompt list
      y = this.addButton('Set Role (preset)', y, () => {
        const presets = ['shopkeeper', 'blacksmith', 'trainer', 'healer', 'questgiver', 'flavor']
        const current = o.params.role || 'shopkeeper'
        const v = prompt(`NPC role (${presets.join(', ')})`, current)
        if (v !== null) { o.params.role = v; this.pushHistory() }
      })
      y = this.addButton(`Brain Id: ${o.params.brainId || '(none)'}`, y, () => { const v = prompt('NPC brain id (e.g., brain_assist_player)', o.params.brainId || ''); if (v !== null) { o.params.brainId = v || undefined; this.pushHistory() } })
      y = this.addButton('Brain Params (JSON)', y, () => {
        const cur = JSON.stringify(o.params.brainParams || {}, null, 2)
        const v = prompt('Enter brain params JSON', cur)
        if (v !== null) {
          try { o.params.brainParams = JSON.parse(v) } catch { /* ignore parse error */ }
          this.pushHistory()
        }
      })
      y = this.addButton('Conversation Bundles (comma-separated)', y, () => {
        const list = Array.isArray(o.params.conversationBundles) ? o.params.conversationBundles : []
        const v = prompt('Bundle ids (comma-separated)', list.join(','))
        if (v !== null) { o.params.conversationBundles = v.split(',').map(s => s.trim()).filter(Boolean); this.pushHistory() }
      })
      // Visibility gates
      const mkList = (arr: any) => Array.isArray(arr) ? arr : []
      y = this.addButton(`Require Active (comma)`, y, () => {
        const v = prompt('Quest ids that must be active (comma-separated)', mkList(o.params.requireActive).join(','))
        if (v !== null) { o.params.requireActive = v.split(',').map((s: string) => s.trim()).filter(Boolean); this.pushHistory() }
      })
      y = this.addButton(`Require Completed (comma)`, y, () => {
        const v = prompt('Quest ids that must be completed (comma-separated)', mkList(o.params.requireCompleted).join(','))
        if (v !== null) { o.params.requireCompleted = v.split(',').map((s: string) => s.trim()).filter(Boolean); this.pushHistory() }
      })
      y = this.addButton(`Require Not Active (comma)`, y, () => {
        const v = prompt('Quest ids that must NOT be active (comma-separated)', mkList(o.params.requireNotActive).join(','))
        if (v !== null) { o.params.requireNotActive = v.split(',').map((s: string) => s.trim()).filter(Boolean); this.pushHistory() }
      })
      y = this.addButton(`Require Not Completed (comma)`, y, () => {
        const v = prompt('Quest ids that must NOT be completed (comma-separated)', mkList(o.params.requireNotCompleted).join(','))
        if (v !== null) { o.params.requireNotCompleted = v.split(',').map((s: string) => s.trim()).filter(Boolean); this.pushHistory() }
      })
      // Visibility by trigger
      y = this.addButton('Hidden By Trigger Id', y, () => { const v = prompt('Trigger id that hides this (persist=true once)', o.params.hiddenByTriggerId || ''); if (v !== null) { o.params.hiddenByTriggerId = v || undefined; this.pushHistory() } })
      y = this.addButton('Shown By Trigger Id', y, () => { const v = prompt('Trigger id that shows this (persist=true once)', o.params.shownByTriggerId || ''); if (v !== null) { o.params.shownByTriggerId = v || undefined; this.pushHistory() } })
    } else if (type === 'spawner') {
      y = this.addButton('Monster Id', y, () => { const v = prompt('Monster id', o.params.monsterId || 'chaser_basic'); if (v !== null) { o.params.monsterId = v; this.pushHistory() } })
      y = this.addNumControl('Every Ms', Number(o.params.everyMs ?? 1000), (nv) => { o.params.everyMs = nv }, y, 50, 100, 60000)
      y = this.addNumControl('Count', Number(o.params.count ?? 1), (nv) => { o.params.count = nv }, y, 1, 1, 50)
      y = this.addNumControl('Limit', Number(o.params.limit ?? 0), (nv) => { o.params.limit = nv }, y, 1, 0, 9999)
      y = this.addNumControl('Start Delay', Number(o.params.startDelayMs ?? 0), (nv) => { o.params.startDelayMs = nv }, y, 50, 0, 60000)
      // Visibility by trigger
      y = this.addButton('Hidden By Trigger Id', y, () => { const v = prompt('Trigger id that hides this (persist=true once)', o.params.hiddenByTriggerId || ''); if (v !== null) { o.params.hiddenByTriggerId = v || undefined; this.pushHistory() } })
      y = this.addButton('Shown By Trigger Id', y, () => { const v = prompt('Trigger id that shows this (persist=true once)', o.params.shownByTriggerId || ''); if (v !== null) { o.params.shownByTriggerId = v || undefined; this.pushHistory() } })
    } else if (type === 'checkpoint') {
      y = this.addButton('Set Name', y, () => { const v = prompt('Checkpoint name', o.params.name || 'Checkpoint'); if (v !== null) { o.params.name = v; this.pushHistory() } })
      // Visibility by trigger
      y = this.addButton('Hidden By Trigger Id', y, () => { const v = prompt('Trigger id that hides this (persist=true once)', o.params.hiddenByTriggerId || ''); if (v !== null) { o.params.hiddenByTriggerId = v || undefined; this.pushHistory() } })
      y = this.addButton('Shown By Trigger Id', y, () => { const v = prompt('Trigger id that shows this (persist=true once)', o.params.shownByTriggerId || ''); if (v !== null) { o.params.shownByTriggerId = v || undefined; this.pushHistory() } })
    	} else if (type === 'decor') {
      y = this.addButton('Set Kind', y, () => { const v = prompt('Decor kind (e.g., leaves, crate, banner)', o.params.kind || 'leaves'); if (v !== null) { o.params.kind = v; this.pushHistory() } })
      y = this.addButton('Set Tint (hex)', y, () => {
        const current = (o.params.tint ?? 0xffffff)
        const v = prompt('Enter tint hex (e.g., #88cc44 or 0x88cc44)', typeof current === 'number' ? '0x' + current.toString(16) : String(current))
        if (v !== null) {
          let parsed = NaN
          try {
            const s = v.trim()
            parsed = s.startsWith('#') ? parseInt(s.slice(1), 16) : (s.startsWith('0x') ? parseInt(s.slice(2), 16) : parseInt(s, 16))
          } catch {}
          if (!Number.isNaN(parsed)) { o.params.tint = parsed; try { (o.visual as any).setFillStyle?.(parsed, 0.9) } catch {}; this.pushHistory() }
        
    		}
      })
      // Visibility by trigger
      y = this.addButton('Hidden By Trigger Id', y, () => { const v = prompt('Trigger id that hides this (persist=true once)', o.params.hiddenByTriggerId || ''); if (v !== null) { o.params.hiddenByTriggerId = v || undefined; this.pushHistory() } })
      y = this.addButton('Shown By Trigger Id', y, () => { const v = prompt('Trigger id that shows this (persist=true once)', o.params.shownByTriggerId || ''); if (v !== null) { o.params.shownByTriggerId = v || undefined; this.pushHistory() } })
    }else if (type === 'trigger') {
    } else if (type === 'obstacle') {
      // Visibility by trigger for obstacles
      y = this.addButton('Hidden By Trigger Id', y, () => { const v = prompt('Trigger id that hides this (persist=true once)', o.params?.hiddenByTriggerId || ''); if (v !== null) { o.params.hiddenByTriggerId = v || undefined; this.pushHistory() } })
      y = this.addButton('Shown By Trigger Id', y, () => { const v = prompt('Trigger id that shows this (persist=true once)', o.params?.shownByTriggerId || ''); if (v !== null) { o.params.shownByTriggerId = v || undefined; this.pushHistory() } })
			// Id
			y = this.addButton(`Id: ${o.params.id || '(auto)'}`, y, () => { const v = prompt('Trigger id (optional, used for persistence)', o.params.id || ''); if (v !== null) { o.params.id = v || undefined; this.pushHistory() } })
			// Ref module
			y = this.addButton(`Ref: ${o.params.ref || '(unset)'}`, y, () => { const v = prompt('Trigger ref (module under src/triggers/, e.g., door_open)', o.params.ref || 'door_open'); if (v !== null) { o.params.ref = v; this.pushHistory() } })
			// Params JSON
			y = this.addButton('Params (JSON)', y, () => {
				const cur = JSON.stringify(o.params.params || {}, null, 2)
				const v = prompt('Enter params JSON', cur)
				if (v !== null) { try { o.params.params = JSON.parse(v) } catch {}; this.pushHistory() }
			})
			// Width/Height
			y = this.addNumControl('Width', Number(o.params.width ?? this.gridSize), (nv) => { o.params.width = nv; try { (o.visual as any)?.setSize?.(nv, Number(o.params.height ?? this.gridSize)); (o.visual as any)?.setDisplaySize?.(nv, Number(o.params.height ?? this.gridSize)) } catch {} }, y, this.gridSize, 8, 4096)
			y = this.addNumControl('Height', Number(o.params.height ?? this.gridSize), (nv) => { o.params.height = nv; try { (o.visual as any)?.setSize?.(Number(o.params.width ?? this.gridSize), nv); (o.visual as any)?.setDisplaySize?.(Number(o.params.width ?? this.gridSize), nv) } catch {} }, y, this.gridSize, 8, 4096)
			// Once toggle
			y = this.addButton(`Once: ${o.params.once ? 'Yes' : 'No'}`, y, () => { o.params.once = !o.params.once; this.refreshInspector(); this.pushHistory() })
			// Persist toggle (only effective when once is true)
			y = this.addButton(`Persist: ${o.params.persist ? 'Yes' : 'No'}`, y, () => { o.params.persist = !o.params.persist; this.refreshInspector(); this.pushHistory() })
      // Visibility by trigger
      y = this.addButton('Hidden By Trigger Id', y, () => { const v = prompt('Trigger id that hides this (persist=true once)', o.params.hiddenByTriggerId || ''); if (v !== null) { o.params.hiddenByTriggerId = v || undefined; this.pushHistory() } })
      y = this.addButton('Shown By Trigger Id', y, () => { const v = prompt('Trigger id that shows this (persist=true once)', o.params.shownByTriggerId || ''); if (v !== null) { o.params.shownByTriggerId = v || undefined; this.pushHistory() } })
    }
    // Delete
    y = this.addButton('Delete', y + 4, () => this.removeSelected())
  }

  private removeSelected(): void {
    if (!this.selected) return
    const oidx = this.selected.idx
    try { (this.objects[oidx].visual as any)?.destroy?.() } catch {}
    this.objects.splice(oidx, 1)
    this.selected = undefined
    this.refreshInspector()
    this.pushHistory()
  }

  private exportJson(): void {
    const out: WorldConfig = { id: this.world.id, name: this.world.name, width: this.world.width, height: this.world.height, portals: [], npcs: [], obstacles: [], spawners: [], checkpoints: [] }
    for (const o of this.objects) {
      if (o.def.type === 'obstacle') out.obstacles!.push({ x: o.x, y: o.y, hiddenByTriggerId: o.params?.hiddenByTriggerId, shownByTriggerId: o.params?.shownByTriggerId })
      if (o.def.type === 'light') (out as any).lights = [ ...(out as any).lights || [], { x: o.x, y: o.y, ...(o.params || {}) } ]
      if (o.def.type === 'portal') out.portals.push({ id: `portal_${out.portals.length+1}`, name: o.params?.name || 'Portal', destinationScene: o.params?.destinationScene || 'World', destinationId: o.params?.destinationId || 'town', x: o.x, y: o.y })
      if (o.def.type === 'npc') out.npcs.push({ id: `npc_${out.npcs.length+1}`, name: o.params?.name || 'NPC', role: o.params?.role || 'shopkeeper', x: o.x, y: o.y, brainId: o.params?.brainId, params: { ...(o.params?.brainParams || {}), requireActive: o.params?.requireActive, requireCompleted: o.params?.requireCompleted, requireNotActive: o.params?.requireNotActive, requireNotCompleted: o.params?.requireNotCompleted }, conversationBundles: Array.isArray(o.params?.conversationBundles) ? o.params?.conversationBundles : undefined } as any)
      if (o.def.type === 'spawner') (out as any).spawners = [ ...(out as any).spawners || [], { monsterId: o.params?.monsterId || 'chaser_basic', everyMs: Number(o.params?.everyMs ?? 1000), count: Number(o.params?.count ?? 1), limit: Number(o.params?.limit ?? 0), startDelayMs: Number(o.params?.startDelayMs ?? 0) } ]
      if (o.def.type === 'checkpoint') (out as any).checkpoints = [ ...(out as any).checkpoints || [], { x: o.x, y: o.y, name: o.params?.name } ]
      if (o.def.type === 'decor') (out as any).decor = [ ...(out as any).decor || [], { x: o.x, y: o.y, ...(o.params || {}) } ]
      if (o.def.type === 'start') (out as any).start = { x: o.x, y: o.y }
			if (o.def.type === 'trigger') (out as any).triggers = [ ...(out as any).triggers || [], { id: String(o.params?.id || `trigger_${((out as any).triggers || []).length+1}`), x: o.x, y: o.y, width: Number(o.params?.width ?? this.gridSize), height: Number(o.params?.height ?? this.gridSize), ref: String(o.params?.ref || 'door_open'), params: (o.params?.params || {}), once: !!o.params?.once, persist: !!o.params?.persist } ]
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'painter_world.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  private serialize(): any {
    return this.objects.map(o => ({ defId: o.def.id, type: o.def.type, x: o.x, y: o.y, params: { ...o.params } }))
  }

  private rebuildFromSerialized(list: any[]): void {
    this.isRestoring = true
    try {
    // Clear visuals
    for (const o of this.objects) { try { (o.visual as any)?.destroy?.() } catch {} }
    this.objects = []
    for (const it of list || []) {
      const def = PALETTE.find(d => d.id === it.defId && d.type === it.type)
      if (!def) continue
      this.selection = def
        this.placeAt(it.x, it.y, true)
      const last = this.objects[this.objects.length - 1]
      last.params = { ...def.defaults, ...(it.params || {}) }
        // Update visual from params when applicable
        try {
			if (def.type === 'light' && typeof last.params.color === 'number') {
            ;(last.visual as any)?.setFillStyle?.(last.params.color, 1)
          }
          if (def.type === 'decor' && typeof last.params.tint === 'number') {
            ;(last.visual as any)?.setFillStyle?.(last.params.tint, 0.9)
          }
			if (def.type === 'trigger') {
				try { (last.visual as any)?.setDisplaySize?.(Number(last.params.width ?? this.gridSize), Number(last.params.height ?? this.gridSize)) } catch {}
			}
        } catch {}
    }
    this.selected = undefined
    this.refreshInspector()
    } finally {
      this.isRestoring = false
    }
  }

  private pushHistory(): void {
    const snap = this.serialize()
    // Truncate redo branch
    this.history = this.history.slice(0, this.historyIdx + 1)
    this.history.push(snap)
    this.historyIdx = this.history.length - 1
    try { localStorage.setItem('painter_autosave', JSON.stringify(snap)) } catch {}
  }

  private undo(): void { if (this.historyIdx > 0) { this.historyIdx--; this.rebuildFromSerialized(this.history[this.historyIdx]) } }
  private redo(): void { if (this.historyIdx + 1 < this.history.length) { this.historyIdx++; this.rebuildFromSerialized(this.history[this.historyIdx]) } }
  private saveSession(): void { try { localStorage.setItem('painter_session', JSON.stringify(this.serialize())) } catch {} }
  private loadSession(): void { try { const raw = localStorage.getItem('painter_session'); if (raw) { const data = JSON.parse(raw); this.rebuildFromSerialized(data); this.pushHistory() } } catch {} }
}


