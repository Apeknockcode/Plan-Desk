/**
 * 压缩内置桌宠精灵图（需本机安装 cwebp: brew install webp）
 */
import { spawnSync } from 'child_process'
import { existsSync, renameSync, unlinkSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const sheet = join(
  dirname(fileURLToPath(import.meta.url)),
  '../src/assets/pet/petdex/tiko/spritesheet.webp'
)
const tmp = `${sheet}.opt`

if (!existsSync(sheet)) {
  console.error('spritesheet not found:', sheet)
  process.exit(1)
}

const result = spawnSync('cwebp', ['-q', '78', sheet, '-o', tmp], { stdio: 'inherit' })
if (result.status !== 0) {
  console.error('cwebp failed — install with: brew install webp')
  process.exit(result.status ?? 1)
}

unlinkSync(sheet)
renameSync(tmp, sheet)
console.log('Optimized', sheet)
