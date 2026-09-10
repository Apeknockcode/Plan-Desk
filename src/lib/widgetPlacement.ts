import { defaultWidgetSize, PET_COLLAPSED } from './widgetLayout'
import { getStageMembers, isPetWidget } from './widgetStage'
import type { WidgetConfig } from './types'

/** Clamp widget position/size to the current screen work area. */
export function normalizeWidgetPlacement(config: WidgetConfig): WidgetConfig {
  const screenX = typeof config.x === 'number' ? config.x : 0
  const screenY = typeof config.y === 'number' ? config.y : 0
  const display = window.screen
  const area = {
    x: display.availLeft,
    y: display.availTop,
    width: display.availWidth,
    height: display.availHeight
  }

  const mode = config.displayMode ?? 'list'
  const fallback = defaultWidgetSize(mode, false)
  let width = config.width || fallback.width
  let height = config.height || fallback.height

  if (isPetWidget(mode)) {
    const memberCount = Math.max(1, getStageMembers(config).length)
    const size = defaultWidgetSize(mode === 'pet-stage' ? 'pet-stage' : 'pet', false, memberCount)
    width = size.width
    height = size.height
  }

  const isMac = navigator.platform.toLowerCase().includes('mac')
  const margin = 24
  const x = Math.min(
    Math.max(area.x + margin, screenX || area.x + area.width - width - margin),
    area.x + area.width - width - margin
  )
  const y = Math.min(
    Math.max(area.y + (isMac ? 48 : margin), screenY || area.y + (isMac ? 48 : margin)),
    area.y + area.height - height - margin
  )

  return { ...config, x, y, width, height }
}

export function widgetMinSize(displayMode?: WidgetConfig['displayMode']): {
  width: number
  height: number
} {
  const isPet = isPetWidget(displayMode)
  return {
    width: isPet ? PET_COLLAPSED.width : 240,
    height: isPet ? PET_COLLAPSED.height : 200
  }
}
