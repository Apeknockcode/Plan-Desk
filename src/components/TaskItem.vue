<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { NButton, NCheckbox, NDropdown, NInput, NPopconfirm, NSpace, NTag, NText, NTooltip } from 'naive-ui'
import AppIcon from '@/ui/AppIcon.vue'
import ItemLinkTags from '@/components/ItemLinkTags.vue'
import { Delete, Drag, Edit } from '@/ui/icons'
import type { PlanItem, Project } from '@/lib/types'
import { formatCompletedAt } from '@/lib/store'

const props = defineProps<{
  item: PlanItem
  projects?: Project[]
  selected?: boolean
  draggable?: boolean
  dragging?: boolean
  showCompletedTime?: boolean
}>()

const emit = defineEmits<{
  toggle: [id: string, completed: boolean]
  edit: [id: string]
  remove: [id: string]
  move: [id: string, projectId: string]
  select: [id: string]
  'update-title': [id: string, title: string]
  dragstart: [id: string]
  dragover: [id: string, event: DragEvent]
  drop: [id: string]
}>()

const editing = ref(false)
const editTitle = ref('')
const titleInputRef = ref<{ focus: () => void } | null>(null)
const moveMenuShow = ref(false)
const moveMenuX = ref(0)
const moveMenuY = ref(0)

const moveOptions = computed(() => {
  if (!props.projects?.length) return []
  return props.projects
    .filter((p) => p.id !== props.item.projectId)
    .map((p) => ({ label: `移动到「${p.name}」`, key: p.id }))
})

function handleRemove(id: string): boolean {
  emit('remove', id)
  return true
}

function startEdit() {
  editing.value = true
  editTitle.value = props.item.title
  nextTick(() => titleInputRef.value?.focus())
}

async function commitEdit() {
  const title = editTitle.value.trim()
  if (title && title !== props.item.title) {
    emit('update-title', props.item.id, title)
  }
  editing.value = false
}

function cancelEdit() {
  editing.value = false
  editTitle.value = props.item.title
}

function onTitleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commitEdit()
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    cancelEdit()
  }
}

function onContextMenu(e: MouseEvent) {
  if (!moveOptions.value.length) return
  e.preventDefault()
  moveMenuX.value = e.clientX
  moveMenuY.value = e.clientY
  moveMenuShow.value = true
}

function onMoveSelect(key: string) {
  moveMenuShow.value = false
  emit('move', props.item.id, key)
}
</script>

<template>
  <div
    class="task-item"
    :class="{ completed: item.completed, selected, dragging }"
    @click="emit('select', item.id)"
    @contextmenu="onContextMenu"
    @dragover.prevent="emit('dragover', item.id, $event)"
    @drop.prevent="emit('drop', item.id)"
  >
    <button
      v-if="draggable"
      type="button"
      class="drag-handle"
      draggable="true"
      title="拖拽排序"
      @click.stop
      @dragstart.stop="emit('dragstart', item.id)"
    >
      <AppIcon :icon="Drag" :size="14" />
    </button>

    <div class="task-content">
      <div class="task-title-line">
        <NCheckbox
          class="task-check"
          :checked="item.completed"
          @click.stop
          @update:checked="(v) => emit('toggle', item.id, v)"
        />
        <div class="task-title-wrap">
          <NInput
            v-if="editing"
            ref="titleInputRef"
            v-model:value="editTitle"
            size="small"
            class="title-input"
            @click.stop
            @keydown="onTitleKeydown"
            @blur="commitEdit"
          />
          <NText
            v-else
            class="task-title"
            :delete="item.completed"
            @click.stop="startEdit"
            @dblclick.stop="emit('edit', item.id)"
          >
            {{ item.title }}
          </NText>
          <NTag v-if="item.pinned" size="tiny" :bordered="false" type="warning">置顶</NTag>
        </div>
      </div>

      <NText v-if="item.notes" depth="3" class="task-notes">
        {{ item.notes }}
      </NText>

      <ItemLinkTags :links="item.links ?? []" />

      <NText v-if="showCompletedTime && item.completedAt" depth="3" class="task-completed-at">
        完成于 {{ formatCompletedAt(item.completedAt) }}
      </NText>
    </div>

    <NSpace :size="2" class="actions" @click.stop>
      <NTooltip trigger="hover">
        <template #trigger>
          <NButton quaternary circle size="tiny" @click="emit('edit', item.id)">
            <template #icon><AppIcon :icon="Edit" :size="14" /></template>
          </NButton>
        </template>
        编辑备注
      </NTooltip>
      <NTooltip trigger="hover">
        <template #trigger>
          <NPopconfirm
            positive-text="确定"
            negative-text="取消"
            :positive-button-props="{ type: 'error' }"
            @positive-click="handleRemove(item.id)"
          >
            <template #trigger>
              <NButton quaternary circle size="tiny" type="error">
                <template #icon><AppIcon :icon="Delete" :size="14" /></template>
              </NButton>
            </template>
            确定删除「{{ item.title }}」吗？
          </NPopconfirm>
        </template>
        删除
      </NTooltip>
    </NSpace>
  </div>

  <NDropdown
    trigger="manual"
    placement="bottom-start"
    :show="moveMenuShow"
    :x="moveMenuX"
    :y="moveMenuY"
    :options="moveOptions"
    @clickoutside="moveMenuShow = false"
    @select="onMoveSelect"
  />
</template>

<style scoped>
.task-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 11px 10px;
  transition: background 0.12s, box-shadow 0.12s;
  border-radius: 10px;
  cursor: default;
}

.task-item:hover {
  background: var(--pd-task-hover);
}

.task-item.selected {
  background: var(--pd-task-hover);
  box-shadow: inset 2px 0 0 var(--pd-divider);
}

.task-item.dragging {
  opacity: 0.45;
}

.task-item.completed {
  opacity: 0.58;
}

.drag-handle {
  flex-shrink: 0;
  margin-top: 5px;
  padding: 2px;
  border: none;
  background: transparent;
  color: var(--pd-muted-fg);
  cursor: grab;
  border-radius: 4px;
  display: flex;
  align-items: center;
  opacity: 0;
  transition: opacity 0.12s, color 0.12s, background 0.12s;
}

.task-item:hover .drag-handle,
.task-item.selected .drag-handle {
  opacity: 1;
}

.drag-handle:hover {
  color: var(--pd-body-fg);
  background: var(--pd-hover-bg);
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-title-line {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 24px;
}

.task-check {
  flex-shrink: 0;
}

.task-title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.title-input {
  flex: 1;
}

.task-title {
  font-size: 15px;
  line-height: 1.5;
  cursor: text;
}

.task-notes {
  display: block;
  font-size: 12px;
  line-height: 1.5;
  margin-top: 6px;
  padding-left: 28px;
}

.task-completed-at {
  display: block;
  font-size: 11px;
  margin-top: 4px;
  padding-left: 28px;
}

.actions {
  opacity: 0;
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 1px;
  transition: opacity 0.12s;
}

.task-item:hover .actions,
.task-item.selected .actions {
  opacity: 1;
}
</style>
