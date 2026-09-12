<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import AppIcon from '@/ui/AppIcon.vue'
import PetStageSlot from '@/components/widget/PetStageSlot.vue'
import WidgetContextMenu from '@/components/widget/WidgetContextMenu.vue'
import WidgetTaskList from '@/components/widget/WidgetTaskList.vue'
import { usePetStageInteraction } from '@/composables/usePetStageInteraction'
import { resolvePetState } from '@/lib/petAtlas'
import { maxHorizontalSpread } from '@/lib/petStageInteraction'
import { Close } from '@/ui/icons'
import PlanDeskLogo from '@/components/PlanDeskLogo.vue'
import { PET_COLLAPSED, PET_EXPANDED, PET_WIN_SAFE, petStageSize } from '@/lib/widgetLayout'
import { getStageMembers, isPetWidget } from '@/lib/widgetStage'
import { usePlanStore, filterItems, projectHasOverdue } from '@/lib/store'
import type { PetInteraction, PetState, WidgetConfig } from '@/lib/types'

const { store, loaded, load, updateItem, persist } = usePlanStore()

const widgetId = ref<string | null>(null)
const widgetConfig = ref<WidgetConfig | null>(null)
const petShellRef = ref<HTMLElement | null>(null)
const slotEls = ref<(HTMLElement | null)[]>([])
const petReadySent = ref(false)
const hovered = ref(false)
const shellMenuShow = ref(false)
const shellMenuX = ref(0)
const shellMenuY = ref(0)
const petMenuShow = ref(false)
const petMenuX = ref(0)
const petMenuY = ref(0)
const petMenuProjectId = ref<string | null>(null)
const expandedProjectId = ref<string | null>(null)
const petPointerDragging = ref(false)
const dragRunDirection = ref<'left' | 'right'>('right')
const jumpUntil = ref<Record<string, number>>({})
const localDragging = ref(false)
const isMac = window.planDesk.platform === 'darwin'
const isWindows = window.planDesk.platform === 'win32'

const displayMode = computed(() => widgetConfig.value?.displayMode ?? 'list')
const isPetMode = computed(() => isPetWidget(displayMode.value))
const stageMembers = computed(() => getStageMembers(widgetConfig.value))
const offsetSpread = computed(() => maxHorizontalSpread(stageMembers.value))

const petStates = computed(() => {
  const states: Record<string, PetState> = {}
  for (const member of stageMembers.value) {
    const active = filterItems(store.value.items, 'project', {
      projectId: member.projectId
    }).length
    const total = store.value.items.filter((item) => item.projectId === member.projectId).length
    states[member.projectId] = resolvePetState(active, total)
  }
  return states
})

const { lookTargets, interactions, leanOffsets, onMouseLeave: onShellMouseLeave } =
  usePetStageInteraction({
    members: stageMembers,
    slotEls,
    petStates,
    shellHovered: hovered,
    isDragging: petPointerDragging
  })

const displayItems = computed(() => {
  if (!widgetConfig.value?.projectId) return []
  return filterItems(store.value.items, 'project', {
    projectId: widgetConfig.value.projectId
  }).slice(0, 8)
})

const planName = computed(() => {
  if (!widgetConfig.value?.projectId) return widgetConfig.value?.title ?? '计划'
  return (
    store.value.projects.find((p) => p.id === widgetConfig.value?.projectId)?.name ??
    widgetConfig.value.title
  )
})

const activeCount = computed(() => displayItems.value.length)

const petShellStyle = computed(() => {
  if (!expandedProjectId.value) return undefined
  const size = petStageSize(stageMembers.value.length, true, offsetSpread.value)
  return {
    width: `${size.width}px`,
    maxWidth: `${size.width}px`
  }
})

let petResizeObserver: ResizeObserver | null = null
let sizeSyncTimer = 0
let transparencyTimer = 0
let unsubStore: (() => void) | undefined

function setSlotEl(index: number, el: HTMLElement | null) {
  slotEls.value[index] = el
}

function enablePetDocumentMode() {
  document.documentElement.classList.add('widget-pet-mode')
  document.documentElement.classList.toggle('widget-pet-expanded', Boolean(expandedProjectId.value))
}

async function syncPetWindowSize() {
  const el = petShellRef.value
  if (!el || !isPetMode.value) return

  let width: number
  let height: number

  if (expandedProjectId.value) {
    const size = petStageSize(stageMembers.value.length, true, offsetSpread.value)
    width = size.width
    height = Math.ceil(el.getBoundingClientRect().height)
    height = Math.min(height, PET_EXPANDED.height + 32)
    height = Math.max(PET_COLLAPSED.height, height)
  } else {
    const size = petStageSize(stageMembers.value.length, false, offsetSpread.value)
    width = size.width
    height = size.height
  }

  if (isWindows) {
    const measured = el.getBoundingClientRect()
    width = Math.ceil(Math.max(width, measured.width + 8))
    height = Math.ceil(Math.max(height, measured.height + 8))
    width = Math.max(width, PET_WIN_SAFE.width)
    height = Math.max(height, PET_WIN_SAFE.height)
  }

  try {
    await window.planDesk.setWidgetSize?.(width, height)
    await window.planDesk.refreshWidgetTransparency?.()
  } catch (error) {
    console.error('sync pet window size failed', error)
  } finally {
    if (!petReadySent.value) {
      petReadySent.value = true
      window.planDesk.showPetWidget?.()
      startTransparencyGuard()
    }
  }
}

function startTransparencyGuard() {
  window.clearInterval(transparencyTimer)
  let ticks = 0
  const maxTicks = isWindows ? 10 : 6
  const intervalMs = isWindows ? 500 : 2000
  void window.planDesk.refreshWidgetTransparency?.()
  transparencyTimer = window.setInterval(() => {
    void window.planDesk.refreshWidgetTransparency?.()
    ticks += 1
    if (ticks >= maxTicks) {
      window.clearInterval(transparencyTimer)
    }
  }, intervalMs)
}

function schedulePetWindowSync() {
  window.clearTimeout(sizeSyncTimer)
  sizeSyncTimer = window.setTimeout(() => {
    syncPetWindowSize()
  }, 32)
}

provide('restorePetWindowSize', schedulePetWindowSync)

function stopPetResizeObserver() {
  petResizeObserver?.disconnect()
  petResizeObserver = null
  window.clearTimeout(sizeSyncTimer)
}

function startPetResizeObserver() {
  stopPetResizeObserver()
  const el = petShellRef.value
  if (!el) return

  petResizeObserver = new ResizeObserver(() => {
    schedulePetWindowSync()
  })
  petResizeObserver.observe(el)
  schedulePetWindowSync()
}

function toggleExpanded(projectId: string) {
  expandedProjectId.value = expandedProjectId.value === projectId ? null : projectId
}

function triggerJump(projectId: string) {
  jumpUntil.value = { ...jumpUntil.value, [projectId]: Date.now() + JUMP_DURATION_MS }
}

function resolveMemberInteraction(projectId: string): PetInteraction {
  const now = Date.now()
  if (petPointerDragging.value) {
    return dragRunDirection.value === 'left' ? 'run-left' : 'run-right'
  }
  if ((jumpUntil.value[projectId] ?? 0) > now) return 'jump'

  const stageInteraction = interactions.value[projectId]
  if (stageInteraction === 'wave') return 'wave'

  const state = petStates.value[projectId] ?? 'idle'
  if (state === 'busy' && projectHasOverdue(store.value.items, projectId)) {
    return 'failed'
  }

  return null
}

const JUMP_DURATION_MS = 550

const PET_DRAG_THRESHOLD = 5
const LOCAL_OFFSET_MIN = -56
const LOCAL_OFFSET_MAX = 56

let petPointerActive = false
let petPointerProjectId: string | null = null
let petPointerStartX = 0
let petPointerStartY = 0

const localDragProjectId = ref<string | null>(null)

let localDragActive = false
let localDragStartX = 0
let localDragStartOffset = 0
let offsetDirty = false

function stopPetPointerTracking() {
  window.removeEventListener('pointermove', onPetPointerMove)
  window.removeEventListener('pointerup', onPetPointerUp)
  window.removeEventListener('pointercancel', onPetPointerUp)
}

function clampOffset(value: number) {
  return Math.max(LOCAL_OFFSET_MIN, Math.min(LOCAL_OFFSET_MAX, Math.round(value)))
}

function updateMemberOffset(projectId: string, offsetX: number) {
  const widget = store.value.widgets.find((w) => w.id === widgetId.value)
  if (!widget?.stageMembers) return
  const member = widget.stageMembers.find((m) => m.projectId === projectId)
  if (!member) return
  member.offsetX = clampOffset(offsetX)
  offsetDirty = true
  if (widgetConfig.value?.id === widget.id) {
    widgetConfig.value = { ...widget, stageMembers: [...widget.stageMembers] }
  }
  schedulePetWindowSync()
}

function onPetPointerMove(event: PointerEvent) {
  if (!petPointerActive) return

  if (localDragActive && localDragProjectId.value) {
    const dx = event.clientX - localDragStartX
    if (Math.abs(dx) > 2) localDragging.value = true
    updateMemberOffset(localDragProjectId.value, localDragStartOffset + dx)
    return
  }

  const dx = event.screenX - petPointerStartX
  const dy = event.screenY - petPointerStartY
  if (
    !petPointerDragging.value &&
    (Math.abs(dx) > PET_DRAG_THRESHOLD || Math.abs(dy) > PET_DRAG_THRESHOLD)
  ) {
    petPointerDragging.value = true
  }
  if (petPointerDragging.value) {
    dragRunDirection.value = dx >= 0 ? 'right' : 'left'
    window.planDesk.moveWidgetDrag?.(event.screenX, event.screenY)
  }
}

async function onPetPointerUp() {
  if (!petPointerActive) return

  if (localDragActive) {
    if (offsetDirty) await persist()
    offsetDirty = false
    localDragActive = false
    localDragProjectId.value = null
    localDragging.value = false
    petPointerActive = false
    stopPetPointerTracking()
    return
  }

  if (!petPointerDragging.value && petPointerProjectId) {
    triggerJump(petPointerProjectId)
    toggleExpanded(petPointerProjectId)
  }
  window.planDesk.endWidgetDrag?.()
  petPointerActive = false
  petPointerDragging.value = false
  petPointerProjectId = null
  stopPetPointerTracking()
}

function onPetPointerDown(event: PointerEvent, projectId: string) {
  if (event.button !== 0) return
  closeAllPetContextMenus()
  petPointerActive = true
  petPointerDragging.value = false
  petPointerProjectId = projectId
  petPointerStartX = event.screenX
  petPointerStartY = event.screenY

  if (event.shiftKey && stageMembers.value.length > 1) {
    localDragActive = true
    localDragProjectId.value = projectId
    localDragStartX = event.clientX
    const member = stageMembers.value.find((m) => m.projectId === projectId)
    localDragStartOffset = member?.offsetX ?? 0
    localDragging.value = false
  } else {
    window.planDesk.beginWidgetDrag?.(event.screenX, event.screenY)
  }

  window.addEventListener('pointermove', onPetPointerMove)
  window.addEventListener('pointerup', onPetPointerUp)
  window.addEventListener('pointercancel', onPetPointerUp)
}

async function toggleItem(id: string) {
  await updateItem(id, { completed: true })
}

async function closeWidget() {
  if (widgetId.value && window.planDesk.closeWidget) {
    await window.planDesk.closeWidget(widgetId.value)
  }
}

const shellMenuItems = computed(() => {
  if (stageMembers.value.length <= 1) {
    const name =
      store.value.projects.find((project) => project.id === stageMembers.value[0]?.projectId)
        ?.name ?? '计划'
    return [{ key: 'close', label: `关闭「${name}」`, danger: true }]
  }
  return [{ key: 'close-all', label: '关闭全部', danger: true }]
})

function closeAllPetContextMenus() {
  petMenuShow.value = false
  shellMenuShow.value = false
}

const petMenuItems = computed(() => {
  const projectId = petMenuProjectId.value
  if (!projectId) return []
  const name =
    store.value.projects.find((project) => project.id === projectId)?.name ?? '计划'
  return [{ key: 'close', label: `关闭「${name}」`, danger: true }]
})

function openPetContextMenu(projectId: string, event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  shellMenuShow.value = false
  petMenuProjectId.value = projectId
  petMenuX.value = event.clientX
  petMenuY.value = event.clientY
  petMenuShow.value = true
}

function onPetMenuSelect(key: string) {
  petMenuShow.value = false
  const projectId = petMenuProjectId.value
  if (key === 'close' && projectId) {
    void removeStageMember(projectId)
  }
}

function onShellContextMenu(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.closest('.pet-stage-slot')) return

  event.preventDefault()
  petMenuShow.value = false
  shellMenuX.value = event.clientX
  shellMenuY.value = event.clientY
  shellMenuShow.value = true
}

function onShellMenuSelect(key: string) {
  shellMenuShow.value = false
  if (key === 'close' && stageMembers.value.length === 1) {
    void removeStageMember(stageMembers.value[0].projectId)
    return
  }
  if (key === 'close-all') {
    void closeWidget()
  }
}

async function removeStageMember(projectId: string) {
  if (expandedProjectId.value === projectId) {
    expandedProjectId.value = null
  }

  if (window.planDesk.removeStageMember) {
    await window.planDesk.removeStageMember(projectId)
    return
  }

  const widget = store.value.widgets.find((w) => w.id === widgetId.value)
  if (!widget?.stageMembers) return

  const members = widget.stageMembers.filter((member) => member.projectId !== projectId)
  if (members.length === widget.stageMembers.length) return

  if (members.length === 0) {
    await closeWidget()
    return
  }

  widget.stageMembers = members
  widget.projectId = members[0]?.projectId
  widget.petdexSlug = members[0]?.petdexSlug
  widgetConfig.value = { ...widget, stageMembers: [...members] }
  await persist()
  schedulePetWindowSync()
}

onMounted(async () => {
  document.documentElement.classList.add(isMac ? 'widget-mac' : 'widget-desktop')
  widgetId.value = window.planDesk.widgetId ?? (await window.planDesk.getWidgetId?.()) ?? null
  await load()
  if (widgetId.value) {
    widgetConfig.value = store.value.widgets.find((w) => w.id === widgetId.value) ?? null
  }

  if (isPetMode.value) {
    enablePetDocumentMode()
    expandedProjectId.value = null
    await nextTick()
    startPetResizeObserver()
  } else if (isWindows && widgetConfig.value) {
    window.planDesk.showListWidget?.()
  }

  unsubStore = window.planDesk.onStoreUpdated(async () => {
    await load()
    if (widgetId.value) {
      widgetConfig.value = store.value.widgets.find((w) => w.id === widgetId.value) ?? null
    }
    if (
      expandedProjectId.value &&
      !stageMembers.value.some((member) => member.projectId === expandedProjectId.value)
    ) {
      expandedProjectId.value = null
    }
    await nextTick()
    schedulePetWindowSync()
  })
})

onUnmounted(() => {
  stopPetResizeObserver()
  stopPetPointerTracking()
  window.clearInterval(transparencyTimer)
  document.documentElement.classList.remove('widget-pet-mode', 'widget-pet-expanded')
  unsubStore?.()
})

watch(petShellRef, (el) => {
  if (el && isPetMode.value) {
    startPetResizeObserver()
  }
})

watch(expandedProjectId, async () => {
  if (!isPetMode.value) return
  enablePetDocumentMode()
  await nextTick()
  schedulePetWindowSync()
})

watch(stageMembers, async () => {
  if (!isPetMode.value) return
  await nextTick()
  schedulePetWindowSync()
})
</script>

<template>
  <div v-if="!loaded" class="widget-loading" />

  <div
    v-else-if="widgetConfig && isPetMode"
    ref="petShellRef"
    class="pet-shell"
    :class="{ 'pet-shell--expanded': expandedProjectId }"
    :style="petShellStyle"
    @mouseenter="hovered = true"
    @mouseleave="
      () => {
        hovered = false
        onShellMouseLeave()
      }
    "
    @contextmenu="onShellContextMenu"
  >
    <div
      class="pet-stage pet-stage--multi"
      :class="{ 'pet-stage--dragging': petPointerDragging }"
    >
      <div
        v-for="(member, index) in stageMembers"
        :key="member.projectId"
        :ref="(el) => setSlotEl(index, el as HTMLElement | null)"
        class="pet-slot-anchor"
      >
        <PetStageSlot
          :member="member"
          :expanded="expandedProjectId === member.projectId"
          :dragging="petPointerDragging"
          :local-dragging="localDragging && localDragProjectId === member.projectId"
          :look-at="lookTargets[member.projectId] ?? null"
          :interaction="resolveMemberInteraction(member.projectId)"
          :lean-offset="leanOffsets[member.projectId] ?? 0"
          :layout-offset="member.offsetX ?? 0"
          @toggle="toggleExpanded(member.projectId)"
          @contextmenu="openPetContextMenu(member.projectId, $event)"
          @pointerdown="onPetPointerDown($event, member.projectId)"
          @ready="schedulePetWindowSync"
        />
      </div>
    </div>

    <WidgetContextMenu
      :show="petMenuShow"
      :x="petMenuX"
      :y="petMenuY"
      :items="petMenuItems"
      @select="onPetMenuSelect"
      @close="petMenuShow = false"
    />

    <WidgetContextMenu
      :show="shellMenuShow"
      :x="shellMenuX"
      :y="shellMenuY"
      :items="shellMenuItems"
      @select="onShellMenuSelect"
      @close="shellMenuShow = false"
    />
  </div>

  <div
    v-else-if="widgetConfig"
    class="widget-root"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <div class="widget-card">
      <header class="widget-top drag-region" data-tauri-drag-region>
        <div class="widget-brand">
          <span class="widget-mark">
            <PlanDeskLogo :size="24" />
          </span>
          <div class="widget-title-wrap">
            <span class="widget-plan">{{ planName }}</span>
            <span class="widget-sub">进行中 {{ activeCount }} 条</span>
          </div>
        </div>
        <button
          type="button"
          class="widget-close no-drag"
          :class="{ visible: hovered }"
          title="关闭"
          @click="closeWidget"
        >
          <AppIcon :icon="Close" :size="13" />
        </button>
      </header>

      <WidgetTaskList :items="displayItems" @toggle="toggleItem" />
    </div>
  </div>

  <div v-else class="widget-error no-drag">
    <p>组件加载失败</p>
    <button type="button" @click="closeWidget">关闭</button>
  </div>
</template>

<style scoped>
.widget-loading {
  width: 0;
  height: 0;
  overflow: hidden;
  background: transparent;
}

.widget-root {
  height: 100vh;
  padding: 4px;
  background: transparent;
}

.widget-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  color: #eee;
  background: linear-gradient(165deg, #242018 0%, #161410 55%, #12100e 100%);
  border: 1px solid rgba(232, 168, 56, 0.18);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.42),
    0 0 0 1px rgba(255, 255, 255, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.pet-stage {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  width: fit-content;
  max-width: 100%;
  padding: 2px;
}

.pet-stage--multi {
  align-items: flex-start;
}

.pet-stage--dragging {
  transform: scale(1.05);
  filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.28));
  transition: transform 0.12s ease-out, filter 0.12s ease-out;
  cursor: grabbing;
}

.pet-shell--expanded .pet-stage--multi {
  align-items: flex-start;
}

.pet-slot-anchor {
  flex-shrink: 0;
}

.widget-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.widget-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.widget-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.widget-plan {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.widget-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}

.widget-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}

.widget-close.visible {
  opacity: 0.65;
}

.widget-close:hover {
  opacity: 1;
  background: rgba(232, 106, 90, 0.28);
  color: #fff;
}

.widget-mark {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.widget-error {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #161410;
  color: #eee;
  font-size: 13px;
}

.widget-error button {
  border: none;
  border-radius: 8px;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.1);
  color: inherit;
  cursor: pointer;
}
</style>
