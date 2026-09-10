import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_ROOT = path.join(__dirname, '../src/assets/pet/petdex')
const MANIFEST_URL = 'https://petdex.dev/api/manifest'

/** 离线内置仅默认桌宠；其余推荐款从 Petdex CDN 按需加载 */
export const BUNDLED_SLUGS = ['tiko']

async function main() {
  const res = await fetch(MANIFEST_URL)
  if (!res.ok) throw new Error(`manifest ${res.status}`)
  const { pets } = await res.json()

  for (const slug of BUNDLED_SLUGS) {
    const pet = pets.find((p) => p.slug === slug)
    if (!pet) {
      console.warn(`skip missing slug: ${slug}`)
      continue
    }

    const dir = path.join(OUT_ROOT, slug)
    fs.mkdirSync(dir, { recursive: true })

    const sheetRes = await fetch(pet.spritesheetUrl)
    if (!sheetRes.ok) throw new Error(`${slug} sheet ${sheetRes.status}`)
    const sheetBuf = Buffer.from(await sheetRes.arrayBuffer())
    fs.writeFileSync(path.join(dir, 'spritesheet.webp'), sheetBuf)

    const meta = {
      slug: pet.slug,
      displayName: pet.displayName,
      kind: pet.kind ?? 'creature',
      spriteVersionNumber: pet.spriteVersionNumber ?? 1
    }
    fs.writeFileSync(path.join(dir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`)
    console.log(`bundled ${slug} (${(sheetBuf.length / 1024).toFixed(0)} KB)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
