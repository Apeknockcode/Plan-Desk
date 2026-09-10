import { adaptCodexManifest } from '@/lib/petdex/adaptCodexManifest'
import type { PetdexEntry } from '@/lib/petdex/types'
import type { PetManifest } from '@/lib/petAtlas'

function spritesheetPreviewStyle(
  manifest: PetManifest,
  spritesheetUrl: string,
  scale: number
): Record<string, string> {
  const cellW = manifest.cellWidth * scale
  const cellH = manifest.cellHeight * scale
  const idleRow = manifest.states.idle.row

  return {
    width: `${cellW}px`,
    height: `${cellH}px`,
    backgroundImage: `url(${spritesheetUrl})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${manifest.columns * cellW}px ${manifest.rows * cellH}px`,
    backgroundPosition: `0 -${idleRow * cellH}px`
  }
}

/** 在固定框内等比缩放，保证整帧可见 */
export function getPetdexPreviewStyle(
  entry: PetdexEntry,
  box?: { width: number; height: number }
) {
  const manifest = adaptCodexManifest(entry)
  if (!box) {
    return spritesheetPreviewStyle(manifest, entry.spritesheetUrl, 0.32)
  }
  const scale = Math.min(box.width / manifest.cellWidth, box.height / manifest.cellHeight)
  return spritesheetPreviewStyle(manifest, entry.spritesheetUrl, scale)
}
