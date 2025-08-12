### ARPG Polish Pass Checklist (D2 tone, keep D3-like systems)

Scope: Implement visual tone, lighting/shaders, camera feel, animation juice, audio layering/ducking, world feel tools, input feel, and UI cohesion. We’ll integrate with world-driven JSON and reusable UI/components where possible.

Legend: [ ] todo, [~] in-progress, [x] done

---

### 1) Visual Tone (Post FX + Palette)
- [x] Add lightweight PostFX manager `src/postfx/PostFX.ts` to attach screen-space effects per scene (toggleable in debug):
  - [x] Vignette overlay (radial, responsive to HP) in `WorldScene` via full-screen quad/container.
  - [x] Film grain (procedural noise or low-res static texture) with subtle animated intensity.
  - [x] Ambient fog overlay (screen-space tint) with color/tint per world from JSON.
  - [x] LUT-based color grading: implemented parametric grading and optional 3D LUT sampling (16x16x16 layout). Auto-loads `assets/textures/neutral-lut.png` as `lut_neutral` if present.
- [x] Expose PostFX config on `WorldScene` (HP-based vignette strength, fog color/intensity).
- [x] Add debug toggle UI to switch effects on/off at runtime (Ctrl+F1..F5 for shake, hitstop, vignette, fog, grain).
  - [x] Grain tuning: switched to dark-only MULTIPLY masked layers (no brightening). Intensity 0 fully hides grain.

Files to touch: `src/scenes/WorldScene.ts`, `src/postfx/PostFX.ts` (new), `src/systems/Effects.ts`

Assets needed: LUT texture(s), optional grain texture. Fog colors per world via `src/data/worlds/*.json` [[palette config]].

---

### 2) Lights and Shaders
- [x] Enable 2D lights where supported (WebGL):
  - [x] `this.lights.enable()` and set relevant sprites to `setPipeline('Light2D')` in `WorldScene`.
  - [x] Add point lights for torches/portals and emissive skills (data-driven lights in world JSON).
- [x] Bloom on emissive (cheap approach):
  - [x] Add additive sprite glow duplicates for emissive FX (`fx.emissiveGlow`).
- [x] Add additive projectile trails:
  - [x] Trail ghosting for projectiles via `fx.additiveTrail` and wired into `projectile_shoot`.
- [x] Soft shadow blobs under actors (ellipse sprite beneath player/enemies, subtle alpha, follows body).

Files to touch: `src/scenes/WorldScene.ts`, `src/powers/*.ts`, `src/effects/*`, `src/systems/Effects.ts`

Assets needed: small blurred-circle shadow sprite; optional glow sprites.

---

### 3) Camera Feel
- [ ] Smooth follow (already using lerp): tune and expose params.
- [x] Add smooth zoom in/out (slight zoom during combat, reset out of combat).
- [x] Screen shake on hits (scale by crit/boss). Centralize helper in `Effects.ts`.
- [x] Hit-stop on crits/boss hits: brief timescale reduction with auto-recovery.
  - [x] Fix: switch to unscaled restore timer and avoid touching `physics.world.timeScale` so projectiles never stall after crit flash/shake. Consolidate overlapping hit-stops into a single extendable window.
- [ ] Radial vignette intensity on low HP, integrated with PostFX.

Files to touch: `src/scenes/WorldScene.ts`, `src/systems/Effects.ts`

---

### 4) Animation and Combat Juice
- [x] Squash-and-stretch on impact for player/enemy sprites (brief scale tween).
- [ ] 2–3 frame melee smear for `melee_swing` (spawn smear sprite/effect in `src/effects/sweep_arc.ts`).
- [x] Crit flash (tint + quick white overlay pulse). Reuseable via `Effects.ts`.
- [ ] Loot beams with rarity colors on item drops:
  - [ ] Add `fx.lootBeam` effect with color per rarity (uses `ItemDB`/`DropSystem` rarity).
  - [ ] Trigger in `spawnDropsAt` and power kill paths.

Files to touch: `src/effects/*` (new `loot_beam.ts`), `src/systems/Effects.ts`, `src/systems/DropSystem.ts`, `src/scenes/WorldScene.ts`, `src/powers/*.ts`

---

### 5) Audio Layers and Ducking
- [x] Centralize audio helpers `src/systems/AudioBus.ts` for groups (BGM/SFX/UI) and simple ducking.
- [x] Data-driven `fx.sfx` effect to trigger sounds from powers/effects.
- [x] Add impact layer SFX variations and randomize pitch/volume slightly (melee/projectile wired via `fx.sfx`).
- [x] Side-chained ducking on UI and strong SFX (UI open, impacts duck BGM briefly via `AudioBus`).
- [x] BG music stems: base loop + combat layer; level-in during combat, fade-out after out-of-combat decay.

Files to touch: `src/scenes/PreloadScene.ts`, `src/scenes/WorldScene.ts`, `src/systems/AudioBus.ts` (new)

Assets needed: combat stem(s), impact SFX set, UI open/close/clicks.

---

### 6) World Feel (Data-Driven, in-World Tools)
- [ ] Tile autobrush (in-game):
  - [ ] Minimal in-world editor mode to paint walls/floors that exports JSON (respect project’s world JSON flow).
  - [ ] Simple rules: corners/edges/centers choose variant indices; render via sprites for now.
- [ ] Decals: cracks, stains, small props as overlay sprites; allow placement via world JSON.
- [ ] Portals with swirl shaders: leverage `src/effects/portal_vortex.ts`; add light + emissive.
- [ ] World Painter (data-driven scene for authoring `WorldConfig`):
  - [x] Scene scaffold `src/scenes/PainterScene.ts` with palette `src/painter/Palette.ts`.
  - [x] Grid snapping and visual stubs; right-click remove; block placement under panel; disable browser context menu.
  - [x] Export to JSON matching `WorldConfig` fields (`obstacles`, `lights`, `portals`, `npcs`).
  - [x] Palette text word-wrap to avoid overflow in panel.
  - [x] Inspector panel to edit selected object params (light radius/intensity/color/flicker; portal name/destination; NPC name/role; decor kind/tint) with live update.
  - [x] Selection/move/delete + undo/redo; history with autosave and session save/load.
  - [x] Non-colliding decor authoring and schema (`decor[]` in `WorldConfig`).
  - [~] Load World JSON into Painter (file picker → parse → rebuild objects).
  - [ ] World Settings in Inspector (no selection): ambientLight, id/name/size edits.
  - [ ] Optional: more light params (type: point/sky, followCamera toggle), portal destinationScene edit, NPC role presets dropdown.
  - [ ] Optional: separate palettes for Decor kinds (trees, rocks, banners, leaves) with default tints.

Files to touch: `src/scenes/WorldScene.ts`, `src/systems/WorldLoader.ts`, `src/effects/portal_vortex.ts`, `src/data/worlds/*.json`

Assets needed: decal spritesheets; floor/wall variant sprites (temporary placeholders acceptable).

---

### 7) Input Feel and Targeting
- [ ] Movement model: switch to acceleration/drag with capped speed; maintain dash behavior.
- [ ] Precise collision tuning (body sizes, offset, drag, maxSpeed) for player/enemies.
- [ ] Aim assist for projectiles: snap aim to nearest enemy within a narrow cone and range.
- [ ] Mouse-hover outlines/tints on interactables (portals, NPCs, drops). Optional outline pipeline fallback to tint + scale pulse.

Files to touch: `src/scenes/WorldScene.ts`, `src/powers/projectile_*.ts`, `src/ui/*`

---

### 8) UI Cohesion (Gothic/D2-inspired)
- [ ] Global UI theme module `src/ui/theme.ts` (colors, shadows, serif headers, parchment textures).
- [ ] Apply theme to core UI: `Inventory`, `SkillsMenu`, `SkillsOverview`, `PassiveMenu`, `Shop`, `StatsPanel`, `Hotbar`, `Dialogue`, `Tooltip`.
- [ ] Consistent drop shadows/inner highlights, 1px edge light.
- [ ] Serif header font, readable body font; fallback stack configured.

Files to touch: `src/ui/*.ts`, `src/scenes/MainMenuScene.ts`, `src/scenes/WorldScene.ts`

Assets needed: serif TTF/WOFF, parchment tile/9-slice, subtle border textures.

---

### 9) Performance and Quality Toggles
- [ ] Central debug menu to toggle: lights, bloom/glow, grain, LUT, fog, trails, shake, hit-stop.
- [ ] Graceful fallback when WebGL features unavailable (skip lights/pipelines, keep overlays).
- [ ] Budget caps (max particles, trail length, post FX intensity) for low-spec.

Files to touch: `src/scenes/WorldScene.ts`, `src/systems/Effects.ts`, `src/postfx/PostFX.ts`

---

### 10) Asset Intake Checklist (You provide or approve)
- [ ] LUT(s) for grading (describe target look: desaturated base, cool shadows, warm highlights).
- [ ] Grain texture (optional; can be procedural).
- [ ] Shadow blob sprite, glow sprites.
- [ ] BGM base + combat stems; impact SFX set; UI SFX.
- [ ] Parchment/border textures; serif font.
- [ ] Decal sprites (cracks, stains), wall/floor variants.

---

### 11) Rollout Plan (Order of Implementation)
1) Camera feel + Animation juice (fast wins, immediate feel).
2) Visual tone overlays (vignette/grain/fog), then LUT.
3) Audio ducking + combat stems.
4) Lights + emissive/bloom + projectile trails.
5) Loot beams + rarity colors.
6) Input feel (accel/drag) + aim assist.
7) UI theme pass.
8) World decals + portal polish.
9) Tile autobrush MVP.
10) Perf toggles and QA.

---

### Acceptance Criteria (per category)
- Camera: smooth follow/zoom; shakes scale with hit magnitude; crit hit-stop feels punchy without disrupting input.
- Visuals: LUT and overlays adjustable in debug; D2-like moody tone achieved.
- Lights: visible torches/portals; emissive skills glow; shadows subtle and performant.
- Combat: impacts read clearly; crits pop; loot beams clearly communicate rarity.
- Audio: UI and big hits duck music briefly; combat layer fades in only during encounters.
- Input: movement feels weighty but responsive; projectiles prefer nearest target within aim cone.
- UI: consistent gothic style across menus; readable; textures subtle.
- World: decals load from JSON; portal swirl + light present; autobrush can export JSON.

---

Notes:
- We’ll keep everything data-driven and reusable (UI components, effects, and world JSON integrations). World scenes remain the source of truth for loading world data.


