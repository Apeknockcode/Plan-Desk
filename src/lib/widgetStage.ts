import { DEFAULT_PETDEX_SLUG } from './petdex/constants'
import type { PetStageMember, WidgetConfig, WidgetDisplayMode } from './types'

export function isPetWidget(mode?: WidgetDisplayMode): boolean {
  return mode === 'pet' || mode === 'pet-stage'
}

export function getStageMembers(widget: WidgetConfig | null | undefined): PetStageMember[] {
  if (!widget || !isPetWidget(widget.displayMode)) return []
  if (widget.stageMembers?.length) return widget.stageMembers
  if (widget.projectId && widget.petdexSlug) {
    return [{ projectId: widget.projectId, petdexSlug: widget.petdexSlug }]
  }
  return []
}

export function findStageWidget(widgets: WidgetConfig[]): WidgetConfig | undefined {
  return widgets.find((w) => w.displayMode === 'pet-stage')
}

export function findStageByProject(
  widgets: WidgetConfig[],
  projectId: string
): WidgetConfig | undefined {
  return widgets.find(
    (w) =>
      isPetWidget(w.displayMode) &&
      getStageMembers(w).some((member) => member.projectId === projectId)
  )
}

export function memberExistsInStage(widgets: WidgetConfig[], projectId: string): boolean {
  return Boolean(findStageByProject(widgets, projectId))
}

export function createStageMember(projectId: string, petdexSlug?: string): PetStageMember {
  return { projectId, petdexSlug: petdexSlug ?? DEFAULT_PETDEX_SLUG }
}

/** 从舞台移除一名成员；若已无成员则返回 null */
export function removeStageMember(
  widget: WidgetConfig,
  projectId: string
): WidgetConfig | null {
  const current = getStageMembers(widget)
  const members = current.filter((member) => member.projectId !== projectId)
  if (members.length === current.length) return widget
  if (members.length === 0) return null
  return normalizeStageWidget({ ...widget, stageMembers: members })
}

export function normalizeStageWidget(widget: WidgetConfig): WidgetConfig {
  const members = getStageMembers(widget)
  return {
    ...widget,
    displayMode: 'pet-stage',
    stageMembers: members,
    projectId: members[0]?.projectId ?? widget.projectId,
    petdexSlug: members[0]?.petdexSlug ?? widget.petdexSlug
  }
}

/** 合并多个 pet / pet-stage widget 为一个舞台 */
export function mergePetWidgetsToStage(widgets: WidgetConfig[]): WidgetConfig[] {
  const listWidgets = widgets.filter((w) => w.displayMode === 'list')
  const petWidgets = widgets.filter((w) => isPetWidget(w.displayMode))

  if (petWidgets.length === 0) return widgets

  const members: PetStageMember[] = []
  for (const widget of petWidgets) {
    for (const member of getStageMembers(widget)) {
      if (!members.some((m) => m.projectId === member.projectId)) {
        members.push(member)
      }
    }
  }

  if (members.length === 0) return widgets

  const anchor = petWidgets[0]
  const stage = normalizeStageWidget({
    ...anchor,
    stageMembers: members
  })

  return [...listWidgets, stage]
}
