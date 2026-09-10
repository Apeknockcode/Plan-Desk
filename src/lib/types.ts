export type ItemCategory = 'todo' | 'memo' | 'debt' | 'project'
export type ItemPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Project {
  id: string
  name: string
  color: string
  createdAt: number
}

export type ItemLinkKind = 'file' | 'folder'

/** 事项关联的文件或文件夹（可选） */
export interface ItemLink {
  path: string
  kind: ItemLinkKind
}

export interface PlanItem {
  id: string
  title: string
  notes: string
  /** 可选：关联的文件或文件夹，方便快速打开 */
  links?: ItemLink[]
  /** @deprecated legacy — defaults to 'todo' on create */
  category: ItemCategory
  /** @deprecated legacy — defaults to 'normal' on create */
  priority: ItemPriority
  /** @deprecated legacy — no longer shown in UI */
  dueDate: string | null
  projectId: string | null
  pinned: boolean
  completed: boolean
  completedAt: number | null
  sortOrder: number
  createdAt: number
  updatedAt: number
}

/** @deprecated legacy filters kept for old widget configs */
export type WidgetFilter = 'project' | 'today' | 'overdue' | 'pinned' | 'category'

export type WidgetDisplayMode = 'list' | 'pet' | 'pet-stage'

export interface PetStageMember {
  projectId: string
  petdexSlug: string
  /** 舞台内水平微调（像素） */
  offsetX?: number
}

/** 舞台内 pet 间交互（由 SpritePet 播放） */
export type PetInteraction =
  | 'wave'
  | 'run-left'
  | 'run-right'
  | 'jump'
  | 'failed'
  | null

export type PetState = 'idle' | 'busy' | 'done'

export interface WidgetConfig {
  id: string
  title: string
  filter: WidgetFilter
  projectId?: string
  category?: ItemCategory
  /** 展示模式：列表面板 / 桌面宠物 */
  displayMode?: WidgetDisplayMode
  /** Petdex 图库 slug（legacy 单 pet / stage 首个成员） */
  petdexSlug?: string
  /** 多计划桌宠舞台成员（displayMode 为 pet-stage） */
  stageMembers?: PetStageMember[]
  x: number
  y: number
  width: number
  height: number
}

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

import type { ShortcutActionId } from './shortcuts'

export type { ShortcutActionId }
export type ThemePreference = 'dark' | 'light' | 'system'

export type { ThemeAccentId } from './themeAccent'
import type { ThemeAccentId } from './themeAccent'

export interface AppPrefs {
  selectedMenuKey: string | null
  expandedKeys: string[]
  defaultPlanId: string | null
  theme?: ThemePreference
  /** 主题强调色（与深浅模式配对） */
  themeAccent?: ThemeAccentId
  shortcuts?: Partial<Record<ShortcutActionId, string>>
  windowBounds?: WindowBounds
  launchAtLogin?: boolean
  /** macOS：是否在菜单栏显示图标（默认 true） */
  menuBarEnabled?: boolean
  /** macOS：隐藏 Dock 图标，仅保留菜单栏入口 */
  hideDockIcon?: boolean
}

export interface AppStore {
  version: 2
  projects: Project[]
  items: PlanItem[]
  widgets: WidgetConfig[]
  prefs: AppPrefs
}

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  todo: '待办',
  memo: '备忘',
  debt: '欠缺',
  project: '项目跟进'
}

export const PRIORITY_LABELS: Record<ItemPriority, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急'
}

export function createDefaultPrefs(): AppPrefs {
  return {
    selectedMenuKey: null,
    expandedKeys: [],
    defaultPlanId: null,
    theme: 'system',
    launchAtLogin: false,
    menuBarEnabled: true,
    hideDockIcon: false
  }
}

export function createEmptyStore(): AppStore {
  return { version: 2, projects: [], items: [], widgets: [], prefs: createDefaultPrefs() }
}
