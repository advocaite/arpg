# Tasks

## TODO
- [ ] Inventory system: data model, UI grid, drag/drop, character-bound persistence
- [ ] Item system: weapons/armor/consumables, rarity, stat modifiers, drop tables
- [ ] Skill system: active/passive skills, cooldowns, resource costs, leveling
- [ ] Hotbar: slots (1–4) + mouse, assign items/skills, cooldown display, rebinds later
- [ ] Class-specific starter kits (melee/ranged/magic) and starter skills
- [ ] Per-character persistence for inventory/skills/coins/progress
- [ ] Pause menu settings (volume, screenshake toggle, difficulty)
- [ ] Balance pass: enemy pacing, boss patterns, upgrade costs

### Town Hub
- [ ] Town scene (tilemap or static layout), player spawn, camera bounds
- [ ] Portal system: named portals with `destinationScene` + `destinationId`, unlock/activation rules, persistence
- [ ] Minimap with icons (NPCs, portals), interact prompts (E)
- [ ] Audio: town BGM and basic SFX for portals/NPCs
- [ ] Performance/QA: 60 FPS budget with NPCs and UI active

### NPC System (data-driven)
- [ ] NPC schema: `id`, `name`, `role` (shopkeeper/blacksmith/trainer/healer/questgiver/flavor), position, interactions
- [ ] Dialogue system: node graph (text, options), conditions (flags, quest state), effects (give item, start quest, open UI), persistence of seen states
- [ ] Shopkeeper: per-NPC inventory generation (by role/level), pricing, buy/sell, limited stock, daily/instance refresh
- [ ] Blacksmith: repair (durability), upgrade items, crafting (materials + blueprints), reroll affixes
- [ ] Trainer: learn/upgrade skills, respec, costs (gold/materials)
- [ ] Healer: heal/cleanse for fee
- [ ] Flavor NPCs: rotating dialogue lines
- [ ] NPC config loading (TS/JSON), ability to extend without code changes

### Quests
- [ ] Quest schema: `id`, `name`, `giverNpcId`, objectives (kill group X, collect Y items, talk-to-Z), rewards, prerequisites
- [ ] Quest journal UI: active/completed, objective progress
- [ ] Objective tracking hooks: combat kills, item pickups, dialogue choices
- [ ] Quest state persistence per character

### Monsters/AI (data-driven)
- [ ] Monster DB (JSON): behaviors, stats, skills/powers, chase modes, sight ranges, drop pools
- [ ] AI brains: behavior tree/state machine definitions per monster, configurable via JSON
- [ ] Drop pools: item pool ids per monster; generator hooked to drops

### Character Storage
- [ ] Stash chest in town (per-character initially; later shared stash option)
- [ ] Stash UI integrated with inventory (drag/drop)
- [ ] Persistence and capacity limits

### Scenes
- [ ] Arena scene refactor complete (done but polish UI/portals)
- [ ] Dungeon scene scaffold: single-room MVP with spawn manager and exit portal; expand to procedural later
- [ ] Scene transitions: MainMenu → Town; Town ↔ Arena/Dungeon; death/hold-R returns to Town
- [ ] Unified overlays: FPS/HP overlays and ESC pause across all scenes

### Visual Polish (target look)
- [ ] Grid background overlay: subtle, parallaxed TileSprite with low-contrast lines
- [ ] Ambient/vignette + player light bubble (radial mask around player)
- [ ] Projectile glow: dual-sprite core+soft glow (ADD blend); short pooled trails
- [ ] Impact FX: tiny debris burst, ring pulse on strong hits; pooled images
- [ ] Standardized palette: background #0b0f18; glows lime/cyan/magenta/amber
- [ ] Minimal entity shapes: circles with soft edges; no outlines
- [ ] Screen shake + micro hitstop tuning for melee kills and boss attacks
- [ ] UI skin: resource globes (HP left, Mana/secondary right)
- [ ] Circular hotbar slots with cooldown arc overlay and ready-state glow
- [ ] Tooltip theme: dark rounded panel, subtle border, small monospace font

### UX/Gameplay Polish
- [ ] Bullet-hell feel: spawn cadence tuning, enemy spacing, readable telegraphs
- [ ] Performance: pool all FX and projectiles; avoid runtime Graphics
- [ ] SFX pass: soft pops for shots/hits, whoosh for dash, UI blips

## In Progress
- [ ] Wave polish (pacing, banners)
- [ ] Class kits scaffolding (stats mapping done; loadout pending)
- [ ] Town NPC scaffolding (dialogue UI in place; hook real UIs next)
- [ ] Monster DB in Arena (spawns use JSON)

## Done
- [x] Initialize project scaffold (Vite + TS + Phaser)
- [x] Keyboard movement (WASD + arrows) and simple player
- [x] Basic scenes (Boot, Preload, Main)
- [x] Dev/build scripts
- [x] Project directories created (`src/`, `src/scenes/`, `assets/`)
- [x] FPS overlay
- [x] Basic attack prototype (Space/mouse) with test enemy
- [x] Dash/roll on Shift with brief i-frames
- [x] Shooter enemy with projectiles and spawn pacing
- [x] Floating damage numbers
- [x] Camera/world bounds and simple walls/obstacles
- [x] Loot pickups (coins, hearts) and coin save/load
- [x] Death screen with respawn (Enter) and restart (Hold R → Town)
- [x] Reusable hold-to-confirm UI component
- [x] Wave system scaffold and integration
- [x] Shop scaffold with purchases, coin checks, and pause while open
- [x] Global PauseSystem (ESC to pause/resume)
- [x] Hit/spawn particles and low-HP vignette
- [x] Boss spawned after final wave
- [x] Main menu with 3 character slots, class & stat creation, save/load
- [x] Town scene with portals (Arena/Dungeon), NPC placeholder, dialogue UI
- [x] Data-driven Town (JSON); data-driven Monsters in Arena
