import type Phaser from 'phaser'

export type TriggerContext = { id: string; x: number; y: number; width: number; height: number }

export async function runTrigger(scene: Phaser.Scene, ref: string, params: Record<string, number | string | boolean> | undefined, ctx: TriggerContext): Promise<void> {
	const safeRef = String(ref || '').replace(/[^a-zA-Z0-9_\/-]/g, '')
	if (!safeRef) return
	try {
		const cleaned = safeRef.replace(/\.(t|j)sx?$/i, '')
		// Resolve relatively so Vite can handle dynamic chunks
		const url = new URL(`../triggers/${cleaned}.ts`, import.meta.url).href
		const mod: any = await import(/* @vite-ignore */ url)
		const fn = typeof mod?.default === 'function' ? mod.default : (typeof mod?.run === 'function' ? mod.run : undefined)
		if (typeof fn !== 'function') return
		await Promise.resolve(fn(scene, params || {}, ctx))
	} catch (e) {
		console.warn('[TriggerRunner] failed to load or run', ref, e)
	}
}


