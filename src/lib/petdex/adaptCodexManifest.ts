import type { PetManifest } from '@/lib/petAtlas'
import type { PetdexEntry } from './types'

const IDLE_DURATIONS = [280, 110, 110, 140, 140, 320]
const BUSY_DURATIONS = [120, 120, 120, 120, 120, 220]
const DONE_DURATIONS = [150, 150, 150, 150, 150, 280]
const RUN_DURATIONS = [100, 100, 100, 100, 100, 100, 100, 140]
const JUMP_DURATIONS = [90, 90, 90, 90, 180]
const FAILED_DURATIONS = [140, 120, 120, 120, 120, 120, 120, 200]
const WAVE_DURATIONS = [280, 110, 110, 140]

/** Codex / Petdex 标准 192×208 图集 → PlanDesk 三态 + 八向注视 */
export function adaptCodexManifest(entry: PetdexEntry): PetManifest {
  const isV2 = entry.spriteVersionNumber === 2
  const lookRow = isV2 ? 9 : 2
  const lookFrameCount = 8

  return {
    id: `petdex-${entry.slug}`,
    displayName: entry.displayName,
    description: entry.displayName,
    spriteVersionNumber: entry.spriteVersionNumber ?? 1,
    spritesheetPath: entry.spritesheetUrl,
    cellWidth: 192,
    cellHeight: 208,
    columns: 8,
    rows: isV2 ? 11 : 9,
    states: {
      idle: { row: 0, frameCount: 6, durations: IDLE_DURATIONS },
      busy: { row: 6, frameCount: 6, durations: BUSY_DURATIONS },
      done: { row: 8, frameCount: 6, durations: DONE_DURATIONS },
      look: {
        row: lookRow,
        frameCount: lookFrameCount,
        durations: Array(lookFrameCount).fill(100)
      },
      wave: { row: 3, frameCount: 4, durations: WAVE_DURATIONS },
      run: { row: 7, frameCount: 6, durations: BUSY_DURATIONS },
      jump: { row: 4, frameCount: 5, durations: JUMP_DURATIONS },
      failed: { row: 5, frameCount: 8, durations: FAILED_DURATIONS },
      runRight: { row: 1, frameCount: 8, durations: RUN_DURATIONS },
      runLeft: isV2
        ? { row: 2, frameCount: 8, durations: RUN_DURATIONS }
        : { row: 1, frameCount: 8, durations: RUN_DURATIONS }
    },
    lookDirections: ['000', '045', '090', '135', '180', '225', '270', '315'],
    stateMap: { idle: 'idle', busy: 'busy', done: 'done' }
  }
}
