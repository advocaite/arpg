import { WebSocketServer } from 'ws'
import { Simulation } from './sim.mjs'

const PORT = Number(process.env.PORT || 5177)
const wss = new WebSocketServer({ port: PORT })

/** @type {Map<string, any>} */
const invites = new Map()
    /** @type {Map<WebSocket, { id: string, name: string, worldId: string, roomId: string|null, inWorld: boolean, x: number, y: number, vx: number, vy: number, lastSeq: number, keys: any, dashUntil?: number, dashVX?: number, dashVY?: number }>} */
const clients = new Map()
const sim = new Simulation()
const MOVE_SPEED = 220

function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0,
            v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16)
    })
}

function send(ws, msg) { try { ws.send(JSON.stringify(msg)) } catch {} }

wss.on('connection', (ws) => {
    const playerId = uuid()
    clients.set(ws, { id: playerId, name: '', worldId: '', roomId: null, inWorld: false, x: 800, y: 600, vx: 0, vy: 0, lastSeq: 0, keys: { up: false, down: false, left: false, right: false, dash: false } })
    send(ws, { t: 'hello', playerId, worldSeed: String(Math.floor(Math.random() * 1e9)), tickRate: 20, serverTime: Date.now() })

    ws.on('message', (data) => {
        let msg
        try { msg = JSON.parse(data.toString()) } catch { return }
        if (!msg || typeof msg.t !== 'string') return
        if (msg.t === 'join') {
            const c = clients.get(ws);
            if (!c) return
            c.name = msg.name || 'Player';
            c.worldId = msg.worldId || 'town'
            c.inWorld = true
            if (c.roomId && c.worldId) sim.seedEnemies(c.roomId, c.worldId, 6)
                // Broadcast presence only to others in the same room
            for (const [other, oc] of clients) {
                if (other === ws) continue
                if (!c.roomId || !oc.roomId || oc.roomId !== c.roomId) continue
                    // Allow notifying menu as well; they can choose to show UI or ignore while not inWorld
                send(other, { t: 'event', ev: { t: 'player.joined', id: c.id, name: c.name } })
            }
            return
        }
        if (msg.t === 'invite.create') {
            const id = uuid()
            const url = `${process.env.PUBLIC_URL || 'http://localhost:5173'}?invite=${id}`
            const worldId = String(msg.worldId || 'town')
            invites.set(id, { id, worldId, createdAt: Date.now() })
                // Associate creator with room immediately; they'll join world later
            const c = clients.get(ws);
            if (c) c.roomId = id
            send(ws, { t: 'invite', inviteId: id, url })
            return
        }
        if (msg.t === 'invite.accept') {
            const info = invites.get(String(msg.inviteId))
            if (info) {
                const c = clients.get(ws);
                if (c) {
                    c.worldId = info.worldId;
                    c.roomId = info.id
                }
                send(ws, { t: 'event', ev: { t: 'chat', from: 'server', text: `Invite accepted. Room: ${info.id}` } })
                    // Notify others already in this room (e.g., creator) that someone accepted
                for (const [other, oc] of clients) {
                    if (other === ws) continue
                    if (oc.roomId === info.id) {
                        send(other, { t: 'event', ev: { t: 'room.accepted', id: c ? c.id : 'unknown', name: c ? c.name : 'Guest' } })
                    }
                }
            }
            return
        }
        if (msg.t === 'input') {
            const c = clients.get(ws)
            if (!c) return
            c.lastSeq = Number(msg.seq || 0)
            c.keys = msg.keys || c.keys
                // compute instantaneous velocity from keys (normalized)
            const mx = (c.keys.right ? 1 : 0) - (c.keys.left ? 1 : 0)
            const my = (c.keys.down ? 1 : 0) - (c.keys.up ? 1 : 0)
            const len = Math.hypot(mx, my)
            if (len > 0) {
                c.vx = (mx / len) * MOVE_SPEED;
                c.vy = (my / len) * MOVE_SPEED
            } else {
                c.vx = 0;
                c.vy = 0
            }
            return
        }
        if (msg.t === 'cast') {
            const c = clients.get(ws)
            if (!c) return
            console.log('[server] recv cast', { playerId: c.id, skillId: msg.skillId, roomId: c.roomId, worldId: c.worldId })
                // Broadcast cast event to peers for synced visuals
            if (c.roomId && c.worldId) {
                for (const [other, oc] of clients) {
                    if (oc.roomId === c.roomId && oc.worldId === c.worldId) {
                        send(other, { t: 'event', ev: { type: 'cast', from: c.id, skillId: msg.skillId, cursor: msg.cursor || null, params: msg.params || {} } })
                    }
                }
            }
            const sid = String(msg.skillId || '')
            if (sid.includes('melee')) {
                // Simple authoritative melee: radial hit around player
                const x = c.x,
                    y = c.y
                const radius = 80
                const damage = 15
                if (c.roomId && c.worldId) {
                    const before = (sim.getEnemies(c.roomId, c.worldId) || []).length
                    const res = sim.meleeHit(c.roomId, c.worldId, x, y, radius, damage)
                    const after = (sim.getEnemies(c.roomId, c.worldId) || []).length
                    console.log('[server] cast melee', { playerId: c.id, roomId: c.roomId, worldId: c.worldId, x: Math.round(x), y: Math.round(y), radius, damage, kills: res.kills, before, after })
                    for (const [other, oc] of clients) {
                        if (oc.roomId === c.roomId && oc.worldId === c.worldId) {
                            send(other, { t: 'combat', kind: 'melee', x, y, radius, kills: res.kills })
                        }
                    }
                }
            } else if (sid.includes('dash')) {
                // Apply dash impulse based on last input direction
                const mx = ((c.keys && c.keys.right) ? 1 : 0) - ((c.keys && c.keys.left) ? 1 : 0)
                const my = ((c.keys && c.keys.down) ? 1 : 0) - ((c.keys && c.keys.up) ? 1 : 0)
                const len = Math.hypot(mx, my) || 1
                const nx = mx / len,
                    ny = my / len
                const speed = 900
                c.dashVX = (len > 0 ? nx : 1) * speed
                c.dashVY = (len > 0 ? ny : 0) * speed
                c.dashUntil = Date.now() + 140
                console.log('[server] dash', { playerId: c.id, vx: Math.round(c.dashVX), vy: Math.round(c.dashVY), until: c.dashUntil })
            } else if (msg.cursor && c.roomId && c.worldId && ((msg.skillType && msg.skillType === 'projectile') || sid.includes('projectile') || sid.includes('shoot') || sid.includes('bolt'))) {
                // Only spawn server projectile for projectile-like skills
                const spd = Number(((msg.params && msg.params.speed) != null ? msg.params.speed : 420))
                const ttl = Number(((msg.params && msg.params.decayMs) != null ? msg.params.decayMs : 2000))
                console.log('[server] cast projectile-like', { playerId: c.id, skillId: msg.skillId, to: msg.cursor, speed: spd, ttl })
                sim.spawnProjectile(c.roomId, c.worldId, c.x, c.y, Number(msg.cursor.x), Number(msg.cursor.y), spd, ttl)
            } else if (c.roomId && c.worldId && (sid.includes('pool') || sid.includes('aoe'))) {
                // Spawn an AOE at cursor
                const radius = Number(((msg.params && msg.params.radius) != null ? msg.params.radius : 60))
                const dps = Number(((msg.params && msg.params.damage) != null ? msg.params.damage : 8))
                const dur = Number(((msg.params && msg.params.durationMs) != null ? msg.params.durationMs : 1500))
                const x = (msg.cursor && msg.cursor.x) ? Number(msg.cursor.x) : c.x
                const y = (msg.cursor && msg.cursor.y) ? Number(msg.cursor.y) : c.y
                console.log('[server] spawn AOE', { radius, dps, dur, x, y })
                sim.spawnAoe(c.roomId, c.worldId, x, y, radius, dps, dur)
            } else if (c.roomId && c.worldId && sid.includes('ring')) {
                // Spawn a projectile ring around the caster
                const count = Number(((msg.params && msg.params.count) != null ? msg.params.count : 8))
                const speed = Number(((msg.params && msg.params.speed) != null ? msg.params.speed : 360))
                const ttl = Number(((msg.params && msg.params.decayMs) != null ? msg.params.decayMs : 2000))
                console.log('[server] spawn ring', { count, speed, ttl })
                sim.spawnProjectileRing(c.roomId, c.worldId, c.x, c.y, count, speed, ttl)
                    // If orbit rune (example), also spawn orbiting projectiles
                if (msg.params && (msg.params.orbit || msg.params.r_orbit || msg.params.r_orbiting)) {
                    const orbitCount = Math.max(1, Math.floor(count / 2))
                    for (let i = 0; i < orbitCount; i++) sim.spawnOrbitProjectile(c.roomId, c.worldId, c.id, Number(msg.params.orbitRadius || 80), Number(msg.params.orbitOmega || (2 * Math.PI)), ttl)
                }
            } else if (c.roomId && c.worldId && sid.includes('wall')) {
                // Spawn a wall at cursor with angle param
                const angle = Number(((msg.params && msg.params.angle) != null ? msg.params.angle : 0))
                const length = Number(((msg.params && msg.params.length) != null ? msg.params.length : 160))
                const dps = Number(((msg.params && msg.params.damage) != null ? msg.params.damage : 8))
                const dur = Number(((msg.params && msg.params.durationMs) != null ? msg.params.durationMs : 1400))
                const x = (msg.cursor && msg.cursor.x) ? Number(msg.cursor.x) : c.x
                const y = (msg.cursor && msg.cursor.y) ? Number(msg.cursor.y) : c.y
                console.log('[server] spawn wall', { angle, length, dps, dur, x, y })
                sim.spawnWall(c.roomId, c.worldId, x, y, angle, length, dps, dur)
            } else if (c.roomId && c.worldId && (sid.includes('lightning.chain') || sid.includes('chain'))) {
                const maxB = Number(((msg.params && msg.params.bounces) != null ? msg.params.bounces : 3))
                const range = Number(((msg.params && msg.params.range) != null ? msg.params.range : 220))
                const dmg = Number(((msg.params && msg.params.damage) != null ? msg.params.damage : 15))
                const res = sim.chainLightning(c.roomId, c.worldId, c.x, c.y, maxB, range, dmg)
                console.log('[server] chain lightning', { hits: res.hits })
            } else if (c.roomId && c.worldId && (sid.includes('cone') || sid.includes('sweep'))) {
                const angle = Number(((msg.params && msg.params.angle) != null ? msg.params.angle : 0))
                const radius = Number(((msg.params && msg.params.radius) != null ? msg.params.radius : 100))
                const arc = Number(((msg.params && msg.params.arc) != null ? msg.params.arc : Math.PI / 3))
                const dmg = Number(((msg.params && msg.params.damage) != null ? msg.params.damage : 10))
                const res = sim.coneHit(c.roomId, c.worldId, c.x, c.y, angle, radius, arc, dmg)
                console.log('[server] cone hit', { hits: res.hits })
            }
            return
        }
        if (msg.t === 'portal.enter') {
            const c = clients.get(ws)
            if (!c) return
                // For now, just switch worldId to destination; room stays the same.
            c.worldId = String(msg.destinationId || c.worldId || 'town')
            c.x = 800;
            c.y = 600;
            c.vx = 0;
            c.vy = 0
            return
        }
    })

    ws.on('close', () => { clients.delete(ws) })
})

console.log(`[server] ws listening on ${PORT}`)

// 20 Hz simulation + broadcast
setInterval(() => {
    const dt = 0.05 // seconds
        // integrate
    const now = Date.now()
    for (const [ws, c] of clients) {
        // Base movement
        c.x += c.vx * dt
        c.y += c.vy * dt
            // Dash override additive
        if (c.dashUntil && now < c.dashUntil) {
            c.x += (c.dashVX || 0) * dt
            c.y += (c.dashVY || 0) * dt
        }
    }
    // Build casters map for orbit projectiles
    const casters = {}
    for (const [ws, c] of clients) { if (c.roomId && c.worldId) casters[c.id] = { x: c.x, y: c.y, roomId: c.roomId, worldId: c.worldId } }
    sim.step(dt, casters)
    const tick = Date.now()
    for (const [ws, c] of clients) {
        // Build ents per-viewer: include only players who are inWorld and in the same room+world
        const ents = []
        for (const [ow, oc] of clients) {
            if (!oc.inWorld) continue
            if (!c.roomId || !oc.roomId || oc.roomId !== c.roomId) continue
            if (!c.worldId || !oc.worldId || oc.worldId !== c.worldId) continue
            ents.push({ id: oc.id, kind: 'player', x: Math.round(oc.x), y: Math.round(oc.y), vx: Math.round(oc.vx), vy: Math.round(oc.vy), meta: { name: oc.name } })
        }
        if (c.roomId && c.worldId) {
            const listE = sim.getEnemies(c.roomId, c.worldId)
            for (const e of listE) ents.push({ id: e.id, kind: 'enemy', x: Math.round(e.x), y: Math.round(e.y) })
            const listP = sim.getProjectiles(c.roomId, c.worldId)
            for (const p of listP) ents.push({ id: p.id, kind: 'projectile', x: Math.round(p.x), y: Math.round(p.y) })
        }
        try { send(ws, { t: 'snapshot', tick, ackSeq: c.lastSeq || 0, ents }) } catch {}
    }
    // Broadcast projectile hit events
    const evs = sim.drainEvents()
    for (const ev of evs) {
        for (const [ws, c] of clients) {
            if (c.roomId === ev.roomId && c.worldId === ev.worldId) {
                try { send(ws, { t: 'event', ev }) } catch {}
            }
        }
    }
}, 50)