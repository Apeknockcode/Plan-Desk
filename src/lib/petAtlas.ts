import { adaptCodexManifest } from '@/lib/petdex/adaptCodexManifest'
import type { PetdexEntry } from '@/lib/petdex/types'
import tikoMeta from '@/assets/pet/petdex/tiko/meta.json'
import type { PetState } from '@/lib/types'

const defaultMetaEntry: PetdexEntry = {
  ...(tikoMeta as Omit<PetdexEntry, 'spritesheetUrl' | 'petJsonUrl'>),
  spritesheetUrl: '',
  petJsonUrl: ''
}

export interface PetAnimationDef {
  row: number
  frameCount: number
  durations: number[]
}

export interface PetManifest {
  id: string
  displayName: string
  description: string
  spriteVersionNumber: number
  spritesheetPath: string
  cellWidth: number
  cellHeight: number
  columns: number
  rows: number
  states: {
    idle: PetAnimationDef
    busy: PetAnimationDef
    done: PetAnimationDef
    look: PetAnimationDef
    wave: PetAnimationDef
    run: PetAnimationDef
    jump: PetAnimationDef
    failed: PetAnimationDef
    runRight: PetAnimationDef
    runLeft: PetAnimationDef
  }
  lookDirections: string[]
  stateMap: Record<PetState, keyof PetManifest['states']>
}

export const defaultPetManifest = adaptCodexManifest(defaultMetaEntry)

export const PET_STATE_LABELS: Record<PetState, string> = {
  idle: '今天还没安排事',
  busy: '还有事要做',
  done: '全部搞定啦'
}

export function resolvePetState(activeCount: number, planItemCount: number): PetState {
  if (planItemCount === 0) return 'idle'
  if (activeCount > 0) return 'busy'
  return 'done'
}

export function frameRect(manifest: PetManifest, row: number, col: number) {
  return {
    sx: col * manifest.cellWidth,
    sy: row * manifest.cellHeight,
    sw: manifest.cellWidth,
    sh: manifest.cellHeight
  }
}

/** Map mouse position to 8-way look index (Codex-style clockwise from up). */
export function resolveLookIndex(
  mouseX: number,
  mouseY: number,
  centerX: number,
  centerY: number,
  deadZone = 28
): number | null {
  const dx = mouseX - centerX
  const dy = mouseY - centerY
  const dist = Math.hypot(dx, dy)
  if (dist < deadZone) return null

  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  const normalized = (angle + 360 + 90) % 360
  return Math.round(normalized / 45) % 8
}

export function animationKeyForState(manifest: PetManifest, state: PetState): keyof PetManifest['states'] {
  return manifest.stateMap[state] ?? 'idle'
}
