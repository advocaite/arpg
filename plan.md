# ARPG Project Plan

## Vision
Build a fast, responsive, web-based action RPG (ARPG) that feels great to play, runs at 60 FPS on mid-range devices, and can scale with content.

## Tech Stack
- Runtime: TypeScript + Phaser 3 + Vite
- Rendering: WebGL (auto fall back to Canvas via Phaser.AUTO)
- Packaging: Vite
- Target: Desktop browsers first; mobile-friendly later

## Guiding Principles
- Moment-to-moment feel is king: input latency, animation timing, and hit feedback over everything
- Ship vertical slices quickly, then iterate
- Measure performance every milestone (fps, memory, asset sizes)
- Keep systems modular to enable fast feature additions

## Milestones

### M0: Scaffold (Day 0)
- Vite + TS + Phaser scaffold
- Basic scenes: Boot → Preload → Main
- Keyboard movement with placeholder hero
- Repo structure: `src/`, `src/scenes/`, `assets/`
- Scripts: dev, build, preview

### M1: Core Loop Slice (Days 1–3)
- Player controller: 8-directional movement, acceleration/deceleration
- Combat basics: primary attack, hitbox/hurtbox, cooldowns
- Single room arena; camera follows player
- Minimal UI: HP, stamina
- SFX stubs (clicks), placeholder sprites

### M2: Enemies & AI (Days 3–6)
- Enemy types: chaser, shooter
- Simple state machines (idle → seek → attack → recover)
- Spawn system and difficulty pacing
- Collisions, knockback, invulnerability frames

### M3: Items & Progression (Days 6–10)
- Drops (health, currency)
- Inventory and equipment slots
- Stats system (attack, defense, crit, moveSpeed)
- Basic loot tables

### M4: World & Content Pipeline (Days 10–14)
- Tilemap level with collisions
- Room transitions and checkpoints
- Simple save/load (localStorage)
- Asset pipeline conventions and folder structure

### M5: Polish & Performance (Days 14–16)
- Hitstop, screenshake, damage numbers
- Asset optimization (texture atlas, audio formats)
- Performance budget validation (60 FPS on mid-range laptop)
- Bug bash and UX polish

## Performance Targets
- 60 FPS in 1080p on mid-range laptop (integrated GPU)
- Initial download < 2 MB for MVP (gzipped)
- Memory target < 200 MB runtime

## Folder Structure
- `src/`: TypeScript source
- `src/scenes/`: Phaser scenes
- `assets/`: images, audio, data

## Definition of Done (per milestone)
- Builds and runs via `npm run build` and `npm run preview`
- Performance targets measured and within budget
- Testable vertical slice with input and combat working

## Next Steps
- Complete M0 scaffold
- Implement M1 core loop slice

