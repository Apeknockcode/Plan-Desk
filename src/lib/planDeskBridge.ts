import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { migrateStore } from '@/lib/migrate'
import { resolveShortcuts } from '@/lib/shortcuts'
import {
  createStageMember,
  getStageMembers,
  memberExistsInStage,
  normalizeStageWidget
} from '@/lib/widgetStage'
import { normalizeWidgetPlacement } from '@/lib/widgetPlacement'
import type { AppStore, WidgetConfig } from '@/lib/types'

export type BridgeKind = 'main' | 'widget' | 'quick-add'

function parseWidgetIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('widgetId')
}

function platform(): NodeJS.Platform {
  const p = navigator.platform.toLowerCase()
  if (p.includes('mac')) return 'darwin'
  if (p.includes('win')) return 'win32'
  if (p.includes('linux')) return 'linux'
  return 'linux'
}

async function loadStore(): Promise<AppStore> {
  const raw = await invoke<AppStore>('store_load')
  return migrateStore(raw)
}

async function saveStore(store: AppStore): Promise<boolean> {
  await invoke('store_save', { store: migrateStore(store) })
  return true
}

function onEvent(event: string, callback: (...args: unknown[]) => void): () => void {
  let unlisten: UnlistenFn | null = null
  void listen(event, (e) => {
    callback(e.payload)
  }).then((fn) => {
    unlisten = fn
  })
  return () => {
    void unlisten?.()
  }
}

const sharedApi = {
  platform: platform(),
  loadStore,
  saveStore,
  notifyStoreChanged: (): void => {
    void invoke('app_notify_store_changed')
  },
  onStoreUpdated: (callback: () => void): (() => void) => onEvent('store:updated', () => callback()),
  openPath: (filePath: string) => invoke<{ ok: boolean; error?: string }>('fs_open_path', { filePath }),
  showInFolder: (filePath: string) =>
    invoke<{ ok: boolean; error?: string }>('fs_show_in_folder', { filePath }),
  pathExists: (filePath: string) =>
    invoke<{ ok: boolean; exists: boolean }>('fs_path_exists', { filePath })
}

const mainApi = {
  ...sharedApi,
  createWidget: async (
    config: WidgetConfig
  ): Promise<{ ok: true; widget: WidgetConfig } | { ok: false; reason: 'duplicate' }> => {
    const store = await loadStore()
    if (config.projectId && memberExistsInStage(store.widgets, config.projectId)) {
      const existing = store.widgets.find((w) => w.displayMode === 'pet-stage')
      if (existing) {
        await invoke('widget_focus_by_id', { widgetId: existing.id })
      }
      return { ok: false, reason: 'duplicate' }
    }

    const stageMembers =
      config.stageMembers ??
      (config.projectId ? [createStageMember(config.projectId, config.petdexSlug)] : [])

    const placed = normalizeWidgetPlacement(
      normalizeStageWidget({
        ...config,
        displayMode: 'pet-stage',
        stageMembers
      })
    )

    store.widgets.push(placed)
    await saveStore(store)
    await invoke('widget_open', { config: placed })
    sharedApi.notifyStoreChanged()
    return { ok: true, widget: placed }
  },
  addStageMember: async (member: {
    projectId: string
    petdexSlug: string
  }): Promise<{ ok: true } | { ok: false; reason: 'duplicate' | 'no-stage' }> => {
    const store = await loadStore()
    const stage = store.widgets.find((w) => w.displayMode === 'pet-stage')
    if (!stage) return { ok: false, reason: 'no-stage' }

    const members = getStageMembers(stage)
    if (members.some((item) => item.projectId === member.projectId)) {
      await invoke('widget_focus_by_id', { widgetId: stage.id })
      return { ok: false, reason: 'duplicate' }
    }

    stage.stageMembers = [...members, createStageMember(member.projectId, member.petdexSlug)]
    stage.projectId = stage.stageMembers[0]?.projectId
    stage.petdexSlug = stage.stageMembers[0]?.petdexSlug
    await saveStore(store)
    sharedApi.notifyStoreChanged()
    await invoke('widget_focus_by_id', { widgetId: stage.id })
    return { ok: true }
  },
  focusWidgetByProject: async (projectId: string): Promise<boolean> => {
    const store = await loadStore()
    const widget =
      store.widgets.find(
        (w) =>
          w.displayMode === 'pet-stage' &&
          w.stageMembers?.some((member) => member.projectId === projectId)
      ) ?? store.widgets.find((w) => w.projectId === projectId)
    if (!widget) return false
    return invoke<boolean>('widget_focus_by_id', { widgetId: widget.id })
  },
  closeWidget: (widgetId: string) => invoke<boolean>('widget_close', { widgetId }),
  syncGlobalShortcuts: async (): Promise<boolean> => {
    const store = await loadStore()
    const shortcuts = resolveShortcuts(store.prefs?.shortcuts, platform() === 'darwin')
    await invoke('app_sync_global_shortcuts', { shortcuts })
    return true
  },
  onNewWidget: (callback: () => void) => onEvent('app:new-widget', () => callback()),
  onQuickAdd: (callback: () => void) => onEvent('app:quick-add', () => callback()),
  onOpenSettings: (callback: () => void) => onEvent('app:open-settings', () => callback()),
  onSelectPlan: (callback: (planId: string) => void) =>
    onEvent('app:select-plan', (planId) => callback(planId as string)),
  onWindowShown: (callback: () => void) => onEvent('app:window-shown', () => callback()),
  onWindowMinimized: (callback: () => void) => onEvent('app:window-minimized', () => callback()),
  exportStoreDialog: () => invoke<{ ok: boolean; path?: string; error?: string }>('store_export_dialog'),
  importStoreDialog: () => invoke<{ ok: boolean; error?: string }>('store_import_dialog'),
  getDataDirectory: () => invoke<string>('store_get_data_dir'),
  openDataDirectory: () => invoke<boolean>('store_open_data_dir'),
  setLaunchAtLogin: (enabled: boolean) => invoke<boolean>('app_set_launch_at_login', { enabled }),
  getLaunchAtLogin: () => invoke<boolean>('app_get_launch_at_login'),
  getMenuBarEnabled: () => invoke<boolean>('app_get_menu_bar_enabled'),
  setMenuBarEnabled: (enabled: boolean) => invoke<boolean>('app_set_menu_bar_enabled', { enabled }),
  getHideDockIcon: () => invoke<boolean>('app_get_hide_dock_icon'),
  setHideDockIcon: (hide: boolean) => invoke<boolean>('app_set_hide_dock_icon', { hide }),
  pickLink: (kind: 'file' | 'folder') =>
    invoke<{ ok: true; path: string; kind: 'file' | 'folder' } | { ok: false }>('fs_pick_link', {
      kind
    })
}

const widgetApi = {
  ...sharedApi,
  widgetId: parseWidgetIdFromUrl(),
  getWidgetId: async (): Promise<string | null> => {
    const fromUrl = parseWidgetIdFromUrl()
    if (fromUrl) return fromUrl
    return invoke<string | null>('widget_get_id')
  },
  closeWidget: (widgetId: string) => invoke<boolean>('widget_close', { widgetId }),
  removeStageMember: (projectId: string) =>
    invoke<{ ok: true; closed: boolean } | { ok: false; reason: string }>(
      'widget_remove_stage_member',
      { projectId }
    ),
  minimizeWidget: () => {
    void invoke('widget_minimize')
  },
  setWidgetSize: (width: number, height: number) =>
    invoke<boolean>('widget_set_size', { width, height }),
  showPetWidget: () => {
    void invoke('widget_pet_ready')
  },
  showListWidget: () => {
    void invoke('widget_list_ready')
  },
  beginWidgetDrag: (screenX: number, screenY: number) => {
    void invoke('widget_begin_drag', { screenX, screenY })
  },
  moveWidgetDrag: (screenX: number, screenY: number) => {
    void invoke('widget_drag_to', { screenX, screenY })
  },
  endWidgetDrag: () => {
    void invoke('widget_end_drag')
  },
  refreshWidgetTransparency: () => invoke<boolean>('widget_refresh_transparency')
}

const quickAddApi = {
  ...sharedApi,
  onQuickAddFocus: (callback: () => void) => onEvent('app:quick-add-focus', () => callback()),
  closeQuickAdd: () => {
    void invoke('quick_add_close')
  }
}

export type PlanDeskAPI = typeof mainApi
export type PlanDeskWidgetAPI = typeof widgetApi
export type PlanDeskQuickAddAPI = typeof quickAddApi

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function initPlanDeskBridge(kind: BridgeKind): Promise<void> {
  if (!isTauriRuntime()) return

  if (kind === 'main') {
    window.planDesk = mainApi as Window['planDesk']
    await mainApi.syncGlobalShortcuts()
    return
  }

  if (kind === 'widget') {
    window.planDesk = widgetApi as Window['planDesk']
    return
  }

  window.planDesk = quickAddApi as Window['planDesk']
}
