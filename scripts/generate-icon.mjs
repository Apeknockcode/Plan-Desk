/**
 * PlanDesk Dock / 应用图标 (512×512)
 * macOS 风格：灰阶 squircle 底 + 白色字母 P
 */
import { createWriteStream, mkdirSync } from 'fs'
import { deflateSync } from 'zlib'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../build')
mkdirSync(outDir, { recursive: true })

const W = 512
const H = 512

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const t = Buffer.from(type)
  const crcBuf = Buffer.concat([t, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcBuf))
  return Buffer.concat([len, t, data, crc])
}

function inRoundedRect(x, y, w, h, r) {
  return (px, py) => {
    if (px < x || py < y || px >= x + w || py >= y + h) return false
    const nx = px < x + r ? x + r - px : px >= x + w - r ? px - (x + w - r - 1) : 0
    const ny = py < y + r ? y + r - py : py >= y + h - r ? py - (y + h - r - 1) : 0
    if (nx > 0 && ny > 0) return nx * nx + ny * ny <= r * r
    return true
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function lerpRgb(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t))
  ]
}

function blend(bg, fg, alpha) {
  return [
    Math.round(lerp(bg[0], fg[0], alpha)),
    Math.round(lerp(bg[1], fg[1], alpha)),
    Math.round(lerp(bg[2], fg[2], alpha))
  ]
}

/** 将 PlanDeskLogo (24×24 viewBox) 坐标映射到 squircle 内 */
function mapRect(x, y, w, h, r) {
  const origin = 36
  const span = 440
  const scale = span / 21
  return inRoundedRect(
    origin + (x - 1.5) * scale,
    origin + (y - 1.5) * scale,
    w * scale,
    h * scale,
    r * scale
  )
}

const squircle = inRoundedRect(36, 36, 440, 440, 98)
const stem = mapRect(8.25, 7, 2.2, 10.5, 0.55)
const topBar = mapRect(8.25, 7, 7.8, 2.2, 0.55)
const rightArm = mapRect(14.8, 7, 2.2, 5.5, 0.55)
const midBar = mapRect(8.25, 12.5, 6.5, 2.1, 0.55)
const counter = mapRect(10.2, 9, 4.5, 3.2, 0.8)

const BG_TOP = [98, 98, 102]
const BG_BOTTOM = [44, 44, 48]
const WHITE = [252, 252, 254]

function backgroundAt(x, y) {
  const t = Math.max(0, Math.min(1, (y - 36) / 440))
  let rgb = lerpRgb(BG_TOP, BG_BOTTOM, t)
  const hl = Math.max(0, 1 - ((x - 120) ** 2 + (y - 100) ** 2) / 90000)
  rgb = blend(rgb, [255, 255, 255], hl * 0.1)
  return rgb
}

const pixels = Buffer.alloc(W * H * 4)
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4

    if (!squircle(x, y)) {
      pixels[i] = 0
      pixels[i + 1] = 0
      pixels[i + 2] = 0
      pixels[i + 3] = 0
      continue
    }

    let rgb = backgroundAt(x, y)

    if (stem(x, y) || topBar(x, y) || rightArm(x, y) || midBar(x, y)) {
      rgb = WHITE
    }
    if (counter(x, y)) {
      rgb = backgroundAt(x, y)
    }

    pixels[i] = rgb[0]
    pixels[i + 1] = rgb[1]
    pixels[i + 2] = rgb[2]
    pixels[i + 3] = 255
  }
}

const raw = Buffer.alloc(H * (1 + W * 4))
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0
  pixels.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4)
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8
ihdr[9] = 6
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

createWriteStream(join(outDir, 'icon.png')).end(png)
console.log('Generated build/icon.png (512×512, letter P)')
