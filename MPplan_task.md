## Multiplayer plan and task tracker

### Scope
- Co-op only (2–4 players). No PvP initially.
- Reuse world JSON; server authoritative simulation; client prediction for movement; server-validated combat.

### Architecture
- Server: Node (ws), 20 Hz tick. Runs headless Simulation (entities, AI, spawns, damage, loot, quests). Seeded RNG per room.
- Client: Phaser rendering + input. Predict local movement, reconcile on snapshots. Interpolate others.
- Protocol: Input/cast commands up, delta snapshots/events down. AOI filtering near camera.

### Current status
- Invite flow working (create link, accept in new tab). Presence events broadcast. Minimal net status UI in menu/world.
- Rooming model enforced (only invited clients share a room). Menu-only clients don’t appear in-world.
- Server broadcasts 20 Hz snapshots. Clients render other players as cyan ghosts with smoothing; local player reconciles gently. Disconnect removes ghosts.
- Enemies are server-owned (Simulation). Motion + bounds collision server-side; snapshots sync positions.
- Authoritative portal transitions (per room+world); peers see relocations via snapshots.
- Authoritative melee: server radial hits; clients see combat flashes.
- Authoritative projectiles: server spawns/moves; clients render cyan dots; server projectile-enemy collisions with hit flashes.
- Authoritative AoE/pools: server ticks damage; clients see AoE pulses.
- Authoritative walls: server-oriented lines tick damage; clients see wall tick flashes.
- Authoritative rings: server spawns projectile rings; orbit rune spawns orbiting projectiles following caster.
- Authoritative chain lightning: server chains across enemies; clients see chain bolts.
- Cones/sweeps: server cone hits; clients see sweep pulses.
- Dash: client prediction + server impulse; reduced snap-back.
- Primary/secondary/hotbar 1–4 casting networked with local FX prediction and server casts.
- Skill→FX mapping for visual parity in `src/net/skillFxMap.ts` using your FX refs and skill IDs; runes/params drive sizes/colors/durations.

### Phase plan (checklist)

#### Phase 1 – Foundations
- [x] Define minimal MP types in `src/types.ts` and `src/net/protocol.ts` (entity kinds, hello includes serverTime).
- [x] Seeded PRNG utility shared by server/client: `src/net/rng.ts`.
- [x] Simulation skeleton created: `src/net/sim/Simulation.ts`.
- [x] Server 20 Hz broadcast loop (baseline snapshots) with room/world filters.
- [x] Time stamp in hello; client shows tick; basic error/status UI.
- [x] Configured URL handling and WS URL normalization; added invite URL persistence.

Definition of done: both tabs connect reliably; server sends empty snapshots with tick/ack; invite links point to correct host.

#### Phase 2 – Movement sync (players only)
- [x] Replace local input handling with `input` messages (client keeps prediction and input buffer).
- [x] Server applies inputs → authoritative position/velocity; broadcasts players.
- [x] Client reconciliation for local player; snapshot interpolation for others.
- [x] Toggle to keep single-player path working (no net).
- [ ] Improve smoothing: small snapshot buffer (100–150 ms) and ack-based rewind/resim for local prediction.

Definition of done: two tabs show each other moving smoothly; no rubber-banding on local.

#### Phase 3 – Enemies server-side
- [x] Enemies in Simulation with motion + bounds; synced via snapshots.
- [x] Disable client-side brains when MP enabled (gate `setupSpawners`/brain ticks).
- [ ] Move spawners and enemy AI ticks to Simulation (no Phaser on server; simple AABB/circle).
- [ ] Basic obstacle avoidance and simple chase when players nearby.

Definition of done: enemies appear/move identically in both tabs; no duplicate AI.

#### Phase 4 – Melee combat authoritative
- [x] Client sends `cast` for melee; predicts swing FX only.
- [x] Server computes hits (radial) and applies HP; emits damage/kill events.
- [x] Death/respawn reflected via HP; tick flashes visible.
- [ ] Add damage numbers/loot events from server; remove client-side drops in MP.

Definition of done: damage numbers/HP consistent across tabs; no client-only kills.

#### Phase 5 – Projectiles and skills
- [x] Server owns projectile spawn/motion/collision; clients render cosmetics/trails.
- [x] Skill params/runes drive projectile speed/TTL, ring count, orbit, AoE radius/dps/duration, wall angle/length, chain bounces/range.
- [x] Orbiting projectiles based on runes.
- [x] Skill→FX mapping per `skills.json` ids for visual parity.
- [ ] Homing/projectile follow behavior server-side (turnRate from runes).
- [ ] Projectile pierce and element conversions server-side.
- [ ] Exact damage numbers/crit on server; broadcast damage text events.

Definition of done: projectile paths consistent; shared loot/xp identical.

#### Phase 6 – Persistence
- [ ] Move `SaveSystem` to server for inventory/quests; client requests/updates via RPC/events.
- [ ] Basic identity (guest or stored id); shop transactions validated server-side.

Definition of done: inventory/quests consistent across tabs and reloads.

#### Phase 7 – Polish
- [ ] AOI culling (distance to player camera), compression/quantization of floats.
- [ ] Heartbeats/reconnect; rate limiting and simple anti-spam.
- [ ] Name tags, basic chat, small HUD net stats.
- [x] Authoritative portal transitions (room/world change and spawn points) with UI feedback.
- [ ] Comprehensive FX sync table per skill/rune for perfect visual parity.
- [ ] Configurable tick rates; performance tuning.

Definition of done: stable multi-tab sessions with reasonable bandwidth and UX.

### Reminders
- Always update this file with progress (checked items, notes) after each step.
- Stop existing dev servers before rebuild/start (use `npm run redev`).
- Don’t delete existing code without explicit approval; gate new MP paths behind flags.
- Keep UI elements reusable; keep systems data-driven (world JSON, skills, NPCs).
- For docs lookups, use Context7 MCP server (no general web search).
- When adding features, prefer a singleton `NetClient` via `getNet()` to preserve room/session state across scenes.
- Keep server logic in `server/sim.mjs` and keep `server/index.mjs` as thin I/O + room routing.

### Risks/considerations
- Latency effects (dash/attack windows). Tune reconciliation and grace windows.
- Determinism: keep RNG on server; never depend on client RNG for gameplay.
- HTTPS dev may require wss or proxy; otherwise prefer http + ws locally.

### Commands
- Start WS server: `npm run server`
- Start client: `npm run dev` (or `npm run redev` to stop prior ports first)


