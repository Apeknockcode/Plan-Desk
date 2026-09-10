import { DEFAULT_PETDEX_SLUG } from './constants'
import {
  getBundledPetdexEntry,
  getBundledPetdexMetas,
  loadBundledPetdexEntry
} from './bundled'
import type { PetdexEntry, PetdexManifestResponse } from './types'

export { DEFAULT_PETDEX_SLUG, getBundledPetdexMetas as getBundledPetdexEntries, getBundledPetdexEntry, loadBundledPetdexEntry }

const MANIFEST_URL = 'https://petdex.dev/api/manifest'

let manifestPromise: Promise<PetdexManifestResponse> | null = null

export async function fetchPetdexManifest(force = false): Promise<PetdexManifestResponse> {
  if (!force && manifestPromise) return manifestPromise
  manifestPromise = fetch(MANIFEST_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`Petdex manifest ${res.status}`)
      return res.json() as Promise<PetdexManifestResponse>
    })
    .catch((err) => {
      manifestPromise = null
      throw err
    })
  return manifestPromise
}

export function filterPetdexEntries(
  pets: PetdexEntry[],
  opts: { query?: string; kind?: 'all' | 'creature' | 'character' }
): PetdexEntry[] {
  const q = opts.query?.trim().toLowerCase() ?? ''
  return pets.filter((pet) => {
    if (opts.kind && opts.kind !== 'all' && pet.kind !== opts.kind) return false
    if (!q) return true
    return (
      pet.slug.toLowerCase().includes(q) ||
      pet.displayName.toLowerCase().includes(q)
    )
  })
}

export async function getPetdexEntry(
  manifest: PetdexManifestResponse,
  slug: string
): Promise<PetdexEntry | undefined> {
  const bundled = getBundledPetdexEntry(slug) ?? (await loadBundledPetdexEntry(slug))
  if (bundled) return bundled
  return manifest.pets.find((p) => p.slug === slug)
}

/** 优先本地内置，否则需联网从 manifest 解析 */
export async function resolvePetdexEntry(slug: string): Promise<PetdexEntry | null> {
  const cached = getBundledPetdexEntry(slug)
  if (cached) return cached

  const bundled = await loadBundledPetdexEntry(slug)
  if (bundled) return bundled

  const manifest = await fetchPetdexManifest()
  return (await getPetdexEntry(manifest, slug)) ?? null
}
