import Phaser from 'phaser'

// Supports two modes:
// 1) Parametric grading (desat + cool/warm balance)
// 2) 3D LUT sampling from a 2D texture laid out as an N x N tile grid (tiles per row = N), each tile N x N
//    Default N = 16. Neutral LUTs should yield an identity transform.

const frag = `
precision mediump float;

uniform sampler2D uMainSampler;
varying vec2 outTexCoord;

// Parametric mode
uniform float uDesat;      // 0..1 amount of desaturation before grading
uniform float uAmount;     // 0..1 how strongly to apply warm/cool grading
uniform vec3  uCool;       // cool tint multiplier for shadows
uniform vec3  uWarm;       // warm tint multiplier for highlights

// LUT mode
uniform int   uUseLUT;     // 0/1 toggle
uniform sampler2D uLUT;
uniform float uLUTSize;    // steps per axis (e.g., 16)
uniform float uLUTTiles;   // tiles per row (usually equals uLUTSize)
uniform vec2  uLUTTexel;   // 1.0 / (lutTextureWidth, lutTextureHeight)

uniform float uStrength;   // 0..1 blend between original and graded/LUT result

vec3 sampleLUT(vec3 color) {
  float size = max(2.0, uLUTSize);
  float tiles = max(1.0, uLUTTiles);
  float slice = color.b * (size - 1.0);
  float sliceX = mod(slice, tiles);
  float sliceY = floor(slice / tiles);

  vec2 tileUV;
  tileUV.x = (color.r * (size - 1.0) + 0.5) / size; // 0..1 within tile
  tileUV.y = (color.g * (size - 1.0) + 0.5) / size;

  vec2 uv;
  uv.x = (sliceX + tileUV.x) / tiles;
  uv.y = (sliceY + tileUV.y) / tiles;

  // Half texel offset to avoid seams
  uv = uv * (1.0 - uLUTTexel * 2.0) + uLUTTexel;
  return texture2D(uLUT, uv).rgb;
}

void main() {
  vec4 src = texture2D(uMainSampler, outTexCoord);

  vec3 result = src.rgb;
  if (uUseLUT == 1) {
    result = sampleLUT(result);
  } else {
    float luma = dot(result, vec3(0.299, 0.587, 0.114));
    vec3 desat = mix(result, vec3(luma), clamp(uDesat, 0.0, 1.0));
    float w = clamp((luma - 0.3) / 0.7, 0.0, 1.0);
    vec3 graded = desat * mix(uCool, uWarm, w);
    result = mix(desat, graded, clamp(uAmount, 0.0, 1.0));
  }

  vec3 finalCol = mix(src.rgb, result, clamp(uStrength, 0.0, 1.0));
  gl_FragColor = vec4(finalCol, src.a);
}`

export default class GradingPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _desat = 0.25
  private _amount = 0.35
  private _cool: [number, number, number] = [0.95, 1.05, 1.12]
  private _warm: [number, number, number] = [1.08, 1.0, 0.92]
  private _strength = 0.8

  private _useLUT = 0
  private _lutKey: string | null = null
  private _lutSize = 16
  private _lutTiles = 16
  private _lutTexel: [number, number] = [1 / 256, 1 / 256]

  constructor(game: Phaser.Game) {
    super({ game, renderTarget: true, fragShader: frag })
  }

  onPreRender(): void {
    // Parametric
    this.set1f('uDesat', this._desat)
    this.set1f('uAmount', this._amount)
    this.set3f('uCool', this._cool[0], this._cool[1], this._cool[2])
    this.set3f('uWarm', this._warm[0], this._warm[1], this._warm[2])

    // LUT
    this.set1i('uUseLUT', this._useLUT)
    this.set1f('uLUTSize', this._lutSize)
    this.set1f('uLUTTiles', this._lutTiles)
    this.set2f('uLUTTexel', this._lutTexel[0], this._lutTexel[1])
    if (this._useLUT === 1 && this._lutKey) {
      try {
        const tex = (this.game.textures.get(this._lutKey) as any)
        const source = tex?.source?.[0]
        const glTex = source?.glTexture || source?.image || source?.data || source?.bitmap
        // Bind to texture unit 1
        ;(this as any).setTexture2D('uLUT', glTex, 1)
      } catch {}
    }

    // Blend strength
    this.set1f('uStrength', this._strength)
  }

  setParams(opts: Partial<{ desat: number; amount: number; cool: [number, number, number]; warm: [number, number, number]; strength: number }>): void {
    if (typeof opts.desat === 'number') this._desat = opts.desat
    if (typeof opts.amount === 'number') this._amount = opts.amount
    if (opts.cool) this._cool = opts.cool
    if (opts.warm) this._warm = opts.warm
    if (typeof opts.strength === 'number') this._strength = opts.strength
  }

  setLUT(key: string, size = 16, tiles = 16): void {
    this._lutKey = key
    this._useLUT = 1
    this._lutSize = size
    this._lutTiles = tiles
    try {
      const tex = (this.game.textures.get(key) as any)
      const src = tex?.source?.[0]
      const w = src?.width || 256
      const h = src?.height || 256
      this._lutTexel = [1 / w, 1 / h]
      // If it's a square texture and divisible by size, infer tiles per row as size
      if (w === h && (w % size === 0)) this._lutTiles = size
    } catch {}
  }

  clearLUT(): void { this._useLUT = 0; this._lutKey = null }
}



