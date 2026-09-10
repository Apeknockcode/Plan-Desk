import { adaptCodexManifest } from '@/lib/petdex/adaptCodexManifest'
import type { PetdexEntry } from '@/lib/petdex/types'
import type { PetManifest } from '@/lib/petAtlas'
import { PET_CELL, PET_SPRITE_SCALE } from '@/lib/widgetLayout'

export interface PetRuntimeConfig {
  manifest: PetManifest
  spritesheetUrl: string
  renderScale: number
}

export function petdexPetRuntime(entry: PetdexEntry): PetRuntimeConfig {
  const manifest = adaptCodexManifest(entry)
  return {
    manifest,
    spritesheetUrl: entry.spritesheetUrl,
    renderScale: (PET_CELL.width / manifest.cellWidth) * PET_SPRITE_SCALE
  }
}
