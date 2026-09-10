import { ref, toRaw } from 'vue'
import type { AppStore, Project, WidgetConfig } from './types'
import { createEmptyStore } from './types'
import { migrateStore } from './migrate'
import { sortPlanItems } from './sortPlanItems'

export { sortPlanItems }

const store = ref<AppStore>(createEmptyStore())
const loaded = ref(false)

function cloneStore(data: AppStore): AppStore {
  return JSON.parse(JSON.stringify(toRaw(data))) as AppStore
}

export function usePlanStore() {
  async function load(): Promise<void> {
    const raw = await window.planDesk.loadStore()
    store.value = migrateStore(raw)
    loaded.value = true
  }

  async function persist(): Promise<void> {
    await window.planDesk.saveStore(cloneStore(store.value))
    window.planDesk.notifyStoreChanged()
  }

  async function savePrefs(patch: Partial<AppStore['prefs']>): Promise<void> {
    store.value.prefs = { ...store.value.prefs, ...patch }
    await persist()
  }

  async function addItem(
    item: Omit<PlanItem, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'sortOrder'>
  ): Promise<PlanItem> {
    const now = Date.now()
    const siblings = store.value.items.filter(
      (i) => i.projectId === item.projectId && i.completed === item.completed
    )
    const maxOrder = siblings.reduce((max, i) => Math.max(max, i.sortOrder ?? i.createdAt), 0)

    const newItem: PlanItem = {
      ...item,
      id: crypto.randomUUID(),
      sortOrder: maxOrder + 1000,
      completedAt: item.completed ? now : null,
      createdAt: now,
      updatedAt: now
    }
    store.value.items.unshift(newItem)
    await persist()
    return newItem
  }

  async function updateItem(id: string, patch: Partial<PlanItem>): Promise<void> {
    const item = store.value.items.find((i) => i.id === id)
    if (!item) return
    Object.assign(item, patch, { updatedAt: Date.now() })
    if (patch.completed === true) item.completedAt = Date.now()
    if (patch.completed === false) item.completedAt = null
    await persist()
  }

  async function removeItem(id: string): Promise<void> {
    store.value.items = store.value.items.filter((i) => i.id !== id)
    await persist()
  }

  async function reorderItems(projectId: string, orderedIds: string[]): Promise<void> {
    orderedIds.forEach((id, index) => {
      const item = store.value.items.find((i) => i.id === id)
      if (item && item.projectId === projectId) {
        item.sortOrder = (index + 1) * 1000
        item.updatedAt = Date.now()
      }
    })
    await persist()
  }

  async function addProject(name: string, color: string): Promise<Project> {
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      color,
      createdAt: Date.now()
    }
    store.value.projects.push(project)
    await persist()
    return project
  }

  async function removeProject(id: string): Promise<void> {
    store.value.projects = store.value.projects.filter((p) => p.id !== id)
    store.value.items = store.value.items.filter((i) => i.projectId !== id)
    if (store.value.prefs.defaultPlanId === id) {
      store.value.prefs.defaultPlanId = store.value.projects[0]?.id ?? null
    }
    await persist()
  }

  async function updateProject(
    id: string,
    patch: Partial<Pick<Project, 'name' | 'color'>>
  ): Promise<void> {
    const project = store.value.projects.find((p) => p.id === id)
    if (!project) return
    Object.assign(project, patch)
    await persist()
  }

  async function clearCompletedItems(projectId: string): Promise<number> {
    const before = store.value.items.length
    store.value.items = store.value.items.filter(
      (i) => i.projectId !== projectId || !i.completed
    )
    const removed = before - store.value.items.length
    if (removed > 0) await persist()
    return removed
  }

  async function moveItemToPlan(itemId: string, projectId: string): Promise<void> {
    const item = store.value.items.find((i) => i.id === itemId)
    if (!item || item.projectId === projectId) return

    const siblings = store.value.items.filter(
      (i) => i.projectId === projectId && i.completed === item.completed
    )
    const maxOrder = siblings.reduce((max, i) => Math.max(max, i.sortOrder ?? i.createdAt), 0)

    item.projectId = projectId
    item.sortOrder = maxOrder + 1000
    item.updatedAt = Date.now()
    await persist()
  }

  async function addWidget(
    config: Omit<WidgetConfig, 'id'>
  ): Promise<{ widget: WidgetConfig; created: boolean }> {
    const projectId = config.projectId
    if (projectId && window.planDesk.focusWidgetByProject) {
      const existingStage = store.value.widgets.find(
        (w) =>
          w.displayMode === 'pet-stage' &&
          w.stageMembers?.some((member) => member.projectId === projectId)
      )
      if (existingStage) {
        await window.planDesk.focusWidgetByProject(projectId)
        return { widget: existingStage, created: false }
      }
    }

    const existingStage = store.value.widgets.find((w) => w.displayMode === 'pet-stage')
    if (existingStage && projectId && config.petdexSlug && window.planDesk.addStageMember) {
      const result = await window.planDesk.addStageMember({
        projectId,
        petdexSlug: config.petdexSlug
      })
      store.value = migrateStore(await window.planDesk.loadStore())
      const stage = store.value.widgets.find((w) => w.displayMode === 'pet-stage') ?? existingStage
      if (!result.ok) {
        await window.planDesk.focusWidgetByProject?.(projectId)
        return { widget: stage, created: false }
      }
      return { widget: stage, created: true }
    }

    const widget: WidgetConfig = {
      ...config,
      id: crypto.randomUUID(),
      displayMode: 'pet-stage',
      stageMembers: projectId
        ? [{ projectId, petdexSlug: config.petdexSlug ?? 'tiko' }]
        : config.stageMembers
    }

    if (window.planDesk.createWidget) {
      const result = await window.planDesk.createWidget(widget)
      store.value = migrateStore(await window.planDesk.loadStore())
      if (!result.ok) {
        await window.planDesk.focusWidgetByProject?.(projectId!)
        const existing = store.value.widgets.find((w) =>
          w.stageMembers?.some((member) => member.projectId === projectId)
        )
        return { widget: existing ?? widget, created: false }
      }
      return { widget: result.widget, created: true }
    }
    store.value.widgets.push(widget)
    await persist()
    return { widget, created: true }
  }

  return {
    store,
    loaded,
    load,
    persist,
    savePrefs,
    addItem,
    updateItem,
    removeItem,
    reorderItems,
    addProject,
    removeProject,
    updateProject,
    clearCompletedItems,
    moveItemToPlan,
    addWidget
  }
}

export function isOverdue(item: PlanItem): boolean {
  if (!item.dueDate || item.completed) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(item.dueDate).getTime() < today.getTime()
}

export function projectHasOverdue(items: PlanItem[], projectId: string): boolean {
  return items.some((item) => item.projectId === projectId && isOverdue(item))
}

export function isToday(item: PlanItem): boolean {
  if (!item.dueDate) return false
  const today = new Date().toISOString().slice(0, 10)
  return item.dueDate.slice(0, 10) === today
}

/** 未完成且应持续显示：无截止日期、已到期、今天到期或置顶 */
export function isActiveUntilCompleted(item: PlanItem): boolean {
  if (item.completed) return false
  if (item.pinned || !item.dueDate) return true
  const today = new Date().toISOString().slice(0, 10)
  return item.dueDate.slice(0, 10) <= today
}

export function filterItems(
  items: PlanItem[],
  filter: WidgetConfig['filter'],
  opts?: { projectId?: string; category?: PlanItem['category'] }
): PlanItem[] {
  const active = items.filter((i) => !i.completed)

  if (filter === 'project' && opts?.projectId) {
    return sortPlanItems(
      active.filter((i) => i.projectId === opts.projectId),
      false
    )
  }

  switch (filter) {
    case 'today':
      return active.filter((i) => isActiveUntilCompleted(i))
    case 'overdue':
      return active.filter((i) => isOverdue(i))
    case 'pinned':
      return active.filter((i) => i.pinned)
    case 'project':
      return active.filter((i) => i.projectId === opts?.projectId)
    case 'category':
      return active.filter((i) => i.category === opts?.category)
    default:
      return active
  }
}

export function formatCompletedAt(ts: number | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
