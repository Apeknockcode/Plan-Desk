<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { NButton, NDropdown, NInput, NLayoutContent, useDialog } from 'naive-ui'
import TaskItem from '@/components/TaskItem.vue'
import AppIcon from '@/ui/AppIcon.vue'
import { Link, MoreOne, Notepad, Search } from '@/ui/icons'
import { linkBasename } from '@/lib/itemLinks'
import { normalizeNotionUrl, planHasExternalNotes } from '@/lib/planNotes'
import { usePlanStore } from '@/lib/store'
import type { PlanItem, Project } from '@/lib/types'

type StatusFilter = 'active' | 'completed'

const props = defineProps<{
  selectedPlan: Project | null
  statusFilter: StatusFilter | null
  filteredItems: PlanItem[]
  selectedItemId: string | null
  dragItemId: string | null
  undoState: { id: string; title: string } | null
  projects: Project[]
}>()

const emit = defineEmits<{
  openSearch: []
  openPlanNotes: []
  clearCompleted: []
  deletePlan: []
  quickAdd: [title: string]
  openNewItem: [prefill?: string]
  toggleItem: [id: string, completed: boolean]
  editItem: [id: string]
  removeItem: [id: string]
  moveItem: [id: string, projectId: string]
  selectItem: [id: string]
  updateTitle: [id: string, title: string]
  dragStart: [id: string]
  dragOver: [targetId: string, event: DragEvent]
  drop: [targetId: string]
  undo: []
}>()

const dialog = useDialog()
const { store } = usePlanStore()
const quickTitle = ref('')
const preferObsidian = () => store.value.prefs.openMarkdownInObsidian !== false
const quickInputRef = ref<{ focus: () => void } | null>(null)

const statusLabel = computed(() =>
  props.statusFilter === 'completed' ? '已完成' : '进行中'
)

const showPlanNotesBar = computed(
  () => props.selectedPlan && props.statusFilter === 'active' && planHasExternalNotes(props.selectedPlan)
)

const headerMenuOptions = computed(() => {
  const opts: { label: string; key: string; type?: string }[] = [
    { label: '笔记关联…', key: 'plan-notes' }
  ]
  if (props.statusFilter === 'completed' && props.filteredItems.length) {
    opts.push({ label: '清空已完成', key: 'clear-completed' })
  }
  opts.push({ type: 'divider', key: 'd1' })
  opts.push({ label: '删除计划', key: 'delete-plan' })
  return opts
})

async function openPlanNotion() {
  const url = normalizeNotionUrl(props.selectedPlan?.notionUrl)
  if (!url) return
  const ok = await window.planDesk.openUrl?.(url)
  if (!ok?.ok) dialog.warning({ title: '无法打开 Notion 链接', content: url })
}

async function openPlanObsidian() {
  const path = props.selectedPlan?.obsidianPath?.trim()
  if (!path) return
  const ok = await window.planDesk.openObsidianNote?.(path, preferObsidian())
  if (!ok?.ok) dialog.warning({ title: '无法打开', content: '路径可能已失效' })
}

async function submitQuickAdd() {
  const t = quickTitle.value.trim()
  if (!t) return
  emit('quickAdd', t)
  quickTitle.value = ''
  await nextTick()
  quickInputRef.value?.focus()
}

function onQuickKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void submitQuickAdd()
  }
  if (e.key === 'Enter' && e.shiftKey) {
    e.preventDefault()
    const t = quickTitle.value.trim()
    emit('openNewItem', t || undefined)
  }
}

function onHeaderMenuSelect(key: string) {
  if (key === 'plan-notes') {
    emit('openPlanNotes')
    return
  }
  if (key === 'clear-completed') {
    emit('clearCompleted')
    return
  }
  if (key === 'delete-plan' && props.selectedPlan) {
    dialog.warning({
      title: '删除计划',
      content: `确定删除「${props.selectedPlan.name}」及其全部事项吗？此操作不可恢复。`,
      positiveText: '删除',
      negativeText: '取消',
      onPositiveClick: () => {
        emit('deletePlan')
        return true
      }
    })
  }
}

function focusQuickInput() {
  quickInputRef.value?.focus()
}

defineExpose({ focusQuickInput })
</script>

<template>
  <NLayoutContent class="main-pane" :native-scrollbar="false">
    <div class="titlebar-safe titlebar-safe--main drag-region" data-tauri-drag-region />
    <div class="main-inner">
      <template v-if="selectedPlan && statusFilter">
        <div class="plan-page">
          <header class="main-header">
            <div class="page-heading no-drag">
              <div class="page-heading__text">
                <h1 class="page-title">{{ selectedPlan.name }}</h1>
                <p class="page-meta">
                  {{ statusLabel }}
                  <span class="page-meta__dot">·</span>
                  {{ filteredItems.length }} 条
                </p>
              </div>
            </div>
            <div class="main-header-actions no-drag">
              <NButton
                circle
                quaternary
                size="small"
                title="搜索 ⌘K"
                @click="emit('openSearch')"
              >
                <template #icon><AppIcon :icon="Search" :size="18" /></template>
              </NButton>
              <NDropdown
                trigger="click"
                placement="bottom-end"
                :options="headerMenuOptions"
                @select="onHeaderMenuSelect"
              >
                <NButton circle quaternary size="small" title="更多">
                  <template #icon><AppIcon :icon="MoreOne" :size="18" /></template>
                </NButton>
              </NDropdown>
            </div>
          </header>

          <div v-if="showPlanNotesBar" class="plan-notes-bar no-drag">
            <NButton
              v-if="normalizeNotionUrl(selectedPlan?.notionUrl)"
              size="tiny"
              secondary
              @click="openPlanNotion"
            >
              <template #icon><AppIcon :icon="Link" :size="14" /></template>
              Notion
            </NButton>
            <NButton
              v-if="selectedPlan?.obsidianPath?.trim()"
              size="tiny"
              secondary
              @click="openPlanObsidian"
            >
              <template #icon><AppIcon :icon="Notepad" :size="14" /></template>
              {{ linkBasename(selectedPlan.obsidianPath) }}
            </NButton>
            <NButton size="tiny" quaternary @click="emit('openPlanNotes')">管理…</NButton>
          </div>

          <div
            v-if="statusFilter === 'active'"
            class="quick-add no-drag"
            @click="focusQuickInput"
          >
            <span class="quick-add__mark">+</span>
            <NInput
              ref="quickInputRef"
              v-model:value="quickTitle"
              class="quick-add__input"
              placeholder="添加事项，回车确认 · Shift+回车 打开详情"
              size="large"
              :bordered="false"
              @keydown="onQuickKeydown"
              @click.stop
            />
            <NButton
              v-show="quickTitle.trim()"
              type="primary"
              size="small"
              class="quick-add__btn"
              @click.stop="submitQuickAdd"
            >
              添加
            </NButton>
          </div>

          <div class="task-list no-drag">
            <div v-if="!filteredItems.length" class="task-empty">
              <p class="task-empty__title">
                {{ statusFilter === 'completed' ? '还没有已完成的事项' : '这里还空着' }}
              </p>
              <p v-if="statusFilter === 'active'" class="task-empty__hint">
                在上方输入一行，回车就能添加
              </p>
            </div>
            <TaskItem
              v-for="item in filteredItems"
              :key="item.id"
              :item="item"
              :projects="projects"
              :selected="selectedItemId === item.id"
              :draggable="statusFilter === 'active'"
              :dragging="dragItemId === item.id"
              :show-completed-time="statusFilter === 'completed'"
              @toggle="(id, v) => emit('toggleItem', id, v)"
              @edit="emit('editItem', $event)"
              @remove="emit('removeItem', $event)"
              @move="(id, pid) => emit('moveItem', id, pid)"
              @select="emit('selectItem', $event)"
              @update-title="(id, t) => emit('updateTitle', id, t)"
              @dragstart="emit('dragStart', $event)"
              @dragover="(id, e) => emit('dragOver', id, e)"
              @drop="emit('drop', $event)"
            />
          </div>
        </div>
      </template>

      <div v-else class="welcome no-drag">
        <slot name="welcome" />
      </div>
    </div>
  </NLayoutContent>

  <div v-if="undoState" class="undo-bar no-drag">
    <span>已完成「{{ undoState.title }}」</span>
    <NButton size="tiny" type="primary" @click="emit('undo')">撤销</NButton>
  </div>
</template>

<style scoped>
.main-pane {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  width: 100%;
  background: var(--pd-main-bg);
}

.main-inner {
  width: 100%;
  max-width: none;
  box-sizing: border-box;
  padding: 0 36px 40px 32px;
  min-height: 100%;
}

.welcome {
  padding-top: 48px;
}

.plan-notes-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--pd-hover-bg, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--pd-panel-border, rgba(255, 255, 255, 0.06));
}

.main-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 28px 0 24px;
}

html.platform-mac .main-header {
  padding-top: 16px;
}

.page-heading {
  min-width: 0;
}

.page-heading__text {
  min-width: 0;
}

.page-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.7px;
  line-height: 1.15;
  color: var(--pd-body-fg);
}

.page-meta {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--pd-muted-fg);
}

.page-meta__dot {
  margin: 0 4px;
  opacity: 0.5;
}

.main-header-actions {
  flex-shrink: 0;
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 4px;
}

.quick-add {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0 18px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--pd-divider);
  cursor: text;
}

.quick-add__mark {
  flex-shrink: 0;
  width: 22px;
  font-size: 22px;
  font-weight: 300;
  line-height: 1;
  color: var(--pd-muted-fg);
  user-select: none;
}

.quick-add__input {
  flex: 1;
  min-width: 0;
}

.quick-add__input :deep(.n-input__input-el) {
  font-size: 15px;
  color: var(--pd-body-fg);
}

.quick-add__input :deep(.n-input__placeholder) {
  color: var(--pd-muted-fg);
}

.quick-add__btn {
  flex-shrink: 0;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 8px;
}

.task-empty {
  padding: 48px 0 56px;
  text-align: center;
}

.task-empty__title {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--pd-muted-fg);
}

.task-empty__hint {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--pd-muted-fg);
  opacity: 0.75;
}

.undo-bar {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 10px;
  background: var(--pd-undo-bg);
  border: 1px solid var(--pd-accent-border);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  font-size: 13px;
}
</style>
