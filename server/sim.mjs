// Minimal server-side simulation for enemies (room+world scoped)

export class Simulation {
    constructor() {
        /** @type {Map<string, Array<{ id: string, x: number, y: number, vx: number, vy: number }>>} */
        this.roomEnemies = new Map()
            /** @type {Array<{ id: string, kind: 'projectile', roomId: string, worldId: string, x: number, y: number, vx: number, vy: number, ttl: number }>} */
        this.projectiles = []
            /** @type {Array<{ roomId: string, worldId: string, type: string, x: number, y: number }>} */
        this.events = []
            /** @type {Array<{ roomId: string, worldId: string, x: number, y: number, radius: number, dps: number, ttl: number, tick: number }>} */
        this.aoes = []
            /** @type {Array<{ roomId: string, worldId: string, x: number, y: number, len: number, ang: number, dps: number, ttl: number, tick: number }>} */
        this.walls = []
    }

    key(roomId, worldId) { return `${roomId}::${worldId}` }

    /** Ensure enemies list exists for a room+world; optionally seed */
    ensureEnemies(roomId, worldId) {
        const k = this.key(roomId, worldId)
        if (!this.roomEnemies.has(k)) this.roomEnemies.set(k, [])
        return this.roomEnemies.get(k)
    }

    seedEnemies(roomId, worldId, count = 6) {
        const list = this.ensureEnemies(roomId, worldId)
        if (list.length > 0) return
        for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2
            const speed = 60 + Math.random() * 40
            list.push({ id: cryptoRandomId(), x: 600 + Math.random() * 400, y: 400 + Math.random() * 300, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, hp: 30 })
        }
    }

    step(dt, casters) {
        for (const [key, list] of this.roomEnemies) {
            const worldId = String(key.split('::')[1] || 'town')
            const { minX, minY, maxX, maxY } = this.getBoundsForWorld(worldId)
            for (const e of list) {
                e.x += e.vx * dt
                e.y += e.vy * dt
                if (e.x < minX || e.x > maxX) e.vx *= -1
                if (e.y < minY || e.y > maxY) e.vy *= -1
            }
            // Advance projectiles, collide with enemies, and decay
            const keep = []
            for (const p of this.projectiles) {
                if (p.mode === 'orbit' && p.casterId && casters && casters[p.casterId]) {
                    p.theta = (p.theta || 0) + (p.omega || 0) * dt
                    const cx = casters[p.casterId].x,
                        cy = casters[p.casterId].y
                    const r = p.radius || 80
                    p.x = cx + Math.cos(p.theta) * r
                    p.y = cy + Math.sin(p.theta) * r
                } else {
                    p.x += p.vx * dt
                    p.y += p.vy * dt
                }
                // collide with enemies
                const enemies = this.getEnemies(p.roomId, p.worldId)
                let hit = false
                for (let i = enemies.length - 1; i >= 0; i--) {
                    const e = enemies[i]
                    const dx = e.x - p.x,
                        dy = e.y - p.y
                    if (dx * dx + dy * dy <= 12 * 12) { // simple radius
                        e.hp = Math.max(0, (e.hp || 0) - (p.dmg || 10))
                        hit = true
                        if (e.hp <= 0) enemies.splice(i, 1)
                        break
                    }
                }
                if (hit) {
                    this.events.push({ roomId: p.roomId, worldId: p.worldId, type: 'projectile.hit', x: p.x, y: p.y })
                    p.ttl = -1
                }
                p.ttl -= dt
                if (p.ttl > 0) keep.push(p)
            }
            this.projectiles = keep
                // Advance AOEs and damage enemies periodically
            const keepA = []
            for (const a of this.aoes) {
                a.ttl -= dt
                a.tick -= dt
                if (a.tick <= 0) {
                    a.tick = 0.2
                    const enemies = this.getEnemies(a.roomId, a.worldId)
                    let hits = 0
                    for (let i = enemies.length - 1; i >= 0; i--) {
                        const e = enemies[i]
                        const dx = e.x - a.x,
                            dy = e.y - a.y
                        if (dx * dx + dy * dy <= a.radius * a.radius) {
                            e.hp = Math.max(0, (e.hp || 0) - a.dps)
                            hits++
                            if (e.hp <= 0) enemies.splice(i, 1)
                        }
                    }
                    if (hits > 0) this.events.push({ roomId: a.roomId, worldId: a.worldId, type: 'aoe.tick', x: a.x, y: a.y, radius: a.radius })
                }
                if (a.ttl > 0) keepA.push(a)
            }
            this.aoes = keepA
                // Advance walls (deal damage along line)
            const keepW = []
            for (const w of this.walls) {
                w.ttl -= dt
                w.tick -= dt
                if (w.tick <= 0) {
                    w.tick = 0.2
                    const enemies = this.getEnemies(w.roomId, w.worldId)
                    const nx = Math.cos(w.ang),
                        ny = Math.sin(w.ang)
                    let hits = 0
                    for (let i = enemies.length - 1; i >= 0; i--) {
                        const e = enemies[i]
                            // project enemy pos onto wall normal and tangent
                        const ex = e.x - w.x,
                            ey = e.y - w.y
                        const along = ex * nx + ey * ny
                        const perp = Math.abs(-ex * ny + ey * nx) // distance from line
                        if (along >= -w.len / 2 && along <= w.len / 2 && perp <= 10) {
                            e.hp = Math.max(0, (e.hp || 0) - w.dps)
                            hits++
                            if (e.hp <= 0) enemies.splice(i, 1)
                        }
                    }
                    if (hits > 0) this.events.push({ roomId: w.roomId, worldId: w.worldId, type: 'wall.tick', x: w.x, y: w.y })
                }
                if (w.ttl > 0) keepW.push(w)
            }
            this.walls = keepW
        }
    }

    getBoundsForWorld(worldId) {
        // Default to 1600x1200 with 120px margin
        const sizes = {
            town: { w: 1600, h: 1200 },
            arena_world: { w: 1600, h: 1200 },
            dungeon_world: { w: 1600, h: 1200 },
        }
        const s = sizes[worldId] || sizes.town
        const margin = 120
        return { minX: margin, minY: margin, maxX: s.w - margin, maxY: s.h - margin }
    }

    getEnemies(roomId, worldId) {
        const list = this.roomEnemies.get(this.key(roomId, worldId))
        return list || []
    }

    spawnProjectile(roomId, worldId, x, y, tx, ty, speed = 360, lifeMs = 2000, dmg = 12) {
        const dx = tx - x,
            dy = ty - y
        const d = Math.hypot(dx, dy) || 1
        const vx = (dx / d) * speed
        const vy = (dy / d) * speed
        this.projectiles.push({ id: cryptoRandomId(), kind: 'projectile', roomId, worldId, x, y, vx, vy, ttl: lifeMs / 1000, dmg })
    }

    getProjectiles(roomId, worldId) {
        return this.projectiles.filter(p => p.roomId === roomId && p.worldId === worldId)
    }

    drainEvents() {
        const out = this.events
        this.events = []
        return out
    }

    spawnAoe(roomId, worldId, x, y, radius = 60, dps = 8, durationMs = 1500) {
        this.aoes.push({ roomId, worldId, x, y, radius, dps, ttl: durationMs / 1000, tick: 0 })
    }

    spawnProjectileRing(roomId, worldId, cx, cy, count = 8, speed = 360, lifeMs = 2000, dmg = 10) {
        for (let i = 0; i < count; i++) {
            const ang = (Math.PI * 2 * i) / Math.max(1, count)
            const tx = cx + Math.cos(ang) * 100
            const ty = cy + Math.sin(ang) * 100
            this.spawnProjectile(roomId, worldId, cx, cy, tx, ty, speed, lifeMs, dmg)
        }
    }

    spawnWall(roomId, worldId, x, y, angle = 0, length = 160, dps = 8, durationMs = 1500) {
        this.walls.push({ roomId, worldId, x, y, len: length, ang: angle, dps, ttl: durationMs / 1000, tick: 0 })
    }

    spawnOrbitProjectile(roomId, worldId, casterId, radius = 80, omega = 2 * Math.PI, lifeMs = 3000) {
        this.projectiles.push({ id: cryptoRandomId(), kind: 'projectile', roomId, worldId, x: 0, y: 0, vx: 0, vy: 0, ttl: lifeMs / 1000, dmg: 10, mode: 'orbit', casterId, radius, omega, theta: Math.random() * Math.PI * 2 })
    }

    chainLightning(roomId, worldId, sx, sy, maxBounces = 3, range = 220, damage = 15) {
        const enemies = this.getEnemies(roomId, worldId)
        const hitIds = new Set()
        let fromX = sx,
            fromY = sy
        let dmg = damage
        let bounces = 0
        while (bounces < maxBounces && dmg > 1) {
            // find nearest enemy not hit within range
            let bestIdx = -1,
                bestDist = Infinity
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i]
                if (!e) continue
                if (hitIds.has(e.id)) continue
                const dx = e.x - fromX,
                    dy = e.y - fromY
                const d2 = dx * dx + dy * dy
                if (d2 <= range * range && d2 < bestDist) {
                    bestDist = d2;
                    bestIdx = i
                }
            }
            if (bestIdx < 0) break
            const target = enemies[bestIdx]
            this.events.push({ roomId, worldId, type: 'chain.bolt', x1: fromX, y1: fromY, x2: target.x, y2: target.y })
            target.hp = Math.max(0, (target.hp || 0) - dmg)
            if (target.hp <= 0) enemies.splice(bestIdx, 1)
            hitIds.add(target.id)
            fromX = target.x;
            fromY = target.y
            dmg = Math.floor(dmg * 0.7)
            bounces++
        }
        return { hits: hitIds.size }
    }

    coneHit(roomId, worldId, x, y, angle = 0, radius = 100, arc = Math.PI / 3, damage = 10) {
        const enemies = this.getEnemies(roomId, worldId)
        let hits = 0
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i]
            const dx = e.x - x,
                dy = e.y - y
            const d2 = dx * dx + dy * dy
            if (d2 > radius * radius) continue
            const a = Math.atan2(dy, dx)
            let da = Math.abs(a - angle)
            while (da > Math.PI) da -= 2 * Math.PI
            if (Math.abs(da) <= arc / 2) {
                e.hp = Math.max(0, (e.hp || 0) - damage)
                hits++
                if (e.hp <= 0) enemies.splice(i, 1)
            }
        }
        this.events.push({ roomId, worldId, type: 'cone.sweep', x, y, radius, angle, arc })
        return { hits }
    }

    meleeHit(roomId, worldId, x, y, radius = 40, damage = 10) {
        const list = this.ensureEnemies(roomId, worldId)
        let kills = 0
        for (let i = list.length - 1; i >= 0; i--) {
            const e = list[i]
            const dx = e.x - x,
                dy = e.y - y
            if (Math.hypot(dx, dy) <= radius) {
                e.hp = Math.max(0, (e.hp || 0) - damage)
                if (e.hp <= 0) {
                    list.splice(i, 1);
                    kills++
                }
            }
        }
        return { kills }
    }
}

function cryptoRandomId() {
    // fast fallback id generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0,
            v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16)
    })
}