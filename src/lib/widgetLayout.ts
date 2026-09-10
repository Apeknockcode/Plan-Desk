import type { WidgetDisplayMode } from './types'

export const PET_SPRITE_SCALE = 0.88
export const PET_CELL = { width: 96, height: 104 }
export const PET_SPRITE = {
  width: Math.ceil(PET_CELL.width * PET_SPRITE_SCALE),
  height: Math.ceil(PET_CELL.height * PET_SPRITE_SCALE)
}
export const PET_SHELL_PADDING = { x: 2, y: 2, gap: 4 }
export const PET_STAGE_GAP = 8
export const PET_DIALOG = {
  gap: 4,
  maxWidthCollapsed: 168,
  maxWidthExpanded: 240,
  tail: 6
}

export const PET_COLLAPSED = {
  width: PET_SHELL_PADDING.x * 2 + PET_SPRITE.width,
  height: PET_SHELL_PADDING.y * 2 + PET_SPRITE.height
}

export const PET_WITH_DIALOG = {
  width: PET_COLLAPSED.width + PET_DIALOG.gap + PET_DIALOG.maxWidthCollapsed,
  height: PET_COLLAPSED.height
}
export const PET_EXPANDED = {
  width:
    PET_SHELL_PADDING.x * 2 +
    PET_SPRITE.width +
    PET_DIALOG.gap +
    PET_DIALOG.maxWidthExpanded,
  height: 280
}
export const LIST_DEFAULT = { width: 260, height: 280 }

export const PET_MIN = { width: 72, height: 96 }

/** macOS Electron <35: transparent windows break at very small sizes */
export const PET_MAC_SAFE = { width: 128, height: 128 }

export function petStageCollapsedWidth(memberCount: number): number {
  const count = Math.max(1, memberCount)
  return (
    PET_SHELL_PADDING.x * 2 +
    count * PET_SPRITE.width +
    Math.max(0, count - 1) * PET_STAGE_GAP
  )
}

export function petStageSize(memberCount: number, expanded = false, spread = 0) {
  const base = petStageCollapsedWidth(memberCount) + spread
  const width = expanded ? base + PET_DIALOG.gap + PET_DIALOG.maxWidthExpanded : base
  return {
    width,
    height: expanded ? PET_EXPANDED.height : PET_COLLAPSED.height
  }
}

export function defaultWidgetSize(
  mode: WidgetDisplayMode,
  expanded = false,
  memberCount = 1,
  spread = 0
) {
  if (mode === 'pet-stage') {
    return petStageSize(memberCount, expanded, spread)
  }
  if (mode === 'pet') {
    return expanded ? PET_EXPANDED : PET_COLLAPSED
  }
  return LIST_DEFAULT
}
