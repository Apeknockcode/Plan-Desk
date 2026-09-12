<script setup lang="ts">
import { computed } from 'vue'
import SpritePet from '@/components/widget/SpritePet.vue'
import WidgetTaskList from '@/components/widget/WidgetTaskList.vue'
import { resolvePetState } from '@/lib/petAtlas'
import { filterItems, usePlanStore } from '@/lib/store'
import type { PetInteraction, PetStageMember, PetState } from '@/lib/types'

const props = defineProps<{
  member: PetStageMember
  expanded: boolean
  lookAt?: { x: number; y: number } | null
  interaction?: PetInteraction
  leanOffset?: number
  layoutOffset?: number
  dragging?: boolean
  localDragging?: boolean
}>()

const emit = defineEmits<{
  toggle: []
  contextmenu: [event: MouseEvent]
  pointerdown: [event: PointerEvent]
  ready: []
}>()

const { store, updateItem } = usePlanStore()

const displayItems = computed(() =>
  filterItems(store.value.items, 'project', {
    projectId: props.member.projectId
  }).slice(0, 8)
)

const planItemCount = computed(
  () => store.value.items.filter((item) => item.projectId === props.member.projectId).length
)

const planName = computed(
  () =>
    store.value.projects.find((project) => project.id === props.member.projectId)?.name ??
    '计划'
)

const activeCount = computed(() => displayItems.value.length)

const petState = computed<PetState>(() =>
  resolvePetState(activeCount.value, planItemCount.value)
)

async function toggleItem(id: string) {
  await updateItem(id, { completed: true })
}

function onContextMenu(event: MouseEvent) {
  emit('contextmenu', event)
}
</script>

<template>
  <div
    class="pet-stage-slot"
    :class="{
      'pet-stage-slot--expanded': expanded,
      'pet-stage-slot--dragging': dragging || localDragging
    }"
    :style="{
      transform: `translateX(${(layoutOffset ?? 0) + (leanOffset ?? 0)}px)`
    }"
  >
    <div class="pet-slot-wrap">
      <div
        class="pet-body no-drag"
        :class="{
          'pet-body--dragging': dragging,
          'pet-body--local-dragging': localDragging
        }"
        :title="`${planName} · 拖拽移动 · Shift+拖拽调整位置 · 点击展开待办 · 右键关闭`"
        @contextmenu="onContextMenu"
        @pointerdown="emit('pointerdown', $event)"
      >
        <SpritePet
          :state="petState"
          :petdex-slug="member.petdexSlug"
          :look-at="lookAt"
          :interaction="interaction"
          :track-mouse="false"
          @ready="emit('ready')"
        />
      </div>
    </div>

    <div
      v-if="expanded"
      class="pet-dialog pet-dialog--expanded"
      :class="`pet-dialog--${petState}`"
      @contextmenu="onContextMenu"
    >
      <div class="pet-dialog-card">
        <button type="button" class="pet-dialog-head" title="点击收起" @click="emit('toggle')">
          <div class="pet-dialog-title-wrap">
            <span class="pet-dialog-text">{{ planName }}</span>
            <span class="pet-dialog-badge">{{ activeCount }} 条</span>
          </div>
          <span class="pet-dialog-chevron" aria-hidden="true">▾</span>
        </button>

        <WidgetTaskList variant="dialog" :items="displayItems" @toggle="toggleItem" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pet-stage-slot {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.pet-stage-slot--dragging {
  transition: none;
}

.pet-stage-slot--expanded {
  align-items: flex-start;
}

.pet-slot-wrap {
  position: relative;
  flex-shrink: 0;
}

.pet-body {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: grab;
  touch-action: none;
}

.pet-body--dragging,
.pet-body--local-dragging {
  cursor: grabbing;
}


.pet-dialog {
  position: relative;
  flex-shrink: 0;
  width: 240px;
  max-width: 240px;
  animation: pet-dialog-in 0.16s ease-out;
}

@keyframes pet-dialog-in {
  from {
    opacity: 0;
    transform: translateX(-6px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.pet-dialog--expanded {
  margin-top: 8px;
}

.pet-dialog::before {
  content: '';
  position: absolute;
  left: -5px;
  top: 18px;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  border-right: 6px solid rgba(36, 32, 24, 0.96);
  z-index: 1;
}

.pet-dialog-card {
  position: relative;
  z-index: 2;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(232, 168, 56, 0.22);
  background: linear-gradient(165deg, rgba(36, 32, 24, 0.96) 0%, rgba(18, 16, 14, 0.98) 100%);
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.35);
}

.pet-dialog--busy .pet-dialog-card {
  border-color: rgba(244, 193, 74, 0.28);
}

.pet-dialog--done .pet-dialog-card {
  border-color: rgba(168, 224, 106, 0.24);
}

.pet-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 10px 12px;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.pet-dialog-title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.pet-dialog-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.94);
}

.pet-dialog-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(232, 168, 56, 0.16);
  color: #f4c14a;
  font-size: 10px;
  font-weight: 600;
}

.pet-dialog-chevron {
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
}

.pet-dialog--expanded :deep(.widget-list-wrap) {
  width: 100%;
  max-height: 180px;
  margin: 0;
  padding: 4px 6px 8px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: auto;
}

html.widget-desktop .pet-dialog--expanded :deep(.widget-list-wrap) {
  scrollbar-width: thin;
}

html.widget-desktop .pet-dialog--expanded :deep(.widget-list-wrap::-webkit-scrollbar) {
  width: 6px;
}

html.widget-desktop .pet-dialog--expanded :deep(.widget-list-wrap::-webkit-scrollbar-thumb) {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
}
</style>
