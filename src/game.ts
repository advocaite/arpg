import Phaser from 'phaser'
import BootScene from './scenes/BootScene'
import PreloadScene from './scenes/PreloadScene'
import MainMenuScene from './scenes/MainMenuScene'
import PainterScene from './scenes/PainterScene'
import WorldScene from './scenes/WorldScene'

export function createGame(): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#0d0f1a',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 960, height: 540 },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scene: [BootScene, PreloadScene, MainMenuScene, WorldScene, PainterScene]
  }
  return new Phaser.Game(config)
}
