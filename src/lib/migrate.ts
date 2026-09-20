import { DEFAULT_PETDEX_SLUG } from './petdex/constants'
import { PLAN_COLOR_PALETTE } from './planColors'
import type { AppStore, PlanItem } from './types'
import { createDefaultPrefs, createEmptyStore } from './types'
import { normalizeItemLinks } from './itemLinks'
import { getStageMembers, isPetWidget, mergePetWidgetsToStage } from './widgetStage'

/** 为重复/缺失/旧版暖色的计划分配低饱和 palette */
function ensureDistinctPlanColors(projects: AppStore['projects']): void {
  const seen = new Set<string>()
  let paletteIdx = 0
  for (const project of projects) {
    let color = project.color?.trim() ?? ''
    const normalized = color.toLowerCase()
    const isLegacyWarm =
      normalized === '#e8a838' ||
      normalized === '#e87838' ||
      normalized === '#e87858' ||
      normalized === '#d89828' ||
      normalized === '#c48420'
    if (!color || seen.has(normalized) || isLegacyWarm) {
      while (
        paletteIdx < PLAN_COLOR_PALETTE.length &&
        seen.has(PLAN_COLOR_PALETTE[paletteIdx].toLowerCase())
      ) {
        paletteIdx++
      }
      color = PLAN_COLOR_PALETTE[paletteIdx % PLAN_COLOR_PALETTE.length]
      project.color = color
      paletteIdx++
    }
    seen.add(color.toLowerCase())
  }
}

/** Normalize legacy store.json (v1 or partial) to current AppStore shape. */
export function migrateStore(raw: unknown): AppStore {
  if (!raw || typeof raw !== 'object') return createEmptyStore()

  const data = raw as Record<string, unknown>
  const projects = Array.isArray(data.projects) ? [...data.projects] : []
  ensureDistinctPlanColors(projects as AppStore['projects'])
  const items = (Array.isArray(data.items) ? data.items : []) as PlanItem[]
  let widgets = Array.isArray(data.widgets) ? data.widgets : []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.sortOrder === undefined || item.sortOrder === null) {
      item.sortOrder = item.createdAt ?? i * 1000
    }
    item.links = normalizeItemLinks(item.links)
  }

  for (const widget of widgets as AppStore['widgets']) {
    if (widget.filter !== 'project') {
      widget.filter = 'project'
    }
    if (!widget.projectId && projects.length > 0) {
      widget.projectId = (projects[0] as { id: string }).id
    }
    if (widget.displayMode !== 'list' && !isPetWidget(widget.displayMode)) {
      widget.displayMode = 'list'
    }
    if (isPetWidget(widget.displayMode)) {
      if (!widget.petdexSlug) {
        widget.petdexSlug = DEFAULT_PETDEX_SLUG
      }
      delete widget.petId
    } else {
      delete widget.petId
      delete widget.petdexSlug
      delete widget.stageMembers
    }
  }

  widgets = mergePetWidgetsToStage(widgets as AppStore['widgets'])

  for (const widget of widgets as AppStore['widgets']) {
    if (widget.displayMode === 'pet-stage') {
      const members = getStageMembers(widget)
      widget.stageMembers = members
      widget.projectId = members[0]?.projectId ?? widget.projectId
      widget.petdexSlug = members[0]?.petdexSlug ?? widget.petdexSlug
    }
  }

  for (const project of projects as AppStore['projects']) {
    if (project.notionUrl === '') project.notionUrl = null
    if (project.obsidianPath === '') project.obsidianPath = null
  }

  const prefs =
    data.prefs && typeof data.prefs === 'object'
      ? { ...createDefaultPrefs(), ...(data.prefs as AppStore['prefs']) }
      : createDefaultPrefs()
  if (prefs.obsidianVaultPath === '') prefs.obsidianVaultPath = null

  return {
    version: 2,
    projects: projects as AppStore['projects'],
    items,
    widgets: widgets as AppStore['widgets'],
    prefs
  }
}
