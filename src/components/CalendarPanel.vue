<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { NButton, NCalendar, NInput, NLayoutContent, NSelect } from 'naive-ui'
import TaskItem from '@/components/TaskItem.vue'
import AppIcon from '@/ui/AppIcon.vue'
import { Search } from '@/ui/icons'
import {
  countActiveItemsByDueDate,
  dateKeyFromParts,
  formatDateKeyLabel,
  itemsDueOnDate,
  parseDateKey,
  toDateKey
} from '@/lib/calendarDate'
import { formatDaySolarLunarLine, getCalendarCellMeta } from '@/lib/chineseCalendar'
import CalendarDayCell from '@/components/CalendarDayCell.vue'
import { sortPlanItems } from '@/lib/store'
import type { PlanItem, Project } from '@/lib/types'

const props = defineProps<{
  items: PlanItem[]
  projects: Project[]
  selectedDateKey: string
  selectedItemId: string | null
  undoState: { id: string; title: string } | null
  quickAddPlanId: string | null
}>()

const emit = defineEmits<{
  'update:selectedDateKey': [value: string]
  'update:quickAddPlanId': [value: string | null]
  openSearch: []
  quickAdd: [title: string]
  openNewItem: [prefill?: string]
  toggleItem: [id: string, completed: boolean]
  editItem: [id: string]
  removeItem: [id: string]
  moveItem: [id: string, projectId: string]
  selectItem: [id: string]
  updateTitle: [id: string, title: string]
  undo: []
}>()

const quickTitle = ref('')
const quickInputRef = ref<{ focus: () => void } | null>(null)

const calendarTs = ref(parseDateKey(props.selectedDateKey).getTime())

watch(
  () => props.selectedDateKey,
  (key) => {
    const next = parseDateKey(key).getTime()
    if (calendarTs.value !== next) calendarTs.value = next
  }
)

watch(calendarTs, (ts) => {
  const key = toDateKey(new Date(ts))
  if (key !== props.selectedDateKey) emit('update:selectedDateKey', key)
})

const activeCountByDate = computed(() => countActiveItemsByDueDate(props.items))

const dayItems = computed(() => {
  const onDay = itemsDueOnDate(props.items, props.selectedDateKey)
  const active = sortPlanItems(
    onDay.filter((i) => !i.completed),
    false
  )
  const done = sortPlanItems(
    onDay.filter((i) => i.completed),
    true
  )
  return { active, done }
})

const dayLabel = computed(() => formatDateKeyLabel(props.selectedDateKey))

function cellCount(year: number, month: number, date: number): number {
  return activeCountByDate.value.get(dateKeyFromParts(year, month, date)) ?? 0
}

const daySolarLunarLine = computed(() => formatDaySolarLunarLine(props.selectedDateKey))

const weekHeadLabels = ['一', '二', '三', '四', '五', '六', '日']

const selectedDayMeta = computed(() => {
  const [y, m, d] = props.selectedDateKey.split('-').map(Number)
  return getCalendarCellMeta(y, m, d)
})

const monthTaskCount = computed(() => {
  const d = new Date(calendarTs.value)
  const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  let n = 0
  for (const [key, count] of activeCountByDate.value) {
    if (key.startsWith(prefix)) n += count
  }
  return n
})

const planOptions = computed(() =>
  props.projects.map((p: Project) => ({ label: p.name, value: p.id }))
)

const quickAddPlanName = computed(() => {
  const id = props.quickAddPlanId
  if (!id) return ''
  return props.projects.find((p) => p.id === id)?.name ?? ''
})

function onQuickAddPlanChange(value: string | null) {
  emit('update:quickAddPlanId', value)
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

function focusQuickInput() {
  quickInputRef.value?.focus()
}

defineExpose({ focusQuickInput })
</script>

<template>
  <NLayoutContent class="main-pane" :native-scrollbar="false">
    <div class="titlebar-safe titlebar-safe--main drag-region" data-tauri-drag-region />
    <div class="main-inner main-inner--calendar">
      <div class="calendar-page">
        <header class="main-header">
          <div class="page-heading no-drag">
            <div class="page-heading__text">
              <h1 class="page-title">日历</h1>
              <p class="page-meta">
                按「计划日期」浏览待办
                <template v-if="monthTaskCount"> · 本月 {{ monthTaskCount }} 项未完结</template>
              </p>
            </div>
          </div>
          <div class="main-header-actions no-drag">
            <NButton circle quaternary size="small" title="搜索 ⌘K" @click="emit('openSearch')">
              <template #icon><AppIcon :icon="Search" :size="18" /></template>
            </NButton>
          </div>
        </header>

        <div class="calendar-layout no-drag">
          <section class="calendar-card">
            <div class="cal-weekhead" aria-hidden="true">
              <span
                v-for="(label, idx) in weekHeadLabels"
                :key="label"
                class="cal-weekhead__cell"
                :class="{ 'cal-weekhead__cell--weekend': idx >= 5 }"
              >
                {{ label }}
              </span>
            </div>
            <div class="cal-legend" aria-hidden="true">
              <span class="cal-legend__item">
                <span class="cal-legend__dot cal-legend__dot--today" />今天
              </span>
              <span class="cal-legend__item">
                <span class="cal-legend__dot cal-legend__dot--selected" />选中
              </span>
              <span class="cal-legend__item">
                <span class="cal-legend__badge">1</span>有待办
              </span>
            </div>
            <NCalendar v-model:value="calendarTs" class="plan-calendar">
              <template #default="{ year, month, date }">
                <CalendarDayCell
                  :year="year"
                  :month="month"
                  :date="date"
                  :task-count="cellCount(year, month, date)"
                />
              </template>
            </NCalendar>
          </section>

          <section class="calendar-day-panel">
            <div class="calendar-day__head">
              <div class="calendar-day__title-row">
                <h2 class="calendar-day__title">{{ dayLabel }}</h2>
                <span
                  v-if="selectedDayMeta.festivalLabel"
                  class="day-tag"
                  :class="{
                    'day-tag--legal': selectedDayMeta.isPublicHoliday,
                    'day-tag--work': selectedDayMeta.isAdjustedWorkday
                  }"
                  :title="selectedDayMeta.festivalHint ?? undefined"
                >
                  {{ selectedDayMeta.festivalLabel }}
                </span>
              </div>
              <p class="calendar-day__solar-lunar">{{ daySolarLunarLine }}</p>
              <div class="calendar-day__stats">
                <span class="stat-pill stat-pill--active">{{ dayItems.active.length }} 进行中</span>
                <span v-if="dayItems.done.length" class="stat-pill stat-pill--done">
                  {{ dayItems.done.length }} 已完成
                </span>
              </div>
            </div>

            <div v-if="projects.length" class="calendar-add-block">
              <div
                v-if="projects.length > 1"
                class="calendar-add-plan"
                @click.stop
              >
                <span class="calendar-add-plan__label">添加到计划</span>
                <NSelect
                  :value="quickAddPlanId"
                  :options="planOptions"
                  size="small"
                  class="calendar-add-plan__select"
                  placeholder="选择计划"
                  @update:value="onQuickAddPlanChange"
                />
              </div>
              <p v-else-if="quickAddPlanName" class="calendar-add-plan__single">
                添加到「{{ quickAddPlanName }}」
              </p>
              <div class="quick-add quick-add--card" @click="focusQuickInput">
                <span class="quick-add__mark">+</span>
                <NInput
                  ref="quickInputRef"
                  v-model:value="quickTitle"
                  class="quick-add__input"
                  placeholder="添加到这一天，回车确认 · Shift+回车 打开详情"
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
            </div>
            <p v-else class="calendar-day__hint">请先创建一个计划，才能添加带日期的事项。</p>

            <div class="task-list">
              <div
                v-if="!dayItems.active.length && !dayItems.done.length"
                class="task-empty task-empty--card"
              >
                <p class="task-empty__title">这一天还没有安排</p>
                <p class="task-empty__hint">在上方输入一行即可添加，或在编辑事项里设置计划日期</p>
              </div>

              <TaskItem
                v-for="item in dayItems.active"
                :key="item.id"
                :item="item"
                :projects="projects"
                :selected="selectedItemId === item.id"
                @toggle="(id, v) => emit('toggleItem', id, v)"
                @edit="emit('editItem', $event)"
                @remove="emit('removeItem', $event)"
                @move="(id, pid) => emit('moveItem', id, pid)"
                @select="emit('selectItem', $event)"
                @update-title="(id, t) => emit('updateTitle', id, t)"
              />

              <template v-if="dayItems.done.length">
                <p class="calendar-day__done-label">已完成</p>
                <TaskItem
                  v-for="item in dayItems.done"
                  :key="item.id"
                  :item="item"
                  :projects="projects"
                  :selected="selectedItemId === item.id"
                  show-completed-time
                  @toggle="(id, v) => emit('toggleItem', id, v)"
                  @edit="emit('editItem', $event)"
                  @remove="emit('removeItem', $event)"
                  @move="(id, pid) => emit('moveItem', id, pid)"
                  @select="emit('selectItem', $event)"
                  @update-title="(id, t) => emit('updateTitle', id, t)"
                />
              </template>
            </div>
          </section>
        </div>
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
  flex-direction: column;
  background: var(--pd-main-bg);
}

.main-inner {
  padding: 0 36px 40px 32px;
  min-height: 100%;
}

.main-inner--calendar {
  width: 100%;
  max-width: none;
  box-sizing: border-box;
  padding-left: 28px;
  padding-right: 28px;
}

.main-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 28px 0 20px;
}

html.platform-mac .main-header {
  padding-top: 16px;
}

.page-heading {
  min-width: 0;
}

.page-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.7px;
  line-height: 1.15;
}

.page-meta {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--pd-muted-fg);
}

.main-header-actions {
  flex-shrink: 0;
  margin-top: 4px;
}

.calendar-layout {
  display: grid;
  grid-template-columns: minmax(400px, 1.65fr) minmax(280px, 1fr);
  gap: 24px;
  align-items: start;
  width: 100%;
}

@media (max-width: 760px) {
  .calendar-layout {
    grid-template-columns: 1fr;
  }
}

.calendar-card,
.calendar-day-panel {
  width: 100%;
  min-width: 0;
  padding: 14px 14px 16px;
  border-radius: 16px;
  border: 1px solid var(--pd-panel-border, var(--pd-divider));
  background: var(--pd-panel-bg, var(--pd-main-bg));
  box-shadow: 0 1px 0 color-mix(in srgb, var(--pd-body-fg) 4%, transparent);
  box-sizing: border-box;
}

.calendar-day-panel {
  position: sticky;
  top: 12px;
  display: flex;
  flex-direction: column;
  min-height: 320px;
}

.cal-weekhead {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 4px;
  padding: 0 1px;
}

.cal-weekhead__cell {
  text-align: center;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.08em;
  color: var(--pd-muted-fg);
  line-height: 26px;
}

.cal-weekhead__cell--weekend {
  color: var(--pd-calendar-weekend);
}

.cal-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  margin-bottom: 10px;
  padding: 0 2px 2px;
  font-size: 11px;
  color: var(--pd-muted-fg);
}

.cal-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.cal-legend__dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  box-sizing: border-box;
}

.cal-legend__dot--today {
  background: color-mix(in srgb, var(--pd-body-fg) 6%, var(--pd-main-bg));
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--pd-body-fg) 25%, transparent);
}

.cal-legend__dot--selected {
  background: var(--pd-calendar-dot-selected);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--pd-body-fg) 15%, transparent);
}

.cal-legend__badge {
  min-width: 16px;
  padding: 0 4px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  color: #fff;
  background: var(--pd-sider-btn-bg, var(--pd-body-fg));
}

.plan-calendar {
  width: 100%;
}

.plan-calendar :deep(.n-calendar) {
  width: 100%;
  height: clamp(480px, 68vh, 760px);
}

.plan-calendar :deep(.n-calendar-header) {
  padding: 0 1px 14px;
  border-bottom: 1px solid var(--pd-divider);
  margin-bottom: 10px;
}

.plan-calendar :deep(.n-calendar-header__title) {
  font-size: 18px;
  font-weight: 750;
  letter-spacing: -0.03em;
}

.plan-calendar :deep(.n-calendar-header__extra) {
  gap: 4px;
}

.plan-calendar :deep(.n-calendar-prev-btn),
.plan-calendar :deep(.n-calendar-next-btn) {
  border-radius: 8px !important;
}

.plan-calendar :deep(.n-calendar-dates) {
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
  border: none;
  background: transparent;
}

.plan-calendar :deep(.n-calendar-cell) {
  position: relative;
  display: block;
  min-height: clamp(88px, 11.5vw, 118px);
  padding: 6px 4px 8px;
  border: none;
  border-radius: 12px;
  background: var(--pd-calendar-cell-bg, var(--pd-main-bg));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pd-divider) 90%, transparent);
  transition:
    background 0.15s,
    box-shadow 0.15s;
  cursor: pointer;
  overflow: hidden;
}

.plan-calendar :deep(.n-calendar-cell:hover:not(.n-calendar-cell--selected)) {
  background: var(--pd-calendar-cell-hover, var(--pd-hover-bg));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pd-body-fg) 12%, transparent);
}

.plan-calendar :deep(.n-calendar-cell:focus-visible) {
  outline: 2px solid var(--pd-focus-ring);
  outline-offset: 1px;
}

.plan-calendar :deep(.n-calendar-cell--other-month) {
  opacity: 0.42;
}

.plan-calendar :deep(.n-calendar-cell--other-month:hover) {
  opacity: 0.55;
}

.plan-calendar :deep(.n-calendar-date) {
  position: absolute;
  left: 50%;
  top: 40%;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: max-content;
  height: max-content;
  padding: 0 !important;
  margin: 0;
  line-height: 1;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.plan-calendar :deep(.n-calendar-date__day) {
  display: none !important;
}

.plan-calendar :deep(.n-calendar-date__date) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  margin: 0 !important;
  border-radius: 999px;
  font-size: 19px;
  font-weight: 650;
  letter-spacing: -0.03em;
  background: transparent !important;
  color: var(--pd-body-fg) !important;
  box-shadow: none;
  flex-shrink: 0;
  transition:
    background 0.15s,
    color 0.15s,
    box-shadow 0.15s;
}

.plan-calendar :deep(.n-calendar-cell:nth-child(7n + 6) .n-calendar-date__date),
.plan-calendar :deep(.n-calendar-cell:nth-child(7n + 7) .n-calendar-date__date) {
  color: var(--pd-calendar-weekend) !important;
}

/* 今天（未选中）：浅底 + 细环，避免粗黑空心圈 */
.plan-calendar :deep(.n-calendar-cell--current:not(.n-calendar-cell--selected) .n-calendar-date__date) {
  background: color-mix(in srgb, var(--pd-body-fg) 6%, var(--pd-main-bg)) !important;
  box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--pd-body-fg) 22%, transparent);
  font-weight: 700;
}

.plan-calendar :deep(.n-calendar-cell--current:not(.n-calendar-cell--selected):nth-child(7n + 6) .n-calendar-date__date),
.plan-calendar :deep(.n-calendar-cell--current:not(.n-calendar-cell--selected):nth-child(7n + 7) .n-calendar-date__date) {
  color: var(--pd-calendar-weekend) !important;
  background: color-mix(in srgb, var(--pd-calendar-weekend) 12%, var(--pd-main-bg)) !important;
  box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--pd-calendar-weekend) 40%, transparent);
}

.plan-calendar :deep(.n-calendar-cell--selected) {
  background: var(--pd-calendar-cell-selected, var(--pd-hover-bg));
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--pd-body-fg) 18%, transparent);
}

.plan-calendar :deep(.n-calendar-cell--selected:hover) {
  background: color-mix(in srgb, var(--pd-body-fg) 7%, var(--pd-main-bg));
}

.plan-calendar :deep(.n-calendar-cell--selected .n-calendar-date__date) {
  background: var(--pd-calendar-dot-selected) !important;
  color: var(--pd-calendar-dot-selected-fg) !important;
  font-weight: 700;
  box-shadow: 0 3px 10px color-mix(in srgb, var(--pd-body-fg) 20%, transparent);
}

.plan-calendar :deep(.n-calendar-cell--selected:nth-child(7n + 6) .n-calendar-date__date),
.plan-calendar :deep(.n-calendar-cell--selected:nth-child(7n + 7) .n-calendar-date__date) {
  background: color-mix(in srgb, var(--pd-calendar-weekend) 88%, #7c2d12) !important;
  color: #fff !important;
}

.plan-calendar :deep(.n-calendar-cell--current.n-calendar-cell--selected .n-calendar-date__date) {
  width: 48px;
  height: 48px;
  font-size: 20px;
}

.plan-calendar :deep(.n-calendar-cell--selected .cal-lunar) {
  font-weight: 600;
  color: color-mix(in srgb, var(--pd-body-fg) 75%, var(--pd-muted-fg));
}

.plan-calendar :deep(.n-calendar-cell--selected .cal-lunar--term) {
  color: var(--pd-calendar-term);
}

.plan-calendar :deep(.n-calendar-cell--selected .cal-festival--legal) {
  color: var(--pd-calendar-holiday);
}

.plan-calendar :deep(.n-calendar-cell__bar) {
  display: none;
}

.calendar-day__head {
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--pd-divider);
}

.calendar-day__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
}

.calendar-day__title {
  margin: 0;
  font-size: 22px;
  font-weight: 750;
  letter-spacing: -0.5px;
}

.day-tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.45;
  color: var(--pd-calendar-holiday);
  background: color-mix(in srgb, var(--pd-calendar-holiday) 12%, transparent);
}

.day-tag--legal {
  color: var(--pd-calendar-holiday);
  background: color-mix(in srgb, var(--pd-calendar-holiday) 14%, transparent);
}

.day-tag--work {
  color: var(--pd-muted-fg);
  background: var(--pd-hover-bg);
}

.calendar-day__solar-lunar {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--pd-muted-fg);
}

.calendar-day__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.stat-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: var(--pd-hover-bg);
  color: var(--pd-body-fg);
}

.stat-pill--active {
  background: color-mix(in srgb, var(--pd-sider-btn-bg, var(--pd-body-fg)) 12%, var(--pd-main-bg));
}

.stat-pill--done {
  color: var(--pd-muted-fg);
  font-weight: 500;
}

.calendar-day__hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--pd-muted-fg);
}

.calendar-add-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.calendar-add-plan {
  display: flex;
  align-items: center;
  gap: 10px;
}

.calendar-add-plan__label {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--pd-muted-fg);
}

.calendar-add-plan__select {
  flex: 1;
  min-width: 0;
}

.calendar-add-plan__single {
  margin: 0;
  font-size: 12px;
  color: var(--pd-muted-fg);
}

.calendar-day__done-label {
  margin: 16px 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--pd-muted-fg);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.quick-add {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0 16px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--pd-divider);
  cursor: text;
}

.quick-add--card {
  padding: 10px 12px;
  margin-bottom: 0;
  border: 1px solid var(--pd-divider);
  border-radius: 12px;
  background: var(--pd-hover-bg);
  border-bottom: 1px solid var(--pd-divider);
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
  padding: 32px 0 40px;
  text-align: center;
}

.task-empty--card {
  padding: 28px 16px 32px;
  border-radius: 12px;
  background: var(--pd-hover-bg);
  border: 1px dashed color-mix(in srgb, var(--pd-divider) 120%, transparent);
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
