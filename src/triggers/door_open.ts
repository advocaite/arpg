import type Phaser from 'phaser'

// Example trigger module. Usage: set ref: 'door_open' on a trigger in the Painter.
// Params can include: doorId (string), questId (string) to gate opening, and msg (string) for feedback.
export default async function run(scene: Phaser.Scene, params: Record<string, number | string | boolean>, ctx: { id: string; x: number; y: number; width: number; height: number }) {
	const anyScene: any = scene as any
	const doorId = String(params['doorId'] || '')
	const questId = String(params['questId'] || '')
	const msg = String(params['msg'] || 'A mechanism clicks...')

	// Optional quest gate: only fire if quest completed
	if (questId) {
		try {
			const charId = localStorage.getItem('quests.activeCharId') || '0'
			const completed: Array<{ id: string }> = JSON.parse(localStorage.getItem(`quests.completed.${charId}`) || '[]') || []
			if (!completed.some(e => e.id === questId)) return
		} catch {}
	}

	// Visual feedback (dev): floating text at trigger center
	try { anyScene.add?.text?.(ctx.x, ctx.y - 18, msg, { fontFamily: 'monospace', color: '#aaf' })?.setOrigin?.(0.5) } catch {}

	// If you have a door system, call into it here using doorId
	// e.g., await anyScene.openDoorById?.(doorId)
}


