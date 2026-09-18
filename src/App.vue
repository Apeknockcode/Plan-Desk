<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { NButton, NEmpty, NInput, NLayout, NModal, NSpace, NSpin, NText, useDialog, useMessage } from 'naive-ui'
import PlanSidebar from '@/components/PlanSidebar.vue'
import TaskListPanel from '@/components/TaskListPanel.vue'
import CalendarPanel from '@/components/CalendarPanel.vue'
const ItemForm = defineAsyncComponent(() => import('@/components/ItemForm.vue'))
const WidgetForm = defineAsyncComponent(() => import('@/components/WidgetForm.vue'))
const SettingsModal = defineAsyncComponent(() => import('@/components/SettingsModal.vue'))
import PlanColorPicker from '@/components/PlanColorPicker.vue'
import AppIcon from '@/ui/AppIcon.vue'
import { Search } from '@/ui/icons'
import PlanDeskLogo from '@/components/PlanDeskLogo.vue'
import { sortPlanItems, usePlanStore } from '@/lib/store'
import { initThemeFromPrefs } from '@/composables/useThemePreference'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { resolveShortcuts } from '@/lib/shortcuts'
import { pickPlanColor } from '@/lib/planColors'
import { itemsDueOnDate, toDateKey } from '@/lib/calendarDate'
import { CALENDAR_MENU_KEY, isCalendarMenuKey } from '@/lib/menuKeys'
import type { PlanItem } from '@/lib/types'

const {
  store,
  loaded,
  load,
  addItem,
  addProject,
  updateItem,
  removeItem,
  removeProject,
  updateProject,
  clearCompletedItems,
  reorderItems,
  moveItemToPlan,
  savePrefs
} = usePlanStore()
const message = useMessage()
const dialog = useDialog()

type StatusFilter = 'active' | 'completed'

const selectedMenuKey = ref<string | null>(null)
const expandedKeys = ref<string[]>([])
const selectedItemId = ref<string | null>(null)
const showSearch = ref(false)
const searchQuery = ref('')
const searchInputRef = ref<{ focus: () => void } | null>(null)
const showItemForm = ref(false)
const showWidgetForm = ref(false)
const showSettings = ref(false)
const showPlanForm = ref(false)
const showRenamePlanForm = ref(false)
const newPlanName = ref('')
const newPlanColor = ref('#E8A838')
const renamePlanId = ref<string | null>(null)
const renamePlanName = ref('')
const renamePlanColor = ref('#E8A838')
const creatingPlan = ref(false)
const editingItem = ref<PlanItem | null>(null)
const undoState = ref<{ id: string; title: string } | null>(null)
const dragItemId = ref<string | null>(null)
const taskListRef = ref<InstanceType<typeof TaskListPanel> | null>(null)
const calendarRef = ref<InstanceType<typeof CalendarPanel> | null>(null)
const calendarSelectedKey = ref(toDateKey(new Date()))
const calendarAddPlanId = ref<string | null>(null)

const isWindows = window.planDesk.platform === 'win32'
let minimizeHintShown = false

let undoTimer: ReturnType<typeof setTimeout> | undefined
let prefsTimer: ReturnType<typeof setTimeout> | undefined
let ignoreNextStoreUpdate = false
let isApplyingPrefs = false

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

const isCalendarView = computed(() => isCalendarMenuKey(selectedMenuKey.value))

const selectedPlanId = computed(() => {
  if (!selectedMenuKey.value || isCalendarView.value) return null
  return selectedMenuKey.value.split(':')[0] ?? null
})

const statusFilter = computed((): StatusFilter | null => {
  if (!selectedMenuKey.value?.includes(':') || isCalendarView.value) return null
  return selectedMenuKey.value.split(':')[1] as StatusFilter
})

function resolveDefaultPlanId(): string | null {
  const projects = store.value.projects
  if (!projects.length) return null
  const preferred = store.value.prefs.defaultPlanId
  if (preferred && projects.some((p) => p.id === preferred)) return preferred
  return projects[0].id
}

function ensureCalendarAddPlanId() {
  const projects = store.value.projects
  if (!projects.length) {
    calendarAddPlanId.value = null
    return
  }
  const cur = calendarAddPlanId.value
  if (cur && projects.some((p) => p.id === cur)) return
  const pref = store.value.prefs.calendarQuickAddPlanId
  if (pref && projects.some((p) => p.id === pref)) {
    calendarAddPlanId.value = pref
    return
  }
  calendarAddPlanId.value = resolveDefaultPlanId()
}

function syncCalendarAddPlanFromPrefs() {
  const projects = store.value.projects
  if (!projects.length) {
    calendarAddPlanId.value = null
    return
  }
  const pref = store.value.prefs.calendarQuickAddPlanId
  if (pref && projects.some((p) => p.id === pref)) {
    calendarAddPlanId.value = pref
    return
  }
  calendarAddPlanId.value = resolveDefaultPlanId()
}

async function persistCalendarAddPlanPref(planId: string | null) {
  if (store.value.prefs.calendarQuickAddPlanId === planId) return
  ignoreNextStoreUpdate = true
  try {
    await savePrefs({ calendarQuickAddPlanId: planId })
  } finally {
    setTimeout(() => {
      ignoreNextStoreUpdate = false
    }, 50)
  }
}

function onCalendarAddPlanIdChange(planId: string | null) {
  calendarAddPlanId.value = planId
  void persistCalendarAddPlanPref(planId)
}

const selectedPlan = computed(
  () => store.value.projects.find((p) => p.id === selectedPlanId.value) ?? null
)

const filteredItems = computed(() => {
  if (!selectedPlanId.value || !statusFilter.value) return []

  let items = store.value.items.filter((i) => i.projectId === selectedPlanId.value)
  items =
    statusFilter.value === 'completed'
      ? items.filter((i) => i.completed)
      : items.filter((i) => !i.completed)

  return sortPlanItems(items, statusFilter.value === 'completed')
})

const searchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []

  return store.value.items
    .filter(
      (item) =>
        item.title.toLowerCase().includes(q) || item.notes.toLowerCase().includes(q)
    )
    .slice(0, 20)
    .map((item) => ({
      item,
      planName: store.value.projects.find((p) => p.id === item.projectId)?.name ?? '未分类'
    }))
})

function applyPrefs() {
  const prefs = store.value.prefs
  if (!prefs) return

  isApplyingPrefs = true
  try {
    if (prefs.expandedKeys?.length) {
      const next = prefs.expandedKeys.filter((id) =>
        store.value.projects.some((p) => p.id === id)
      )
      if (!arraysEqual(expandedKeys.value, next)) {
        expandedKeys.value = next
      }
    }

    const menuKey = prefs.selectedMenuKey
    if (menuKey === CALENDAR_MENU_KEY) {
      if (selectedMenuKey.value !== CALENDAR_MENU_KEY) {
        selectedMenuKey.value = CALENDAR_MENU_KEY
      }
      return
    }
    if (menuKey) {
      const planId = menuKey.split(':')[0]
      if (store.value.projects.some((p) => p.id === planId)) {
        if (selectedMenuKey.value !== menuKey) {
          selectedMenuKey.value = menuKey
        }
        return
      }
    }
    ensureSelection()
  } finally {
    isApplyingPrefs = false
  }
}

function scheduleSavePrefs() {
  if (!loaded.value || isApplyingPrefs) return
  if (prefsTimer) clearTimeout(prefsTimer)
  prefsTimer = setTimeout(() => {
    void persistPrefs()
  }, 400)
}

async function persistPrefs() {
  const nextPrefs = {
    selectedMenuKey: selectedMenuKey.value,
    expandedKeys: [...expandedKeys.value]
  }
  const cur = store.value.prefs
  if (
    cur.selectedMenuKey === nextPrefs.selectedMenuKey &&
    arraysEqual(cur.expandedKeys ?? [], nextPrefs.expandedKeys)
  ) {
    return
  }

  ignoreNextStoreUpdate = true
  try {
    await savePrefs(nextPrefs)
  } finally {
    setTimeout(() => {
      ignoreNextStoreUpdate = false
    }, 50)
  }
}

function ensureSelection() {
  const nextExpanded = store.value.projects.map((p) => p.id)
  if (!arraysEqual(expandedKeys.value, nextExpanded)) {
    expandedKeys.value = nextExpanded
  }
  if (isCalendarMenuKey(selectedMenuKey.value)) return
  if (!store.value.projects.length) {
    if (selectedMenuKey.value !== null && !isCalendarMenuKey(selectedMenuKey.value)) {
      selectedMenuKey.value = null
    }
    return
  }
  const currentPlanId = selectedMenuKey.value?.split(':')[0]
  if (currentPlanId && store.value.projects.some((p) => p.id === currentPlanId)) return

  const defaultId = store.value.prefs.defaultPlanId
  const fallbackPlanId =
    defaultId && store.value.projects.some((p) => p.id === defaultId)
      ? defaultId
      : store.value.projects[0].id
  const nextKey = `${fallbackPlanId}:active`
  if (selectedMenuKey.value !== nextKey) {
    selectedMenuKey.value = nextKey
  }
}

function syncThemeFromPrefs() {
  initThemeFromPrefs(store.value.prefs)
}

watch(() => store.value.projects.length, () => {
  ensureSelection()
  ensureCalendarAddPlanId()
})
watch(selectedMenuKey, () => {
  selectedItemId.value = null
  scheduleSavePrefs()
})
watch(expandedKeys, scheduleSavePrefs, { deep: true })

function openNewItem(prefill?: string) {
  const planId = isCalendarView.value ? calendarAddPlanId.value : selectedPlanId.value
  if (!planId) {
    if (isCalendarView.value) message.info('请先选择一个计划')
    return
  }
  const defaultDue = isCalendarView.value
    ? calendarSelectedKey.value
    : toDateKey(new Date())
  editingItem.value = prefill
    ? ({
        id: '',
        title: prefill,
        notes: '',
        category: 'todo',
        priority: 'normal',
        dueDate: defaultDue,
        projectId: planId,
        pinned: false,
        completed: false,
        createdAt: 0,
        updatedAt: 0,
        completedAt: null,
        sortOrder: 0
      } as PlanItem)
    : null
  showItemForm.value = true
}

function openEditItem(id: string) {
  const item = store.value.items.find((i) => i.id === id)
  if (item) {
    editingItem.value = { ...item }
    showItemForm.value = true
  }
}

async function toggleItem(id: string, completed: boolean) {
  const item = store.value.items.find((i) => i.id === id)
  if (!item || item.completed === completed) return

  if (completed) {
    await updateItem(id, { completed: true })
    if (undoTimer) clearTimeout(undoTimer)
    undoState.value = { id, title: item.title }
    undoTimer = setTimeout(() => {
      undoState.value = null
    }, 3000)
    return
  }

  undoState.value = null
  if (undoTimer) clearTimeout(undoTimer)
  await updateItem(id, { completed: false })
}

async function performUndo() {
  if (!undoState.value) return
  const { id } = undoState.value
  undoState.value = null
  if (undoTimer) clearTimeout(undoTimer)
  await updateItem(id, { completed: false })
}

async function handleMoveItem(id: string, projectId: string) {
  await moveItemToPlan(id, projectId)
  message.success('已移动到其他计划')
}

function onItemMoved(projectId: string) {
  selectedMenuKey.value = `${projectId}:active`
  message.success('已移动到其他计划')
}

function onDragStart(id: string) {
  dragItemId.value = id
}

function onDragOver(targetId: string, e: DragEvent) {
  if (!dragItemId.value || dragItemId.value === targetId) return
  e.dataTransfer!.dropEffect = 'move'
}

async function onDrop(targetId: string) {
  if (!dragItemId.value || !selectedPlanId.value || statusFilter.value !== 'active') return
  const fromId = dragItemId.value
  dragItemId.value = null
  if (fromId === targetId) return

  const ids = filteredItems.value.map((i) => i.id)
  const from = ids.indexOf(fromId)
  const to = ids.indexOf(targetId)
  if (from < 0 || to < 0) return

  ids.splice(from, 1)
  ids.splice(to, 0, fromId)
  await reorderItems(selectedPlanId.value, ids)
}

async function handleQuickAdd(title: string) {
  const planId = isCalendarView.value ? calendarAddPlanId.value : selectedPlanId.value
  if (!planId) {
    if (isCalendarView.value) message.info('请先选择一个计划')
    return
  }
  await addItem({
    title,
    notes: '',
    category: 'todo',
    priority: 'normal',
    dueDate: isCalendarView.value ? calendarSelectedKey.value : null,
    projectId: planId,
    pinned: false,
    completed: false
  })
}

async function handleRemoveItem(id: string) {
  await removeItem(id)
  if (selectedItemId.value === id) selectedItemId.value = null
}

const calendarSelectableIds = computed(() => {
  const onDay = itemsDueOnDate(store.value.items, calendarSelectedKey.value)
  const active = sortPlanItems(
    onDay.filter((i) => !i.completed),
    false
  )
  const done = sortPlanItems(
    onDay.filter((i) => i.completed),
    true
  )
  return [...active, ...done].map((i) => i.id)
})

const formPlanId = computed(() =>
  isCalendarView.value ? calendarAddPlanId.value : selectedPlanId.value
)

function moveSelection(delta: number) {
  const items = isCalendarView.value
    ? calendarSelectableIds.value.map((id) => store.value.items.find((i) => i.id === id)!)
    : filteredItems.value
  if (!items.length) return

  const idx = items.findIndex((i) => i.id === selectedItemId.value)
  const next =
    idx < 0
      ? delta > 0
        ? 0
        : items.length - 1
      : Math.max(0, Math.min(items.length - 1, idx + delta))
  selectedItemId.value = items[next].id
}

function confirmDeleteItem(id: string) {
  const item = store.value.items.find((i) => i.id === id)
  if (!item) return

  dialog.warning({
    title: '删除事项',
    content: `确定删除「${item.title}」吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      await handleRemoveItem(id)
      message.success('已删除')
    }
  })
}

function openRenamePlan(planId: string) {
  const plan = store.value.projects.find((p) => p.id === planId)
  if (!plan) return
  renamePlanId.value = planId
  renamePlanName.value = plan.name
  renamePlanColor.value = plan.color
  showRenamePlanForm.value = true
}

async function handleRenamePlan() {
  const name = renamePlanName.value.trim()
  if (!name || !renamePlanId.value) return

  try {
    ignoreNextStoreUpdate = true
    await updateProject(renamePlanId.value, { name, color: renamePlanColor.value })
    showRenamePlanForm.value = false
    message.success('已保存')
  } catch (err) {
    console.error('重命名失败', err)
    message.error('重命名失败')
  } finally {
    ignoreNextStoreUpdate = false
  }
}

function confirmDeletePlanById(planId: string) {
  const plan = store.value.projects.find((p) => p.id === planId)
  if (!plan) return

  dialog.warning({
    title: '删除计划',
    content: `确定删除「${plan.name}」及其全部事项吗？此操作不可恢复。`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        ignoreNextStoreUpdate = true
        await removeProject(planId)
        ensureSelection()
        message.success(`已删除「${plan.name}」`)
      } catch (err) {
        console.error('删除计划失败', err)
        message.error('删除失败')
      } finally {
        ignoreNextStoreUpdate = false
      }
    }
  })
}

function handleClearCompleted(planId: string) {
  const plan = store.value.projects.find((p) => p.id === planId)
  if (!plan) return

  const count = store.value.items.filter((i) => i.projectId === planId && i.completed).length
  if (!count) return

  dialog.warning({
    title: '清空已完成',
    content: `确定清空「${plan.name}」中的 ${count} 条已完成事项吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        ignoreNextStoreUpdate = true
        const removed = await clearCompletedItems(planId)
        message.success(`已清空 ${removed} 条`)
      } catch (err) {
        console.error('清空失败', err)
        message.error('清空失败')
      } finally {
        ignoreNextStoreUpdate = false
      }
    }
  })
}

function onPlanContextSelect(key: string, planId: string) {
  if (key === 'rename') openRenamePlan(planId)
  else if (key === 'clear-completed') handleClearCompleted(planId)
  else if (key === 'delete') confirmDeletePlanById(planId)
}

function openSearch() {
  searchQuery.value = ''
  showSearch.value = true
  nextTick(() => searchInputRef.value?.focus())
}

function openSearchResult(item: PlanItem) {
  const dueKey = item.dueDate?.slice(0, 10)
  if (dueKey) {
    selectedMenuKey.value = CALENDAR_MENU_KEY
    calendarSelectedKey.value = dueKey
    selectedItemId.value = item.id
  } else if (item.projectId) {
    selectedMenuKey.value = `${item.projectId}:${item.completed ? 'completed' : 'active'}`
    selectedItemId.value = item.id
  }
  showSearch.value = false
  searchQuery.value = ''
}

function isModalOpen(): boolean {
  return (
    showSearch.value ||
    showItemForm.value ||
    showWidgetForm.value ||
    showSettings.value ||
    showPlanForm.value ||
    showRenamePlanForm.value
  )
}

function closeAllModals() {
  showSearch.value = false
  showItemForm.value = false
  showWidgetForm.value = false
  showSettings.value = false
  showPlanForm.value = false
  showRenamePlanForm.value = false
}

function focusQuickAdd() {
  if (isCalendarView.value) {
    ensureCalendarAddPlanId()
    if (!calendarAddPlanId.value) {
      message.info('请先创建一个计划')
      return
    }
    nextTick(() => calendarRef.value?.focusQuickInput())
    return
  }
  if (!selectedPlanId.value) {
    message.info('请先选择一个计划')
    return
  }
  if (statusFilter.value !== 'active') {
    selectedMenuKey.value = `${selectedPlanId.value}:active`
  }
  nextTick(() => taskListRef.value?.focusQuickInput())
}

const isMac = window.planDesk.platform === 'darwin'

const shortcuts = useKeyboardShortcuts(
  selectedItemId,
  {
    openSearch,
    focusQuickAdd,
    closeAllModals,
    moveSelection,
    toggleSelectedItem: () => {
      const item = store.value.items.find((i) => i.id === selectedItemId.value)
      if (item) void toggleItem(item.id, !item.completed)
    },
    deleteSelectedItem: () => {
      if (selectedItemId.value) confirmDeleteItem(selectedItemId.value)
    },
    isModalOpen
  },
  () => resolveShortcuts(store.value.prefs.shortcuts, isMac),
  isMac
)

async function handleCreatePlan() {
  const name = newPlanName.value.trim()
  if (!name || creatingPlan.value) return

  showPlanForm.value = false
  newPlanName.value = ''
  creatingPlan.value = true

  try {
    ignoreNextStoreUpdate = true
    const plan = await addProject(name, newPlanColor.value)
    selectedMenuKey.value = `${plan.id}:active`
    ensureSelection()
  } catch (err) {
    console.error('创建计划失败', err)
  } finally {
    creatingPlan.value = false
    ignoreNextStoreUpdate = false
  }
}

function closePlanForm() {
  showPlanForm.value = false
  newPlanName.value = ''
  newPlanColor.value = pickPlanColor(store.value.projects)
  creatingPlan.value = false
}

async function handleDeletePlan() {
  if (!selectedPlanId.value || !selectedPlan.value) return

  const deletedId = selectedPlanId.value
  const planName = selectedPlan.value.name

  try {
    ignoreNextStoreUpdate = true
    await removeProject(deletedId)
    ensureSelection()
    message.success(`已删除「${planName}」`)
  } catch (err) {
    console.error('删除计划失败', err)
    message.error('删除失败，请重试')
  } finally {
    ignoreNextStoreUpdate = false
  }
}

function openPlanForm() {
  newPlanName.value = ''
  newPlanColor.value = pickPlanColor(store.value.projects)
  showPlanForm.value = true
}

async function onSettingsImported() {
  await load()
  syncThemeFromPrefs()
  applyPrefs()
  ensureSelection()
  syncCalendarAddPlanFromPrefs()
}

let unsubStore: (() => void) | undefined
let unsubWidget: (() => void) | undefined
let unsubSettings: (() => void) | undefined
let unsubSelectPlan: (() => void) | undefined
let unsubMinimized: (() => void) | undefined

onMounted(async () => {
  await load()
  syncThemeFromPrefs()
  applyPrefs()
  syncCalendarAddPlanFromPrefs()
  if (!selectedMenuKey.value) ensureSelection()
  shortcuts.attach()
  unsubStore = window.planDesk.onStoreUpdated(() => {
    if (ignoreNextStoreUpdate) return
    void load().then(() => {
      const planId = selectedMenuKey.value?.split(':')[0]
      if (planId && !store.value.projects.some((p) => p.id === planId)) {
        ensureSelection()
      }
    })
  })
  unsubWidget = window.planDesk.onNewWidget?.(() => {
    showWidgetForm.value = true
  })
  unsubSettings = window.planDesk.onOpenSettings?.(() => {
    showSettings.value = true
  })
  unsubSelectPlan = window.planDesk.onSelectPlan?.((planId) => {
    selectedMenuKey.value = `${planId}:active`
    selectedItemId.value = null
  })
  window.planDesk.onWindowShown?.(() => {
    void document.body.offsetHeight
  })
  unsubMinimized = window.planDesk.onWindowMinimized?.(() => {
    if (!isWindows || minimizeHintShown) return
    minimizeHintShown = true
    message.info('已最小化到后台，右键托盘图标可完全退出', { duration: 4500 })
  })
})

onUnmounted(() => {
  shortcuts.detach()
  if (undoTimer) clearTimeout(undoTimer)
  if (prefsTimer) clearTimeout(prefsTimer)
  unsubStore?.()
  unsubWidget?.()
  unsubSettings?.()
  unsubSelectPlan?.()
  unsubMinimized?.()
})
</script>

<template>
  <NSpin v-if="!loaded" :show="true" class="page-spin">
    <div class="page-loading" />
  </NSpin>

  <NLayout v-else has-sider class="app-layout" position="absolute">
    <PlanSidebar
      :store="store"
      :selected-menu-key="selectedMenuKey"
      :expanded-keys="expandedKeys"
      @update:selected-menu-key="selectedMenuKey = $event"
      @update:expanded-keys="expandedKeys = $event"
      @open-plan-form="openPlanForm"
      @open-widget-form="showWidgetForm = true"
      @open-settings="showSettings = true"
      @plan-context-select="onPlanContextSelect"
    />

    <CalendarPanel
      v-if="isCalendarView"
      ref="calendarRef"
      v-model:selected-date-key="calendarSelectedKey"
      :quick-add-plan-id="calendarAddPlanId"
      :items="store.items"
      :projects="store.projects"
      @update:quick-add-plan-id="onCalendarAddPlanIdChange"
      :selected-item-id="selectedItemId"
      :undo-state="undoState"
      @open-search="openSearch"
      @quick-add="handleQuickAdd"
      @open-new-item="openNewItem"
      @toggle-item="toggleItem"
      @edit-item="openEditItem"
      @remove-item="handleRemoveItem"
      @move-item="handleMoveItem"
      @select-item="selectedItemId = $event"
      @update-title="(id, t) => updateItem(id, { title: t })"
      @undo="performUndo"
    />

    <TaskListPanel
      v-else
      ref="taskListRef"
      :selected-plan="selectedPlan"
      :status-filter="statusFilter"
      :filtered-items="filteredItems"
      :selected-item-id="selectedItemId"
      :drag-item-id="dragItemId"
      :undo-state="undoState"
      :projects="store.projects"
      @open-search="openSearch"
      @clear-completed="selectedPlanId && handleClearCompleted(selectedPlanId)"
      @delete-plan="handleDeletePlan"
      @quick-add="handleQuickAdd"
      @open-new-item="openNewItem"
      @toggle-item="toggleItem"
      @edit-item="openEditItem"
      @remove-item="handleRemoveItem"
      @move-item="handleMoveItem"
      @select-item="selectedItemId = $event"
      @update-title="(id, t) => updateItem(id, { title: t })"
      @drag-start="onDragStart"
      @drag-over="onDragOver"
      @drop="onDrop"
      @undo="performUndo"
    >
      <template #welcome>
        <div class="welcome-panel">
          <div class="welcome-panel__hero">
            <span class="welcome-panel__mark">
              <PlanDeskLogo :size="48" />
            </span>
            <h2 class="welcome-panel__title">开始你的第一个计划</h2>
            <p class="welcome-panel__desc">
              PlanDesk 是桌面计划本：在这里整理事项，也可以把计划放到桌面组件或桌宠里随时查看。
            </p>
          </div>
          <div class="welcome-panel__actions">
            <NButton type="primary" size="medium" @click="openPlanForm">
              新建计划
            </NButton>
            <NButton size="medium" quaternary @click="showWidgetForm = true">
              了解桌面组件
            </NButton>
          </div>
        </div>
      </template>
    </TaskListPanel>

    <ItemForm
      v-model:show="showItemForm"
      :item="editingItem"
      :projects="store.projects"
      :plan-id="formPlanId"
      :default-due-date="isCalendarView ? calendarSelectedKey : toDateKey(new Date())"
      @saved="showItemForm = false"
      @moved="onItemMoved"
    />

    <WidgetForm
      v-model:show="showWidgetForm"
      :projects="store.projects"
      :widgets="store.widgets"
      @created="showWidgetForm = false"
    />

    <SettingsModal
      v-model:show="showSettings"
      :projects="store.projects"
      @imported="onSettingsImported"
    />
  </NLayout>

  <NModal
    v-if="loaded"
    v-model:show="showPlanForm"
    display-directive="if"
    preset="card"
    title="新建计划"
    style="width: 360px"
    @after-leave="newPlanName = ''; newPlanColor = pickPlanColor(store.projects)"
  >
    <NSpace vertical :size="16">
      <NInput
        v-model:value="newPlanName"
        placeholder="计划名称，例如：考研复习"
        autofocus
        @keydown.enter.prevent="handleCreatePlan"
      />
      <PlanColorPicker
        :value="newPlanColor"
        :projects="store.projects"
        @update:value="newPlanColor = $event"
      />
    </NSpace>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="closePlanForm">取消</NButton>
        <NButton type="primary" :loading="creatingPlan" :disabled="!newPlanName.trim()" @click="handleCreatePlan">
          创建
        </NButton>
      </NSpace>
    </template>
  </NModal>

  <NModal
    v-if="loaded"
    v-model:show="showRenamePlanForm"
    display-directive="if"
    preset="card"
    title="编辑计划"
    style="width: 360px"
    @after-leave="renamePlanName = ''; renamePlanId = null; renamePlanColor = '#E8A838'"
  >
    <NSpace vertical :size="16">
      <NInput
        v-model:value="renamePlanName"
        placeholder="计划名称"
        autofocus
        @keydown.enter.prevent="handleRenamePlan"
      />
      <PlanColorPicker
        :value="renamePlanColor"
        :projects="store.projects"
        :exclude-plan-id="renamePlanId"
        @update:value="renamePlanColor = $event"
      />
    </NSpace>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="showRenamePlanForm = false">取消</NButton>
        <NButton type="primary" :disabled="!renamePlanName.trim()" @click="handleRenamePlan">
          保存
        </NButton>
      </NSpace>
    </template>
  </NModal>

  <NModal
    v-if="loaded"
    v-model:show="showSearch"
    display-directive="if"
    preset="card"
    title="搜索事项"
    style="width: 480px"
    @after-leave="searchQuery = ''"
  >
    <NInput
      ref="searchInputRef"
      v-model:value="searchQuery"
      placeholder="输入关键词搜索标题或备注…"
      clearable
      autofocus
    >
      <template #prefix>
        <AppIcon :icon="Search" :size="16" />
      </template>
    </NInput>

    <div class="search-results">
      <NEmpty
        v-if="searchQuery.trim() && !searchResults.length"
        description="没有匹配的事项"
        size="small"
        style="padding: 24px 0"
      />
      <NText v-else-if="!searchQuery.trim()" depth="3" class="search-hint">
        快捷键 ⌘K / Ctrl+K 随时打开搜索
      </NText>
      <button
        v-for="{ item, planName } in searchResults"
        :key="item.id"
        type="button"
        class="search-result-item"
        @click="openSearchResult(item)"
      >
        <span class="search-result-title">{{ item.title }}</span>
        <span class="search-result-meta">
          {{ planName }} · {{ item.completed ? '已完成' : '进行中' }}
        </span>
      </button>
    </div>
  </NModal>
</template>

<style scoped>
.page-spin,
.page-loading {
  height: 100vh;
}

.app-layout {
  inset: 0;
}

.search-results {
  margin-top: 12px;
  max-height: 320px;
  overflow: auto;
}

.search-hint {
  display: block;
  padding: 16px 4px;
  font-size: 13px;
}

.search-result-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s;
}

.search-result-item:hover {
  background: var(--pd-hover-bg);
}

.search-result-title {
  font-size: 14px;
  font-weight: 500;
}

.search-result-meta {
  font-size: 12px;
  opacity: 0.55;
}

.welcome-panel {
  max-width: 420px;
  padding-top: 80px;
}

.welcome-panel__hero {
  margin-bottom: 28px;
}

.welcome-panel__mark {
  display: inline-flex;
  margin-bottom: 20px;
}

.welcome-panel__title {
  margin: 0 0 10px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.6px;
}

.welcome-panel__desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--pd-muted-fg);
}

.welcome-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
