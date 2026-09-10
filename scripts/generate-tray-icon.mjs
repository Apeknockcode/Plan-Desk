/**
 * macOS 菜单栏 Tray 模板图标
 * trayTemplate.png     → 18×18 (1x)
 * trayTemplate@2x.png  → 36×36 (2x)
 * 必须成对提供，否则 Retina 会把单张 36px 当成 36pt，出现大块空白。
 */
import { createWriteStream, mkdirSync } from 'fs'
import { deflateSync } from 'zlib'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../build')
mkdirSync(outDir, { recursive: true })

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

/** 18×18 逻辑坐标，P 约占 72% 画布（贴近系统图标视觉大小） */
function buildShapes() {
  return {
    stem: inRoundedRect(4.5, 2.5, 1.85, 13, 0.4),
    topBar: inRoundedRect(4.5, 2.5, 9.2, 1.85, 0.4),
    rightArm: inRoundedRect(12.85, 2.5, 1.85, 6.5, 0.4),
    midBar: inRoundedRect(4.5, 9.2, 7.8, 1.75, 0.4),
    counter: inRoundedRect(6.1, 4.2, 5.6, 3.8, 0.45)
  }
}

function renderPng(size) {
  const scale = size / 18
  const shapes = buildShapes()
  const W = size
  const H = size
  const BLACK = [0, 0, 0]
  const pixels = Buffer.alloc(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const lx = x / scale
      const ly = y / scale
      let alpha = 0

      if (
        shapes.stem(lx, ly) ||
        shapes.topBar(lx, ly) ||
        shapes.rightArm(lx, ly) ||
        shapes.midBar(lx, ly)
      ) {
        alpha = 255
      }
      if (shapes.counter(lx, ly)) {
        alpha = 0
      }

      pixels[i] = BLACK[0]
      pixels[i + 1] = BLACK[1]
      pixels[i + 2] = BLACK[2]
      pixels[i + 3] = alpha
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

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function writePng(filename, size) {
  createWriteStream(join(outDir, filename)).end(renderPng(size))
}

writePng('trayTemplate.png', 18)
writePng('trayTemplate@2x.png', 36)
console.log('Generated build/trayTemplate.png (18×18) + trayTemplate@2x.png (36×36)')
