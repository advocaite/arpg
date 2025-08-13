import type Phaser from 'phaser'

// Simple trigger: shake the camera. Params: intensity (0..1), durationMs (number)
export default async function run(scene: Phaser.Scene, params: Record<string, number | string | boolean>) {
	const cam = scene.cameras?.main
	if (!cam) return
	const intensity = Math.max(0, Math.min(1, Number(params['intensity'] ?? 0.015)))
	const durationMs = Math.max(10, Number(params['durationMs'] ?? 400))
	try { cam.shake(durationMs, intensity) } catch {}
}


