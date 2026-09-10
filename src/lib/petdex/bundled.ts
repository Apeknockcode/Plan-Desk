import type { PetdexEntry } from './types'
import { BUNDLED_PETDEX_SLUGS, DEFAULT_PETDEX_SLUG } from './constants'

import tikoMeta from '@/assets/pet/petdex/tiko/meta.json'

export { BUNDLED_PETDEX_SLUGS, DEFAULT_PETDEX_SLUG }

export type BundledPetdexSlug = (typeof BUNDLED_PETDEX_SLUGS)[number]

type BundledMeta = {
  slug: string
  displayName: string
  kind?: string
  spriteVersionNumber?: number
}

const BUNDLED_META: Record<BundledPetdexSlug, BundledMeta> = {
  tiko: tikoMeta as BundledMeta
}

const SHEET_LOADERS: Record<BundledPetdexSlug, () => Promise<string>> = {
  tiko: () => import('@/assets/pet/petdex/tiko/spritesheet.webp').then((m) => m.default)
}

const entryCache = new Map<string, PetdexEntry>()

function metaToEntry(meta: BundledMeta, spritesheetUrl = ''): PetdexEntry {
  return {
    slug: meta.slug,
    displayName: meta.displayName,
    kind: meta.kind,
    spriteVersionNumber: meta.spriteVersionNumber,
    spritesheetUrl,
    petJsonUrl: ''
  }
}

export function isBundledPetdexSlug(slug: string): slug is BundledPetdexSlug {
  return slug in BUNDLED_META
}

/** 同步元数据（无精灵图，用于列表展示名称） */
export function getBundledPetdexMetas(): PetdexEntry[] {
  return BUNDLED_PETDEX_SLUGS.map((slug) => metaToEntry(BUNDLED_META[slug]))
}

/** @deprecated 使用 getBundledPetdexMetas */
export function getBundledPetdexEntries(): PetdexEntry[] {
  return getBundledPetdexMetas()
}

/** 同步读取已缓存的完整条目 */
export function getBundledPetdexEntry(slug: string): PetdexEntry | undefined {
  return entryCache.get(slug)
}

/** 异步加载内置精灵图（按需，避免主窗口打包大图） */
export async function loadBundledPetdexEntry(slug: string): Promise<PetdexEntry | undefined> {
  const cached = entryCache.get(slug)
  if (cached) return cached

  if (!isBundledPetdexSlug(slug)) return undefined

  const meta = BUNDLED_META[slug]
  const spritesheetUrl = await SHEET_LOADERS[slug]()
  const entry = metaToEntry(meta, spritesheetUrl)
  entryCache.set(slug, entry)
  return entry
}
